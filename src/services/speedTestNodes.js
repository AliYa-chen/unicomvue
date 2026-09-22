import { SPEED_TEST_NODES_API_URL } from "@/config/speedTest";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_GROUPS = 20;
const MAX_NODES = 200;
const MAX_RESPONSE_BYTES = 256 * 1024;

function normalizeNodeLink(value) {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

export function normalizeSpeedTestNodes(payload) {
  if (payload?.ok !== true || payload.schemaVersion !== 1
    || !payload.groups || typeof payload.groups !== "object"
    || Array.isArray(payload.groups)) {
    throw new Error("测速节点列表格式不正确");
  }

  const entries = Object.entries(payload.groups);
  if (entries.length > MAX_GROUPS) throw new Error("测速节点分组过多");

  const seen = new Set();
  const groups = [];
  let nodeCount = 0;

  for (const [groupName, groupNodes] of entries) {
    if (!groupNodes || typeof groupNodes !== "object" || Array.isArray(groupNodes)) {
      throw new Error("测速节点分组格式不正确");
    }
    const label = groupName.trim().slice(0, 48);
    if (!label) continue;

    const options = [];
    for (const [nodeName, node] of Object.entries(groupNodes)) {
      nodeCount += 1;
      if (nodeCount > MAX_NODES) throw new Error("测速节点数量过多");
      if (node?.status !== true || node?.webVisible !== true) continue;
      const name = nodeName.trim().slice(0, 40);
      const value = normalizeNodeLink(node.link);
      if (!name || !value || seen.has(value)) continue;
      seen.add(value);
      options.push({ label: name, value });
    }
    if (options.length) groups.push({ label, options });
  }

  if (!groups.length) throw new Error("测速节点列表为空");
  return groups;
}

export async function fetchSpeedTestNodes({ signal, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("当前环境不支持网络请求");

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(SPEED_TEST_NODES_API_URL, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`测速节点列表响应异常（HTTP ${response.status}）`);
    const contentLength = Number(response.headers?.get("content-length"));
    if (contentLength > MAX_RESPONSE_BYTES) throw new Error("测速节点列表过大");
    const body = await response.text();
    if (body.length > MAX_RESPONSE_BYTES) throw new Error("测速节点列表过大");
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error("测速节点列表不是有效的 JSON");
    }
    return normalizeSpeedTestNodes(payload);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
