<template>
  <div
    class="liquid-thread-slider"
    :class="{ 'is-ready': glassReady }"
  >
    <div ref="hostRef" class="liquid-thread-slider__engine"></div>

    <label v-if="!glassReady" class="liquid-thread-slider__fallback">
      <span class="sr-only">{{ label }}</span>
      <input
        ref="fallbackInputRef"
        type="range"
        :min="min"
        :max="max"
        step="1"
        :value="normalizedValue"
        @input="updateValue($event.target.value)"
      />
    </label>
  </div>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import { useTheme } from "@/composables/useTheme";
import { createLiquidGlassPlainWallpaper } from "@/utils/liquidGlassWallpaper";
import {
  applyLiquidGlassMaxQuality,
  disposeLiquidGlassElement,
  loadLiquidGlass,
} from "@/vendor/liquid-glass/loadLiquidGlass";

const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 1 },
  max: { type: Number, default: 64 },
  label: { type: String, default: "测速线程数" },
});
const emit = defineEmits(["update:modelValue"]);
const { isDark } = useTheme();
const hostRef = useTemplateRef("hostRef");
const fallbackInputRef = useTemplateRef("fallbackInputRef");
const glassReady = ref(false);
const normalizedValue = computed(() => clampValue(props.modelValue));

let glassElement = null;
let glassCanvas = null;
let mounted = false;
let syncingFromVue = false;
let mountGeneration = 0;
let assetRefreshFrame = 0;
let engineResizeObserver = null;

function clampValue(value) {
  const minimum = Math.min(props.min, props.max);
  const maximum = Math.max(props.min, props.max);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function toSliderValue(value) {
  const range = props.max - props.min;
  if (!range) return 0;
  return ((clampValue(value) - props.min) / range) * 100;
}

function fromSliderValue(value) {
  const percentage = Math.min(100, Math.max(0, Number(value) || 0));
  return clampValue(props.min + (percentage / 100) * (props.max - props.min));
}

function updateValue(value) {
  const nextValue = clampValue(value);
  if (nextValue !== normalizedValue.value) emit("update:modelValue", nextValue);
}

function syncAccessibility() {
  if (!glassElement) return;
  glassElement.setAttribute("aria-label", props.label);
  glassElement.setAttribute("aria-valuemin", String(props.min));
  glassElement.setAttribute("aria-valuemax", String(props.max));
  glassElement.setAttribute("aria-valuenow", String(normalizedValue.value));
  glassElement.setAttribute("aria-valuetext", `${normalizedValue.value} 个线程`);
}

function syncSliderValue() {
  if (!glassElement?.setState) return;
  syncingFromVue = true;
  syncAccessibility();
  glassElement.setState({ sliderValue: toSliderValue(normalizedValue.value) });
  queueMicrotask(() => { syncingFromVue = false; });
}

function onGlassStateChange(event) {
  if (event.target !== glassElement || syncingFromVue) return;
  const rawValue = Number(event.detail?.sliderValue);
  if (!Number.isFinite(rawValue)) return;
  const nextValue = fromSliderValue(rawValue);
  if (nextValue !== normalizedValue.value) emit("update:modelValue", nextValue);

  const snappedValue = toSliderValue(nextValue);
  if (Math.abs(snappedValue - rawValue) <= 0.001) return;
  syncingFromVue = true;
  glassElement.setState({ sliderValue: snappedValue });
  queueMicrotask(() => { syncingFromVue = false; });
}

function onKeyDown(event) {
  let nextValue = normalizedValue.value;
  if (["ArrowRight", "ArrowUp"].includes(event.key)) nextValue += 1;
  else if (["ArrowLeft", "ArrowDown"].includes(event.key)) nextValue -= 1;
  else if (event.key === "PageUp") nextValue += 5;
  else if (event.key === "PageDown") nextValue -= 5;
  else if (event.key === "Home") nextValue = props.min;
  else if (event.key === "End") nextValue = props.max;
  else return;

  event.preventDefault();
  updateValue(nextValue);
}

function onWebGlContextLost(event) {
  if (event.target !== glassCanvas) return;
  event.preventDefault();
  console.warn("[liquid-glass] 线程滑块 WebGL 上下文已丢失，已使用原生滑块。");
  destroyGlassElement();
}

function buildWallpaper() {
  const bounds = hostRef.value?.getBoundingClientRect();
  return createLiquidGlassPlainWallpaper(
    bounds?.width || 380,
    bounds?.height || 50,
    isDark.value,
  );
}

function refreshQualityAssets() {
  assetRefreshFrame = 0;
  if (!mounted || !glassElement) return;
  applyLiquidGlassMaxQuality(glassElement);
  const wallpaper = buildWallpaper();
  if (glassElement.getAttribute("wallpaper") !== wallpaper) {
    glassElement.setAttribute("wallpaper", wallpaper);
  }
}

function scheduleQualityRefresh() {
  if (assetRefreshFrame) cancelAnimationFrame(assetRefreshFrame);
  assetRefreshFrame = requestAnimationFrame(refreshQualityAssets);
}

async function waitForEngineReady(element, generation) {
  for (let frame = 0; frame < 120; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (
      !mounted
      || generation !== mountGeneration
      || element !== glassElement
      || !element.isConnected
    ) return false;
    if (element._renderer?.wallpaperReady && element._elements?.length) return true;
  }
  return false;
}

async function mountGlassElement() {
  const host = hostRef.value;
  if (!host || !mounted || glassElement) return;
  const generation = ++mountGeneration;
  if (
    !(await loadLiquidGlass())
    || !mounted
    || generation !== mountGeneration
    || host !== hostRef.value
    || glassElement
  ) {
    return;
  }

  try {
    const element = document.createElement("liquid-glass");
    glassElement = element;
    applyLiquidGlassMaxQuality(element);
    element.setAttribute("corner-style", "1");
    element.setAttribute("wallpaper", buildWallpaper());
    element.toggleAttribute("dark", isDark.value);
    element.setAttribute("mode", "single-slider");
    element.setAttribute("role", "slider");
    element.setAttribute("aria-label", props.label);
    element.setAttribute("aria-hidden", "true");
    element.tabIndex = -1;
    element.addEventListener("lg-statechange", onGlassStateChange);
    element.addEventListener("keydown", onKeyDown);

    syncingFromVue = true;
    host.replaceChildren(element);
    glassCanvas = element.shadowRoot?.querySelector("canvas") ?? null;
    glassCanvas?.addEventListener("webglcontextlost", onWebGlContextLost, { once: true });
    syncAccessibility();
    element.setState({ sliderValue: toSliderValue(normalizedValue.value) });
    queueMicrotask(() => { syncingFromVue = false; });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!mounted || generation !== mountGeneration || !element.isConnected) return;

    if (await waitForEngineReady(element, generation)) {
      const shouldTransferFocus = document.activeElement === fallbackInputRef.value;
      element.removeAttribute("aria-hidden");
      element.tabIndex = 0;
      glassReady.value = true;
      if (shouldTransferFocus) requestAnimationFrame(() => element.focus({ preventScroll: true }));
    } else if (generation === mountGeneration) destroyGlassElement();
  } catch (error) {
    console.warn("[liquid-glass] 线程滑块初始化失败，已使用原生滑块。", error);
    destroyGlassElement();
  }
}

function destroyGlassElement() {
  mountGeneration += 1;
  glassReady.value = false;
  syncingFromVue = false;
  glassCanvas?.removeEventListener("webglcontextlost", onWebGlContextLost);
  glassCanvas = null;
  if (!glassElement) return;
  glassElement.removeEventListener("lg-statechange", onGlassStateChange);
  glassElement.removeEventListener("keydown", onKeyDown);
  disposeLiquidGlassElement(glassElement);
  glassElement = null;
}

watch(() => props.modelValue, syncSliderValue);
watch([() => props.min, () => props.max, () => props.label], syncSliderValue);
watch(isDark, (dark) => {
  if (!glassElement) return;
  syncingFromVue = true;
  glassElement.toggleAttribute("dark", dark);
  refreshQualityAssets();
  queueMicrotask(() => { syncingFromVue = false; });
});

onMounted(() => {
  mounted = true;
  if (typeof ResizeObserver !== "undefined" && hostRef.value) {
    engineResizeObserver = new ResizeObserver(scheduleQualityRefresh);
    engineResizeObserver.observe(hostRef.value);
  }
  window.addEventListener("resize", scheduleQualityRefresh, { passive: true });
  void mountGlassElement();
});

onBeforeUnmount(() => {
  mounted = false;
  engineResizeObserver?.disconnect();
  window.removeEventListener("resize", scheduleQualityRefresh);
  if (assetRefreshFrame) cancelAnimationFrame(assetRefreshFrame);
  destroyGlassElement();
});
</script>

<style scoped>
.liquid-thread-slider {
  position: relative;
  width: min(100%, 380px);
  height: 64px;
  margin-inline: auto;
  overflow: hidden;
  background: transparent;
}

.liquid-thread-slider__engine {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 100px;
  opacity: 0;
  pointer-events: none;
}

.is-ready .liquid-thread-slider__engine {
  opacity: 1;
  pointer-events: auto;
}

.liquid-thread-slider__engine :deep(liquid-glass) {
  width: 100%;
  height: 100%;
  outline: none;
}

.liquid-thread-slider__engine :deep(liquid-glass:focus-visible) {
  outline: 2px solid var(--app-accent-500);
  outline-offset: -3px;
}

.liquid-thread-slider__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  padding-inline: 2rem;
  place-items: center;
}

.liquid-thread-slider__fallback input {
  width: 100%;
  accent-color: var(--app-accent-600);
}

</style>
