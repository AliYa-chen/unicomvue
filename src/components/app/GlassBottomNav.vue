<template>
  <nav class="glass-bottom-nav" :style="navSafeAreaStyle" aria-label="主导航">
    <div class="glass-bottom-nav__surface" :class="{ 'is-fallback': !glassReady }">
      <div
        ref="glassHostRef"
        class="glass-bottom-nav__engine"
        :style="engineOverscanStyle"
        aria-hidden="true"
      ></div>

      <div class="glass-bottom-nav__controls">
        <button
          v-for="(tab, index) in APP_TABS"
          :key="tab.value"
          type="button"
          class="glass-bottom-nav__tab"
          :class="{ 'is-active': activeTab === tab.value }"
          :aria-current="activeTab === tab.value ? 'page' : undefined"
          @pointerdown="forwardPointerDown"
          @click="selectTab($event, index)"
        >
          <component :is="tab.component" :size="21" :stroke-width="2" aria-hidden="true" />
          <span>{{ tab.label }}</span>
        </button>
      </div>
    </div>
  </nav>
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
import { useTheme } from "@/composables/useTheme";
import { APP_TABS, APP_TAB_VALUES, isAppTab } from "@/config/appNavigation";
import {
  createLiquidGlassMask,
  createLiquidGlassWallpaper,
} from "@/utils/liquidGlassWallpaper";
import {
  applyLiquidGlassMaxQuality,
  disposeLiquidGlassElement,
  loadLiquidGlass,
} from "@/vendor/liquid-glass/loadLiquidGlass";

const ENGINE_TABS = [
  APP_TABS.map(({ icon, label, viewport }) => ({ icon, label, viewport })),
];
const NAV_WIDTH = 360;
const NAV_HEIGHT = 64;
const ENGINE_OVERSCAN_X = 36;
const ENGINE_OVERSCAN_Y = 24;
const navSafeAreaStyle = Object.freeze({
  "--glass-nav-overscan-x": `${ENGINE_OVERSCAN_X}px`,
  "--glass-nav-overscan-y": `${ENGINE_OVERSCAN_Y}px`,
});

const props = defineProps({
  activeTab: {
    type: String,
    required: true,
    validator: isAppTab,
  },
});
const emit = defineEmits(["change"]);
const { isDark } = useTheme();
const glassHostRef = useTemplateRef("glassHostRef");
const glassReady = ref(false);
const engineMask = ref("");
const engineOverscanStyle = computed(() => ({
  "--glass-engine-overscan-x": `${ENGINE_OVERSCAN_X}px`,
  "--glass-engine-overscan-y": `${ENGINE_OVERSCAN_Y}px`,
  "--glass-engine-mask": engineMask.value ? `url("${engineMask.value}")` : "none",
}));
const fallbackIndicatorTransform = computed(() => `translateX(${activeIndex() * 100}%)`);

let glassElement = null;
let glassCanvas = null;
let mounted = false;
let syncingFromVue = false;
let engineConnected = false;
let currentWallpaper = "";
let mountGeneration = 0;
let assetRefreshFrame = 0;
let engineResizeObserver = null;

function activeIndex() {
  return Math.max(0, APP_TAB_VALUES.indexOf(props.activeTab));
}

function buildEngineAssets() {
  const bounds = glassHostRef.value?.getBoundingClientRect();
  const width = bounds?.width || NAV_WIDTH + ENGINE_OVERSCAN_X * 2;
  const height = bounds?.height || NAV_HEIGHT + ENGINE_OVERSCAN_Y * 2;
  return {
    mask: createLiquidGlassMask(
      width,
      height,
      ENGINE_OVERSCAN_X,
      ENGINE_OVERSCAN_Y,
      NAV_HEIGHT,
    ),
    wallpaper: createLiquidGlassWallpaper(width, height, isDark.value),
  };
}

function refreshEngineAssets() {
  assetRefreshFrame = 0;
  if (!mounted) return;
  const assets = buildEngineAssets();
  engineMask.value = assets.mask;
  currentWallpaper = assets.wallpaper;
  if (!glassElement) return;
  applyLiquidGlassMaxQuality(glassElement);
  if (glassElement.getAttribute("wallpaper") !== currentWallpaper) {
    glassElement.setAttribute("wallpaper", currentWallpaper);
  }
}

function scheduleEngineAssetRefresh() {
  if (assetRefreshFrame) cancelAnimationFrame(assetRefreshFrame);
  assetRefreshFrame = requestAnimationFrame(refreshEngineAssets);
}

function syncEngineSelection() {
  if (!glassElement || typeof glassElement.setState !== "function") return;
  syncingFromVue = true;
  glassElement.setState({ selectedTab: activeIndex() });
  queueMicrotask(() => { syncingFromVue = false; });
}

function onGlassStateChange(event) {
  if (event.target !== glassElement) return;
  engineConnected = true;
  if (syncingFromVue) return;

  const nextTab = APP_TAB_VALUES[Number(event.detail?.selectedTab)];
  if (nextTab && nextTab !== props.activeTab) emit("change", nextTab);
}

function onWebGlContextLost(event) {
  if (event.target !== glassCanvas) return;
  event.preventDefault();
  console.warn("[liquid-glass] WebGL 上下文已丢失，已使用原生导航。");
  destroyGlassElement();
}

function forwardPointerDown(event) {
  if (!glassReady.value || !glassCanvas || typeof PointerEvent !== "function") return;
  glassCanvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    clientX: event.clientX,
    clientY: event.clientY,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    button: event.button,
    buttons: event.buttons,
    pressure: event.pressure,
  }));
}

function selectTab(event, index) {
  const nextTab = APP_TAB_VALUES[index];
  if (!nextTab || nextTab === props.activeTab) return;
  // Pointer taps/drags are handled by the WebGL engine after the forwarded
  // pointerdown. Keyboard/assistive clicks have detail=0 and sync explicitly.
  if (glassReady.value && event.detail !== 0) return;
  if (glassReady.value) glassElement?.setState?.({ selectedTab: index });
  else emit("change", nextTab);
}

async function waitForEngineReady(element, generation) {
  for (let frame = 0; frame < 120; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (
      !mounted
      || generation !== mountGeneration
      || element !== glassElement
      || !element.isConnected
    ) {
      return false;
    }
    if (engineConnected && element._renderer?.wallpaperReady && element._elements?.length) {
      return true;
    }
  }
  return false;
}

async function mountGlassElement() {
  const host = glassHostRef.value;
  if (!host || !mounted || glassElement) return;
  const generation = ++mountGeneration;
  if (
    !(await loadLiquidGlass())
    || !mounted
    || generation !== mountGeneration
    || host !== glassHostRef.value
    || glassElement
  ) {
    return;
  }

  try {
    engineConnected = false;
    const assets = buildEngineAssets();
    currentWallpaper = assets.wallpaper;
    engineMask.value = assets.mask;
    const element = document.createElement("liquid-glass");
    glassElement = element;
    applyLiquidGlassMaxQuality(element);
    element.setAttribute("corner-style", "1");
    element.setAttribute("wallpaper", currentWallpaper);
    element.toggleAttribute("dark", isDark.value);
    element.addEventListener("lg-statechange", onGlassStateChange);

    syncingFromVue = true;
    host.replaceChildren(element);
    element.setAttribute("mode", "single-bottom-tabs");
    glassCanvas = element.shadowRoot?.querySelector("canvas") ?? null;
    glassCanvas?.addEventListener("webglcontextlost", onWebGlContextLost, { once: true });

    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!mounted || generation !== mountGeneration || !element.isConnected) return;
    element.setTabs(ENGINE_TABS);
    element.setState({ selectedTab: activeIndex() });
    queueMicrotask(() => { syncingFromVue = false; });
    await nextTick();

    if (await waitForEngineReady(element, generation)) glassReady.value = true;
    else if (generation === mountGeneration) destroyGlassElement();
  } catch (error) {
    console.warn("[liquid-glass] WebGL 初始化失败，已使用原生导航。", error);
    destroyGlassElement();
  }
}

function destroyGlassElement() {
  mountGeneration += 1;
  glassReady.value = false;
  syncingFromVue = false;
  engineConnected = false;
  currentWallpaper = "";
  glassCanvas?.removeEventListener("webglcontextlost", onWebGlContextLost);
  glassCanvas = null;
  if (!glassElement) return;
  glassElement.removeEventListener("lg-statechange", onGlassStateChange);
  disposeLiquidGlassElement(glassElement);
  glassElement = null;
}

watch(() => props.activeTab, syncEngineSelection);
watch(isDark, async () => {
  if (!mounted) return;
  destroyGlassElement();
  await nextTick();
  if (mounted) void mountGlassElement();
});

onMounted(() => {
  mounted = true;
  if (typeof ResizeObserver !== "undefined" && glassHostRef.value) {
    engineResizeObserver = new ResizeObserver(scheduleEngineAssetRefresh);
    engineResizeObserver.observe(glassHostRef.value);
  }
  window.addEventListener("resize", scheduleEngineAssetRefresh, { passive: true });
  void mountGlassElement();
});

onBeforeUnmount(() => {
  mounted = false;
  engineResizeObserver?.disconnect();
  window.removeEventListener("resize", scheduleEngineAssetRefresh);
  if (assetRefreshFrame) cancelAnimationFrame(assetRefreshFrame);
  destroyGlassElement();
});
</script>

<style scoped>
.glass-bottom-nav {
  position: fixed;
  z-index: 120;
  bottom: calc(
    var(--glass-nav-overscan-y)
    + 8px
    + env(safe-area-inset-bottom, 0px)
  );
  right: calc(env(safe-area-inset-right, 0px) + var(--glass-nav-overscan-x));
  left: calc(env(safe-area-inset-left, 0px) + var(--glass-nav-overscan-x));
  width: auto;
  max-width: 360px;
  margin-inline: auto;
}

.glass-bottom-nav__surface { position: relative; height: 64px; }
.glass-bottom-nav__engine {
  position: absolute;
  z-index: 1;
  inset: calc(-1 * var(--glass-engine-overscan-y))
    calc(-1 * var(--glass-engine-overscan-x));
  overflow: visible;
  opacity: 0;
  pointer-events: none;
  -webkit-mask-image: var(--glass-engine-mask);
  -webkit-mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-image: var(--glass-engine-mask);
  mask-mode: alpha;
  mask-size: 100% 100%;
  mask-repeat: no-repeat;
}
.glass-bottom-nav__surface:not(.is-fallback) .glass-bottom-nav__engine {
  opacity: 1;
  pointer-events: none;
}
.glass-bottom-nav__engine :deep(liquid-glass) {
  width: 100%;
  height: 100%;
}

.glass-bottom-nav__controls {
  position: absolute;
  z-index: 2;
  inset: 0 4px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  pointer-events: auto;
}
.glass-bottom-nav__tab {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 2px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  cursor: pointer;
  touch-action: none;
  pointer-events: auto;
}
.glass-bottom-nav__tab:focus-visible { outline: 2px solid #0088ff; outline-offset: -4px; }

.is-fallback .glass-bottom-nav__controls {
  inset: 0;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(250 250 250 / 76%);
  box-shadow: 0 10px 28px rgb(24 24 27 / 16%), inset 0 0 0 1px rgb(255 255 255 / 78%);
  pointer-events: auto;
  backdrop-filter: blur(12px) saturate(1.4);
}
.is-fallback .glass-bottom-nav__controls::before {
  position: absolute;
  inset: 4px auto 4px 4px;
  width: calc((100% - 8px) / 3);
  border-radius: 999px;
  background: rgb(255 255 255 / 72%);
  box-shadow: 0 3px 12px rgb(48 50 85 / 13%);
  content: "";
  transform: v-bind(fallbackIndicatorTransform);
  transition: transform 240ms ease;
}
.is-fallback .glass-bottom-nav__tab { color: #52525b; pointer-events: auto; }
.is-fallback .glass-bottom-nav__tab.is-active { color: #0088ff; }

:global(.dark) .is-fallback .glass-bottom-nav__controls {
  background: rgb(18 18 18 / 76%);
  box-shadow: 0 12px 30px rgb(0 0 0 / 35%), inset 0 0 0 1px rgb(255 255 255 / 18%);
}
:global(.dark) .is-fallback .glass-bottom-nav__controls::before { background: rgb(255 255 255 / 14%); }
:global(.dark) .is-fallback .glass-bottom-nav__tab { color: #d4d4d8; }
:global(.dark) .is-fallback .glass-bottom-nav__tab.is-active { color: #0091ff; }
:global(.dark) .glass-bottom-nav__tab:focus-visible { outline-color: #0091ff; }

@media (prefers-reduced-motion: reduce) {
  .is-fallback .glass-bottom-nav__controls::before { transition: none; }
}
</style>
