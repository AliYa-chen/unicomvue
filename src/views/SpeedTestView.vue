<template>
  <div
    class="speed-page text-zinc-900 dark:text-zinc-100"
    :inert="settingsOpen || undefined"
    :aria-hidden="settingsOpen ? 'true' : undefined"
  >
    <header class="speed-header">
      <div class="min-w-0">
        <p class="text-[11px] font-semibold tracking-[0.18em] text-indigo-500 uppercase dark:text-indigo-300">
          Continuous download
        </p>
        <h1 class="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">持续测速</h1>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <ThemeSelector compact />
        <button
          ref="settingsButtonRef"
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white/80 text-zinc-600 shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label="打开测速设置"
          title="测速设置"
          @click="openSettings"
        >
          <Settings2 :size="18" aria-hidden="true" />
        </button>
      </div>
    </header>

    <main class="speed-main">
      <section class="speed-core" aria-labelledby="live-speed-title">
        <div
          class="speed-gauge"
          :class="{ 'is-running': isRunning }"
          :style="{ '--gauge-level': `${gaugeLevel}%` }"
        >
          <div class="speed-gauge__inner">
            <span id="live-speed-title" class="text-xs font-semibold tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              下载速度
            </span>
            <span class="mt-1 max-w-full truncate px-3 tabular-nums text-[clamp(2.75rem,13vw,4rem)] font-semibold leading-none tracking-tight">
              {{ formattedSpeed }}
            </span>
            <span class="mt-2 text-base font-semibold text-zinc-500 dark:text-zinc-400">Mbps</span>
          </div>
        </div>

        <p
          class="speed-description"
          :class="{ 'text-rose-600 dark:text-rose-300': connectionError }"
          role="status"
          aria-live="polite"
        >
          {{ statusDescription }}
        </p>

        <div class="speed-chart-wrap">
          <div class="mb-2 flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold">测速曲线</h2>
            <span class="truncate text-xs text-zinc-400 dark:text-zinc-500">下载 Mbps</span>
          </div>
          <div class="speed-chart" role="img" :aria-label="chartAriaLabel">
            <div class="speed-chart__grid" aria-hidden="true"></div>
            <svg
              v-if="chartPoints.length > 1"
              class="relative h-full w-full"
              viewBox="0 0 640 120"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="speed-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#6366f1" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="chartArea" fill="url(#speed-chart-fill)" />
              <path
                :d="chartLine"
                fill="none"
                stroke="#6366f1"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
            <div v-else class="relative grid h-full place-items-center px-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
              {{ isRunning ? "正在等待速度样本…" : "开始后显示实时测速曲线" }}
            </div>
          </div>
        </div>

        <div class="speed-status">
          <div class="flex items-center justify-between gap-3 text-xs">
            <span class="inline-flex min-w-0 items-center gap-2 font-medium text-zinc-700 dark:text-zinc-200">
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                :class="isRunning ? 'animate-pulse bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'"
                aria-hidden="true"
              ></span>
              <span class="truncate">{{ phaseLabel }}</span>
            </span>
            <span class="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">{{ formattedElapsed }}</span>
          </div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
            <div class="speed-running-bar h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-500" :class="{ 'is-running': isRunning }"></div>
          </div>
        </div>

        <dl class="speed-summary" aria-label="测速摘要">
          <div>
            <dt>峰值</dt>
            <dd>{{ formatSpeed(peakMbps) }} <small>Mbps</small></dd>
          </div>
          <div>
            <dt>已下载</dt>
            <dd>{{ formatBytes(totalBytes) }}</dd>
          </div>
          <div>
            <dt>线程</dt>
            <dd>{{ connectedThreads }}/{{ threadCount }}</dd>
          </div>
        </dl>

        <button
          type="button"
          class="speed-action"
          :class="isRunning ? 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700' : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400'"
          @click="isRunning ? stop() : start()"
        >
          <Square v-if="isRunning" :size="15" fill="currentColor" aria-hidden="true" />
          <Play v-else :size="17" fill="currentColor" aria-hidden="true" />
          {{ isRunning ? "停止测速" : phase === "stopped" || phase === "error" ? "重新开始" : "开始测速" }}
        </button>
      </section>
    </main>
  </div>

  <Teleport defer to="#app-top-modal-root">
    <div
      v-if="settingsOpen"
      class="fixed inset-0 z-[130] flex items-end justify-center sm:items-center sm:p-5"
      @keydown.esc.stop.prevent="settingsOpen = false"
    >
      <button
        type="button"
        class="absolute inset-0 cursor-default bg-zinc-950/55 backdrop-blur-[1px]"
        aria-label="关闭测速设置"
        tabindex="-1"
        @click="settingsOpen = false"
      ></button>
      <section
        ref="settingsDialogRef"
        class="relative flex max-h-[min(88dvh,46rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.5rem] border border-zinc-200 bg-white text-zinc-900 shadow-2xl outline-none sm:rounded-[1.5rem] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="speed-settings-title"
        tabindex="-1"
        @keydown.tab="handleSettingsTab"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 id="speed-settings-title" class="font-semibold">测速设置</h2>
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">运行中修改节点或线程数会立即生效</p>
          </div>
          <button
            ref="settingsCloseRef"
            type="button"
            class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label="关闭测速设置"
            @click="settingsOpen = false"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </header>

        <div class="min-h-0 overflow-y-auto px-5 py-4">
          <div>
            <label for="speed-node" class="mb-2 block text-sm font-medium">测速文件</label>
            <select
              id="speed-node"
              v-model="selectedUrl"
              class="min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <optgroup v-for="group in nodeGroups" :key="group.label" :label="group.label">
                <option v-for="node in group.options" :key="node.value" :value="node.value">
                  {{ node.label }}
                </option>
              </optgroup>
            </select>
            <p class="mt-2 break-all text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">{{ selectedUrl }}</p>
          </div>

          <div class="mt-5">
            <div class="mb-2 flex items-center justify-between gap-3">
              <label for="speed-threads" class="text-sm font-medium">线程数</label>
              <input
                class="h-9 w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-center text-base tabular-nums outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-950"
                type="number"
                min="1"
                max="64"
                :value="threadCount"
                aria-label="测速线程数"
                @change="setThreadCount($event.target.value)"
              />
            </div>
            <input
              id="speed-threads"
              class="w-full accent-indigo-600"
              type="range"
              min="1"
              max="64"
              step="1"
              :value="threadCount"
              @input="setThreadCount($event.target.value)"
            />
            <div class="mt-1 flex justify-between text-[11px] text-zinc-400"><span>1</span><span>64</span></div>
          </div>

          <div class="my-5 h-px bg-zinc-100 dark:bg-zinc-800"></div>

          <form class="space-y-3" @submit.prevent="saveCustomNode">
            <div>
              <h3 class="text-sm font-medium">添加自定义地址</h3>
              <p class="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                填写允许跨域访问的完整文件 URL。HTTPS 页面无法使用 HTTP 地址。
              </p>
            </div>
            <label for="custom-speed-name" class="sr-only">自定义地址名称</label>
            <input
              id="custom-speed-name"
              v-model.trim="customLabel"
              type="text"
              maxlength="40"
              class="min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="地址名称"
              autocomplete="off"
            />
            <label for="custom-speed-url" class="sr-only">自定义测速文件 URL</label>
            <input
              id="custom-speed-url"
              v-model.trim="customUrl"
              type="url"
              class="min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="https://example.com/large-file.bin"
              autocomplete="url"
            />
            <p v-if="customError" class="text-xs text-rose-600 dark:text-rose-300" role="alert">{{ customError }}</p>
            <button type="submit" class="inline-flex min-h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
              保存并选择
            </button>
          </form>

          <ul v-if="customNodes.length" class="mt-4 space-y-2" aria-label="自定义测速地址">
            <li v-for="node in customNodes" :key="node.id" class="flex min-w-0 items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ node.label }}</p>
                <p class="truncate text-[11px] text-zinc-400">{{ node.value }}</p>
              </div>
              <button type="button" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300" :aria-label="`删除 ${node.label}`" @click="removeCustomNode(node.id)">
                <Trash2 :size="16" aria-hidden="true" />
              </button>
            </li>
          </ul>

          <div class="mt-5 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
            持续测速会反复下载所选文件并消耗大量流量，只有手动点击“停止测速”才会结束。请勿用于未经授权的地址。
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import { Play, Settings2, Square, Trash2, X } from "@lucide/vue";
import ThemeSelector from "@/components/app/ThemeSelector.vue";
import { useDocumentScrollLock } from "@/composables/useDocumentScrollLock";
import { useSpeedTest } from "@/composables/useSpeedTest";

const props = defineProps({ active: { type: Boolean, default: false } });
const settingsOpen = defineModel("settingsOpen", { type: Boolean, default: false });
const settingsButtonRef = useTemplateRef("settingsButtonRef");
const settingsDialogRef = useTemplateRef("settingsDialogRef");
const settingsCloseRef = useTemplateRef("settingsCloseRef");
const customLabel = ref("");
const customUrl = ref("");
const customError = ref("");
let settingsReturnFocus = null;
useDocumentScrollLock(settingsOpen);

const {
  nodeGroups,
  customNodes,
  selectedUrl,
  selectedNodeLabel,
  threadCount,
  phase,
  isRunning,
  currentMbps,
  peakMbps,
  totalBytes,
  elapsedMs,
  samples,
  connectionError,
  connectedThreads,
  setThreadCount,
  addCustomNode,
  removeCustomNode,
  start,
  stop,
} = useSpeedTest();

const formattedSpeed = computed(() => formatSpeed(currentMbps.value));
const formattedElapsed = computed(() => {
  const totalSeconds = Math.floor(elapsedMs.value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});
const gaugeLevel = computed(() => {
  if (!isRunning.value || currentMbps.value <= 0) return 0;
  return Math.min(100, 18 + Math.log10(currentMbps.value + 1) * 34);
});
const phaseLabel = computed(() => {
  if (phase.value === "starting") return "正在连接";
  if (phase.value === "running") return "持续测速中";
  if (phase.value === "stopped") return "已手动停止";
  if (phase.value === "error") return "无法开始测速";
  return "准备就绪";
});
const statusDescription = computed(() => {
  if (connectionError.value) return `${connectionError.value}，正在自动重试…`;
  if (isRunning.value) {
    return `${selectedNodeLabel.value} · ${connectedThreads.value}/${threadCount.value} 线程已连接`;
  }
  if (phase.value === "stopped") return `已停止，本次共下载 ${formatBytes(totalBytes.value)}`;
  return "开始后会持续下载，只有手动停止才会结束。";
});

const chartPoints = computed(() => {
  const values = samples.value.slice(-60);
  if (values.length < 2) return [];
  const maximum = Math.max(1, ...values.map((sample) => sample.mbps)) * 1.12;
  return values.map((sample, index) => ({
    x: 8 + (index / (values.length - 1)) * 624,
    y: 110 - (sample.mbps / maximum) * 98,
  }));
});
const chartLine = computed(() => chartPoints.value.map((point, index) => (
  `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`
)).join(" "));
const chartArea = computed(() => chartPoints.value.length
  ? `${chartLine.value} L${chartPoints.value.at(-1).x.toFixed(1)},120 L8,120 Z`
  : "");
const chartAriaLabel = computed(() => samples.value.length
  ? `最近下载速度 ${formatSpeed(currentMbps.value)} Mbps，峰值 ${formatSpeed(peakMbps.value)} Mbps`
  : "尚无测速数据");

function formatSpeed(value) {
  if (!Number.isFinite(value)) return "0.0";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: value >= 1000 ? 0 : 1,
  }).format(value);
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let amount = bytes;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : amount >= 100 ? 0 : 1;
  return `${amount.toFixed(digits)} ${units[unitIndex]}`;
}

function saveCustomNode() {
  const result = addCustomNode(customLabel.value, customUrl.value);
  if (!result.ok) {
    customError.value = result.error;
    return;
  }
  customLabel.value = "";
  customUrl.value = "";
  customError.value = "";
}

function openSettings() {
  settingsReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : settingsButtonRef.value;
  settingsOpen.value = true;
}

function handleSettingsTab(event) {
  const dialog = settingsDialogRef.value;
  if (!dialog) return;
  const controls = [...dialog.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden);
  if (!controls.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(settingsOpen, async (open) => {
  if (open) {
    customError.value = "";
    await nextTick();
    settingsCloseRef.value?.focus();
    return;
  }

  const focusTarget = settingsReturnFocus;
  settingsReturnFocus = null;
  await nextTick();
  if (props.active && focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
});

watch(() => props.active, (active) => {
  if (!active) settingsOpen.value = false;
});
</script>

<style scoped>
.speed-page {
  min-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  padding: clamp(1rem, 3dvh, 2rem) 1rem 6rem;
}

.speed-header {
  display: flex;
  width: min(100%, 56rem);
  margin-inline: auto;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.speed-main {
  display: grid;
  width: min(100%, 36rem);
  margin: clamp(0.75rem, 2dvh, 1.4rem) auto 0;
  place-items: center;
}

.speed-core {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: stretch;
}

.speed-gauge {
  --gauge-level: 0%;
  position: relative;
  display: grid;
  width: clamp(11.75rem, 24dvh, 14rem);
  aspect-ratio: 1;
  margin-inline: auto;
  place-items: center;
  border-radius: 999px;
  background: conic-gradient(from -90deg, #6366f1 0 var(--gauge-level), #e4e4e7 var(--gauge-level) 100%);
  box-shadow: 0 16px 50px rgb(99 102 241 / 12%);
  transition: background 300ms ease;
}

.speed-gauge::before {
  position: absolute;
  inset: -8%;
  border-radius: inherit;
  background: radial-gradient(circle, rgb(99 102 241 / 11%), transparent 66%);
  content: "";
  filter: blur(16px);
  opacity: 0;
  transition: opacity 300ms ease;
}

.speed-gauge.is-running::before { opacity: 1; }

.speed-gauge__inner {
  position: absolute;
  inset: 0.7rem;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  overflow: hidden;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 25%, rgb(255 255 255 / 100%), rgb(250 250 250 / 98%) 72%);
  box-shadow: inset 0 2px 10px rgb(99 102 241 / 7%);
}

.speed-description {
  min-height: 1.25rem;
  margin-top: clamp(0.7rem, 1.8dvh, 1.1rem);
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  line-height: 1.25rem;
  color: var(--color-zinc-500);
}

.speed-chart-wrap { margin-top: clamp(0.75rem, 1.8dvh, 1.15rem); }

.speed-chart {
  position: relative;
  height: clamp(7rem, 12dvh, 8.5rem);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-zinc-300) 75%, transparent);
  border-radius: 1.35rem;
  background: rgb(250 250 250 / 62%);
}

.speed-chart__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgb(161 161 170 / 13%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(161 161 170 / 13%) 1px, transparent 1px);
  background-size: 20% 33.333%;
}

.speed-status { margin-top: clamp(0.7rem, 1.6dvh, 1rem); }

.speed-running-bar {
  width: 0;
  opacity: 0;
}

.speed-running-bar.is-running {
  width: 42%;
  opacity: 1;
  animation: speed-running 1.35s ease-in-out infinite alternate;
}

.speed-summary {
  display: grid;
  margin-top: clamp(0.7rem, 1.6dvh, 1rem);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-block: 1px solid color-mix(in srgb, var(--color-zinc-300) 60%, transparent);
  padding-block: 0.55rem;
}

.speed-summary > div { min-width: 0; text-align: center; }
.speed-summary > div + div { border-left: 1px solid color-mix(in srgb, var(--color-zinc-300) 60%, transparent); }
.speed-summary dt { font-size: 0.65rem; color: var(--color-zinc-400); }
.speed-summary dd { margin-top: 0.1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.speed-summary small { font-size: 0.6rem; font-weight: 500; color: var(--color-zinc-400); }

.speed-action {
  display: inline-flex;
  min-height: 3rem;
  width: 100%;
  margin-top: clamp(0.7rem, 1.6dvh, 1rem);
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.9rem;
  font-size: 0.875rem;
  font-weight: 600;
  transition: color 160ms ease, background-color 160ms ease, transform 160ms ease;
}

.speed-action:active { transform: scale(0.99); }
.speed-action:focus-visible { outline: 2px solid var(--color-indigo-500); outline-offset: 2px; }

:global(.dark) .speed-gauge {
  background: conic-gradient(from -90deg, #818cf8 0 var(--gauge-level), #3f3f46 var(--gauge-level) 100%);
  box-shadow: 0 16px 50px rgb(99 102 241 / 10%);
}

:global(.dark) .speed-gauge__inner {
  background: radial-gradient(circle at 50% 25%, rgb(39 39 42 / 100%), rgb(24 24 27 / 99%) 72%);
  box-shadow: inset 0 2px 10px rgb(0 0 0 / 20%);
}

:global(.dark) .speed-description { color: var(--color-zinc-400); }
:global(.dark) .speed-chart { border-color: rgb(255 255 255 / 10%); background: rgb(9 9 11 / 35%); }
:global(.dark) .speed-summary { border-color: rgb(255 255 255 / 10%); }
:global(.dark) .speed-summary > div + div { border-color: rgb(255 255 255 / 10%); }

@keyframes speed-running {
  from { transform: translateX(-100%); }
  to { transform: translateX(240%); }
}

@media (max-height: 700px) and (max-width: 640px) {
  .speed-page { padding-top: 0.65rem; }
  .speed-header p { display: none; }
  .speed-main { margin-top: 0.45rem; }
  .speed-gauge { width: min(10.5rem, 27dvh); }
  .speed-description, .speed-chart-wrap, .speed-status, .speed-summary, .speed-action { margin-top: 0.5rem; }
  .speed-chart { height: min(6.5rem, 16dvh); }
  .speed-action { min-height: 2.75rem; }
}

@media (prefers-reduced-motion: reduce) {
  .speed-running-bar.is-running { animation: none; transform: translateX(70%); }
  .speed-gauge, .speed-gauge::before { transition: none; }
}
</style>
