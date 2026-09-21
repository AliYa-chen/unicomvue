<template>
  <div
    class="speed-page text-zinc-900 dark:text-zinc-100"
    :inert="settingsOpen || undefined"
    :aria-hidden="settingsOpen ? 'true' : undefined"
  >
    <header class="speed-header">
      <PageHeading eyebrow="Continuous download" title="持续测速" />
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
            <span
              ref="speedValueRef"
              class="speed-gauge__value mt-1 px-3 tabular-nums font-semibold leading-none tracking-tight"
            >
              {{ formattedSpeed }}
            </span>
            <span class="mt-2 text-base font-semibold text-zinc-500 dark:text-zinc-400">Mbps</span>
          </div>
        </div>

        <p
          class="speed-description"
          :class="{ 'is-error': connectionError }"
          role="status"
          aria-live="polite"
        >
          {{ statusDescription }}
        </p>

        <NetworkStatusBar
          class="speed-network-status"
          :profile="networkProfile"
          :latency-ms="networkLatencyMs"
          :loading="networkLoading"
          :failed="networkFailed"
          :offline="networkOffline"
          @retry="refreshNetworkStatus"
        />

        <div class="speed-chart-wrap">
          <div class="speed-chart-heading mb-2 flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold">测速曲线</h2>
            <span class="truncate text-xs text-zinc-500 dark:text-zinc-400">下载 Mbps</span>
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
                  <stop offset="0%" stop-color="var(--app-accent-500)" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="var(--app-accent-500)" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="chartArea" fill="url(#speed-chart-fill)" />
              <path
                :d="chartLine"
                fill="none"
                stroke="var(--app-accent-500)"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
            <div v-else class="relative grid h-full place-items-center px-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
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
            <div class="speed-running-bar h-full rounded-full" :class="{ 'is-running': isRunning }"></div>
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
            <dt>传输 / 配置</dt>
            <dd>{{ connectedThreads }}/{{ threadCount }}</dd>
          </div>
        </dl>

        <button
          type="button"
          class="speed-action"
          :class="isRunning ? 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700' : 'app-accent-solid shadow-sm'"
          @click="isRunning ? stop() : start()"
        >
          <Square v-if="isRunning" :size="15" fill="currentColor" aria-hidden="true" />
          <Play v-else :size="17" fill="currentColor" aria-hidden="true" />
          {{ isRunning ? "停止测速" : phase === "stopped" || phase === "error" ? "重新开始" : "开始测速" }}
        </button>
      </section>
    </main>
  </div>

  <SpeedSettingsDialog
    v-model:open="settingsOpen"
    v-model:selected-url="selectedUrl"
    v-model:custom-label="customLabel"
    v-model:custom-url="customUrl"
    :active="active"
    :node-groups="nodeGroups"
    :custom-nodes="customNodes"
    :selected-node-label="selectedNodeLabel"
    :thread-count="threadCount"
    :custom-error="customError"
    :return-focus-target="settingsButtonRef"
    @update:thread-count="setThreadCount"
    @save-custom-node="saveCustomNode"
    @delete-custom-node="removeCustomNode"
    @open-privacy="openPrivacy"
  />
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import { Play, Settings2, Square } from "@lucide/vue";
import PageHeading from "@/components/app/PageHeading.vue";
import ThemeSelector from "@/components/app/ThemeSelector.vue";
import NetworkStatusBar from "@/components/speed/NetworkStatusBar.vue";
import SpeedSettingsDialog from "@/components/speed/SpeedSettingsDialog.vue";
import { useNetworkStatus } from "@/composables/useNetworkStatus";
import { usePrivacy } from "@/composables/usePrivacy";
import { useSpeedTest } from "@/composables/useSpeedTest";

const props = defineProps({ active: { type: Boolean, default: false } });
const settingsOpen = defineModel("settingsOpen", { type: Boolean, default: false });
const settingsButtonRef = useTemplateRef("settingsButtonRef");
const speedValueRef = useTemplateRef("speedValueRef");
const customLabel = ref("");
const customUrl = ref("");
const customError = ref("");
const { openPrivacy } = usePrivacy();
const {
  profile: networkProfile,
  latencyMs: networkLatencyMs,
  loading: networkLoading,
  failed: networkFailed,
  offline: networkOffline,
  refresh: refreshNetworkStatus,
} = useNetworkStatus();
let speedValueResizeObserver = null;
let speedValueFitFrame = 0;

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
  startedThreads,
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
    const waitingThreads = Math.max(0, startedThreads.value - connectedThreads.value);
    const waitingLabel = waitingThreads ? ` · ${waitingThreads} 条等待` : "";
    return `${selectedNodeLabel.value} · ${connectedThreads.value} 条传输${waitingLabel}`;
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
  const fractionDigits = value >= 1000 ? 0 : 1;
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function fitSpeedValue() {
  speedValueFitFrame = 0;
  const element = speedValueRef.value;
  const container = element?.parentElement;
  if (!element || !container || container.clientWidth <= 0) return;

  element.style.removeProperty("--speed-value-size");
  const styles = getComputedStyle(element);
  const baseSize = Number.parseFloat(styles.fontSize);
  const horizontalPadding = Number.parseFloat(styles.paddingLeft)
    + Number.parseFloat(styles.paddingRight);
  const availableWidth = Math.max(1, container.clientWidth - horizontalPadding - 8);
  const naturalWidth = Math.max(1, element.getBoundingClientRect().width - horizontalPadding);
  if (naturalWidth <= availableWidth || !Number.isFinite(baseSize)) return;

  const fittedSize = baseSize * (availableWidth / naturalWidth) * 0.98;
  element.style.setProperty("--speed-value-size", `${Math.max(1, fittedSize)}px`);
}

function scheduleSpeedValueFit() {
  if (speedValueFitFrame) cancelAnimationFrame(speedValueFitFrame);
  speedValueFitFrame = requestAnimationFrame(fitSpeedValue);
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
  settingsOpen.value = true;
}

watch(() => formattedSpeed.value.length, async () => {
  await nextTick();
  scheduleSpeedValueFit();
}, { flush: "post" });

watch(settingsOpen, (open) => {
  if (open) customError.value = "";
});

watch(() => props.active, (active) => {
  if (!active) settingsOpen.value = false;
  else nextTick(scheduleSpeedValueFit);
});

onMounted(() => {
  const container = speedValueRef.value?.parentElement;
  if (typeof ResizeObserver !== "undefined" && container) {
    speedValueResizeObserver = new ResizeObserver(scheduleSpeedValueFit);
    speedValueResizeObserver.observe(container);
  }
  scheduleSpeedValueFit();
});

onBeforeUnmount(() => {
  speedValueResizeObserver?.disconnect();
  if (speedValueFitFrame) cancelAnimationFrame(speedValueFitFrame);
});
</script>

<style scoped>
.speed-page {
  min-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  padding: clamp(1rem, 3dvh, 2rem) 1rem 7.5rem;
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
  background: conic-gradient(from -90deg, var(--app-accent-500) 0 var(--gauge-level), #e4e4e7 var(--gauge-level) 100%);
  box-shadow: 0 16px 50px color-mix(in srgb, var(--app-accent-500) 12%, transparent);
  transition: background 300ms ease;
}

.speed-gauge::before {
  position: absolute;
  inset: -8%;
  border-radius: inherit;
  background: radial-gradient(circle, color-mix(in srgb, var(--app-accent-500) 11%, transparent), transparent 66%);
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
  box-shadow: inset 0 2px 10px color-mix(in srgb, var(--app-accent-500) 7%, transparent);
}

.speed-gauge__value {
  display: inline-block;
  flex: none;
  max-width: none;
  white-space: nowrap;
  font-size: var(--speed-value-size, clamp(2.75rem, 13vw, 4rem));
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
.speed-description.is-error { color: var(--color-rose-600); }

.speed-network-status { margin-top: clamp(0.55rem, 1.4dvh, 0.85rem); }

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
  background: linear-gradient(90deg, var(--app-accent-600), var(--app-accent-300), var(--app-accent-600));
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

:global(.dark .speed-gauge) {
  background: conic-gradient(from -90deg, var(--app-accent-400) 0 var(--gauge-level), #3f3f46 var(--gauge-level) 100%);
  box-shadow: 0 16px 50px color-mix(in srgb, var(--app-accent-500) 10%, transparent);
}

:global(.dark .speed-gauge__inner) {
  background: radial-gradient(circle at 50% 25%, rgb(39 39 42 / 100%), rgb(24 24 27 / 99%) 72%);
  box-shadow: inset 0 2px 10px rgb(0 0 0 / 20%);
  color: #f4f4f5;
}

:global(.dark .speed-description) { color: var(--color-zinc-400); }
:global(.dark .speed-description.is-error) { color: var(--color-rose-300); }
:global(.dark .speed-chart) { border-color: rgb(255 255 255 / 10%); background: rgb(9 9 11 / 35%); }
:global(.dark .speed-summary) { border-color: rgb(255 255 255 / 10%); }
:global(.dark .speed-summary > div + div) { border-color: rgb(255 255 255 / 10%); }
@keyframes speed-running {
  from { transform: translateX(-100%); }
  to { transform: translateX(240%); }
}

@media (max-width: 640px) {
  .speed-page {
    height: calc(
      100dvh
      - env(safe-area-inset-top, 0px)
      - env(safe-area-inset-bottom, 0px)
    );
    min-height: 0;
    overflow: clip;
    padding-top: clamp(1rem, 3dvh, 2rem);
    padding-inline: 0.75rem;
  }
  .speed-header { width: min(calc(100% - 0.5rem), 56rem); }
  .speed-main { margin-top: clamp(0.25rem, 1.5dvh, 0.75rem); }
  .speed-gauge { width: clamp(9rem, 22dvh, 12rem); }
  .speed-description, .speed-network-status, .speed-chart-wrap, .speed-summary, .speed-action { margin-top: 0.5rem; }
  .speed-chart-heading { margin-bottom: 0.25rem; }
  .speed-chart { height: clamp(6rem, 11dvh, 7rem); }
  .speed-status { display: none; }
  .speed-summary { padding-block: 0.45rem; }
  .speed-action { min-height: 2.75rem; }
}

@media (max-width: 359px) {
  .speed-header { gap: 0.5rem; }
}

@media (max-width: 640px) and (max-height: 700px) {
  .speed-main { margin-top: 0.25rem; }
  .speed-gauge { width: min(9.25rem, 22dvh); }
  .speed-description, .speed-network-status, .speed-chart-wrap, .speed-summary, .speed-action { margin-top: 0.25rem; }
  .speed-chart { height: min(4.5rem, 12dvh); }
  .speed-summary { padding-block: 0.3rem; }
  .speed-action { min-height: 2.5rem; }
}

@media (prefers-reduced-motion: reduce) {
  .speed-running-bar.is-running { animation: none; transform: translateX(70%); }
  .speed-gauge, .speed-gauge::before { transition: none; }
}
</style>
