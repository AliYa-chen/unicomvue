<template>
  <div
    class="speed-page text-zinc-900 dark:text-zinc-100"
    :inert="settingsOpen || undefined"
    :aria-hidden="settingsOpen ? 'true' : undefined"
  >
    <header class="speed-header">
      <PageHeading eyebrow="Continuous download" title="跑满了吗" />
      <div class="flex shrink-0 items-center gap-2">
        <div class="hidden sm:block"><ThemeSelector compact /></div>
        <HeaderIconButton
          ref="settingsButtonRef"
          label="打开测速设置"
          title="测速设置"
          @click="openSettings"
        >
          <Settings2 :size="18" aria-hidden="true" />
        </HeaderIconButton>
      </div>
    </header>

    <main class="speed-main">
      <section class="speed-core" aria-labelledby="live-speed-title">
        <SpeedGauge
          heading-id="live-speed-title"
          :speed-mbps="currentMbps"
          :node-label="selectedNodeLabel"
          :running="isRunning"
          :active="active"
        />
        <NetworkStatusBar
          class="speed-network-status"
          :profile="networkProfile"
          :latency-ms="networkLatencyMs"
          :loading="networkLoading"
          :failed="networkFailed"
          :offline="networkOffline"
          @retry="refreshNetworkStatus"
        />

        <SpeedChart
          :current-mbps="currentMbps"
          :peak-mbps="peakMbps"
          :samples="samples"
          :running="isRunning"
        />

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
    :node-list-loading="nodeListLoading"
    :node-list-error="nodeListError"
    :thread-count="threadCount"
    :custom-error="customError"
    :return-focus-target="settingsButtonRef"
    @update:thread-count="setThreadCount"
    @save-custom-node="saveCustomNode"
    @delete-custom-node="removeCustomNode"
    @refresh-nodes="refreshNodeGroups"
  />
</template>

<script setup>
import {
  computed,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import { Play, Settings2, Square } from "@lucide/vue";
import HeaderIconButton from "@/components/app/HeaderIconButton.vue";
import PageHeading from "@/components/app/PageHeading.vue";
import ThemeSelector from "@/components/app/ThemeSelector.vue";
import NetworkStatusBar from "@/components/speed/NetworkStatusBar.vue";
import SpeedChart from "@/components/speed/SpeedChart.vue";
import SpeedGauge from "@/components/speed/SpeedGauge.vue";
import SpeedSettingsDialog from "@/components/speed/SpeedSettingsDialog.vue";
import { useNetworkStatus } from "@/composables/useNetworkStatus";
import { useSpeedTest } from "@/composables/useSpeedTest";
import {
  formatBytes,
  formatElapsedTime,
  formatSpeed,
} from "@/domain/speedMetrics";

const props = defineProps({ active: { type: Boolean, default: false } });
const settingsOpen = defineModel("settingsOpen", { type: Boolean, default: false });
const settingsButtonRef = useTemplateRef("settingsButtonRef");
const customLabel = ref("");
const customUrl = ref("");
const customError = ref("");
const {
  profile: networkProfile,
  latencyMs: networkLatencyMs,
  loading: networkLoading,
  failed: networkFailed,
  offline: networkOffline,
  refresh: refreshNetworkStatus,
} = useNetworkStatus();

const {
  nodeGroups,
  customNodes,
  nodeListLoading,
  nodeListError,
  refreshNodeGroups,
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
  connectedThreads,
  setThreadCount,
  addCustomNode,
  removeCustomNode,
  start,
  stop,
} = useSpeedTest();

const formattedElapsed = computed(() => formatElapsedTime(elapsedMs.value));
const phaseLabel = computed(() => {
  if (phase.value === "starting") return "正在连接";
  if (phase.value === "running") return "持续测速中";
  if (phase.value === "stopped") return "已手动停止";
  if (phase.value === "error") return "无法开始测速";
  return "准备就绪";
});
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
  void refreshNodeGroups();
}

watch(settingsOpen, (open) => {
  if (open) customError.value = "";
});

watch(() => props.active, (active) => {
  if (!active) settingsOpen.value = false;
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
  min-width: 0;
  flex-direction: column;
  align-items: stretch;
}

.speed-network-status { margin-top: clamp(0.55rem, 1.4dvh, 0.85rem); }

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
  .speed-network-status, .speed-summary, .speed-action { margin-top: 0.5rem; }
  .speed-status { display: none; }
  .speed-summary { padding-block: 0.45rem; }
  .speed-action { min-height: 2.75rem; }
}

@media (max-width: 359px) {
  .speed-header { gap: 0.5rem; }
}

@media (max-width: 640px) and (max-height: 700px) {
  .speed-main { margin-top: 0.25rem; }
  .speed-network-status, .speed-summary, .speed-action { margin-top: 0.25rem; }
  .speed-summary { padding-block: 0.3rem; }
  .speed-action { min-height: 2.5rem; }
}

@media (prefers-reduced-motion: reduce) {
  .speed-running-bar.is-running { animation: none; transform: translateX(70%); }
}
</style>
