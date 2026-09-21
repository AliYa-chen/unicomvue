import {
  computed,
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
} from "vue";
import {
  NETWORK_INFO_REFRESH_MS,
  NETWORK_INFO_RETRY_MS,
  NETWORK_INFO_URL,
  NETWORK_INTERNATIONAL_TRACE_URL,
  NETWORK_LATENCY_INITIAL_SAMPLES,
  NETWORK_LATENCY_INTERVAL_MS,
  NETWORK_LATENCY_SAMPLE_GAP_MS,
  NETWORK_LATENCY_URL,
  NETWORK_REQUEST_TIMEOUT_MS,
} from "@/config/networkStatus";

const CONNECTION_LABELS = Object.freeze({
  bluetooth: "蓝牙网络",
  cellular: "移动网络",
  ethernet: "有线网络",
  wifi: "Wi-Fi",
  wimax: "WiMAX",
});
const EMPTY_PROFILE = Object.freeze({
  locationLabel: "",
  carrierLabel: "",
  networkTypeLabel: "",
  routeKind: "unknown",
  routeLabel: "",
});

function cleanText(value, maximumLength = 48) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function uniqueText(values) {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))];
}

function connectionLabel(apiType = "") {
  const explicitType = cleanText(apiType, 24);
  if (explicitType) return explicitType;

  const type = cleanText(globalThis.navigator?.connection?.type, 20).toLowerCase();
  return CONNECTION_LABELS[type] || "";
}

function unwrapPayload(payload) {
  return payload?.status === 0 && payload?.data ? payload.data : payload;
}

function payloadIp(payload) {
  return cleanText(unwrapPayload(payload)?.ip, 64);
}

function regionName(countryCode) {
  if (!countryCode || typeof Intl.DisplayNames !== "function") return "";
  try {
    return cleanText(new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(countryCode), 32);
  } catch {
    return "";
  }
}

function normalizeProfile(payload, countryCodeHint = "") {
  const data = unwrapPayload(payload);
  const hintedCode = cleanText(countryCodeHint, 8).toUpperCase();
  const actualCountry = data?.country?.code ? data.country : null;
  const registeredCountry = data?.registered_country;
  const countryCode = cleanText(
    actualCountry?.code || hintedCode || registeredCountry?.code,
    8,
  ).toUpperCase();
  const international = Boolean(countryCode && countryCode !== "CN");
  const shortRegions = Array.isArray(data?.regions_short)
    ? data.regions_short
    : Array.isArray(data?.geo_cn?.division?.short)
      ? data.geo_cn.division.short
      : [];
  const fullRegions = Array.isArray(data?.regions) ? data.regions : [];
  const fallbackRegions = [data?.subdivision, data?.city, data?.area];
  const regions = uniqueText(
    shortRegions.length ? shortRegions : fullRegions.length ? fullRegions : fallbackRegions,
  ).slice(0, 3);
  const countryName = cleanText(
    actualCountry?.name
    || (hintedCode ? regionName(hintedCode) : "")
    || registeredCountry?.name,
    32,
  );
  const locationParts = international
    ? uniqueText([countryName, ...regions])
    : regions;
  const carrier = cleanText(
    data?.geo_cn?.isp
    || data?.as?.info
    || data?.as?.name,
  );

  return {
    locationLabel: locationParts.join(" "),
    carrierLabel: carrier,
    networkTypeLabel: connectionLabel(data?.type),
    routeKind: countryCode === "CN" ? "domestic" : international ? "international" : "unknown",
    routeLabel: international ? "国际线路" : "",
  };
}

function hasProfileDetails(profile) {
  return Boolean(
    profile?.locationLabel
    || profile?.carrierLabel
    || profile?.networkTypeLabel
  );
}

function parseTrace(body) {
  const fields = {};
  for (const line of String(body || "").split("\n")) {
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    fields[line.slice(0, separator)] = line.slice(separator + 1).trim();
  }
  return {
    ip: cleanText(fields.ip, 64),
    countryCode: cleanText(fields.loc, 8).toUpperCase(),
  };
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  return Math.round(sorted[Math.floor(sorted.length / 2)]);
}

function waitWithSignal(delayMs, signal) {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(finish, delayMs);
    function finish() {
      signal.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function fetchWithTimeout(url, options, parentSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, NETWORK_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abort);
  }
}

async function fetchNetworkInfo(signal, ip = "") {
  const url = new URL(NETWORK_INFO_URL);
  if (ip) url.searchParams.set("ip", ip);
  const response = await fetchWithTimeout(url.href, {
    cache: "no-store",
    credentials: "omit",
    mode: "cors",
    referrerPolicy: "no-referrer",
  }, signal);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.status !== undefined && payload.status !== 0) {
    throw new Error("网络信息接口返回异常");
  }
  return payload;
}

async function fetchInternationalTrace(signal) {
  const url = new URL(NETWORK_INTERNATIONAL_TRACE_URL);
  url.searchParams.set("_", `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const response = await fetchWithTimeout(url.href, {
    cache: "no-store",
    credentials: "omit",
    mode: "cors",
    referrerPolicy: "no-referrer",
  }, signal);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseTrace(await response.text());
}

async function measureLatency(signal, routeKind) {
  const international = routeKind === "international";
  const target = international ? NETWORK_INTERNATIONAL_TRACE_URL : NETWORK_LATENCY_URL;
  const url = new URL(target);
  url.searchParams.set("_", `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const startedAt = performance.now();
  await fetchWithTimeout(url.href, {
    method: international ? "GET" : "HEAD",
    cache: "no-store",
    credentials: "omit",
    mode: international ? "cors" : "no-cors",
    referrerPolicy: "no-referrer",
  }, signal);
  return Math.max(1, Math.round(performance.now() - startedAt));
}

export function useNetworkStatus() {
  const profile = ref({ ...EMPTY_PROFILE, networkTypeLabel: connectionLabel() });
  const latencyMs = ref(null);
  const profileLoading = ref(false);
  const latencyLoading = ref(false);
  const profileError = ref("");
  const latencyError = ref("");
  const offline = ref(globalThis.navigator?.onLine === false);

  let profileUpdatedAt = 0;
  let latencySamples = [];
  let profileTimer = null;
  let latencyTimer = null;
  let profileController = null;
  let latencyController = null;
  let runGeneration = 0;
  let disposed = false;

  const hasProfile = computed(() => hasProfileDetails(profile.value));
  const loading = computed(() => (
    !offline.value
    && (
      (latencyMs.value === null && latencyLoading.value)
      || (!hasProfile.value && profileLoading.value)
    )
  ));
  const failed = computed(() => (
    !offline.value
    && !loading.value
    && Boolean(profileError.value || latencyError.value)
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
    profileTimer = null;
    latencyTimer = null;
  }

  function stopRequests() {
    runGeneration += 1;
    clearTimers();
    profileController?.abort();
    latencyController?.abort();
    profileController = null;
    latencyController = null;
    profileLoading.value = false;
    latencyLoading.value = false;
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

  async function refreshProfile(force = false, generation = runGeneration) {
    if (!shouldRun() || generation !== runGeneration) return;
    if (!force && profileUpdatedAt && Date.now() - profileUpdatedAt < NETWORK_INFO_REFRESH_MS) {
      const detectedType = connectionLabel();
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
      const [directResult, traceResult] = await Promise.allSettled([
        fetchNetworkInfo(controller.signal),
        fetchInternationalTrace(controller.signal),
      ]);
      if (generation !== runGeneration || controller.signal.aborted) return;

      const directPayload = directResult.status === "fulfilled" ? directResult.value : null;
      const directProfile = directPayload ? normalizeProfile(directPayload) : null;
      const trace = traceResult.status === "fulfilled" ? traceResult.value : null;
      let internationalProfile = null;

      if (trace?.ip) {
        try {
          const tracePayload = trace.ip === payloadIp(directPayload)
            ? directPayload
            : await fetchNetworkInfo(controller.signal, trace.ip);
          internationalProfile = tracePayload
            ? normalizeProfile(tracePayload, trace.countryCode)
            : null;
        } catch {
          // The direct profile remains a valid fallback when the trace lookup fails.
        }
      }

      const nextProfile = internationalProfile?.routeKind === "international"
        ? internationalProfile
        : hasProfileDetails(directProfile)
          ? directProfile
          : internationalProfile;
      if (!hasProfileDetails(nextProfile)) throw new Error("网络信息查询失败");

      const routeChanged = profile.value.routeKind !== nextProfile.routeKind;
      const hadLatencyActivity = Boolean(
        latencyController
        || latencyTimer !== null
        || latencyMs.value !== null,
      );
      profile.value = nextProfile;
      profileUpdatedAt = Date.now();
      profileError.value = "";
      if (routeChanged) {
        if (latencyTimer !== null) clearTimeout(latencyTimer);
        latencyTimer = null;
        latencyController?.abort();
        latencyController = null;
        latencySamples = [];
        latencyMs.value = null;
        if (hadLatencyActivity) {
          queueMicrotask(() => {
            if (shouldRun() && generation === runGeneration) void runLatencyCycle(generation);
          });
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && generation === runGeneration) {
        profileError.value = error?.message || "网络信息查询失败";
      }
    } finally {
      if (profileController === controller) profileController = null;
      if (generation === runGeneration) profileLoading.value = false;
      if (!controller.signal.aborted) scheduleProfileRefresh(generation);
    }
  }

  async function runLatencyCycle(generation = runGeneration) {
    if (!shouldRun() || generation !== runGeneration) return;
    latencyController?.abort();
    const controller = new AbortController();
    latencyController = controller;
    latencyLoading.value = latencyMs.value === null;
    latencyError.value = "";
    const sampleCount = latencyMs.value === null ? NETWORK_LATENCY_INITIAL_SAMPLES : 1;
    const samples = [];

    try {
      // The first request establishes DNS/TLS and is intentionally not shown.
      if (latencyMs.value === null) {
        await measureLatency(controller.signal, profile.value.routeKind);
      }
      for (let index = 0; index < sampleCount; index += 1) {
        if (index) await waitWithSignal(NETWORK_LATENCY_SAMPLE_GAP_MS, controller.signal);
        samples.push(await measureLatency(controller.signal, profile.value.routeKind));
      }
      if (generation !== runGeneration || controller.signal.aborted) return;
      latencySamples = [...latencySamples, ...samples].slice(-NETWORK_LATENCY_INITIAL_SAMPLES);
      latencyMs.value = median(latencySamples);
    } catch (error) {
      if (!controller.signal.aborted && generation === runGeneration) {
        latencySamples = [];
        latencyMs.value = null;
        latencyError.value = error?.message || "网络延迟测量失败";
      }
    } finally {
      if (latencyController === controller) latencyController = null;
      if (generation === runGeneration) latencyLoading.value = false;
      if (!controller.signal.aborted && shouldRun() && generation === runGeneration) {
        latencyTimer = setTimeout(
          () => {
            latencyTimer = null;
            void runLatencyCycle(generation);
          },
          NETWORK_LATENCY_INTERVAL_MS,
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
      profile.value = { ...EMPTY_PROFILE, networkTypeLabel: connectionLabel() };
      profileUpdatedAt = 0;
      profileError.value = "";
      latencySamples = [];
      latencyMs.value = null;
    }
    void refreshProfile(forceProfile, generation).finally(() => {
      if (
        shouldRun()
        && generation === runGeneration
        && !latencyController
        && latencyTimer === null
      ) {
        void runLatencyCycle(generation);
      }
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
    latencySamples = [];
    latencyMs.value = null;
    stopRequests();
  }

  function handleConnectionChange() {
    if (shouldRun()) startMonitoring({ forceProfile: true, resetProfile: true });
  }

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
    loading,
    failed,
    offline: readonly(offline),
    profileError: readonly(profileError),
    latencyError: readonly(latencyError),
    refresh,
  };
}
