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
  medianMeasurement,
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

  function commitProfile(nextProfile, generation, { resolved = false } = {}) {
    if (!nextProfile || generation !== runGeneration) return;
    const routeChanged = currentRouteKind !== nextProfile.routeKind;
    currentRouteKind = nextProfile.routeKind;
    profile.value = nextProfile;
    if (resolved) {
      profileResolvedOnce.value = true;
      profileUpdatedAt = Date.now();
    }
    profileError.value = "";
    if (routeChanged) resetLatencyTarget(generation);
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
    traceOverride = currentTrace,
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
    const trace = traceOverride;
    const requestedTraceFingerprint = networkTraceFingerprint(trace);

    try {
      const payload = await fetchNetworkInfo(controller.signal, trace?.ip || "");
      if (generation !== runGeneration || controller.signal.aborted) return;
      if (requestedTraceFingerprint !== networkTraceFingerprint(currentTrace)) return;

      const normalizedProfile = normalizeNetworkProfile(
        payload,
        trace?.countryCode,
        globalThis.navigator?.connection?.type,
      );
      const tracedRouteKind = routeKindFromCountryCode(trace?.countryCode);
      const nextProfile = tracedRouteKind === "unknown"
        ? normalizedProfile
        : {
            ...normalizedProfile,
            routeKind: tracedRouteKind,
            routeLabel: tracedRouteKind === "international" ? "国际线路" : "",
          };
      if (!hasNetworkProfileDetails(nextProfile)) throw new Error("网络信息查询失败");
      commitProfile(nextProfile, generation, { resolved: true });
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
      const detectedRouteKind = routeKindFromCountryCode(trace.countryCode);
      if (
        detectedRouteKind !== "unknown"
        && currentRouteKind !== detectedRouteKind
      ) {
        currentRouteKind = detectedRouteKind;
        resetLatencyTarget(generation);
      }

      if (detectedRouteKind === "international") recordLatency(trace.latencyMs);
      if (traceChanged) {
        void refreshProfile(true, generation, trace);
      }
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
