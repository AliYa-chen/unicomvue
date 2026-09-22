import { computed, onScopeDispose, ref, watch } from "vue";
import {
  CAPTCHA_APP_ID,
  CAPTCHA_SCRIPT_SRC,
  SMS_COUNTDOWN_SECONDS,
} from "@/config/unicom";
import { isValidPhone, isValidToken } from "@/domain/accounts";
import {
  smsLoginCredentials,
  tokenLoginCredentials,
} from "@/domain/loginCredentials";
import {
  loginWithSms,
  sendLoginCode,
  validateCaptcha,
} from "@/services/unicomApi";
import { ensureLoginIdentity } from "@/services/loginIdentity";
import { getRecentPhone, saveRecentPhone } from "@/services/loginPreferences";
import { createCaptchaScriptLoader } from "@/services/captchaScript";
import { createAbortError, getErrorMessage } from "@/utils/errors";

export function useLoginFlow(
  open,
  { captchaScriptTimeoutMs } = {},
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
  const captchaScript = createCaptchaScriptLoader({
    timeoutMs: captchaScriptTimeoutMs,
    onRequestedChange: (requested) => { captchaScriptRequested.value = requested; },
  });

  let disposed = false;
  let generation = 0;
  let activeController = null;
  let countdownTimer = null;
  let captchaInstance = null;
  let captchaFlowResolve = null;
  let captchaFlowReject = null;

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

  function cancelPendingWork() {
    generation += 1;
    activeController?.abort();
    activeController = null;
    settleCaptchaFlow(createAbortError("登录流程已取消"));
    captchaScript.cancel();
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

  async function runCaptcha(mobile, initialSnapshot, context) {
    await captchaScript.load();
    if (!snapshotIsCurrent(initialSnapshot, context)) {
      throw createAbortError("登录流程已取消");
    }
    if (typeof globalThis.TencentCaptcha !== "function") {
      throw new Error("验证码组件加载失败");
    }

    return new Promise((resolve, reject) => {
      captchaFlowResolve = resolve;
      captchaFlowReject = reject;

      try {
        captchaInstance = new globalThis.TencentCaptcha(CAPTCHA_APP_ID, async (result) => {
          if (!snapshotIsCurrent(initialSnapshot, context)) {
            settleCaptchaFlow(createAbortError("登录流程已取消"));
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
            settleCaptchaFlow(createAbortError("登录流程已取消"));
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
              settleCaptchaFlow(createAbortError("登录流程已取消"));
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
    if (
      !phoneIsValid.value
      || smsLoading.value
      || loginLoading.value
      || smsCountdown.value > 0
    ) {
      return false;
    }

    const context = beginRequest();
    smsLoading.value = true;
    setMessage("");

    try {
      let resultToken = "";

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const snapshot = identitySnapshot();
        saveRecentPhone(snapshot.phone);
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
        setMessage(`请求发送出错: ${getErrorMessage(error, "发送失败")}`);
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
    if (
      !phoneIsValid.value
      || !String(code.value || "").trim()
      || loginLoading.value
      || smsLoading.value
    ) {
      return null;
    }

    const context = beginRequest();
    loginLoading.value = true;

    try {
      const snapshot = identitySnapshot();
      saveRecentPhone(snapshot.phone);
      const result = await loginWithSms({
        phone: snapshot.phone,
        code: String(code.value || "").trim(),
        appId: snapshot.appId,
        deviceId: snapshot.deviceId,
      }, context.controller.signal);

      if (!snapshotIsCurrent(snapshot, context)) return null;
      return smsLoginCredentials(result, snapshot.phone);
    } catch (error) {
      if (error?.name !== "AbortError" && isCurrent(context)) {
        setMessage(getErrorMessage(error, "登录失败"));
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
    const credentials = tokenLoginCredentials(token.value);
    if (!credentials) {
      setMessage("请输入有效的 ecs_token");
      return null;
    }

    return credentials;
  }

  function setMode(nextMode) {
    const normalizedMode = nextMode === "token" ? "token" : "sms";
    if (normalizedMode === mode.value) return;

    cancelPendingWork();
    mode.value = normalizedMode;
    setMessage("");
  }

  function resetForOpen() {
    cancelPendingWork();
    stopSmsCountdown();
    mode.value = "sms";
    phone.value = getRecentPhone();
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
    onCaptchaScriptLoad: captchaScript.onLoad,
    onCaptchaScriptError: captchaScript.onError,
  };
}
