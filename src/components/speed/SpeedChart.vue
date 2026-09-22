<template>
  <div class="speed-chart-wrap">
    <div class="speed-chart-heading mb-2">
      <h2 class="text-sm font-semibold">测速曲线</h2>
    </div>
    <div class="speed-chart" role="img" :aria-label="chartAriaLabel">
      <div class="speed-chart__axis" aria-hidden="true">
        <span
          v-for="tick in chartTicks"
          :key="tick.position"
          class="speed-chart__axis-label"
          :style="{ '--tick-position': `${tick.position}%` }"
        >
          {{ tick.label }}
        </span>
      </div>
      <div class="speed-chart__plot">
        <div class="speed-chart__grid" aria-hidden="true">
          <span
            v-for="tick in chartTicks"
            :key="tick.position"
            class="speed-chart__grid-line"
            :style="{ '--tick-position': `${tick.position}%` }"
          ></span>
        </div>
        <svg
          v-if="chartPoints.length > 1"
          class="relative h-full w-full"
          viewBox="0 0 640 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--app-accent-500)" stop-opacity="0.3" />
              <stop offset="100%" stop-color="var(--app-accent-500)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path :d="chartArea" :fill="`url(#${gradientId})`" />
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
        <div v-else class="relative grid h-full place-items-center px-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {{ running ? "正在等待速度样本…" : "开始后显示实时测速曲线" }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, useId } from "vue";
import {
  BYTES_PER_MEGABIT,
  formatByteRate,
  formatSpeed,
} from "@/domain/speedMetrics";

const props = defineProps({
  currentMbps: { type: Number, default: 0 },
  peakMbps: { type: Number, default: 0 },
  samples: { type: Array, default: () => [] },
  running: { type: Boolean, default: false },
});

const CHART_TICK_INTERVALS = 4;
const CHART_TOP = 8;
const CHART_BOTTOM = 112;
const gradientId = `speed-chart-fill-${useId().replaceAll(":", "")}`;
const chartSamples = computed(() => props.samples.slice(-60));
const chartPeakMbps = computed(() => (
  Number.isFinite(props.peakMbps) && props.peakMbps > 0 ? props.peakMbps : 0
));
const hasChartData = computed(() => (
  chartPeakMbps.value > 0
  && chartSamples.value.some((sample) => Number.isFinite(sample.mbps) && sample.mbps > 0)
));
const chartTicks = computed(() => {
  if (!hasChartData.value) {
    return [{ label: "0 B/s", position: (CHART_BOTTOM / 120) * 100 }];
  }
  return Array.from(
    { length: CHART_TICK_INTERVALS + 1 },
    (_, index) => {
      const ratio = index / CHART_TICK_INTERVALS;
      const value = chartPeakMbps.value * BYTES_PER_MEGABIT * (1 - ratio);
      return {
        label: formatByteRate(value),
        position: ((CHART_TOP + ratio * (CHART_BOTTOM - CHART_TOP)) / 120) * 100,
      };
    },
  );
});
const chartPoints = computed(() => {
  const values = chartSamples.value;
  if (!hasChartData.value || values.length < 2) return [];
  return values.map((sample, index) => {
    const mbps = Number.isFinite(sample.mbps) && sample.mbps > 0 ? sample.mbps : 0;
    const ratio = Math.min(1, mbps / chartPeakMbps.value);
    return {
      x: 8 + (index / (values.length - 1)) * 624,
      y: CHART_BOTTOM - ratio * (CHART_BOTTOM - CHART_TOP),
    };
  });
});
const chartLine = computed(() => chartPoints.value.map((point, index) => (
  `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`
)).join(" "));
const chartArea = computed(() => chartPoints.value.length
  ? `${chartLine.value} L${chartPoints.value.at(-1).x.toFixed(1)},${CHART_BOTTOM} L8,${CHART_BOTTOM} Z`
  : "");
const chartAriaLabel = computed(() => hasChartData.value
  ? `最近下载速度 ${formatSpeed(props.currentMbps)} Mbps，本次峰值 ${formatSpeed(chartPeakMbps.value)} Mbps，纵轴最高 ${formatByteRate(chartPeakMbps.value * BYTES_PER_MEGABIT)}`
  : "尚无测速数据；开始测速后显示最近下载速度曲线");
</script>

<style scoped>
.speed-chart-wrap { margin-top: clamp(0.75rem, 1.8dvh, 1.15rem); }

.speed-chart {
  position: relative;
  display: grid;
  height: clamp(7rem, 12dvh, 8.5rem);
  overflow: hidden;
  grid-template-columns: clamp(3.8rem, 12vw, 4.6rem) minmax(0, 1fr);
  border: 1px solid color-mix(in srgb, var(--color-zinc-300) 75%, transparent);
  border-radius: 1.35rem;
  background: rgb(250 250 250 / 62%);
}

.speed-chart__axis {
  position: relative;
  min-width: 0;
}

.speed-chart__axis-label {
  position: absolute;
  top: var(--tick-position);
  right: 0.5rem;
  transform: translateY(-50%);
  color: var(--color-zinc-500);
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-align: right;
  white-space: nowrap;
}

.speed-chart__plot {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border-left: 1px solid color-mix(in srgb, var(--color-zinc-300) 60%, transparent);
}

.speed-chart__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(to right, rgb(161 161 170 / 13%) 1px, transparent 1px);
  background-size: 20% 100%;
}

.speed-chart__grid-line {
  position: absolute;
  top: var(--tick-position);
  right: 0;
  left: 0;
  border-top: 1px solid rgb(161 161 170 / 16%);
}

:global(.dark .speed-chart) { border-color: rgb(255 255 255 / 10%); background: rgb(9 9 11 / 35%); }
:global(.dark .speed-chart__axis-label) { color: var(--color-zinc-400); }
:global(.dark .speed-chart__plot) { border-color: rgb(255 255 255 / 10%); }

@media (max-width: 640px) {
  .speed-chart-wrap { margin-top: 0.5rem; }
  .speed-chart-heading { margin-bottom: 0.25rem; }
  .speed-chart {
    height: clamp(6rem, 11dvh, 7rem);
    grid-template-columns: 4rem minmax(0, 1fr);
  }
  .speed-chart__axis-label { right: 0.4rem; font-size: 0.575rem; }
}

@media (max-width: 640px) and (max-height: 700px) {
  .speed-chart-wrap { margin-top: 0.25rem; }
  .speed-chart { height: min(4.5rem, 12dvh); }
  .speed-chart__axis-label:nth-child(even),
  .speed-chart__grid-line:nth-child(even) { display: none; }
}
</style>
