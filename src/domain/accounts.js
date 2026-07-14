const VALID_LOGIN_TYPES = new Set(["sms", "token"]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTimestamp(value, fallback) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
}

function stableAccountId(token, suffix = 0) {
  let hash = 2_166_136_261;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  const base = `account-${(hash >>> 0).toString(36)}`;
  return suffix > 0 ? `${base}-${suffix}` : base;
}

function resolveUniqueId(account, index, usedIds, createId) {
  const storedId = normalizeString(account.id);
  if (storedId && !usedIds.has(storedId)) return storedId;

  const generatedId = normalizeString(createId?.(account, index));
  if (generatedId && !usedIds.has(generatedId)) return generatedId;

  let suffix = 0;
  let candidate = stableAccountId(normalizeString(account.token), suffix);
  while (usedIds.has(candidate)) {
    suffix += 1;
    candidate = stableAccountId(normalizeString(account.token), suffix);
  }
  return candidate;
}

export function isValidPhone(phone) {
  return /^1\d{10}$/.test(normalizeString(phone));
}

export function isValidToken(token) {
  return normalizeString(token).length > 20;
}

export function maskPhone(phone) {
  const normalizedPhone = normalizeString(phone);
  return isValidPhone(normalizedPhone)
    ? `${normalizedPhone.slice(0, 3)}****${normalizedPhone.slice(-4)}`
    : "";
}

export function normalizeMaskedMobile(mobile) {
  const value = normalizeString(mobile);
  if (/^1\d{2}\*{4}\d{4}$/.test(value)) return value;
  return maskPhone(value);
}

export function tokenSuffix(token) {
  return normalizeString(token).slice(-4) || "—";
}

export function accountDisplayName(account) {
  return maskPhone(account?.phone)
    || normalizeMaskedMobile(account?.mobile)
    || `Token · ${tokenSuffix(account?.token)}`;
}

export function accountPackageDescription(account) {
  return normalizeString(account?.packageName) || "套餐信息待获取";
}

export function normalizeAccount(account, { id, now = 0 } = {}) {
  const token = normalizeString(account?.token);
  if (!isValidToken(token)) return null;

  const inferredLoginType = isValidPhone(account?.phone) ? "sms" : "token";
  const loginType = VALID_LOGIN_TYPES.has(account?.loginType)
    ? account.loginType
    : inferredLoginType;
  const normalizedNow = normalizeTimestamp(now, 0);

  return {
    id: normalizeString(id ?? account?.id),
    token,
    onlinToken: normalizeString(account?.onlinToken),
    phone: loginType === "sms" && isValidPhone(account?.phone)
      ? normalizeString(account.phone)
      : "",
    mobile: loginType === "token" ? normalizeMaskedMobile(account?.mobile) : "",
    loginType,
    packageName: normalizeString(account?.packageName),
    createdAt: normalizeTimestamp(account?.createdAt, normalizedNow),
    updatedAt: normalizeTimestamp(account?.updatedAt, normalizedNow),
  };
}

export function normalizeAccounts(
  storedAccounts,
  {
    legacyToken = "",
    createId,
    now = 0,
  } = {},
) {
  const source = Array.isArray(storedAccounts) ? storedAccounts : [];
  const normalizedLegacyToken = normalizeString(legacyToken);
  const candidates = isValidToken(normalizedLegacyToken)
    ? [...source, { token: normalizedLegacyToken }]
    : source;
  const seenTokens = new Set();
  const usedIds = new Set();
  const accounts = [];

  candidates.forEach((candidate, index) => {
    const normalized = normalizeAccount(candidate, { now });
    if (!normalized || seenTokens.has(normalized.token)) return;

    const id = resolveUniqueId(normalized, index, usedIds, createId);
    seenTokens.add(normalized.token);
    usedIds.add(id);
    accounts.push({ ...normalized, id });
  });

  return accounts;
}
