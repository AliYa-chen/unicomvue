import {
  NETWORK_INFO_URL,
  NETWORK_INTERNATIONAL_TRACE_URL,
  NETWORK_LATENCY_URL,
  NETWORK_REQUEST_TIMEOUT_MS,
} from "@/config/networkStatus";
import { parseNetworkTrace } from "@/domain/networkStatus";
import { withAbortTimeout } from "@/utils/abort";

export async function fetchNetworkInfo(
  signal,
  { ip = "", fetchImpl = globalThis.fetch } = {},
) {
  return withAbortTimeout({
    parentSignal: signal,
    timeoutMs: NETWORK_REQUEST_TIMEOUT_MS,
    task: async (requestSignal) => {
      const url = new URL(NETWORK_INFO_URL);
      if (ip) url.searchParams.set("ip", ip);
      const response = await fetchImpl(url.href, {
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        referrerPolicy: "no-referrer",
        signal: requestSignal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.status !== undefined && payload.status !== 0) {
        throw new Error("网络信息接口返回异常");
      }
      return payload;
    },
  });
}

export async function fetchInternationalTrace(
  signal,
  fetchImpl = globalThis.fetch,
) {
  return withAbortTimeout({
    parentSignal: signal,
    timeoutMs: NETWORK_REQUEST_TIMEOUT_MS,
    task: async (requestSignal) => {
      const startedAt = performance.now();
      const response = await fetchImpl(NETWORK_INTERNATIONAL_TRACE_URL, {
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        referrerPolicy: "no-referrer",
        signal: requestSignal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return {
        ...parseNetworkTrace(await response.text()),
        latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      };
    },
  });
}

export async function measureNetworkLatency(
  signal,
  fetchImpl = globalThis.fetch,
) {
  return withAbortTimeout({
    parentSignal: signal,
    timeoutMs: NETWORK_REQUEST_TIMEOUT_MS,
    task: async (requestSignal) => {
      const url = new URL(NETWORK_LATENCY_URL);
      url.searchParams.set("_", `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const startedAt = performance.now();
      await fetchImpl(url.href, {
        method: "HEAD",
        cache: "no-store",
        credentials: "omit",
        mode: "no-cors",
        referrerPolicy: "no-referrer",
        signal: requestSignal,
      });
      return Math.max(1, Math.round(performance.now() - startedAt));
    },
  });
}
