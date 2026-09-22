import { UNICOM_API_ENDPOINTS } from "@/config/unicom";
import {
  SPEED_TEST_NODE_MAX_RESPONSE_BYTES,
  SPEED_TEST_NODE_REQUEST_TIMEOUT_MS,
} from "@/config/speedTest";
import { normalizeSpeedTestNodeResponse } from "@/domain/speedTestNodes";
import { withAbortTimeout } from "@/utils/abort";

export async function fetchSpeedTestNodes({ signal, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("当前环境不支持网络请求");

  return withAbortTimeout({
    parentSignal: signal,
    timeoutMs: SPEED_TEST_NODE_REQUEST_TIMEOUT_MS,
    task: (requestSignal) => fetchAndNormalizeSpeedTestNodes(fetchImpl, requestSignal),
  });
}

async function fetchAndNormalizeSpeedTestNodes(fetchImpl, signal) {
  const response = await fetchImpl(UNICOM_API_ENDPOINTS.speedTestNodes, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal,
  });
  if (!response.ok) throw new Error(`测速节点列表响应异常（HTTP ${response.status}）`);
  const contentLength = Number(response.headers?.get("content-length"));
  if (contentLength > SPEED_TEST_NODE_MAX_RESPONSE_BYTES) {
    throw new Error("测速节点列表过大");
  }
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > SPEED_TEST_NODE_MAX_RESPONSE_BYTES) {
    throw new Error("测速节点列表过大");
  }
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("测速节点列表不是有效的 JSON");
  }
  return normalizeSpeedTestNodeResponse(payload);
}
