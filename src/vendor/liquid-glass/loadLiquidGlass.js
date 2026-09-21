const LIQUID_GLASS_TAG = "liquid-glass";
const MAX_BLUR_TAP_CAP = 33;

let loadPromise;

function supportsLiquidGlass() {
  if (
    typeof window.customElements === "undefined"
    || typeof window.ResizeObserver === "undefined"
    || typeof window.Path2D === "undefined"
  ) {
    return false;
  }

  const canvas = document.createElement("canvas");
  try {
    const context = canvas.getContext("webgl");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

export async function loadLiquidGlass() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (window.customElements.get(LIQUID_GLASS_TAG)) return true;
  if (!supportsLiquidGlass()) return false;

  loadPromise ??= import("./liquid-glass.js")
    .then(() => Boolean(window.customElements.get(LIQUID_GLASS_TAG)))
    .catch((error) => {
      console.warn("[liquid-glass] 本地组件加载失败，已使用原生导航。", error);
      return false;
    });

  return loadPromise;
}

export function applyLiquidGlassMaxQuality(element) {
  if (!element) return;
  const deviceDpr = Number(globalThis.devicePixelRatio);
  const dpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  element.setAttribute("dpr", String(dpr));
  element.setAttribute("blur-tap-cap", String(MAX_BLUR_TAP_CAP));
}

/**
 * Remove a Liquid Glass custom element and explicitly release its WebGL
 * context after the vendor's disconnected callback has deleted GPU assets.
 */
export function disposeLiquidGlassElement(element) {
  if (!element) return;
  const gestures = element._gestures instanceof Map
    ? [...element._gestures.entries()]
    : [];
  for (const [pointerId, gesture] of gestures) {
    if (!gesture?.dragStarted || typeof element._onUp !== "function") continue;
    const bounds = element._canvas?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    try {
      element._onUp({
        pointerId,
        clientX: bounds.left + (gesture.x || 0),
        clientY: bounds.top + (gesture.y || 0),
      });
    } catch {
      // Teardown below still clears listeners and releases the renderer.
    }
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("pointermove", element._onMove);
    window.removeEventListener("pointerup", element._onUp);
    window.removeEventListener("pointercancel", element._onUp);
  }
  element._gestures?.clear?.();
  const context = element._renderer?.gl ?? element._siri?._gl ?? null;
  element.remove();
  try {
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // The renderer may already have released or lost its context.
  }
}
