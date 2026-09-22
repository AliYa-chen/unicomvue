const CONNECTION_LABELS = Object.freeze({
  bluetooth: "蓝牙网络",
  cellular: "移动网络",
  ethernet: "有线网络",
  wifi: "Wi-Fi",
  wimax: "WiMAX",
});

export const EMPTY_NETWORK_PROFILE = Object.freeze({
  publicIp: "",
  locationLabel: "",
  carrierLabel: "",
  networkTypeLabel: "",
  routeKind: "unknown",
  routeLabel: "",
});

export function cleanNetworkText(value, maximumLength = 48) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function normalizePublicIp(value) {
  const address = cleanNetworkText(value, 64);
  if (!/^[0-9a-f:.]+$/i.test(address)) return "";

  if (address.includes(".") && !address.includes(":")) {
    const octets = address.split(".");
    const validIpv4 = octets.length === 4 && octets.every((octet) => (
      /^\d{1,3}$/.test(octet) && Number(octet) <= 255
    ));
    return validIpv4 ? address : "";
  }

  if (!address.includes(":")) return "";
  try {
    return new URL(`http://[${address}]/`).hostname ? address : "";
  } catch {
    return "";
  }
}

function uniqueText(values) {
  return [...new Set(values.map((value) => cleanNetworkText(value)).filter(Boolean))];
}

export function resolveConnectionLabel(apiType = "", connectionType = "") {
  const explicitType = cleanNetworkText(apiType, 24);
  if (explicitType) return explicitType;

  const type = cleanNetworkText(connectionType, 20).toLowerCase();
  return CONNECTION_LABELS[type] || "";
}

function unwrapPayload(payload) {
  return payload?.status === 0 && payload?.data ? payload.data : payload;
}

function regionName(countryCode) {
  if (!countryCode || typeof Intl.DisplayNames !== "function") return "";
  try {
    return cleanNetworkText(
      new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(countryCode),
      32,
    );
  } catch {
    return "";
  }
}

export function normalizeNetworkProfile(
  payload,
  countryCodeHint = "",
  connectionType = "",
) {
  const data = unwrapPayload(payload);
  const hintedCode = cleanNetworkText(countryCodeHint, 8).toUpperCase();
  const actualCountry = data?.country?.code ? data.country : null;
  const registeredCountry = data?.registered_country;
  const countryCode = cleanNetworkText(
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
  const countryName = cleanNetworkText(
    actualCountry?.name
    || (hintedCode ? regionName(hintedCode) : "")
    || registeredCountry?.name,
    32,
  );
  const locationParts = international
    ? uniqueText([countryName, ...regions])
    : regions;
  const carrier = cleanNetworkText(
    data?.geo_cn?.isp
    || data?.as?.info
    || data?.as?.name,
  );

  return {
    publicIp: normalizePublicIp(data?.ip),
    locationLabel: locationParts.join(" "),
    carrierLabel: carrier,
    networkTypeLabel: resolveConnectionLabel(data?.type, connectionType),
    routeKind: countryCode === "CN" ? "domestic" : international ? "international" : "unknown",
    routeLabel: international ? "国际线路" : "",
  };
}

export function hasNetworkProfileDetails(profile) {
  return Boolean(
    profile?.locationLabel
    || profile?.carrierLabel
    || profile?.networkTypeLabel
  );
}

export function parseNetworkTrace(body) {
  const fields = {};
  for (const line of String(body || "").split("\n")) {
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    fields[line.slice(0, separator)] = line.slice(separator + 1).trim();
  }
  return {
    ip: cleanNetworkText(fields.ip, 64),
    countryCode: cleanNetworkText(fields.loc, 8).toUpperCase(),
  };
}

export function medianMeasurement(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  return Math.round(sorted[Math.floor(sorted.length / 2)]);
}

export function routeKindFromCountryCode(countryCode) {
  const normalized = cleanNetworkText(countryCode, 8).toUpperCase();
  if (!normalized) return "unknown";
  return normalized === "CN" ? "domestic" : "international";
}

export function networkTraceFingerprint(trace) {
  if (!trace?.ip && !trace?.countryCode) return "";
  return `${trace.ip || ""}|${trace.countryCode || ""}`;
}

export function networkRegionName(countryCode) {
  return regionName(countryCode);
}
