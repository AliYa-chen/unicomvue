import {
  computed,
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  watch,
} from "vue";
import {
  NETWORK_INFO_REFRESH_MS,
  NETWORK_INFO_RETRY_MS,
  NETWORK_LATENCY_INITIAL_SAMPLES,
  NETWORK_LATENCY_INTERVAL_MS,
  NETWORK_LOADING_DELAY_MS,
  NETWORK_ROUTE_INTERVAL_MS,
} from "@/config/networkStatus";
import {
  EMPTY_NETWORK_PROFILE,
  hasNetworkProfileDetails,
  INTERNATIONAL_ROUTE_LABEL,
  isSamePublicIp,
  medianMeasurement,
  networkRegionName,
  networkTraceFingerprint,
  normalizeNetworkProfile,
  resolveConnectionLabel,
  routeKindFromCountryCode,
} from "@/domain/networkStatus";
import {
  fetchInternationalTrace,
  fetchNetworkInfo,
  measureNetworkLatency,
} from "@/services/networkStatus";
import { getErrorMessage } from "@/utils/errors";

function currentConnectionLabel(apiType = "") {
  return resolveConnectionLabel(apiType, globalThis.navigator?.connection?.type);
}

function nextPollDelay(startedAt, intervalMs) {
  return Math.max(0, intervalMs - (performance.now() - startedAt));
}

const MAX_CLOUDFLARE_PROFILES = 8;
const MAX_CLOUDFLARE_QUERIES = 2;

export function useNetworkStatus() {
  const profile = ref({
    ...EMPTY_NETWORK_PROFILE,
    networkTypeLabel: currentConnectionLabel(),
  });
  const latencyMs = ref(null);
  const profileLoading = ref(false);
  const latencyLoading = ref(false);
  const profileError = ref("");
  const latencyError = ref("");
  const offline = ref(globalThis.navigator?.onLine === false);
  const loading = ref(false);
  const profileResolvedOnce = ref(false);

  let profileUpdatedAt = 0;
  let localProfile = null;
  const cloudflareProfiles = new Map();
  const cloudflareProfileControllers = new Map();
  const cloudflareRetryAt = new Map();
  let latencySamples = [];
  let latencyWarmupNeeded = true;
  let currentRouteKind = "unknown";
  let currentTrace = null;
  let profileTimer = null;
  let latencyTimer = null;
  let routeTimer = null;
  let profileController = null;
  let latencyController = null;
  let routeController = null;
  let loadingDelayTimer = null;
  let runGeneration = 0;
  let disposed = false;

  const requestPending = computed(() => (
    !offline.value
    && (profileLoading.value || latencyLoading.value)
  ));
  const failed = computed(() => (
    !offline.value
    && !loading.value
    && !profileResolvedOnce.value
    && !profileLoading.value
    && Boolean(profileError.value)
  ));

  function shouldRun() {
    return Boolean(
      !disposed
      && globalThis.navigator?.onLine !== false
    );
  }

  function clearTimers() {
    if (profileTimer !== null) clearTimeout(profileTimer);
    if (latencyTimer !== null) clearTimeout(latencyTimer);
    if (routeTimer !== null) clearTimeout(routeTimer);
    if (loadingDelayTimer !== null) clearTimeout(loadingDelayTimer);
    profileTimer = null;
    latencyTimer = null;
    routeTimer = null;
    loadingDelayTimer = null;
  }

  function stopRequests() {
    runGeneration += 1;
    clearTimers();
    profileController?.abort();
    for (const controller of cloudflareProfileControllers.values()) controller.abort();
    cloudflareProfileControllers.clear();
    latencyController?.abort();
    routeController?.abort();
    profileController = null;
    latencyController = null;
    routeController = null;
    profileLoading.value = false;
    latencyLoading.value = false;
    loading.value = false;
  }

  function scheduleProfileRefresh(generation) {
    if (!shouldRun() || generation !== runGeneration) return;
    if (profileTimer !== null) clearTimeout(profileTimer);
    const delay = profileError.value ? NETWORK_INFO_RETRY_MS : NETWORK_INFO_REFRESH_MS;
    profileTimer = setTimeout(() => {
      profileTimer = null;
      void refreshProfile(true, generation);
    }, delay);
  }

  function startLatencyIfNeeded(generation) {
    if (
      shouldRun()
      && generation === runGeneration
      && currentRouteKind !== "international"
      && !latencyController
      && latencyTimer === null
    ) {
      queueMicrotask(() => {
        if (
          shouldRun()
          && generation === runGeneration
          && currentRouteKind !== "international"
          && !latencyController
          && latencyTimer === null
        ) {
          void runLatencyCycle(generation);
        }
      });
    }
  }

  function resetLatencyTarget(generation) {
    if (latencyTimer !== null) clearTimeout(latencyTimer);
    latencyTimer = null;
    latencyController?.abort();
    latencyController = null;
    latencySamples = [];
    latencyWarmupNeeded = true;
    latencyError.value = "";
    latencyLoading.value = false;
    startLatencyIfNeeded(generation);
  }

  function syncVisibleProfile(generation) {
    if (generation !== runGeneration) return;
    const trace = currentTrace;
    const fingerprint = networkTraceFingerprint(trace);
    const currentCloudflareProfile = cloudflareProfiles.get(fingerprint) || null;
    const traceRouteKind = routeKindFromCountryCode(trace?.countryCode);
    // A domestic dual-stack connection may use different IPv4/IPv6 exits at
    // Netart and Cloudflare. Keep valid local CN details until the Cloudflare
    // IP lookup resolves, but never borrow them for an international trace.
    const matchingLocalProfile = localProfile && (
      !trace?.ip
      || isSamePublicIp(localProfile.publicIp, trace.ip)
      || (traceRouteKind === "domestic" && localProfile.routeKind === "domestic")
    ) ? localProfile : null;
    const selectedProfile = currentCloudflareProfile || matchingLocalProfile;
    const confirmedRouteKind = currentCloudflareProfile?.routeKind;
    const nextRouteKind = (confirmedRouteKind && confirmedRouteKind !== "unknown"
      ? confirmedRouteKind
      : null)
      || (traceRouteKind !== "unknown" ? traceRouteKind : null)
      || selectedProfile?.routeKind
      || localProfile?.routeKind
      || "unknown";
    const routeChanged = currentRouteKind !== nextRouteKind;
    currentRouteKind = nextRouteKind;
    profile.value = {
      ...(selectedProfile || (!trace?.ip ? localProfile : null) || EMPTY_NETWORK_PROFILE),
      publicIp: selectedProfile?.publicIp || trace?.ip || localProfile?.publicIp || "",
      locationLabel: selectedProfile?.locationLabel
        || (nextRouteKind === "international" ? networkRegionName(trace?.countryCode) : ""),
      carrierLabel: selectedProfile?.carrierLabel || "",
      networkTypeLabel: selectedProfile?.networkTypeLabel
        || localProfile?.networkTypeLabel
        || currentConnectionLabel(),
      routeKind: nextRouteKind,
      routeLabel: nextRouteKind === "international" ? INTERNATIONAL_ROUTE_LABEL : "",
    };
    if (routeChanged) resetLatencyTarget(generation);
  }

  async function refreshCloudflareProfile(trace, generation) {
    const fingerprint = networkTraceFingerprint(trace);
    if (
      !shouldRun()
      || generation !== runGeneration
      || !trace.ip
      || !fingerprint
      || cloudflareProfiles.has(fingerprint)
      || cloudflareProfileControllers.has(fingerprint)
      || cloudflareProfileControllers.size >= MAX_CLOUDFLARE_QUERIES
      || Date.now() < (cloudflareRetryAt.get(fingerprint) || 0)
    ) return;

    const controller = new AbortController();
    cloudflareProfileControllers.set(fingerprint, controller);
    try {
      const payload = await fetchNetworkInfo(controller.signal, { ip: trace.ip });
      if (generation !== runGeneration || controller.signal.aborted) return;
      const nextProfile = normalizeNetworkProfile(
        payload,
        trace.countryCode,
        globalThis.navigator?.connection?.type,
      );
      if (!isSamePublicIp(nextProfile.publicIp, trace.ip)
        || !hasNetworkProfileDetails(nextProfile)) {
        throw new Error("Cloudflare 出口信息查询失败");
      }
      cloudflareProfiles.set(fingerprint, nextProfile);
      if (cloudflareProfiles.size > MAX_CLOUDFLARE_PROFILES) {
        cloudflareProfiles.delete(cloudflareProfiles.keys().next().value);
      }
      cloudflareRetryAt.delete(fingerprint);
      if (fingerprint === networkTraceFingerprint(currentTrace)) {
        profileResolvedOnce.value = true;
        syncVisibleProfile(generation);
        if (currentRouteKind === "international") recordLatency(currentTrace.latencyMs);
      }
    } catch {
      if (!controller.signal.aborted && generation === runGeneration) {
        cloudflareRetryAt.set(fingerprint, Date.now() + NETWORK_INFO_RETRY_MS);
        if (cloudflareRetryAt.size > MAX_CLOUDFLARE_PROFILES) {
          cloudflareRetryAt.delete(cloudflareRetryAt.keys().next().value);
        }
      }
    } finally {
      if (cloudflareProfileControllers.get(fingerprint) === controller) {
        cloudflareProfileControllers.delete(fingerprint);
      }
    }
  }

  function recordLatency(sample) {
    if (!Number.isFinite(sample)) return;
    latencySamples = [...latencySamples, sample].slice(-NETWORK_LATENCY_INITIAL_SAMPLES);
    latencyWarmupNeeded = false;
    latencyMs.value = medianMeasurement(latencySamples);
    latencyError.value = "";
    latencyLoading.value = false;
  }

  async function refreshProfile(
    force = false,
    generation = runGeneration,
  ) {
    if (!shouldRun() || generation !== runGeneration) return;
    if (!force && profileUpdatedAt && Date.now() - profileUpdatedAt < NETWORK_INFO_REFRESH_MS) {
      const detectedType = currentConnectionLabel();
      if (detectedType) profile.value = { ...profile.value, networkTypeLabel: detectedType };
      return;
    }

    if (profileTimer !== null) clearTimeout(profileTimer);
    profileTimer = null;
    profileController?.abort();
    const controller = new AbortController();
    profileController = controller;
    profileLoading.value = true;
    profileError.value = "";

    try {
      const payload = await fetchNetworkInfo(controller.signal);
      if (generation !== runGeneration || controller.signal.aborted) return;
      const normalizedProfile = normalizeNetworkProfile(
        payload,
        "",
        globalThis.navigator?.connection?.type,
      );
      if (!normalizedProfile.publicIp || !hasNetworkProfileDetails(normalizedProfile)) {
        throw new Error("网络信息查询失败");
      }
      localProfile = normalizedProfile;
      profileResolvedOnce.value = true;
      profileUpdatedAt = Date.now();
      profileError.value = "";
      syncVisibleProfile(generation);
    } catch (error) {
      if (!controller.signal.aborted && generation === runGeneration) {
        profileError.value = getErrorMessage(error, "网络信息查询失败");
      }
    } finally {
      if (profileController === controller) {
        profileController = null;
        if (generation === runGeneration) profileLoading.value = false;
      }
      if (!controller.signal.aborted) scheduleProfileRefresh(generation);
    }
  }

  async function runRouteCycle(generation = runGeneration) {
    if (!shouldRun() || generation !== runGeneration) return;
    const cycleStartedAt = performance.now();
    routeController?.abort();
    const controller = new AbortController();
    routeController = controller;

    try {
      const trace = await fetchInternationalTrace(controller.signal);
      if (generation !== runGeneration || controller.signal.aborted) return;

      const previousFingerprint = networkTraceFingerprint(currentTrace);
      const nextFingerprint = networkTraceFingerprint(trace);
      currentTrace = trace;
      const traceChanged = Boolean(
        nextFingerprint
        && nextFingerprint !== previousFingerprint
      );
      if (traceChanged) syncVisibleProfile(generation);
      if (currentRouteKind === "international") recordLatency(trace.latencyMs);
      // Netart's direct IP and Cloudflare's VPN/proxy exit can differ. Query
      // the latter once per fingerprint, retrying failures with a backoff.
      void refreshCloudflareProfile(trace, generation);
    } catch {
      // Keep the last known route while a transient high-frequency probe fails.
    } finally {
      if (routeController === controller) routeController = null;
      if (!controller.signal.aborted && shouldRun() && generation === runGeneration) {
        routeTimer = setTimeout(() => {
          routeTimer = null;
          void runRouteCycle(generation);
        }, nextPollDelay(cycleStartedAt, NETWORK_ROUTE_INTERVAL_MS));
      }
    }
  }

  async function runLatencyCycle(generation = runGeneration) {
    if (
      !shouldRun()
      || generation !== runGeneration
      || currentRouteKind === "international"
    ) return;
    const cycleStartedAt = performance.now();
    latencyController?.abort();
    const controller = new AbortController();
    latencyController = controller;
    latencyLoading.value = true;
    latencyError.value = "";
    try {
      // The first request establishes DNS/TLS and is intentionally not shown.
      if (latencyWarmupNeeded) {
        await measureNetworkLatency(controller.signal);
      }
      const sample = await measureNetworkLatency(controller.signal);
      if (generation !== runGeneration || controller.signal.aborted) return;
      recordLatency(sample);
    } catch (error) {
      if (!controller.signal.aborted && generation === runGeneration) {
        latencyError.value = getErrorMessage(error, "网络延迟测量失败");
      }
    } finally {
      if (latencyController === controller) {
        latencyController = null;
        if (generation === runGeneration) latencyLoading.value = false;
      }
      if (
        !controller.signal.aborted
        && shouldRun()
        && generation === runGeneration
        && currentRouteKind !== "international"
      ) {
        latencyTimer = setTimeout(
          () => {
            latencyTimer = null;
            void runLatencyCycle(generation);
          },
          nextPollDelay(cycleStartedAt, NETWORK_LATENCY_INTERVAL_MS),
        );
      }
    }
  }

  function startMonitoring({ forceProfile = false, resetProfile = false } = {}) {
    if (!shouldRun()) return;
    stopRequests();
    const generation = runGeneration;
    offline.value = false;
    if (resetProfile) {
      profile.value = {
        ...profile.value,
        networkTypeLabel: currentConnectionLabel() || profile.value.networkTypeLabel,
      };
      profileUpdatedAt = 0;
      profileError.value = "";
      localProfile = null;
      cloudflareProfiles.clear();
      cloudflareRetryAt.clear();
      currentRouteKind = "unknown";
      currentTrace = null;
      latencySamples = [];
      latencyWarmupNeeded = true;
      latencyError.value = "";
    }
    void runRouteCycle(generation);
    void refreshProfile(forceProfile, generation).finally(() => {
      startLatencyIfNeeded(generation);
    });
  }

  function refresh() {
    startMonitoring({ forceProfile: true });
  }

  function handleOnline() {
    offline.value = false;
    startMonitoring({ forceProfile: true, resetProfile: true });
  }

  function handleOffline() {
    offline.value = true;
    currentRouteKind = "unknown";
    currentTrace = null;
    cloudflareProfiles.clear();
    cloudflareRetryAt.clear();
    latencySamples = [];
    latencyWarmupNeeded = true;
    latencyMs.value = null;
    stopRequests();
  }

  function handleConnectionChange() {
    if (shouldRun()) startMonitoring({ forceProfile: true, resetProfile: true });
  }

  function syncLoadingVisibility() {
    if (loadingDelayTimer !== null) clearTimeout(loadingDelayTimer);
    loadingDelayTimer = null;

    if (offline.value || !requestPending.value) {
      loading.value = false;
      return;
    }

    if (!profileResolvedOnce.value && profileLoading.value) {
      loading.value = true;
      return;
    }

    // Once a snapshot exists, keep rendering it while requests refresh in the
    // background. Only expose a loading state for an unusually slow refresh.
    loading.value = false;
    const generation = runGeneration;
    loadingDelayTimer = setTimeout(() => {
      loadingDelayTimer = null;
      if (
        !disposed
        && generation === runGeneration
        && requestPending.value
        && !offline.value
      ) {
        loading.value = true;
      }
    }, NETWORK_LOADING_DELAY_MS);
  }

  watch(
    [requestPending, profileResolvedOnce, offline],
    syncLoadingVisibility,
    { immediate: true, flush: "sync" },
  );

  if (shouldRun()) startMonitoring();
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  globalThis.navigator?.connection?.addEventListener?.("change", handleConnectionChange);

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true;
      stopRequests();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      globalThis.navigator?.connection?.removeEventListener?.("change", handleConnectionChange);
    });
  }

  return {
    profile: readonly(profile),
    latencyMs: readonly(latencyMs),
    loading: readonly(loading),
    failed,
    offline: readonly(offline),
    profileError: readonly(profileError),
    latencyError: readonly(latencyError),
    refresh,
  };
}
