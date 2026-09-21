<template>
  <div class="liquid-toggle" :class="{ 'is-ready': glassReady }">
    <div ref="hostRef" class="liquid-toggle__engine"></div>

    <label v-if="!glassReady" class="liquid-toggle__fallback">
      <span class="sr-only">{{ label }}</span>
      <input
        ref="fallbackInputRef"
        type="checkbox"
        :checked="modelValue"
        @change="emit('update:modelValue', $event.target.checked)"
      />
    </label>
  </div>
</template>

<script setup>
import {
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import { useTheme } from "@/composables/useTheme";
import { createLiquidGlassPlainWallpaper } from "@/utils/liquidGlassWallpaper";
import {
  disposeLiquidGlassElement,
  loadLiquidGlass,
} from "@/vendor/liquid-glass/loadLiquidGlass";

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  active: { type: Boolean, default: true },
  label: { type: String, required: true },
});
const emit = defineEmits(["update:modelValue"]);
const { isDark } = useTheme();
const hostRef = useTemplateRef("hostRef");
const fallbackInputRef = useTemplateRef("fallbackInputRef");
const glassReady = ref(false);

let glassElement = null;
let glassCanvas = null;
let mounted = false;
let syncingFromVue = false;
let mountGeneration = 0;

function buildWallpaper() {
  const bounds = hostRef.value?.getBoundingClientRect();
  return createLiquidGlassPlainWallpaper(
    bounds?.width || 96,
    bounds?.height || 72,
    isDark.value,
    "plain",
  );
}

function syncAccessibility() {
  if (!glassElement) return;
  glassElement.setAttribute("aria-label", props.label);
  glassElement.setAttribute("aria-checked", String(props.modelValue));
}

function syncToggleValue() {
  if (!glassElement?.setState) return;
  syncingFromVue = true;
  syncAccessibility();
  glassElement.setState({ toggleOn: props.modelValue });
  queueMicrotask(() => { syncingFromVue = false; });
}

function onGlassStateChange(event) {
  if (event.target !== glassElement || syncingFromVue) return;
  const nextValue = event.detail?.toggleOn;
  if (typeof nextValue !== "boolean" || nextValue === props.modelValue) return;
  emit("update:modelValue", nextValue);
}

function onKeyDown(event) {
  if (event.repeat || ![" ", "Enter"].includes(event.key)) return;
  event.preventDefault();
  emit("update:modelValue", !props.modelValue);
}

function onWebGlContextLost(event) {
  if (event.target !== glassCanvas) return;
  event.preventDefault();
  console.warn("[liquid-glass] 偏好开关 WebGL 上下文已丢失，已使用原生开关。");
  destroyGlassElement();
}

async function waitForEngineReady(element, generation) {
  for (let frame = 0; frame < 120; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (
      !mounted
      || !props.active
      || generation !== mountGeneration
      || element !== glassElement
    ) {
      return false;
    }
    if (element._renderer?.wallpaperReady && element._elements?.length) return true;
  }
  return false;
}

async function mountGlassElement() {
  const host = hostRef.value;
  if (glassElement || !props.active || !host || !mounted) return;
  const generation = ++mountGeneration;
  if (
    !(await loadLiquidGlass())
    || !mounted
    || !props.active
    || generation !== mountGeneration
    || host !== hostRef.value
    || glassElement
  ) return;

  try {
    const element = document.createElement("liquid-glass");
    glassElement = element;
    element.setAttribute("mode", "single-toggle");
    element.setAttribute("dpr", "2");
    element.setAttribute("blur-tap-cap", "9");
    element.setAttribute("corner-style", "1");
    element.setAttribute("wallpaper", buildWallpaper());
    element.toggleAttribute("dark", isDark.value);
    element.setAttribute("role", "switch");
    element.setAttribute("aria-hidden", "true");
    element.tabIndex = -1;
    element.addEventListener("lg-statechange", onGlassStateChange);
    element.addEventListener("keydown", onKeyDown);

    syncingFromVue = true;
    host.replaceChildren(element);
    glassCanvas = element.shadowRoot?.querySelector("canvas") ?? null;
    glassCanvas?.addEventListener("webglcontextlost", onWebGlContextLost, { once: true });
    syncAccessibility();
    element.setState({ toggleOn: props.modelValue });
    queueMicrotask(() => { syncingFromVue = false; });

    if (await waitForEngineReady(element, generation)) {
      const shouldTransferFocus = document.activeElement === fallbackInputRef.value;
      element.removeAttribute("aria-hidden");
      element.tabIndex = 0;
      glassReady.value = true;
      if (shouldTransferFocus) {
        requestAnimationFrame(() => {
          if (element.isConnected) element.focus({ preventScroll: true });
        });
      }
    } else if (generation === mountGeneration) {
      destroyGlassElement();
    }
  } catch (error) {
    console.warn("[liquid-glass] 偏好开关初始化失败，已使用原生开关。", error);
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

watch(() => props.modelValue, syncToggleValue);
watch(() => props.label, syncAccessibility);
watch(() => props.active, (active) => {
  if (active) void mountGlassElement();
  else destroyGlassElement();
});
watch(isDark, (dark) => {
  if (!glassElement) return;
  syncingFromVue = true;
  glassElement.toggleAttribute("dark", dark);
  glassElement.setAttribute("wallpaper", buildWallpaper());
  queueMicrotask(() => { syncingFromVue = false; });
});

onMounted(() => {
  mounted = true;
  if (props.active) void mountGlassElement();
});

onBeforeUnmount(() => {
  mounted = false;
  destroyGlassElement();
});
</script>

<style scoped>
.liquid-toggle {
  position: relative;
  width: 96px;
  height: 56px;
  flex: none;
  overflow: hidden;
  background: transparent;
}

.liquid-toggle__engine {
  position: absolute;
  top: -10px;
  right: 0;
  left: 0;
  height: 72px;
  opacity: 0;
  pointer-events: none;
}

.is-ready .liquid-toggle__engine {
  opacity: 1;
  pointer-events: auto;
}

.liquid-toggle__engine :deep(liquid-glass) {
  width: 100%;
  height: 100%;
  outline: none;
}

.liquid-toggle__engine :deep(liquid-glass:focus-visible) {
  outline: 2px solid var(--app-accent-500);
  outline-offset: -3px;
}

.liquid-toggle__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.liquid-toggle__fallback input {
  width: 2.75rem;
  height: 1.5rem;
  accent-color: var(--app-accent-600);
}
</style>
