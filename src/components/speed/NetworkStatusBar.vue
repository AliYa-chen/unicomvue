<template>
  <div
    class="network-status-bar"
    :aria-label="accessibleLabel"
    title="网络延迟为浏览器到探测地址的 HTTP 往返耗时，仅供参考"
  >
    <span class="network-status-bar__latency" :class="latencyTone">
      <LoaderCircle v-if="loading" :size="13" class="animate-spin" aria-hidden="true" />
      <WifiOff v-else-if="offline" :size="13" aria-hidden="true" />
      <span v-else class="tabular-nums">{{ latencyLabel }}</span>
    </span>

    <span class="network-status-bar__details">
      <span class="network-status-bar__location">{{ primaryLabel }}</span>
      <span v-if="profile.routeLabel" class="network-status-bar__route">
        {{ profile.routeLabel }}
      </span>
      <span v-if="profile.carrierLabel" class="network-status-bar__meta">
        {{ profile.carrierLabel }}
      </span>
      <span v-if="profile.networkTypeLabel" class="network-status-bar__meta">
        {{ profile.networkTypeLabel }}
      </span>
    </span>

    <button
      v-if="failed"
      type="button"
      class="network-status-bar__retry"
      aria-label="重新获取网络状态"
      title="重新获取网络状态"
      @click="emit('retry')"
    >
      <RefreshCw :size="14" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { LoaderCircle, RefreshCw, WifiOff } from "@lucide/vue";

const props = defineProps({
  profile: {
    type: Object,
    default: () => ({
      locationLabel: "",
      carrierLabel: "",
      networkTypeLabel: "",
      routeLabel: "",
    }),
  },
  latencyMs: { type: Number, default: null },
  loading: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
  offline: { type: Boolean, default: false },
});
const emit = defineEmits(["retry"]);

const latencyLabel = computed(() => (
  Number.isFinite(props.latencyMs) ? `${props.latencyMs}ms` : "— ms"
));
const latencyTone = computed(() => {
  if (props.offline || !Number.isFinite(props.latencyMs)) return "is-neutral";
  if (props.latencyMs <= 50) return "is-good";
  if (props.latencyMs <= 120) return "is-fair";
  return "is-poor";
});
const primaryLabel = computed(() => {
  if (props.offline) return "当前网络已断开";
  if (props.profile.locationLabel) return props.profile.locationLabel;
  if (props.loading) return "正在识别当前网络…";
  return "网络信息暂不可用";
});
const accessibleLabel = computed(() => [
  props.offline ? "网络离线" : `网络延迟 ${latencyLabel.value}`,
  props.profile.locationLabel,
  props.profile.carrierLabel,
  props.profile.networkTypeLabel,
  props.profile.routeLabel,
].filter(Boolean).join("，"));
</script>

<style scoped>
.network-status-bar {
  display: flex;
  min-height: 2.5rem;
  width: fit-content;
  max-width: 100%;
  margin-inline: auto;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid rgb(228 228 231 / 82%);
  border-radius: 0.9rem;
  background: rgb(255 255 255 / 72%);
  padding: 0.35rem 0.45rem;
  box-shadow: 0 8px 24px rgb(24 24 27 / 6%);
}

.network-status-bar__latency {
  display: inline-flex;
  min-width: 3.55rem;
  height: 1.8rem;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 0.55rem;
  padding-inline: 0.55rem;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.network-status-bar__latency.is-good { background: rgb(16 185 129 / 12%); color: #047857; }
.network-status-bar__latency.is-fair { background: rgb(245 158 11 / 14%); color: #b45309; }
.network-status-bar__latency.is-poor { background: rgb(244 63 94 / 12%); color: #be123c; }
.network-status-bar__latency.is-neutral { background: rgb(161 161 170 / 13%); color: #71717a; }

.network-status-bar__details {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  line-height: 1.1rem;
}

.network-status-bar__location {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: #3f3f46;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.network-status-bar__meta {
  min-width: 0;
  max-width: min(9rem, 32vw);
  flex: 0 1 auto;
  overflow: hidden;
  color: #71717a;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.network-status-bar__route {
  flex: none;
  border-radius: 999px;
  background: rgb(59 130 246 / 10%);
  padding: 0.1rem 0.45rem;
  color: #2563eb;
  font-size: 0.65rem;
  font-weight: 650;
  white-space: nowrap;
}

.network-status-bar__retry {
  display: inline-grid;
  width: 1.8rem;
  height: 1.8rem;
  flex: none;
  cursor: pointer;
  place-items: center;
  border: 0;
  border-radius: 0.55rem;
  background: transparent;
  color: #71717a;
}
.network-status-bar__retry:hover { background: rgb(161 161 170 / 12%); color: #27272a; }
.network-status-bar__retry:focus-visible { outline: 2px solid var(--app-accent-500); outline-offset: 2px; }

:global(.dark .network-status-bar) {
  border-color: rgb(255 255 255 / 10%);
  background: rgb(9 9 11 / 52%);
  box-shadow: 0 10px 28px rgb(0 0 0 / 16%);
}
:global(.dark .network-status-bar__latency.is-good) { background: rgb(52 211 153 / 13%); color: #6ee7b7; }
:global(.dark .network-status-bar__latency.is-fair) { background: rgb(251 191 36 / 14%); color: #fcd34d; }
:global(.dark .network-status-bar__latency.is-poor) { background: rgb(251 113 133 / 13%); color: #fda4af; }
:global(.dark .network-status-bar__latency.is-neutral) { background: rgb(255 255 255 / 8%); color: #a1a1aa; }
:global(.dark .network-status-bar__location) { color: #e4e4e7; }
:global(.dark .network-status-bar__meta) { color: #a1a1aa; }
:global(.dark .network-status-bar__route) { background: rgb(96 165 250 / 13%); color: #93c5fd; }
:global(.dark .network-status-bar__retry) { color: #a1a1aa; }
:global(.dark .network-status-bar__retry:hover) { background: rgb(255 255 255 / 8%); color: #f4f4f5; }

@media (max-width: 480px) {
  .network-status-bar { width: 100%; }
  .network-status-bar__details { flex: 1; }
}
</style>
