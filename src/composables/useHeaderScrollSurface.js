import { computed, onBeforeUnmount, onMounted, readonly, ref } from "vue";

export const HEADER_SCROLL_DISTANCE = 160;
export const HEADER_BACKGROUND_MAX_PERCENT = 88;
export const HEADER_BORDER_MAX_PERCENT = 72;
export const HEADER_BACKDROP_MAX_PX = 18;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundCssValue(value) {
  return Math.round(value * 1_000) / 1_000;
}

export function getHeaderScrollProgress(scrollTop, distance = HEADER_SCROLL_DISTANCE) {
  const safeScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const safeDistance = Number.isFinite(distance) && distance > 0
    ? distance
    : HEADER_SCROLL_DISTANCE;

  return clamp(safeScrollTop / safeDistance, 0, 1);
}

export function getHeaderSurfaceStyle(progress) {
  const safeProgress = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;

  return {
    "--header-background-mix": `${roundCssValue(safeProgress * HEADER_BACKGROUND_MAX_PERCENT)}%`,
    "--header-border-mix": `${roundCssValue(safeProgress * HEADER_BORDER_MAX_PERCENT)}%`,
    "--header-backdrop-blur": `${roundCssValue(safeProgress * HEADER_BACKDROP_MAX_PX)}px`,
  };
}

function readWindowScrollTop() {
  const scrollTop = globalThis.scrollY ?? globalThis.pageYOffset ?? 0;
  return Number.isFinite(scrollTop) ? scrollTop : 0;
}

export function useHeaderScrollSurface(options = {}) {
  const distance = options.distance ?? HEADER_SCROLL_DISTANCE;
  const progress = ref(0);
  let animationFrameId = null;

  function syncProgress() {
    animationFrameId = null;
    progress.value = getHeaderScrollProgress(readWindowScrollTop(), distance);
  }

  function scheduleSync() {
    if (animationFrameId !== null) return;
    animationFrameId = globalThis.requestAnimationFrame(syncProgress);
  }

  onMounted(() => {
    syncProgress();
    globalThis.addEventListener("scroll", scheduleSync, { passive: true });
  });

  onBeforeUnmount(() => {
    globalThis.removeEventListener("scroll", scheduleSync);
    if (animationFrameId !== null) globalThis.cancelAnimationFrame(animationFrameId);
  });

  return {
    progress: readonly(progress),
    surfaceStyle: computed(() => getHeaderSurfaceStyle(progress.value)),
  };
}
