<template>
  <div
    ref="barRef"
    class="network-status-bar"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
  >
    <div ref="contentRef" class="network-status-bar__content">
      <button
        type="button"
        class="network-status-bar__trigger"
        :aria-label="`${accessibleLabel}，查看公网 IP`"
        :aria-describedby="tooltipVisible ? tooltipId : undefined"
        :aria-expanded="tooltipVisible"
        @click="toggleTooltip"
        @focus="handleFocus"
        @blur="handleBlur"
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
      </button>

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

    <div
      v-if="tooltipVisible"
      :id="tooltipId"
      class="network-status-bar__tooltip"
      role="tooltip"
    >
      <code
        class="network-status-bar__tooltip-value"
        :class="{ 'is-placeholder': !publicIpAvailable }"
        dir="ltr"
      >{{ publicIpLabel }}</code>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  useTemplateRef,
} from "vue";
import { LoaderCircle, RefreshCw, WifiOff } from "@lucide/vue";

const MOBILE_MEDIA_QUERY = "(max-width: 480px)";
const BASE_FONT_SIZE_PX = 12;

const props = defineProps({
  profile: {
    type: Object,
    default: () => ({
      publicIp: "",
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
const tooltipId = `network-ip-${useId()}`;
const barRef = useTemplateRef("barRef");
const contentRef = useTemplateRef("contentRef");
const hovered = ref(false);
const focused = ref(false);
const pinned = ref(false);
const dismissed = ref(false);
let resizeObserver = null;
let contentObserver = null;
let fitFrame = 0;

const latencyLabel = computed(() => (
  Number.isFinite(props.latencyMs) ? `${props.latencyMs}ms` : "— ms"
));
const publicIpAvailable = computed(() => (
  !props.offline && Boolean(props.profile.publicIp)
));
const publicIpLabel = computed(() => {
  if (props.offline) return "当前网络已断开";
  if (props.profile.publicIp) return props.profile.publicIp;
  if (props.loading) return "正在获取…";
  return "暂未获取";
});
const tooltipVisible = computed(() => (
  !dismissed.value
  && (hovered.value || focused.value || pinned.value)
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

function handlePointerEnter(event) {
  if (event.pointerType === "touch") return;
  hovered.value = true;
  dismissed.value = false;
}

function handlePointerLeave(event) {
  if (event.pointerType === "touch") return;
  hovered.value = false;
  if (!focused.value && !pinned.value) dismissed.value = false;
}

function handleFocus() {
  focused.value = true;
  dismissed.value = false;
}

function handleBlur() {
  focused.value = false;
  if (!hovered.value && !pinned.value) dismissed.value = false;
}

function toggleTooltip() {
  if (pinned.value) {
    pinned.value = false;
    dismissed.value = true;
    return;
  }
  pinned.value = true;
  dismissed.value = false;
}

function closeTooltip() {
  pinned.value = false;
  dismissed.value = true;
}

function isInsideBar(target) {
  return target instanceof Node && Boolean(barRef.value?.contains(target));
}

function handleDocumentPointerDown(event) {
  if (!isInsideBar(event.target)) closeTooltip();
}

function handleDocumentFocusIn(event) {
  if (!isInsideBar(event.target)) closeTooltip();
}

function handleDocumentKeydown(event) {
  if (event.key === "Escape" && tooltipVisible.value) closeTooltip();
}

function fitMobileContent() {
  fitFrame = 0;
  const bar = barRef.value;
  const content = contentRef.value;
  if (!bar || !content) return;

  if (!window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
    content.style.removeProperty("--network-status-font-size");
    return;
  }

  content.style.setProperty("--network-status-font-size", `${BASE_FONT_SIZE_PX}px`);
  const styles = getComputedStyle(bar);
  const horizontalPadding = Number.parseFloat(styles.paddingLeft)
    + Number.parseFloat(styles.paddingRight);
  const availableWidth = Math.max(1, bar.clientWidth - horizontalPadding - 2);
  const naturalWidth = Math.max(1, content.scrollWidth);
  let fontSize = BASE_FONT_SIZE_PX * Math.min(1, availableWidth / naturalWidth);
  content.style.setProperty("--network-status-font-size", `${fontSize.toFixed(2)}px`);
  if (content.scrollWidth > availableWidth) {
    fontSize *= (availableWidth / content.scrollWidth) * 0.99;
    content.style.setProperty("--network-status-font-size", `${fontSize.toFixed(2)}px`);
  }
}

function scheduleContentFit() {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(fitMobileContent);
}

onMounted(() => {
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(scheduleContentFit);
    resizeObserver.observe(barRef.value);
  }
  contentObserver = new MutationObserver(scheduleContentFit);
  contentObserver.observe(contentRef.value, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("focusin", handleDocumentFocusIn);
  document.addEventListener("keydown", handleDocumentKeydown);
  scheduleContentFit();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  contentObserver?.disconnect();
  cancelAnimationFrame(fitFrame);
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  document.removeEventListener("focusin", handleDocumentFocusIn);
  document.removeEventListener("keydown", handleDocumentKeydown);
});
</script>

<style scoped>
.network-status-bar {
  position: relative;
  display: flex;
  min-height: 2.5rem;
  width: fit-content;
  max-width: 100%;
  margin-inline: auto;
  align-items: center;
  border: 1px solid rgb(228 228 231 / 82%);
  border-radius: 0.9rem;
  background: rgb(255 255 255 / 72%);
  padding: 0.35rem 0.45rem;
  box-shadow: 0 8px 24px rgb(24 24 27 / 6%);
}

.network-status-bar__content {
  display: flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 0.8em;
  font-size: var(--network-status-font-size, 0.75rem);
}

.network-status-bar__trigger {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.8em;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: inherit;
}

.network-status-bar__trigger:focus-visible {
  border-radius: 0.65rem;
  outline: 2px solid var(--app-accent-500);
  outline-offset: 3px;
}

.network-status-bar__latency {
  display: inline-flex;
  min-width: 4.733em;
  height: 2.4em;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 0.733em;
  padding-inline: 0.733em;
  font-size: 1em;
  font-weight: 700;
  white-space: nowrap;
}

.network-status-bar__latency :deep(svg) {
  width: 1.083em;
  height: 1.083em;
}

.network-status-bar__latency.is-good { background: rgb(16 185 129 / 12%); color: #047857; }
.network-status-bar__latency.is-fair { background: rgb(245 158 11 / 14%); color: #b45309; }
.network-status-bar__latency.is-poor { background: rgb(244 63 94 / 12%); color: #be123c; }
.network-status-bar__latency.is-neutral { background: rgb(161 161 170 / 13%); color: #71717a; }

.network-status-bar__details {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.667em;
  font-size: 1em;
  line-height: 1.467em;
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
  padding: 0.154em 0.692em;
  color: #2563eb;
  font-size: 0.867em;
  font-weight: 650;
  white-space: nowrap;
}

.network-status-bar__retry {
  display: inline-grid;
  width: 2.4em;
  height: 2.4em;
  flex: none;
  cursor: pointer;
  place-items: center;
  border: 0;
  border-radius: 0.733em;
  background: transparent;
  color: #71717a;
}
.network-status-bar__retry :deep(svg) { width: 1.167em; height: 1.167em; }
.network-status-bar__retry:hover { background: rgb(161 161 170 / 12%); color: #27272a; }
.network-status-bar__retry:focus-visible { outline: 2px solid var(--app-accent-500); outline-offset: 2px; }

.network-status-bar__tooltip {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 50%;
  z-index: 20;
  display: grid;
  width: max-content;
  max-width: min(18rem, calc(100vw - 2rem));
  transform: translateX(-50%);
  gap: 0.2rem;
  border: 1px solid rgb(228 228 231 / 92%);
  border-radius: 0.7rem;
  background: rgb(255 255 255 / 96%);
  padding: 0.5rem 0.65rem;
  box-shadow: 0 12px 32px rgb(24 24 27 / 14%);
  pointer-events: none;
  text-align: left;
}

.network-status-bar__tooltip::after {
  position: absolute;
  top: 100%;
  left: 50%;
  width: 0.55rem;
  height: 0.55rem;
  transform: translate(-50%, -50%) rotate(45deg);
  border-right: 1px solid rgb(228 228 231 / 92%);
  border-bottom: 1px solid rgb(228 228 231 / 92%);
  background: inherit;
  content: "";
}

.network-status-bar__tooltip-label {
  color: #71717a;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.network-status-bar__tooltip-value {
  overflow-wrap: anywhere;
  color: #18181b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  line-height: 1.25rem;
}

.network-status-bar__tooltip-value.is-placeholder {
  color: #71717a;
  font-family: inherit;
  font-weight: 500;
}

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
:global(.dark .network-status-bar__tooltip) {
  border-color: rgb(255 255 255 / 12%);
  background: rgb(24 24 27 / 98%);
  box-shadow: 0 14px 34px rgb(0 0 0 / 32%);
}
:global(.dark .network-status-bar__tooltip::after) { border-color: rgb(255 255 255 / 12%); }
:global(.dark .network-status-bar__tooltip-label),
:global(.dark .network-status-bar__tooltip-value.is-placeholder) { color: #a1a1aa; }
:global(.dark .network-status-bar__tooltip-value) { color: #f4f4f5; }

@media (max-width: 480px) {
  .network-status-bar {
    width: 100%;
    min-width: 0;
    justify-content: center;
    overflow: visible;
  }

  .network-status-bar__content {
    width: max-content;
    max-width: none;
    flex: none;
  }

  .network-status-bar__details,
  .network-status-bar__location,
  .network-status-bar__meta {
    flex: none;
    max-width: none;
    overflow: visible;
    text-overflow: clip;
  }
}
</style>
