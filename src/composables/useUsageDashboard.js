import { computed, onScopeDispose, readonly, ref } from "vue";
import { UNICOM_REFRESH_INTERVAL_MS } from "../config/unicom.js";
import { accountDisplayName } from "../domain/accounts.js";
import {
  buildCardsFromOcs,
  extractPackageName,
  formatQciNum,
  formatRateMbps,
} from "../domain/usage.js";
import {
  fetchBasicData,
  fetchQciData,
  fetchUsage,
} from "../services/unicomApi.js";

function getAccountFailure(data, status = 0) {
  if (data?.code === "BLACKLIST" || data?.raw === "999997") {
    return {
      status: "账号被限制(黑名单)，请稍后重试",
      loginMessage: "您的账号被联通限制 (999997)",
    };
  }

  const upstreamTokenFailure = data?.code === "UPSTREAM_NON_JSON"
    && /99999[89]/.test(String(data?.raw || ""));
  if (data?.code === "TOKEN_EXPIRED" || status === 401 || upstreamTokenFailure) {
    return { status: "Token 已失效，请重新登录", loginMessage: "" };
  }

  return null;
}

function assertSuccessfulUsage(data) {
  if (data?.ok === false || (data?.code && String(data.code) !== "0000")) {
    throw new Error(data?.msg || "查询失败");
  }
}

function nowLabel() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function useUsageDashboard(
  { accountStore, notify, onRequireLogin },
  {
    fetchUsage: fetchUsageRequest = fetchUsage,
    fetchBasicData: fetchBasicDataRequest = fetchBasicData,
    fetchQciData: fetchQciDataRequest = fetchQciData,
  } = {},
) {
  const statusText = ref("准备中…");
  const statusKind = ref("info");
  const isLoading = ref(false);
  const lastUpdatedAt = ref("—");
  const signedRate = ref("—");
  const qciLevel = ref("—");
  const usageCards = ref([]);
  const packageName = ref("");
  const hasLimitService = ref(false);
  const paused = ref(false);
  const hasLoaded = ref(false);

  let disposed = false;
  let autoRefreshEnabled = false;
  let refreshTimer = null;
  let activeController = null;
  let requestGeneration = 0;

  const isEmpty = computed(() => hasLoaded.value && usageCards.value.length === 0);

  function setStatus(message, kind = "info") {
    statusText.value = String(message || "");
    statusKind.value = kind;
  }

  function clearRefreshTimer() {
    if (refreshTimer !== null) clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  function scheduleRefresh() {
    clearRefreshTimer();
    if (!autoRefreshEnabled || paused.value || disposed) return;

    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refresh();
    }, UNICOM_REFRESH_INTERVAL_MS);
  }

  function resetDashboard() {
    packageName.value = "";
    usageCards.value = [];
    hasLoaded.value = false;
    lastUpdatedAt.value = "—";
    signedRate.value = "—";
    qciLevel.value = "—";
    hasLimitService.value = false;
  }

  function abortRefresh() {
    requestGeneration += 1;
    activeController?.abort();
    activeController = null;
    isLoading.value = false;
  }

  function removeInvalidAccount(failure) {
    const removed = accountStore.removeActiveAccount();
    resetDashboard();
    setStatus(failure.status, "error");

    if (accountStore.hasAccounts.value) {
      notify(`${accountDisplayName(removed)} 已移除，正在切换账号`);
      return true;
    }

    onRequireLogin(failure.loginMessage);
    return false;
  }

  function assertCurrentRequest(generation, token, signal) {
    return !disposed
      && !signal.aborted
      && generation === requestGeneration
      && token === accountStore.ecsToken.value;
  }

  function applyBasicData(data) {
    if (String(data?.code || "") !== "0000") return false;

    accountStore.updateActiveAccountMobile(data?.mobile);
    if (typeof data?.rate_mbps === "number" && data.rate_mbps > 0) {
      signedRate.value = formatRateMbps(data.rate_mbps);
    } else if (data?.rate_is_lte === true) {
      signedRate.value = "LTE";
    } else {
      signedRate.value = "—";
    }
    return data?.rate_is_lte === true;
  }

  function applyQciData(data, basicIsLte) {
    if (String(data?.code || "") !== "0000") return;

    qciLevel.value = formatQciNum(data?.qci_num);
    hasLimitService.value = data?.has_limit_service === true;
    if (basicIsLte && typeof data?.max_net_mbps === "number" && data.max_net_mbps > 0) {
      signedRate.value = formatRateMbps(data.max_net_mbps);
    }
  }

  async function refresh() {
    clearRefreshTimer();
    const token = accountStore.ecsToken.value;

    if (!token) {
      setStatus("未登录", "info");
      onRequireLogin("");
      scheduleRefresh();
      return;
    }

    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    const generation = ++requestGeneration;
    let refreshNextAccount = false;

    isLoading.value = true;
    setStatus("请求中…", "info");

    try {
      const usage = await fetchUsageRequest(token, controller.signal);
      if (!assertCurrentRequest(generation, token, controller.signal)) return;

      const usageFailure = getAccountFailure(usage);
      if (usageFailure) {
        refreshNextAccount = removeInvalidAccount(usageFailure);
        return;
      }

      assertSuccessfulUsage(usage);
      const nextPackageName = extractPackageName(usage);
      packageName.value = nextPackageName;
      accountStore.updateAccountPackageName(token, nextPackageName);
      usageCards.value = buildCardsFromOcs(usage);
      hasLoaded.value = true;

      const [basicResult, qciResult] = await Promise.allSettled([
        fetchBasicDataRequest(token, controller.signal),
        fetchQciDataRequest(token, controller.signal),
      ]);
      if (!assertCurrentRequest(generation, token, controller.signal)) return;

      for (const result of [basicResult, qciResult]) {
        const data = result.status === "fulfilled" ? result.value : result.reason?.data;
        const status = result.status === "rejected" ? result.reason?.status : 0;
        const failure = getAccountFailure(data, status);
        if (!failure) continue;
        refreshNextAccount = removeInvalidAccount(failure);
        return;
      }

      const basicIsLte = basicResult.status === "fulfilled"
        ? applyBasicData(basicResult.value)
        : false;
      if (qciResult.status === "fulfilled") applyQciData(qciResult.value, basicIsLte);

      lastUpdatedAt.value = nowLabel();
      setStatus("已刷新", "ok");
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (!assertCurrentRequest(generation, token, controller.signal)) return;
      const failure = getAccountFailure(error?.data, error?.status);
      if (failure) refreshNextAccount = removeInvalidAccount(failure);
      else if (!disposed) setStatus(error?.message || "查询失败", "error");
    } finally {
      if (generation === requestGeneration) {
        activeController = null;
        isLoading.value = false;
        if (refreshNextAccount && !disposed) void refresh();
        else scheduleRefresh();
      }
    }
  }

  function selectAccount(accountId) {
    if (accountId === accountStore.activeAccountId.value) return false;
    if (!accountStore.selectAccount(accountId)) return false;
    abortRefresh();
    resetDashboard();
    setStatus("正在切换账号…", "info");
    void refresh();
    return true;
  }

  function removeCurrentAccount() {
    const removed = accountStore.removeActiveAccount();
    if (!removed) return null;

    abortRefresh();
    resetDashboard();
    if (accountStore.hasAccounts.value) {
      setStatus("已切换账号", "info");
      notify(`${accountDisplayName(removed)} 已从本机移除`);
      void refresh();
    } else {
      setStatus("未登录", "info");
      notify("账号已从本机移除");
      onRequireLogin("");
    }
    return removed;
  }

  function togglePaused() {
    paused.value = !paused.value;
    setStatus(paused.value ? "自动刷新已暂停" : "自动刷新已恢复", "info");
    if (paused.value) clearRefreshTimer();
    else scheduleRefresh();
  }

  function startAutoRefresh() {
    autoRefreshEnabled = true;
    void refresh();
  }

  function stopAutoRefresh() {
    autoRefreshEnabled = false;
    clearRefreshTimer();
    abortRefresh();
  }

  onScopeDispose(() => {
    disposed = true;
    stopAutoRefresh();
  });

  return {
    statusText: readonly(statusText),
    statusKind: readonly(statusKind),
    isLoading: readonly(isLoading),
    lastUpdatedAt: readonly(lastUpdatedAt),
    signedRate: readonly(signedRate),
    qciLevel: readonly(qciLevel),
    usageCards: readonly(usageCards),
    packageName: readonly(packageName),
    hasLimitService: readonly(hasLimitService),
    paused: readonly(paused),
    hasLoaded: readonly(hasLoaded),
    isEmpty,
    setStatus,
    resetDashboard,
    refresh,
    selectAccount,
    removeCurrentAccount,
    togglePaused,
    startAutoRefresh,
    stopAutoRefresh,
  };
}
