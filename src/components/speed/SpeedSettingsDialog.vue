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
        aria-label="关闭测速设置"
        tabindex="-1"
        @click="close"
      ></button>
      <section
        ref="dialogRef"
        class="relative flex max-h-[min(90dvh,48rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.5rem] border border-zinc-200 bg-white text-zinc-900 shadow-2xl outline-none sm:rounded-[1.5rem] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        :class="{ 'is-dark': isDark }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown.tab="trapFocus"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 :id="titleId" class="font-semibold">测速设置</h2>
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">下载节点、并发线程与自定义地址</p>
          </div>
          <button
            ref="closeButtonRef"
            type="button"
            class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label="关闭测速设置"
            @click="close"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </header>

        <div class="min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
          <section class="speed-settings-card" aria-labelledby="speed-node-title">
            <div class="flex items-start gap-3">
              <span class="speed-settings-icon" aria-hidden="true"><Server :size="18" /></span>
              <div class="min-w-0 flex-1">
                <h3 id="speed-node-title" class="text-sm font-semibold">下载节点</h3>
                <p class="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  当前选择：<span class="font-medium text-zinc-700 dark:text-zinc-200">{{ selectedNodeLabel }}</span>
                </p>
              </div>
            </div>

            <div v-for="group in builtInNodeGroups" :key="group.label" class="mt-4">
              <p class="mb-2 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                {{ group.label }}
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="node in group.options"
                  :key="node.value"
                  type="button"
                  class="speed-node-option"
                  :class="{ 'is-selected': selectedUrl === node.value }"
                  :aria-pressed="selectedUrl === node.value"
                  @click="selectedUrl = node.value"
                >
                  <span class="truncate">{{ node.label }}</span>
                  <Check v-if="selectedUrl === node.value" :size="15" aria-hidden="true" />
                </button>
              </div>
            </div>

            <details class="mt-3 rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950/45">
              <summary class="cursor-pointer text-xs font-medium text-zinc-500 dark:text-zinc-400">查看当前文件地址</summary>
              <p class="mt-2 break-all font-mono text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">{{ selectedUrl }}</p>
            </details>
          </section>

          <section class="speed-settings-card mt-4" aria-labelledby="speed-threads-title">
            <div class="flex items-start gap-3">
              <span class="speed-settings-icon" aria-hidden="true"><Cpu :size="18" /></span>
              <div class="min-w-0 flex-1">
                <h3 id="speed-threads-title" class="text-sm font-semibold">并发线程</h3>
                <p class="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  拖动时实时调整下载任务。
                </p>
              </div>
              <label class="relative shrink-0">
                <span class="sr-only">测速线程数</span>
                <input
                  class="h-10 w-20 rounded-xl border border-zinc-200 bg-white pr-7 pl-2 text-center text-base font-semibold tabular-nums outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-950"
                  type="number"
                  min="1"
                  max="64"
                  :value="threadCount"
                  @change="changeThreadCount"
                />
                <span class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-zinc-400">条</span>
              </label>
            </div>

            <LiquidGlassThreadSlider
              class="mt-3"
              :model-value="threadCount"
              :min="1"
              :max="64"
              @update:model-value="updateThreadCount"
            />
            <div class="flex items-center justify-between px-2 text-[11px] text-zinc-400 dark:text-zinc-500">
              <span>低并发 · 1</span>
              <span>高并发 · 64</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2" aria-label="常用线程数">
              <button
                v-for="count in THREAD_PRESETS"
                :key="count"
                type="button"
                class="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                :class="threadCount === count
                  ? 'border-transparent bg-[var(--app-accent-action)] text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600'"
                :aria-pressed="threadCount === count"
                @click="updateThreadCount(count)"
              >
                {{ count }} 线程
              </button>
            </div>
            <p class="mt-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              实际同时传输数受浏览器与节点协议限制；HTTP/1.1 单域名通常约为 6 条，其余任务会在浏览器中等待连接。
            </p>
          </section>

          <section class="speed-settings-card mt-4" aria-labelledby="custom-node-title">
            <div class="flex items-start gap-3">
              <span class="speed-settings-icon" aria-hidden="true"><Link2 :size="18" /></span>
              <div class="min-w-0 flex-1">
                <h3 id="custom-node-title" class="text-sm font-semibold">自定义节点</h3>
                <p class="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  使用支持跨域访问的 HTTP 或 HTTPS 文件地址。
                </p>
              </div>
            </div>

            <ul v-if="customNodes.length" class="mt-4 space-y-2" aria-label="已保存的自定义测速节点">
              <li v-for="node in customNodes" :key="node.id" class="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white/70 p-2 dark:border-zinc-700 dark:bg-zinc-950/45">
                <button
                  type="button"
                  class="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  :aria-pressed="selectedUrl === node.value"
                  @click="selectedUrl = node.value"
                >
                  <span class="flex items-center gap-2 text-sm font-medium">
                    <Check v-if="selectedUrl === node.value" :size="14" class="shrink-0 text-[var(--app-accent-600)]" aria-hidden="true" />
                    <span class="truncate">{{ node.label }}</span>
                  </span>
                  <span class="mt-0.5 block truncate font-mono text-[10px] text-zinc-400">{{ node.value }}</span>
                </button>
                <button
                  type="button"
                  class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                  :aria-label="`删除 ${node.label}`"
                  @click="emit('delete-custom-node', node.id)"
                >
                  <Trash2 :size="16" aria-hidden="true" />
                </button>
              </li>
            </ul>

            <details class="group mt-4 rounded-xl border border-dashed border-zinc-300 bg-white/60 dark:border-zinc-700 dark:bg-zinc-950/35">
              <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span class="inline-flex items-center gap-2"><Plus :size="16" aria-hidden="true" />添加节点</span>
                <ChevronDown :size="16" class="text-zinc-400 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <form class="space-y-3 border-t border-zinc-200 p-3 dark:border-zinc-700" @submit.prevent="emit('save-custom-node')">
                <div>
                  <label for="custom-speed-name" class="mb-1.5 block text-xs font-medium">节点名称</label>
                  <input
                    id="custom-speed-name"
                    v-model.trim="customLabel"
                    type="text"
                    maxlength="40"
                    class="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="例如：自建测速文件"
                    autocomplete="off"
                  />
                </div>
                <div>
                  <label for="custom-speed-url" class="mb-1.5 block text-xs font-medium">文件 URL</label>
                  <input
                    id="custom-speed-url"
                    v-model.trim="customUrl"
                    type="url"
                    class="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="https://example.com/large-file.bin"
                    autocomplete="url"
                  />
                </div>
                <p class="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  HTTPS 页面无法请求 HTTP 地址；目标服务器还需要允许浏览器跨域读取。
                </p>
                <p v-if="customError" class="text-xs text-rose-600 dark:text-rose-300" role="alert">{{ customError }}</p>
                <button type="submit" class="app-accent-solid inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition">
                  保存并选择
                </button>
              </form>
            </details>
          </section>

          <div class="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
            持续测速会反复下载所选文件并消耗大量流量，只有手动点击“停止测速”才会结束。请勿用于未经授权的地址。
          </div>

          <SettingsAboutSection class="mt-4" @open-privacy="openPrivacy" />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, useId, useTemplateRef, watch } from "vue";
import {
  Check,
  ChevronDown,
  Cpu,
  Link2,
  Plus,
  Server,
  Trash2,
  X,
} from "@lucide/vue";
import SettingsAboutSection from "@/components/app/SettingsAboutSection.vue";
import LiquidGlassThreadSlider from "@/components/speed/LiquidGlassThreadSlider.vue";
import { useDocumentScrollLock } from "@/composables/useDocumentScrollLock";
import { useTheme } from "@/composables/useTheme";

const THREAD_PRESETS = Object.freeze([4, 8, 16, 32]);
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const props = defineProps({
  active: { type: Boolean, default: true },
  nodeGroups: { type: Array, default: () => [] },
  customNodes: { type: Array, default: () => [] },
  selectedNodeLabel: { type: String, default: "" },
  threadCount: { type: Number, required: true },
  customError: { type: String, default: "" },
  returnFocusTarget: { type: Object, default: null },
});
const open = defineModel("open", { type: Boolean, default: false });
const selectedUrl = defineModel("selectedUrl", { type: String, required: true });
const customLabel = defineModel("customLabel", { type: String, default: "" });
const customUrl = defineModel("customUrl", { type: String, default: "" });
const emit = defineEmits([
  "update:thread-count",
  "save-custom-node",
  "delete-custom-node",
  "open-privacy",
]);
const titleId = useId();
const dialogRef = useTemplateRef("dialogRef");
const closeButtonRef = useTemplateRef("closeButtonRef");
const { isDark } = useTheme();
const builtInNodeGroups = computed(() => (
  props.nodeGroups.filter((group) => group.label !== "自定义")
));
let previouslyFocusedElement = null;
let skipFocusRestore = false;
useDocumentScrollLock(open);

function close() {
  open.value = false;
}

function updateThreadCount(value) {
  emit("update:thread-count", value);
}

async function changeThreadCount(event) {
  const input = event.target;
  updateThreadCount(input.value);
  await nextTick();
  if (input.isConnected) input.value = String(props.threadCount);
}

function getFocusableControls() {
  if (!dialogRef.value) return [];
  return [...dialogRef.value.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((element) => !element.hidden && element.getClientRects().length > 0);
}

function trapFocus(event) {
  const controls = getFocusableControls();
  if (!controls.length) {
    event.preventDefault();
    dialogRef.value?.focus();
    return;
  }

  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && (document.activeElement === first || !dialogRef.value.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.value.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}

async function openPrivacy() {
  skipFocusRestore = true;
  close();
  await nextTick();
  emit("open-privacy");
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

  if (skipFocusRestore) {
    skipFocusRestore = false;
    previouslyFocusedElement = null;
    return;
  }

  const focusTarget = props.returnFocusTarget?.isConnected
    ? props.returnFocusTarget
    : previouslyFocusedElement;
  previouslyFocusedElement = null;
  await nextTick();
  if (props.active && focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
}, { flush: "post" });
</script>

<style scoped>
.speed-settings-card {
  border: 1px solid color-mix(in srgb, var(--color-zinc-300) 78%, transparent);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--color-zinc-50) 76%, transparent);
  padding: 1rem;
}

.speed-settings-icon {
  display: inline-grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: 0.75rem;
  background: var(--app-accent-soft);
  color: var(--app-accent-700);
}

.speed-node-option {
  display: flex;
  min-width: 0;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border: 1px solid var(--color-zinc-200);
  border-radius: 0.75rem;
  background: rgb(255 255 255 / 80%);
  padding-inline: 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-zinc-600);
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
}

.speed-node-option:hover { border-color: var(--color-zinc-300); }
.speed-node-option:focus-visible { outline: 2px solid var(--app-accent-500); outline-offset: 2px; }
.speed-node-option.is-selected {
  border-color: color-mix(in srgb, var(--app-accent-500) 42%, transparent);
  background: var(--app-accent-soft);
  color: var(--app-accent-700);
}

.is-dark .speed-settings-card {
  border-color: rgb(255 255 255 / 10%);
  background: rgb(24 24 27 / 58%);
}

.is-dark .speed-settings-icon {
  background: color-mix(in srgb, var(--app-accent-950) 74%, transparent);
  color: var(--app-accent-300);
}

.is-dark .speed-node-option {
  border-color: var(--color-zinc-700);
  background: rgb(9 9 11 / 42%);
  color: var(--color-zinc-300);
}

.is-dark .speed-node-option:hover { border-color: var(--color-zinc-600); }
.is-dark .speed-node-option.is-selected {
  border-color: color-mix(in srgb, var(--app-accent-400) 45%, transparent);
  background: color-mix(in srgb, var(--app-accent-950) 72%, transparent);
  color: var(--app-accent-200);
}
</style>
