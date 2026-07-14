const DEFAULT_BADGE_CLASS = "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
const POSITIVE_BADGE_CLASS = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
const UNLIMITED_BADGE_CLASS = "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800";

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function toNum(value) {
  const number = Number(String(value ?? "").trim());
  return Number.isFinite(number) ? number : null;
}

export function formatRateMbps(value) {
  if (value === "LTE") return "LTE";
  const number = toNum(value);
  return number === null || number <= 0 ? "—" : `${Math.round(number)}Mbps`;
}

export function formatQciNum(value) {
  const number = toNum(value);
  return number === null ? "—" : String(Math.round(number));
}

export function formatFlowFromMB(value) {
  const number = toNum(value);
  if (number === null) return "—";
  return number >= 1024
    ? `${(number / 1024).toFixed(2)}GB`
    : `${number.toFixed(2)}MB`;
}

export function formatMinutes(value) {
  const number = toNum(value);
  return number === null ? "—" : `${Math.round(number)}分钟`;
}

export function extractPackageName(data) {
  return String(data?.packageName || data?.result?.packageName || "").trim();
}

function pickByIndex(items, index) {
  return Array.isArray(items) && items.length > index ? items[index] : null;
}

function normalizeDetails(details) {
  return Array.isArray(details) ? details.filter(Boolean) : [];
}

function detailKey(detail) {
  if (detail?.feePolicyId) return `feePolicyId:${detail.feePolicyId}`;
  return `mix:${detail?.addupItemCode}|${detail?.feePolicyName}|${detail?.endDate}|${detail?.flowType}|${detail?.total}`;
}

function mergeDetails(first, second) {
  const merged = [];
  const seen = new Set();

  for (const detail of [...normalizeDetails(first), ...normalizeDetails(second)]) {
    const key = detailKey(detail);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(detail);
  }

  return merged;
}

function mergeBlock(data, index) {
  const resource = pickByIndex(data?.resources, index);
  const unshared = pickByIndex(data?.unshared, index);
  const details = mergeDetails(resource?.details, unshared?.details);

  return details.length
    ? { ...unshared, ...resource, details }
    : null;
}

function flowTypeLabel(flowType) {
  if (flowType === "1") return "通用流量";
  if (flowType === "2") return "专属流量";
  if (flowType === "3") return "其他流量";
  return flowType ? `流量(${flowType})` : "流量";
}

function flowTypeMeta(flowType, unlimited) {
  let label = "未知";
  if (flowType === "1") label = "通用";
  else if (flowType === "2") label = "专属";
  else if (flowType === "3") label = "其他";

  return {
    label,
    badge: unlimited ? POSITIVE_BADGE_CLASS : DEFAULT_BADGE_CLASS,
  };
}

function shareMeta(typeMark) {
  if (typeMark === "0") return { label: "共享", badge: POSITIVE_BADGE_CLASS };
  if (typeMark === "1") return { label: "非共享", badge: DEFAULT_BADGE_CLASS };
  return null;
}

function flowTypeRank(flowType) {
  if (flowType === "1") return 1;
  if (flowType === "2") return 2;
  if (flowType === "3") return 3;
  return 9;
}

function getAggregate(resource) {
  const used = toNum(resource?.userResource) ?? 0;
  const remain = Math.max(0, toNum(resource?.remainResource) ?? 0);
  return { used, remain, total: used + remain };
}

function buildVoiceCard(resource) {
  const { used, remain, total } = getAggregate(resource);
  const percent = total > 0 ? clamp((used / total) * 100, 0, 100) : null;

  return {
    id: "voice",
    kind: "voice",
    title: "语音",
    subtitle: "（已用）",
    mainValue: formatMinutes(used),
    smallTotal: `总：${formatMinutes(total)}`,
    unlimited: false,
    percent,
    canUseText: `剩：${formatMinutes(remain)}`,
  };
}

function buildSmsCard(resource) {
  const { used, remain, total } = getAggregate(resource);
  const percent = total > 0 ? clamp((used / total) * 100, 0, 100) : null;

  return {
    id: "sms",
    kind: "sms",
    title: "短信",
    subtitle: "（已用）",
    mainValue: `${Math.round(used)}条`,
    smallTotal: `总：${Math.round(total)}`,
    unlimited: false,
    percent,
    canUseText: `剩：${Math.round(remain)}`,
  };
}

function buildFlowCard(detail) {
  const unlimited = String(detail?.limited) === "1";
  const flowType = String(detail?.flowType ?? "").trim();
  const used = toNum(detail?.use) ?? 0;
  const total = toNum(detail?.total);
  const remain = toNum(detail?.remain);
  const fallbackTotal = used + (remain || 0);
  const percent = unlimited
    ? 100
    : total > 0
      ? clamp((used / total) * 100, 0, 100)
      : fallbackTotal > 0
        ? clamp((used / fallbackTotal) * 100, 0, 100)
        : null;
  const typeMeta = flowTypeMeta(flowType, unlimited);
  const sharing = unlimited ? shareMeta(detail?.typemark) : null;
  const badges = [
    { key: "flow-type", text: typeMeta.label, cls: typeMeta.badge },
    sharing
      ? { key: "sharing", text: sharing.label, cls: sharing.badge }
      : null,
    {
      key: "limit",
      text: unlimited ? "无限量" : "有上限",
      cls: unlimited ? UNLIMITED_BADGE_CLASS : DEFAULT_BADGE_CLASS,
    },
  ].filter(Boolean);

  return {
    id: `flow:${detailKey(detail)}`,
    kind: "flow",
    title: detail?.feePolicyName?.trim() || flowTypeLabel(flowType),
    mainValue: formatFlowFromMB(used),
    smallTotal: unlimited
      ? "总量：∞"
      : total !== null
        ? `总：${formatFlowFromMB(total)}`
        : "总量：—",
    unlimited,
    percent,
    canUseText: unlimited
      ? ""
      : `剩：${remain === null ? "—" : formatFlowFromMB(remain)}`,
    hideCanUseLine: unlimited,
    badges,
    flowTypeRank: flowTypeRank(flowType),
    flowLimitedKey: unlimited ? 0 : 1,
  };
}

function cardSortRank(card) {
  if (card.kind === "voice") return 0;
  if (card.kind === "sms") return 5;
  return 1000 + (card.flowTypeRank ?? 9) * 100 + (card.flowLimitedKey ?? 1) * 10;
}

export function buildCardsFromOcs(data) {
  const cards = [];
  const flowResource = mergeBlock(data, 0);
  const voiceResource = mergeBlock(data, 1);
  const smsResource = mergeBlock(data, 2);

  if (voiceResource) cards.push(buildVoiceCard(voiceResource));
  if (smsResource) cards.push(buildSmsCard(smsResource));

  if (flowResource) {
    for (const detail of flowResource.details) {
      if (String(detail?.elemType) !== "3" || detail?.hide === true) continue;
      cards.push(buildFlowCard(detail));
    }
  }

  return cards.sort((first, second) => {
    const rankDifference = cardSortRank(first) - cardSortRank(second);
    return rankDifference || String(first.title).localeCompare(String(second.title), "zh-CN");
  });
}
