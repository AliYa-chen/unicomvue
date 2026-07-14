import { computed, onScopeDispose, ref, watch } from "vue";
import {
  CAPTCHA_APP_ID,
  CAPTCHA_SCRIPT_SRC,
  SMS_COUNTDOWN_SECONDS,
  UNICOM_STORAGE_KEYS,
} from "../config/unicom.js";
import { isValidPhone, isValidToken } from "../domain/accounts.js";
import {
  loginWithSms,
  sendLoginCode,
  validateCaptcha,
} from "../services/unicomApi.js";
import { getStorageItem, setStorageItem } from "../services/storage.js";

const CAPTCHA_SCRIPT_TIMEOUT_MS = 15_000;
const APP_ID_PATTERN = /^[a-zA-Z0-9]{64,256}$/;
const DEVICE_ID_PATTERN = /^[a-f0-9]{32}$/;

const loginIdentityCache = {
  appId: "",
  deviceId: "",
};

function createAbortError() {
  try {
    return new DOMException("登录流程已取消", "AbortError");
  } catch {
    const error = new Error("登录流程已取消");
    error.name = "AbortError";
    return error;
  }
}

function generateAppId() {
  const digit = () => String(Math.floor(Math.random() * 10));
  return digit() + "f" + digit() + "af" + digit() + digit() + "ad"
    + digit() + "912d306b5053abf90c7ebbb695887bc"
    + "870ae0706d573c348539c26c5c0a878641fcc0d3e90acb9be1e6ef858a"
    + "59af546f3c826988332376b7d18c8ea2398ee3a9c3db947e2471d32a49612";
}

function generateDeviceId() {
  const bytes = new Uint8Array(16);

  try {
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      throw new Error("Secure random values are unavailable");
    }
  } catch {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ensureLoginIdentity() {
  let appId = getStorageItem(UNICOM_STORAGE_KEYS.appId, "");
  if (!APP_ID_PATTERN.test(appId)) {
    appId = APP_ID_PATTERN.test(loginIdentityCache.appId)
      ? loginIdentityCache.appId
      : generateAppId();
    setStorageItem(UNICOM_STORAGE_KEYS.appId, appId);
  }
  loginIdentityCache.appId = appId;

  let deviceId = getStorageItem(UNICOM_STORAGE_KEYS.deviceId, "");
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    deviceId = DEVICE_ID_PATTERN.test(loginIdentityCache.deviceId)
      ? loginIdentityCache.deviceId
      : generateDeviceId();
    setStorageItem(UNICOM_STORAGE_KEYS.deviceId, deviceId);
  }
  loginIdentityCache.deviceId = deviceId;

  return { appId, deviceId };
}

function responseMessage(error, fallback) {
  return error?.message ? String(error.message) : fallback;
}

export function useLoginFlow(
  open,
  { captchaScriptTimeoutMs = CAPTCHA_SCRIPT_TIMEOUT_MS } = {},
) {
  const mode = ref("sms");
  const phone = ref("");
  const code = ref("");
  const token = ref("");
  const message = ref("");
  const messageKind = ref("error");
  const smsLoading = ref(false);
  const loginLoading = ref(false);
  const smsCountdown = ref(0);
  const captchaScriptRequested = ref(false);

  let disposed = false;
  let generation = 0;
  let activeController = null;
  let countdownTimer = null;
  let captchaInstance = null;
  let captchaFlowResolve = null;
  let captchaFlowReject = null;
  let captchaScriptPromise = null;
  let resolveCaptchaScript = null;
  let rejectCaptchaScript = null;
  let captchaScriptTimer = null;

  const phoneIsValid = computed(() => isValidPhone(phone.value));
  const tokenIsValid = computed(() => isValidToken(token.value));

  function setMessage(nextMessage, kind = "error") {
    message.value = String(nextMessage || "");
    messageKind.value = kind;
  }

  function stopSmsCountdown() {
    if (countdownTimer !== null) clearInterval(countdownTimer);
    countdownTimer = null;
    smsCountdown.value = 0;
  }

  function startSmsCountdown() {
    stopSmsCountdown();
    smsCountdown.value = SMS_COUNTDOWN_SECONDS;
    countdownTimer = setInterval(() => {
      smsCountdown.value = Math.max(0, smsCountdown.value - 1);
      if (smsCountdown.value === 0) stopSmsCountdown();
    }, 1000);
  }

  function disposeCaptchaInstance() {
    const instance = captchaInstance;
    captchaInstance = null;
    if (!instance) return;

    try {
      if (typeof instance.destroy === "function") instance.destroy();
      else if (typeof instance.close === "function") instance.close();
    } catch {
      // Tencent Captcha versions expose different best-effort cleanup methods.
    }
  }

  function settleCaptchaFlow(error, resultToken = "") {
    const resolve = captchaFlowResolve;
    const reject = captchaFlowReject;
    captchaFlowResolve = null;
    captchaFlowReject = null;
    disposeCaptchaInstance();

    if (error) reject?.(error);
    else resolve?.(resultToken);
  }

  function settleCaptchaScript(error) {
    const resolve = resolveCaptchaScript;
    const reject = rejectCaptchaScript;
    if (captchaScriptTimer !== null) clearTimeout(captchaScriptTimer);
    captchaScriptTimer = null;
    resolveCaptchaScript = null;
    rejectCaptchaScript = null;
    captchaScriptPromise = null;
    captchaScriptRequested.value = false;

    if (error) reject?.(error);
    else resolve?.();
  }

  function cancelPendingWork() {
    generation += 1;
    activeController?.abort();
    activeController = null;
    settleCaptchaFlow(createAbortError());
    if (captchaScriptPromise) settleCaptchaScript(createAbortError());
    smsLoading.value = false;
    loginLoading.value = false;
  }

  function beginRequest() {
    cancelPendingWork();
    const controller = new AbortController();
    activeController = controller;
    return { controller, generation };
  }

  function isCurrent(context) {
    return !disposed
      && open.value
      && activeController === context.controller
      && generation === context.generation
      && !context.controller.signal.aborted;
  }

  function identitySnapshot() {
    const { appId, deviceId } = ensureLoginIdentity();
    return Object.freeze({
      phone: String(phone.value || "").trim(),
      appId,
      deviceId,
    });
  }

  function snapshotIsCurrent(snapshot, context) {
    return isCurrent(context) && snapshot.phone === String(phone.value || "").trim();
  }

  function loadCaptchaScript() {
    if (typeof globalThis.TencentCaptcha === "function") return Promise.resolve();
    if (captchaScriptPromise) return captchaScriptPromise;

    captchaScriptRequested.value = true;
    captchaScriptPromise = new Promise((resolve, reject) => {
      resolveCaptchaScript = resolve;
      rejectCaptchaScript = reject;
    });
    const timeout = Number.isFinite(captchaScriptTimeoutMs) && captchaScriptTimeoutMs > 0
      ? captchaScriptTimeoutMs
      : CAPTCHA_SCRIPT_TIMEOUT_MS;
    captchaScriptTimer = setTimeout(() => {
      settleCaptchaScript(new Error("验证码组件加载超时，请重试"));
    }, timeout);
    return captchaScriptPromise;
  }

  function onCaptchaScriptLoad() {
    if (!captchaScriptPromise) return;
    if (typeof globalThis.TencentCaptcha === "function") settleCaptchaScript();
    else settleCaptchaScript(new Error("验证码组件加载失败"));
  }

  function onCaptchaScriptError() {
    if (!captchaScriptPromise) return;
    settleCaptchaScript(new Error("验证码组件加载失败"));
  }

  async function runCaptcha(mobile, initialSnapshot, context) {
    await loadCaptchaScript();
    if (!snapshotIsCurrent(initialSnapshot, context)) throw createAbortError();
    if (typeof globalThis.TencentCaptcha !== "function") {
      throw new Error("验证码组件加载失败");
    }

    return new Promise((resolve, reject) => {
      captchaFlowResolve = resolve;
      captchaFlowReject = reject;

      try {
        captchaInstance = new globalThis.TencentCaptcha(CAPTCHA_APP_ID, async (result) => {
          if (!snapshotIsCurrent(initialSnapshot, context)) {
            settleCaptchaFlow(createAbortError());
            return;
          }

          if (result?.ret !== 0) {
            setMessage("已取消安全验证");
            settleCaptchaFlow(null, "");
            return;
          }

          setMessage("正在进行安全验证...", "ok");
          const snapshot = identitySnapshot();
          if (snapshot.phone !== initialSnapshot.phone) {
            settleCaptchaFlow(createAbortError());
            return;
          }

          try {
            const validation = await validateCaptcha({
              ticket: result.ticket,
              randstr: result.randstr,
              mobile,
              phone: snapshot.phone,
              appId: snapshot.appId,
              deviceId: snapshot.deviceId,
            }, context.controller.signal);

            if (!snapshotIsCurrent(snapshot, context)) {
              settleCaptchaFlow(createAbortError());
              return;
            }

            if (validation?.status === "success" && validation?.resultToken) {
              setMessage("安全验证通过，正在发送短信...", "ok");
              settleCaptchaFlow(null, String(validation.resultToken));
            } else {
              setMessage(validation?.msg || "安全验证未通过");
              settleCaptchaFlow(null, "");
            }
          } catch (error) {
            settleCaptchaFlow(error);
          }
        });
        captchaInstance.show();
      } catch (error) {
        settleCaptchaFlow(error);
      }
    });
  }

  async function sendCode() {
    if (!phoneIsValid.value || smsLoading.value || smsCountdown.value > 0) return false;

    const context = beginRequest();
    smsLoading.value = true;
    setMessage("");

    try {
      let resultToken = "";

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const snapshot = identitySnapshot();
        setStorageItem(UNICOM_STORAGE_KEYS.phoneHistory, snapshot.phone);
        const result = await sendLoginCode({
          phone: snapshot.phone,
          appId: snapshot.appId,
          deviceId: snapshot.deviceId,
          resultToken,
        }, context.controller.signal);

        if (!snapshotIsCurrent(snapshot, context)) return false;
        if (result?.status === "success") {
          setMessage(result.msg || "验证码已发送，请查收", "ok");
          startSmsCountdown();
          return true;
        }

        if (result?.status !== "need_captcha" || resultToken) {
          setMessage(result?.msg || "发送失败");
          return false;
        }

        setMessage(result.msg || "需要安全验证");
        resultToken = await runCaptcha(result.mobile || "", snapshot, context);
        if (!resultToken || !isCurrent(context)) return false;
      }

      setMessage("发送失败");
      return false;
    } catch (error) {
      if (error?.name !== "AbortError" && isCurrent(context)) {
        setMessage(`请求发送出错: ${responseMessage(error, "发送失败")}`);
      }
      return false;
    } finally {
      if (isCurrent(context)) {
        activeController = null;
        smsLoading.value = false;
      }
    }
  }

  async function submitSmsLogin() {
    if (!phoneIsValid.value || !String(code.value || "").trim() || loginLoading.value) {
      return null;
    }

    const context = beginRequest();
    loginLoading.value = true;

    try {
      const snapshot = identitySnapshot();
      setStorageItem(UNICOM_STORAGE_KEYS.phoneHistory, snapshot.phone);
      const result = await loginWithSms({
        phone: snapshot.phone,
        code: String(code.value || "").trim(),
        appId: snapshot.appId,
        deviceId: snapshot.deviceId,
      }, context.controller.signal);

      if (!snapshotIsCurrent(snapshot, context)) return null;
      if (result?.status !== "success") throw new Error(result?.msg || "登录失败");
      if (!isValidToken(result?.ecs_token)) {
        throw new Error("后端返回的数据中缺少有效的 ecs_token");
      }

      return {
        token: String(result.ecs_token).trim(),
        onlinToken: String(result.onlin_token || "").trim(),
        phone: snapshot.phone,
        loginType: "sms",
      };
    } catch (error) {
      if (error?.name !== "AbortError" && isCurrent(context)) {
        setMessage(responseMessage(error, "登录失败"));
      }
      return null;
    } finally {
      if (isCurrent(context)) {
        activeController = null;
        loginLoading.value = false;
      }
    }
  }

  function submitTokenLogin() {
    const normalizedToken = String(token.value || "").trim();
    if (!isValidToken(normalizedToken)) {
      setMessage("请输入有效的 ecs_token");
      return null;
    }

    return {
      token: normalizedToken,
      onlinToken: "",
      phone: "",
      loginType: "token",
    };
  }

  function setMode(nextMode) {
    mode.value = nextMode === "token" ? "token" : "sms";
    setMessage("");
  }

  function resetForOpen() {
    cancelPendingWork();
    stopSmsCountdown();
    mode.value = "sms";
    phone.value = getStorageItem(UNICOM_STORAGE_KEYS.phoneHistory, "");
    code.value = "";
    token.value = "";
    setMessage("");
    ensureLoginIdentity();
  }

  function deactivate() {
    cancelPendingWork();
    stopSmsCountdown();
  }

  watch(open, (isOpen) => {
    if (isOpen) resetForOpen();
    else deactivate();
  }, { immediate: true });

  onScopeDispose(() => {
    disposed = true;
    deactivate();
  });

  return {
    mode,
    phone,
    code,
    token,
    message,
    messageKind,
    smsLoading,
    loginLoading,
    smsCountdown,
    captchaScriptRequested,
    captchaScriptSrc: CAPTCHA_SCRIPT_SRC,
    phoneIsValid,
    tokenIsValid,
    setMessage,
    setMode,
    sendCode,
    submitSmsLogin,
    submitTokenLogin,
    onCaptchaScriptLoad,
    onCaptchaScriptError,
  };
}
