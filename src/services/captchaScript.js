import { createAbortError } from "@/utils/errors";

const CAPTCHA_SCRIPT_TIMEOUT_MS = 15_000;

// The script element belongs to Vue; this service only coordinates its load events.
export function createCaptchaScriptLoader({ onRequestedChange, timeoutMs = CAPTCHA_SCRIPT_TIMEOUT_MS }) {
  let promise = null;
  let resolveScript = null;
  let rejectScript = null;
  let timer = null;

  function settle(error) {
    const resolve = resolveScript;
    const reject = rejectScript;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    resolveScript = null;
    rejectScript = null;
    promise = null;
    onRequestedChange(false);

    if (error) reject?.(error);
    else resolve?.();
  }

  return {
    load() {
      if (typeof globalThis.TencentCaptcha === "function") return Promise.resolve();
      if (promise) return promise;

      onRequestedChange(true);
      promise = new Promise((resolve, reject) => {
        resolveScript = resolve;
        rejectScript = reject;
      });
      const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : CAPTCHA_SCRIPT_TIMEOUT_MS;
      timer = setTimeout(() => settle(new Error("验证码组件加载超时，请重试")), timeout);
      return promise;
    },
    onLoad() {
      if (!promise) return;
      if (typeof globalThis.TencentCaptcha === "function") settle();
      else settle(new Error("验证码组件加载失败"));
    },
    onError() {
      if (promise) settle(new Error("验证码组件加载失败"));
    },
    cancel() {
      if (promise) settle(createAbortError("登录流程已取消"));
    },
  };
}
