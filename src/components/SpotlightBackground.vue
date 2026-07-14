<template>
  <div
    class="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-0 transition-opacity duration-500 dark:opacity-60"
    aria-hidden="true"
  >
    <canvas ref="canvasRef" class="h-full w-full"></canvas>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

const canvasRef = ref(null);

let animationFrame = 0;
let lastFrameAt = 0;
let motionQuery = null;
let themeObserver = null;
let isDark = false;
let reduceMotion = false;

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const nextWidth = Math.round(width * pixelRatio);
  const nextHeight = Math.round(height * pixelRatio);

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");
  context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function drawSpotlight(context, x, y, radius, color, scaleX, scaleY) {
  context.save();
  context.translate(x, y);
  context.scale(scaleX, scaleY);

  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, `rgba(${color}, 0.16)`);
  gradient.addColorStop(0.36, `rgba(${color}, 0.08)`);
  gradient.addColorStop(1, `rgba(${color}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(-radius, -radius, radius * 2, radius * 2);
  context.restore();
}

function drawScene(time = 0) {
  const canvas = canvasRef.value;
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const span = Math.max(width, height);
  const phase = time / 1000;

  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = "screen";

  drawSpotlight(
    context,
    width * (0.14 + Math.sin(phase * 0.09) * 0.08),
    height * (-0.06 + Math.cos(phase * 0.07) * 0.08),
    span * 0.74,
    "56, 189, 178",
    1.45,
    0.72,
  );
  drawSpotlight(
    context,
    width * (0.92 + Math.cos(phase * 0.08) * 0.07),
    height * (0.38 + Math.sin(phase * 0.065) * 0.1),
    span * 0.7,
    "99, 102, 241",
    1.25,
    0.82,
  );
  drawSpotlight(
    context,
    width * (0.42 + Math.sin(phase * 0.055) * 0.1),
    height * (1.08 + Math.cos(phase * 0.075) * 0.06),
    span * 0.64,
    "244, 114, 182",
    1.55,
    0.62,
  );

  context.globalCompositeOperation = "source-over";
}

function animate(time) {
  if (!isDark || reduceMotion || document.hidden) {
    animationFrame = 0;
    return;
  }

  if (time - lastFrameAt >= 32) {
    drawScene(time);
    lastFrameAt = time;
  }
  animationFrame = requestAnimationFrame(animate);
}

function startAnimation() {
  if (animationFrame || !isDark || reduceMotion || document.hidden) return;
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

function syncPlayback() {
  isDark = document.documentElement.classList.contains("dark");
  reduceMotion = Boolean(motionQuery?.matches);
  resizeCanvas();

  if (!isDark) {
    stopAnimation();
    canvasRef.value?.getContext("2d")?.clearRect(0, 0, window.innerWidth, window.innerHeight);
    return;
  }

  if (reduceMotion) {
    stopAnimation();
    drawScene(0);
    return;
  }
  startAnimation();
}

function handleResize() {
  resizeCanvas();
  if (isDark) drawScene(reduceMotion ? 0 : performance.now());
}

function handleVisibilityChange() {
  if (document.hidden) stopAnimation();
  else syncPlayback();
}

onMounted(() => {
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener?.("change", syncPlayback);
  themeObserver = new MutationObserver(syncPlayback);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", handleResize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  syncPlayback();
});

onBeforeUnmount(() => {
  stopAnimation();
  motionQuery?.removeEventListener?.("change", syncPlayback);
  themeObserver?.disconnect();
  window.removeEventListener("resize", handleResize);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});
</script>
