const LIQUID_GLASS_TAG = "liquid-glass";

let loadPromise;

function hasWebGlSupport() {
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

/**
 * Load the vendored Liquid Glass Web Component once per page.
 *
 * The feature check happens before evaluating the bundle because the component
 * constructor throws when WebGL is unavailable. Callers can then keep an HTML
 * control visible as a usable fallback instead of mounting a broken element.
 */
export async function loadLiquidGlass() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  if (window.customElements.get(LIQUID_GLASS_TAG)) return true;
  if (!hasWebGlSupport()) return false;

  loadPromise ??= import("./liquid-glass.js")
    .then(() => Boolean(window.customElements.get(LIQUID_GLASS_TAG)))
    .catch((error) => {
      console.warn("[liquid-glass] 本地组件加载失败，已使用原生导航。", error);
      return false;
    });

  return loadPromise;
}
