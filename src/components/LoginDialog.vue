<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[80]"
    @keydown.esc.stop.prevent="close"
  >
    <button
      v-if="canClose"
      type="button"
      class="absolute inset-0 cursor-default bg-zinc-900/50 dark:bg-black/80"
      aria-label="关闭登录窗口"
      @click="close"
    ></button>
    <div v-else class="absolute inset-0 bg-zinc-900/50 dark:bg-black/80"></div>

    <div class="relative flex min-h-full items-center justify-center p-4 sm:p-6">
      <div
        ref="dialogRef"
        class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-900"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <span class="sr-only" tabindex="0" @focus="focusLastControl"></span>

        <div class="flex items-start justify-between gap-3">
          <div>
            <div :id="titleId" class="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {{ canClose ? "添加账号" : "登录" }}
            </div>
            <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">账号只保存在当前浏览器</div>
          </div>
          <button
            v-if="canClose"
            ref="closeButtonRef"
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            title="关闭"
            aria-label="关闭登录窗口"
            @click="close"
          >
            <X :size="18" />
          </button>
          <span v-else class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <LockKeyhole :size="18" />
          </span>
        </div>

        <div class="mt-4 grid gap-3">
          <div class="flex gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              ref="smsModeButtonRef"
              type="button"
              class="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition"
              :class="mode === 'sms' ? 'bg-white text-zinc-900 hover:shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'"
              @click="selectMode('sms')"
            >
              手机 + 验证码
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition"
              :class="mode === 'token' ? 'bg-white text-zinc-900 hover:shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'"
              @click="selectMode('token')"
            >
              直接输入 token
            </button>
          </div>

          <template v-if="mode === 'sms'">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">手机号</span>
              <input
                ref="phoneInputRef"
                v-model.trim="phone"
                type="tel"
                inputmode="numeric"
                autocomplete="tel"
                maxlength="11"
                class="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(161,161,170,0.2)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
                placeholder="11位手机号"
              />
            </label>

            <label class="block">
              <span class="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">短信验证码</span>
              <span class="flex gap-2">
                <input
                  ref="codeInputRef"
                  v-model.trim="code"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="6"
                  class="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(161,161,170,0.2)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
                  placeholder="6位验证码"
                  @keydown.enter="authenticateWithSms"
                />
                <button
                  type="button"
                  class="w-[110px] shrink-0 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                  :disabled="smsLoading || smsCountdown > 0 || !phoneIsValid"
                  @click="requestCode"
                >
                  {{ smsButtonLabel }}
                </button>
              </span>
            </label>

            <button
              type="button"
              class="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 hover:shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              :disabled="loginLoading || !phoneIsValid || !code"
              @click="authenticateWithSms"
            >
              <span>{{ loginLoading ? "正在登录..." : "立即登录" }}</span>
              <LoaderCircle v-if="loginLoading" :size="16" class="animate-spin" />
            </button>
          </template>

          <template v-else>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">ecs_token</span>
              <textarea
                ref="tokenInputRef"
                v-model.trim="token"
                rows="4"
                class="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-relaxed outline-none focus:border-zinc-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(161,161,170,0.2)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
                placeholder="粘贴你的 ecs_token（会写入本地缓存）"
              ></textarea>
            </label>
            <button
              type="button"
              class="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 hover:shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              :disabled="!tokenIsValid"
              @click="authenticateWithToken"
            >
              使用该 ecs_token 登录
            </button>
          </template>

          <div
            v-if="message"
            class="rounded-xl border px-3 py-2 text-xs"
            :class="messageKind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-400'"
            role="status"
          >
            {{ message }}
          </div>

          <div class="text-[11px] leading-relaxed text-zinc-500">
            点击登录即表示您同意本工具获取您的
            <span class="font-mono font-medium text-zinc-700 dark:text-zinc-300">ecs_token</span>，
            仅用于查询您本人联通账号信息。
            <button
              ref="privacyButtonRef"
              type="button"
              class="font-medium text-indigo-600 underline underline-offset-4 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              @click="emit('open-privacy')"
            >
              详细请看隐私协议
            </button>
          </div>
        </div>

        <span class="sr-only" tabindex="0" @focus="focusFirstControl"></span>
      </div>
    </div>

    <ExternalScript
      v-if="captchaScriptRequested"
      :src="captchaScriptSrc"
      @load="onCaptchaScriptLoad"
      @error="onCaptchaScriptError"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, useId, useTemplateRef, watch } from "vue";
import { LoaderCircle, LockKeyhole, X } from "@lucide/vue";
import ExternalScript from "@/components/ExternalScript.vue";
import { useLoginFlow } from "@/composables/useLoginFlow";

const props = defineProps({
  canClose: { type: Boolean, default: false },
  notice: { type: String, default: "" },
});
const emit = defineEmits(["authenticated", "open-privacy"]);
const open = defineModel("open", { type: Boolean, default: false });
const titleId = useId();
const dialogRef = useTemplateRef("dialogRef");
const closeButtonRef = useTemplateRef("closeButtonRef");
const smsModeButtonRef = useTemplateRef("smsModeButtonRef");
const phoneInputRef = useTemplateRef("phoneInputRef");
const codeInputRef = useTemplateRef("codeInputRef");
const tokenInputRef = useTemplateRef("tokenInputRef");
const privacyButtonRef = useTemplateRef("privacyButtonRef");

let previouslyFocusedElement = null;

const {
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
  captchaScriptSrc,
  phoneIsValid,
  tokenIsValid,
  setMessage,
  setMode,
  sendCode,
  submitSmsLogin,
  submitTokenLogin,
  onCaptchaScriptLoad,
  onCaptchaScriptError,
} = useLoginFlow(open);

const smsButtonLabel = computed(() => {
  if (smsLoading.value) return "发送中...";
  if (smsCountdown.value > 0) return `${smsCountdown.value}s`;
  return "获取验证码";
});

function close() {
  if (props.canClose) open.value = false;
}

function focusFirstControl() {
  if (props.canClose) closeButtonRef.value?.focus();
  else smsModeButtonRef.value?.focus();
}

function focusLastControl() {
  privacyButtonRef.value?.focus();
}

async function selectMode(nextMode) {
  setMode(nextMode);
  await nextTick();
  if (!open.value) return;
  if (nextMode === "token") tokenInputRef.value?.focus();
  else phoneInputRef.value?.focus();
}

async function requestCode() {
  if (await sendCode()) {
    await nextTick();
    if (open.value) codeInputRef.value?.focus();
  }
}

async function authenticateWithSms() {
  const payload = await submitSmsLogin();
  if (!payload) return;
  emit("authenticated", payload);
  open.value = false;
}

function authenticateWithToken() {
  const payload = submitTokenLogin();
  if (!payload) return;
  emit("authenticated", payload);
  open.value = false;
}

watch(open, async (isOpen) => {
  if (isOpen) {
    previouslyFocusedElement = typeof HTMLElement !== "undefined"
      && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    await nextTick();
    if (!open.value) return;
    dialogRef.value?.focus();
    phoneInputRef.value?.focus();
    return;
  }

  const focusTarget = previouslyFocusedElement;
  previouslyFocusedElement = null;
  await nextTick();
  if (focusTarget?.isConnected) focusTarget.focus();
}, { flush: "post" });

watch(
  [open, () => props.notice],
  ([isOpen, notice]) => {
    if (isOpen) setMessage(notice);
  },
  { immediate: true, flush: "post" },
);
</script>
