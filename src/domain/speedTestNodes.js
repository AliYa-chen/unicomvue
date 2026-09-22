const MAX_GROUPS = 20;
const MAX_NODES = 200;
const MAX_URL_LENGTH = 2048;

function normalizeUrl(value, allowedProtocols) {
  if (typeof value !== "string") return "";
  const source = value.trim();
  if (!source || source.length > MAX_URL_LENGTH) return "";

  try {
    const url = new URL(source);
    if (!allowedProtocols.includes(url.protocol) || url.username || url.password) return "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

export function normalizeCatalogNodeUrl(value) {
  return normalizeUrl(value, ["https:"]);
}

export function normalizeCustomNodeUrl(value) {
  return normalizeUrl(value, ["http:", "https:"]);
}

export function normalizeSpeedTestNodeResponse(payload) {
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
      const value = normalizeCatalogNodeUrl(node.link);
      if (!name || !value || seen.has(value)) continue;
      seen.add(value);
      options.push({ label: name, value });
    }
    if (options.length) groups.push({ label, options });
  }

  if (!groups.length) throw new Error("测速节点列表为空");
  return groups;
}

export function sanitizeCustomSpeedTestNodes(value, { createId, maxNodes }) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const nodes = [];

  for (const item of value) {
    if (nodes.length >= maxNodes) break;
    const url = normalizeCustomNodeUrl(item?.value);
    const label = String(item?.label || "").trim().slice(0, 40);
    if (!url || !label || seen.has(url)) continue;
    seen.add(url);
    nodes.push({ id: String(item?.id || createId()), label, value: url });
  }
  return nodes;
}

export function collectSpeedTestNodeUrls(groups) {
  return new Set(groups.flatMap((group) => group.options.map((option) => option.value)));
}

export function findSpeedTestNodeLabel(groups, selectedUrl) {
  for (const group of groups) {
    const node = group.options.find((option) => option.value === selectedUrl);
    if (node) return node.label;
  }
  return selectedUrl ? "自定义测速地址" : "请选择测速节点";
}
