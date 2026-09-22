<template>
  <div
    class="speed-gauge"
    :class="{ 'is-running': running }"
  >
    <svg
      class="speed-gauge__scale"
      viewBox="0 0 200 200"
      aria-hidden="true"
    >
      <path
        class="speed-gauge__track"
        :d="GAUGE_ARC_PATH"
        pathLength="100"
      />
      <path
        class="speed-gauge__progress"
        :class="{ 'has-progress': gaugeProgress > 0 }"
        :d="GAUGE_ARC_PATH"
        pathLength="100"
        :style="{ strokeDasharray: `${gaugeProgress} 100` }"
      />
      <g v-for="tick in GAUGE_SCALE_TICKS" :key="tick.value">
        <line
          class="speed-gauge__marker"
          :x1="tick.markerStart.x"
          :y1="tick.markerStart.y"
          :x2="tick.markerEnd.x"
          :y2="tick.markerEnd.y"
        />
        <text
          class="speed-gauge__label"
          :x="tick.labelPoint.x"
          :y="tick.labelPoint.y"
          :transform="`rotate(${tick.rotation} ${tick.labelPoint.x} ${tick.labelPoint.y})`"
        >{{ tick.label }}</text>
      </g>
    </svg>
    <span :id="headingId" class="speed-gauge__caption" role="status" aria-live="polite">
      {{ nodeLabel }}
    </span>
    <div class="speed-gauge__inner">
      <span
        ref="speedValueRef"
        class="speed-gauge__value px-3 tabular-nums font-semibold leading-none tracking-tight"
      >
        {{ formattedSpeed }}
      </span>
      <span class="mt-2 text-base font-semibold text-zinc-500 dark:text-zinc-400">Mbps</span>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  useTemplateRef,
  watch,
} from "vue";
import {
  formatSpeed,
  mapSpeedToGaugeProgress,
  SPEED_GAUGE_SCALE,
} from "@/domain/speedMetrics";

const props = defineProps({
  speedMbps: { type: Number, default: 0 },
  nodeLabel: { type: String, default: "" },
  running: { type: Boolean, default: false },
  headingId: { type: String, default: undefined },
  active: { type: Boolean, default: true },
});

const GAUGE_CENTER = 100;
const GAUGE_RADIUS = 91;
const GAUGE_START_ANGLE = 135;
const GAUGE_SWEEP_ANGLE = 270;
const gaugeArcStart = polarPoint(GAUGE_RADIUS, GAUGE_START_ANGLE);
const gaugeArcEnd = polarPoint(GAUGE_RADIUS, GAUGE_START_ANGLE + GAUGE_SWEEP_ANGLE);
const GAUGE_ARC_PATH = [
  `M ${gaugeArcStart.x} ${gaugeArcStart.y}`,
  `A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 1 1 ${gaugeArcEnd.x} ${gaugeArcEnd.y}`,
].join(" ");
const GAUGE_SCALE_TICKS = Object.freeze(SPEED_GAUGE_SCALE.map((item, index) => {
  const ratio = index / (SPEED_GAUGE_SCALE.length - 1);
  const angle = GAUGE_START_ANGLE + ratio * GAUGE_SWEEP_ANGLE;
  return Object.freeze({
    ...item,
    markerStart: Object.freeze(polarPoint(78, angle)),
    markerEnd: Object.freeze(polarPoint(84, angle)),
    labelPoint: Object.freeze(polarPoint(68, angle)),
    rotation: uprightTangentRotation(angle),
  });
}));

const speedValueRef = useTemplateRef("speedValueRef");
const formattedSpeed = computed(() => formatSpeed(props.speedMbps));
const gaugeProgress = computed(() => mapSpeedToGaugeProgress(props.speedMbps));
let speedValueResizeObserver = null;
let speedValueFitFrame = 0;

function polarPoint(radius, angle) {
  const radians = angle * (Math.PI / 180);
  return {
    x: Number((GAUGE_CENTER + radius * Math.cos(radians)).toFixed(3)),
    y: Number((GAUGE_CENTER + radius * Math.sin(radians)).toFixed(3)),
  };
}

function uprightTangentRotation(angle) {
  let rotation = angle + 90;
  while (rotation > 90) rotation -= 180;
  while (rotation < -90) rotation += 180;
  return rotation;
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

watch(() => formattedSpeed.value.length, async () => {
  await nextTick();
  scheduleSpeedValueFit();
}, { flush: "post" });

watch(() => props.active, (active) => {
  if (active) nextTick(scheduleSpeedValueFit);
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
.speed-gauge {
  position: relative;
  display: grid;
  width: clamp(11.75rem, 24dvh, 14rem);
  aspect-ratio: 1;
  margin-inline: auto;
  place-items: center;
  border-radius: 999px;
  background: transparent;
}

.speed-gauge::before {
  position: absolute;
  inset: -8%;
  border-radius: inherit;
  background: radial-gradient(circle, color-mix(in srgb, var(--app-accent-500) 9%, transparent), transparent 64%);
  content: "";
  filter: blur(16px);
  opacity: 0;
  transition: opacity 300ms ease;
}

.speed-gauge.is-running::before { opacity: 1; }

.speed-gauge__scale {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.speed-gauge__track,
.speed-gauge__progress {
  fill: none;
  stroke-linecap: round;
  stroke-width: 12;
  vector-effect: non-scaling-stroke;
}

.speed-gauge__track {
  stroke: color-mix(in srgb, var(--color-zinc-400) 36%, transparent);
}

.speed-gauge__progress {
  opacity: 0;
  stroke: var(--app-accent-500);
  transition: stroke-dasharray 220ms ease, opacity 160ms ease;
  filter: drop-shadow(0 3px 7px color-mix(in srgb, var(--app-accent-500) 28%, transparent));
}

.speed-gauge__progress.has-progress { opacity: 1; }

.speed-gauge__marker {
  stroke: color-mix(in srgb, var(--color-zinc-500) 36%, transparent);
  stroke-width: 1.2;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.speed-gauge__label {
  fill: var(--color-zinc-500);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 8px;
  font-weight: 650;
  text-anchor: middle;
  dominant-baseline: central;
  font-variant-numeric: tabular-nums;
}

.speed-gauge__caption {
  position: absolute;
  bottom: 0.35rem;
  left: 50%;
  z-index: 3;
  transform: translateX(-50%);
  color: var(--color-zinc-500);
  font-size: 0.6875rem;
  font-weight: 650;
  line-height: 1rem;
  white-space: nowrap;
}

.speed-gauge__inner {
  position: absolute;
  inset: 22%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  overflow: hidden;
  border-radius: inherit;
  background: radial-gradient(circle, rgb(255 255 255 / 48%), transparent 74%);
}

.speed-gauge__value {
  display: inline-block;
  flex: none;
  max-width: none;
  white-space: nowrap;
  font-size: var(--speed-value-size, clamp(2.75rem, 13vw, 4rem));
}

:global(.dark .speed-gauge__track) { stroke: rgb(255 255 255 / 18%); }
:global(.dark .speed-gauge__progress) { stroke: var(--app-accent-400); }
:global(.dark .speed-gauge__marker) { stroke: rgb(255 255 255 / 28%); }
:global(.dark .speed-gauge__label) { fill: var(--color-zinc-300); }
:global(.dark .speed-gauge__caption) { color: var(--color-zinc-300); }

:global(.dark .speed-gauge__inner) {
  background: radial-gradient(circle, rgb(24 24 27 / 52%), transparent 74%);
  color: #f4f4f5;
}

@media (max-width: 640px) {
  .speed-gauge { width: clamp(9rem, 22dvh, 12rem); }
}

@media (max-width: 640px) and (max-height: 700px) {
  .speed-gauge { width: min(9.25rem, 22dvh); }
}

@media (prefers-reduced-motion: reduce) {
  .speed-gauge::before, .speed-gauge__progress { transition: none; }
}
</style>
