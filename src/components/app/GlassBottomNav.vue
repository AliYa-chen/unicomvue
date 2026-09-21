<template>
  <nav class="glass-bottom-nav" aria-label="主导航">
    <div class="glass-bottom-nav__surface" :class="{ 'is-fallback': !glassReady }">
      <div ref="glassHostRef" class="glass-bottom-nav__engine" aria-hidden="true"></div>

      <div class="glass-bottom-nav__controls">
        <button
          v-for="(tab, index) in TABS"
          :key="tab.value"
          type="button"
          class="glass-bottom-nav__tab"
          :class="{ 'is-active': activeTab === tab.value }"
          :aria-current="activeTab === tab.value ? 'page' : undefined"
          @click="selectTab(index)"
        >
          <component
            :is="tab.component"
            :size="21"
            :stroke-width="2"
            aria-hidden="true"
          />
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
import { ChartPie, Gauge } from "@lucide/vue";
import { useTheme } from "@/composables/useTheme";
import { loadLiquidGlass } from "@/vendor/liquid-glass/loadLiquidGlass";

const TAB_VALUES = ["usage", "speed"];
const TABS = [
  {
    value: "usage",
    label: "余量",
    component: ChartPie,
    icon: "M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z M21.21 15.89A10 10 0 1 1 8 2.83",
    viewport: 24,
  },
  {
    value: "speed",
    label: "测速",
    component: Gauge,
    icon: "M12 14 16 10 M3.34 19A10 10 0 1 1 20.66 19",
    viewport: 24,
  },
];
const ENGINE_TABS = [
  TABS.map(({ icon, label, viewport }) => ({ icon, label, viewport })),
];

const props = defineProps({
  activeTab: {
    type: String,
    required: true,
    validator: (value) => ["usage", "speed"].includes(value),
  },
});

const emit = defineEmits(["change"]);
const { isDark } = useTheme();
const glassHostRef = useTemplateRef("glassHostRef");
const glassReady = ref(false);
const fallbackIndicatorTransform = computed(() => `translateX(${activeIndex() * 100}%)`);

let glassElement = null;
let glassCanvas = null;
let mounted = false;
let syncingFromVue = false;
let engineConnected = false;

function activeIndex() {
  return Math.max(0, TAB_VALUES.indexOf(props.activeTab));
}

function applyTheme(dark) {
  if (!glassElement) return;
  glassElement.toggleAttribute("dark", dark);
}

function syncEngineSelection() {
  if (!glassElement || typeof glassElement.setState !== "function") return;

  syncingFromVue = true;
  glassElement.setState({ selectedTab: activeIndex() });
  queueMicrotask(() => {
    syncingFromVue = false;
  });
}

function onGlassStateChange(event) {
  if (event.target !== glassElement) return;
  engineConnected = true;
  if (syncingFromVue) return;

  const nextIndex = Number(event.detail?.selectedTab);
  const nextTab = TAB_VALUES[nextIndex];
  if (!nextTab || nextTab === props.activeTab) return;

  emit("change", nextTab);
}

function onWebGlContextLost(event) {
  if (event.target !== glassCanvas) return;

  event.preventDefault();
  console.warn("[liquid-glass] WebGL 上下文已丢失，已使用原生导航。");
  destroyGlassElement();
}

function selectTab(index) {
  const nextTab = TAB_VALUES[index];
  if (!nextTab || nextTab === props.activeTab) return;

  if (glassReady.value) {
    glassElement?.setState?.({ selectedTab: index });
    return;
  }

  emit("change", nextTab);
}

async function mountGlassElement() {
  const host = glassHostRef.value;
  if (!host || !(await loadLiquidGlass()) || !mounted || host !== glassHostRef.value) return;

  try {
    engineConnected = false;
    glassElement = document.createElement("liquid-glass");
    glassElement.setAttribute("dpr", "2");
    glassElement.setAttribute("blur-tap-cap", "9");
    glassElement.setAttribute("corner-style", "1");
    applyTheme(isDark.value);
    glassElement.addEventListener("lg-statechange", onGlassStateChange);

    syncingFromVue = true;
    host.replaceChildren(glassElement);
    glassElement.setAttribute("mode", "single-bottom-tabs");
    glassCanvas = glassElement.shadowRoot?.querySelector("canvas") ?? null;
    glassCanvas?.addEventListener("webglcontextlost", onWebGlContextLost, { once: true });

    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!mounted || !glassElement?.isConnected) {
      destroyGlassElement();
      return;
    }
    glassElement.setTabs(ENGINE_TABS);
    glassElement.setState({ selectedTab: activeIndex() });
    queueMicrotask(() => {
      syncingFromVue = false;
    });
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    if (mounted && glassElement?.isConnected && engineConnected) {
      glassReady.value = true;
    } else {
      destroyGlassElement();
    }
  } catch (error) {
    console.warn("[liquid-glass] WebGL 初始化失败，已使用原生导航。", error);
    destroyGlassElement();
  }
}

function destroyGlassElement() {
  glassReady.value = false;
  syncingFromVue = false;
  engineConnected = false;
  glassCanvas?.removeEventListener("webglcontextlost", onWebGlContextLost);
  glassCanvas = null;
  if (!glassElement) return;

  glassElement.removeEventListener("lg-statechange", onGlassStateChange);
  glassElement.remove();
  glassElement = null;
}

watch(() => props.activeTab, syncEngineSelection);
watch(isDark, applyTheme);

onMounted(() => {
  mounted = true;
  mountGlassElement();
});

onBeforeUnmount(() => {
  mounted = false;
  destroyGlassElement();
});
</script>

<style scoped>
.glass-bottom-nav {
  position: fixed;
  z-index: 120;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  width: min(360px, calc(100vw - 32px));
  transform: translateX(-50%);
}

.glass-bottom-nav__surface {
  position: relative;
  height: 64px;
}

.glass-bottom-nav__engine {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 999px;
  opacity: 0;
  pointer-events: none;
}

.glass-bottom-nav__surface:not(.is-fallback) .glass-bottom-nav__engine {
  opacity: 1;
  pointer-events: auto;
}

.glass-bottom-nav__engine :deep(liquid-glass) {
  width: calc(100% + 72px);
  height: 64px;
  margin-left: -36px;
}

.glass-bottom-nav__controls {
  position: absolute;
  inset: 0 4px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  pointer-events: none;
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
  touch-action: manipulation;
  pointer-events: none;
}

.glass-bottom-nav__tab:focus-visible {
  /* outline: 2px solid #4f46e5; */
  outline-offset: -3px;
}

.is-fallback .glass-bottom-nav__controls {
  inset: 0;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 999px;
  background: #f4f4f5;
  box-shadow: 0 10px 28px rgb(24 24 27 / 16%);
  pointer-events: auto;
}

.is-fallback .glass-bottom-nav__controls::before {
  position: absolute;
  inset: 4px auto 4px 4px;
  width: calc((100% - 8px) / 2);
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 3px 12px rgb(48 50 85 / 13%);
  content: "";
  transform: v-bind(fallbackIndicatorTransform);
  transition: transform 240ms ease;
}

.is-fallback .glass-bottom-nav__tab {
  color: #52525b;
  pointer-events: auto;
}

.is-fallback .glass-bottom-nav__tab.is-active {
  /* color: #4f46e5; */
}

:global(.dark) .is-fallback .glass-bottom-nav__controls {
  border-color: rgb(255 255 255 / 18%);
  background: #27272a;
  box-shadow: 0 12px 30px rgb(0 0 0 / 35%);
}

:global(.dark) .is-fallback .glass-bottom-nav__controls::before {
  background: #45454e;
}

:global(.dark) .is-fallback .glass-bottom-nav__tab {
  color: #d4d4d8;
}

:global(.dark) .is-fallback .glass-bottom-nav__tab.is-active {
  color: #a5b4fc;
}

:global(.dark) .glass-bottom-nav__tab:focus-visible {
  outline-color: #a5b4fc;
}

@media (prefers-reduced-motion: reduce) {
  .is-fallback .glass-bottom-nav__controls::before {
    transition: none;
  }
}
</style>
