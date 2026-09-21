<template>
  <Teleport defer to="#app-top-modal-root">
    <div
      v-if="open"
      class="fixed inset-0 z-[130] flex items-end justify-center sm:items-center sm:p-5"
      @keydown.esc.stop.prevent="close"
    >
      <button
        type="button"
        class="absolute inset-0 cursor-default bg-zinc-950/55 backdrop-blur-[1px]"
        aria-label="关闭余量设置"
        tabindex="-1"
        @click="close"
      ></button>
      <section
        ref="dialogRef"
        class="relative flex max-h-[min(90dvh,46rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.5rem] border border-zinc-200 bg-white text-zinc-900 shadow-2xl outline-none sm:rounded-[1.5rem] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <span class="sr-only" tabindex="0" @focus="focusLastControl"></span>
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 :id="titleId" class="font-semibold">余量设置</h2>
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">账号、刷新与外观偏好</p>
          </div>
          <button
            ref="closeButtonRef"
            type="button"
            class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label="关闭余量设置"
            @click="close"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </header>

        <div class="min-h-0 overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <section aria-labelledby="accounts-settings-title">
            <h3 id="accounts-settings-title" class="text-sm font-semibold">账号</h3>
            <div class="mt-3 rounded-xl border border-zinc-200 p-2 dark:border-zinc-700">
              <AccountMenu
                :accounts="accounts"
                :current-id="currentId"
                @select="emit('select-account', $event)"
                @add="emit('add-account')"
                @remove="emit('remove-account')"
              />
            </div>
          </section>

          <section class="mt-6 space-y-3" aria-labelledby="preferences-settings-title">
            <h3 id="preferences-settings-title" class="text-sm font-semibold">偏好</h3>
            <div class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 py-2 pr-2 pl-3 dark:border-zinc-700">
              <span class="min-w-0">
                <span class="block text-sm font-medium">在当前浏览器保存账号</span>
                <span class="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  关闭后立即清除已保存的 Token 和最近手机号；当前页面仍可使用账号，刷新后需要重新登录。
                </span>
              </span>
              <LiquidGlassToggle
                :model-value="saveAccountsInBrowser"
                :active="open"
                label="在当前浏览器保存账号"
                @update:model-value="emit('update:save-accounts', $event)"
              />
            </div>
            <div class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 py-2 pr-2 pl-3 dark:border-zinc-700">
              <span class="min-w-0">
                <span class="block text-sm font-medium">每 30 秒自动刷新</span>
                <span class="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  关闭后仍可在余量卡片上手动刷新。
                </span>
              </span>
              <LiquidGlassToggle
                :model-value="autoRefresh"
                :active="open"
                label="每 30 秒自动刷新"
                @update:model-value="emit('update:auto-refresh', $event)"
              />
            </div>
          </section>

          <section class="mt-6" aria-labelledby="appearance-settings-title">
            <h3 id="appearance-settings-title" class="text-sm font-semibold">外观</h3>
            <p class="mt-3 mb-2 text-xs text-zinc-500 dark:text-zinc-400">显示主题</p>
            <ThemeSelector />
            <p class="mt-5 mb-2 text-xs text-zinc-500 dark:text-zinc-400">主题强调色</p>
            <div class="flex flex-wrap gap-2" role="group" aria-label="主题强调色">
              <button
                v-for="color in accentOptions"
                :key="color.id"
                type="button"
                class="relative h-9 w-9 cursor-pointer rounded-full border-2 border-white shadow-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-zinc-900"
                :style="{ backgroundColor: color.action }"
                :aria-label="color.label"
                :aria-pressed="accent === color.id"
                :class="accent === color.id ? 'ring-2 ring-indigo-500 dark:ring-indigo-300' : ''"
                :title="color.label"
                @click="emit('update:accent', color.id)"
              >
                <Check v-if="accent === color.id" :size="16" class="absolute inset-0 m-auto text-white" aria-hidden="true" />
              </button>
            </div>
            <p class="mt-2 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              页面强调色即时生效；Liquid Glass 控件保留组件原生配色。
            </p>
          </section>

          <SettingsAboutSection class="mt-6" @open-privacy="emit('open-privacy')" />
        </div>
        <span class="sr-only" tabindex="0" @focus="focusFirstControl"></span>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, useId, useTemplateRef, watch } from "vue";
import { Check, X } from "@lucide/vue";
import LiquidGlassToggle from "@/components/app/LiquidGlassToggle.vue";
import ThemeSelector from "@/components/app/ThemeSelector.vue";
import SettingsAboutSection from "@/components/app/SettingsAboutSection.vue";
import AccountMenu from "@/components/dashboard/AccountMenu.vue";
import { useDocumentScrollLock } from "@/composables/useDocumentScrollLock";
import { ACCENT_THEMES } from "@/config/accentThemes";

const props = defineProps({
  accounts: { type: Array, default: () => [] },
  currentId: { type: String, default: "" },
  saveAccountsInBrowser: { type: Boolean, default: true },
  autoRefresh: { type: Boolean, default: true },
  accent: { type: String, default: "indigo" },
  returnFocusTarget: { type: Object, default: null },
});
const open = defineModel("open", { type: Boolean, default: false });
const emit = defineEmits([
  "select-account",
  "add-account",
  "remove-account",
  "update:save-accounts",
  "update:auto-refresh",
  "update:accent",
  "open-privacy",
]);
const titleId = useId();
const dialogRef = useTemplateRef("dialogRef");
const closeButtonRef = useTemplateRef("closeButtonRef");
const accentOptions = ACCENT_THEMES;
let previouslyFocusedElement = null;
useDocumentScrollLock(open);

function close() {
  open.value = false;
}

function focusFirstControl() {
  closeButtonRef.value?.focus();
}

function focusLastControl() {
  const controls = dialogRef.value?.querySelectorAll("button:not([disabled]), input:not([disabled])");
  controls?.[controls.length - 1]?.focus();
}

watch(open, async (isOpen) => {
  if (isOpen) {
    previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    await nextTick();
    if (open.value) closeButtonRef.value?.focus();
    return;
  }

  const focusTarget = props.returnFocusTarget?.isConnected
    ? props.returnFocusTarget
    : previouslyFocusedElement;
  previouslyFocusedElement = null;
  await nextTick();
  if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
}, { flush: "post" });
</script>
