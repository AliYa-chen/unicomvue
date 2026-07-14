import {
  UNICOM_API_ENDPOINTS,
  UNICOM_ECS_ACCOUNT,
} from "../config/unicom.js";

export const UNICOM_API_TIMEOUT_MS = 20_000;

const JSON_HEADERS = Object.freeze({
  Accept: "application/json",
  "Content-Type": "text/plain;charset=UTF-8",
});

export class UnicomApiError extends Error {
  constructor(message, { status = 0, data = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "UnicomApiError";
    this.status = status;
    this.data = data;
  }
}

function looksLikeHtml(value) {
  const start = String(value || "").trimStart().slice(0, 200).toLowerCase();
  return start.startsWith("<") || start.startsWith("<!doctype");
}

function responseErrorMessage(data, status) {
  return String(data?.msg || data?.message || `请求失败（HTTP ${status}）`);
}

function createAbortError() {
  try {
    return new DOMException("请求已取消", "AbortError");
  } catch {
    const error = new Error("请求已取消");
    error.name = "AbortError";
    return error;
  }
}

function abortErrorFromSignal(signal) {
  return signal?.reason?.name === "AbortError"
    ? signal.reason
    : createAbortError();
}

function normalizedTimeout(timeoutMs) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : UNICOM_API_TIMEOUT_MS;
}

function createRequestCancellation(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let cancellationError = null;
  let rejectCancellation;
  let finished = false;

  const promise = new Promise((_, reject) => {
    rejectCancellation = reject;
  });

  function cancel(error, reason = error) {
    if (finished) return;
    finished = true;
    cancellationError = error;
    rejectCancellation(error);

    try {
      controller.abort(reason);
    } catch {
      controller.abort();
    }
  }

  function onExternalAbort() {
    cancel(abortErrorFromSignal(externalSignal), externalSignal?.reason);
  }

  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  const timer = setTimeout(() => {
    cancel(new UnicomApiError("请求超时，请稍后重试"));
  }, normalizedTimeout(timeoutMs));

  return {
    controller,
    get error() {
      return cancellationError;
    },
    promise,
    cleanup() {
      finished = true;
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    },
  };
}

export async function parseJsonResponse(response) {
  const text = await response.text();

  if (looksLikeHtml(text)) {
    throw new UnicomApiError("API 返回了 HTML，而不是 JSON", {
      status: response.status,
    });
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    throw new UnicomApiError("API 响应不是有效的 JSON", {
      status: response.status,
      cause,
    });
  }

  if (!response.ok) {
    throw new UnicomApiError(responseErrorMessage(data, response.status), {
      status: response.status,
      data,
    });
  }

  return data;
}

export async function postJson(
  url,
  payload,
  {
    signal,
    fetchImpl = globalThis.fetch,
    timeoutMs = UNICOM_API_TIMEOUT_MS,
  } = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new UnicomApiError("当前环境不支持网络请求");
  }

  if (signal?.aborted) throw abortErrorFromSignal(signal);

  const cancellation = createRequestCancellation(signal, timeoutMs);

  const request = (async () => {
    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
        signal: cancellation.controller.signal,
      });
    } catch (cause) {
      if (cancellation.error) throw cancellation.error;
      if (cause?.name === "AbortError") throw cause;
      throw new UnicomApiError(cause?.message || "网络请求失败", { cause });
    }

    try {
      return await parseJsonResponse(response);
    } catch (cause) {
      if (cancellation.error) throw cancellation.error;
      throw cause;
    }
  })();

  try {
    return await Promise.race([request, cancellation.promise]);
  } finally {
    cancellation.cleanup();
  }
}

function usagePayload(token) {
  return {
    ecs_token: String(token || "").trim(),
    ecs_acc: UNICOM_ECS_ACCOUNT,
  };
}

function loginActionUrl(action) {
  return `${UNICOM_API_ENDPOINTS.login}?action=${encodeURIComponent(action)}`;
}

function normalizeLoginPayload(payload) {
  const { appId, appid = appId, ...rest } = payload || {};
  return { ...rest, appid };
}

export function fetchUsage(token, signal) {
  return postJson(UNICOM_API_ENDPOINTS.packageUsage, usagePayload(token), { signal });
}

export function fetchBasicData(token, signal) {
  return postJson(UNICOM_API_ENDPOINTS.basicData, usagePayload(token), { signal });
}

export function fetchQciData(token, signal) {
  return postJson(UNICOM_API_ENDPOINTS.qci, usagePayload(token), { signal });
}

export function sendLoginCode(payload, signal) {
  return postJson(loginActionUrl("send"), normalizeLoginPayload(payload), { signal });
}

export function validateCaptcha(payload, signal) {
  return postJson(loginActionUrl("validate"), normalizeLoginPayload(payload), { signal });
}

export function loginWithSms(payload, signal) {
  return postJson(loginActionUrl("login"), normalizeLoginPayload(payload), { signal });
}
