<template>
  <div
    ref="hostRef"
    class="pointer-events-none fixed inset-0 z-[1] overflow-hidden opacity-0 transition-opacity duration-500 dark:opacity-[.62]"
    aria-hidden="true"
    data-light-rays-background
  >
    <div
      class="light-rays-fallback absolute inset-0 transition-opacity duration-500"
      :class="fallbackVisible ? 'opacity-100' : 'opacity-0'"
    ></div>
    <canvas
      ref="canvasRef"
      class="absolute inset-0 block h-full w-full transition-opacity duration-300"
      :class="fallbackVisible ? 'opacity-0' : 'opacity-100'"
      data-light-rays-canvas
    ></canvas>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

const canvasRef = ref(null);
const hostRef = ref(null);

const RAYS_COLOR = [212 / 255, 226 / 255, 241 / 255];
const RAYS_SPEED = 0.45;
const LIGHT_SPREAD = 0.8;
const RAY_LENGTH = 1.6;
const FADE_DISTANCE = 0.9;
const SATURATION = 0.6;
const FRAME_INTERVAL = 1000 / 30;
const MAX_RENDER_PIXELS = 3_200_000;
const MOBILE_RENDERER_QUERY = "(max-width: 767px), (hover: none) and (pointer: coarse)";

const fallbackVisible = ref(true);

const fragmentShaderBody = `
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 rayPos;
uniform vec2 rayDir;
uniform vec3 raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2 mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rayStrength(
  vec2 raySource,
  vec2 rayRefDirection,
  vec2 coord,
  float seedA,
  float seedB,
  float speed
) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);
  float distortedAngle = cosAngle;
  if (distortion > 0.0) {
    distortedAngle += distortion
      * sin(iTime * 2.0 + length(sourceToCoord) * 0.01)
      * 0.2;
  }
  float spreadFactor = pow(
    max(distortedAngle, 0.0),
    1.0 / max(lightSpread, 0.001)
  );

  float distanceToSource = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp(
    (maxDistance - distanceToSource) / maxDistance,
    0.0,
    1.0
  );
  float fadeFalloff = clamp(
    (iResolution.x * fadeDistance - distanceToSource)
      / (iResolution.x * fadeDistance),
    0.5,
    1.0
  );
  float pulse = pulsating > 0.5
    ? (0.8 + 0.2 * sin(iTime * speed * 3.0))
    : 1.0;
  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed))
      + (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0,
    1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

vec4 renderLightRays(vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 finalRayDir = rayDir;

  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) * rayStrength(
    rayPos,
    finalRayDir,
    coord,
    36.2214,
    21.11349,
    1.5 * raysSpeed
  );
  vec4 rays2 = vec4(1.0) * rayStrength(
    rayPos,
    finalRayDir,
    coord,
    22.3991,
    18.0234,
    1.1 * raysSpeed
  );
  vec4 color = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float noiseValue = noise(coord * 0.01 + iTime * 0.1);
    color.rgb *= 1.0 - noiseAmount + noiseAmount * noiseValue;
  }

  float brightness = 1.0 - coord.y / iResolution.y;
  color.r *= 0.1 + brightness * 0.8;
  color.g *= 0.3 + brightness * 0.6;
  color.b *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, saturation);
  }

  color.rgb *= raysColor;
  return color;
}
`;

let animationFrame = 0;
let lastFrameAt = 0;
let rendererStartFrame = 0;
let rendererReadyFrame = 0;
let resizeFrame = 0;
let gl = null;
let program = null;
let positionBuffer = null;
let uniforms = null;
let isWebGl2 = false;
let rendererUnavailable = false;
let motionQuery = null;
let mobileRendererQuery = null;
let themeObserver = null;
let resizeObserver = null;
let isDark = false;
let reduceMotion = false;
let rendererStartAllowed = false;

function prefersCssFallback() {
  return Boolean(mobileRendererQuery?.matches || navigator.maxTouchPoints > 0);
}

function compileShader(context, type, source) {
  const shader = context.createShader(type);
  if (!shader) throw new Error("无法创建 WebGL 着色器");
  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (context.getShaderParameter(shader, context.COMPILE_STATUS)) return shader;

  const message = context.getShaderInfoLog(shader) || "未知着色器错误";
  context.deleteShader(shader);
  throw new Error(message);
}

function createProgram(context) {
  const supportsHighPrecision = isWebGl2 || Boolean(
    context.getShaderPrecisionFormat(context.FRAGMENT_SHADER, context.HIGH_FLOAT)?.precision,
  );
  const fragmentPrecision = supportsHighPrecision ? "highp" : "mediump";
  const vertexSource = isWebGl2
    ? `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`
    : `attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;
  const fragmentSource = isWebGl2
    ? `#version 300 es
precision ${fragmentPrecision} float;
${fragmentShaderBody}
out vec4 outColor;
void main() {
  outColor = renderLightRays(gl_FragCoord.xy);
}`
    : `precision ${fragmentPrecision} float;
${fragmentShaderBody}
void main() {
  gl_FragColor = renderLightRays(gl_FragCoord.xy);
}`;
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexSource);
  let fragmentShader = null;

  try {
    fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentSource);
  } catch (error) {
    context.deleteShader(vertexShader);
    throw error;
  }

  const nextProgram = context.createProgram();
  if (!nextProgram) {
    context.deleteShader(vertexShader);
    context.deleteShader(fragmentShader);
    throw new Error("无法创建 WebGL 程序");
  }

  context.attachShader(nextProgram, vertexShader);
  context.attachShader(nextProgram, fragmentShader);
  context.linkProgram(nextProgram);
  context.deleteShader(vertexShader);
  context.deleteShader(fragmentShader);

  if (context.getProgramParameter(nextProgram, context.LINK_STATUS)) return nextProgram;

  const message = context.getProgramInfoLog(nextProgram) || "未知 WebGL 链接错误";
  context.deleteProgram(nextProgram);
  throw new Error(message);
}

function setStaticUniforms() {
  if (!gl || !program || !uniforms) return;

  gl.useProgram(program);
  gl.uniform3f(uniforms.raysColor, ...RAYS_COLOR);
  gl.uniform1f(uniforms.raysSpeed, RAYS_SPEED);
  gl.uniform1f(uniforms.lightSpread, LIGHT_SPREAD);
  gl.uniform1f(uniforms.rayLength, RAY_LENGTH);
  gl.uniform1f(uniforms.pulsating, 0);
  gl.uniform1f(uniforms.fadeDistance, FADE_DISTANCE);
  gl.uniform1f(uniforms.saturation, SATURATION);
  gl.uniform2f(uniforms.mousePos, 0.5, 0.5);
  gl.uniform1f(uniforms.mouseInfluence, 0);
  gl.uniform1f(uniforms.noiseAmount, 0);
  gl.uniform1f(uniforms.distortion, 0);
}

function initRenderer() {
  const canvas = canvasRef.value;
  if (
    !canvas
    || program
    || rendererUnavailable
    || !rendererStartAllowed
    || prefersCssFallback()
  ) {
    return Boolean(program);
  }

  const contextOptions = {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  };

  try {
    gl = canvas.getContext("webgl", contextOptions);
    isWebGl2 = false;
    if (!gl) {
      gl = canvas.getContext("webgl2", contextOptions);
      isWebGl2 = Boolean(gl);
    }
    if (!gl) throw new Error("当前浏览器不支持 WebGL");

    program = createProgram(gl);
    positionBuffer = gl.createBuffer();
    if (!positionBuffer) throw new Error("无法创建 WebGL 顶点缓冲区");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "position");
    if (positionLocation < 0) throw new Error("WebGL 顶点属性 position 不可用");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    const uniformNames = [
      "iTime",
      "iResolution",
      "rayPos",
      "rayDir",
      "raysColor",
      "raysSpeed",
      "lightSpread",
      "rayLength",
      "pulsating",
      "fadeDistance",
      "saturation",
      "mousePos",
      "mouseInfluence",
      "noiseAmount",
      "distortion",
    ];
    uniforms = Object.fromEntries(uniformNames.map((name) => {
      const location = gl.getUniformLocation(program, name);
      if (location === null) throw new Error(`WebGL uniform ${name} 不可用`);
      return [name, location];
    }));

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    setStaticUniforms();
    resizeCanvas();
    fallbackVisible.value = false;
    return true;
  } catch (error) {
    if (gl && positionBuffer) gl.deleteBuffer(positionBuffer);
    if (gl && program) gl.deleteProgram(program);
    gl = null;
    program = null;
    positionBuffer = null;
    uniforms = null;
    rendererUnavailable = true;
    fallbackVisible.value = true;
    console.warn("WebGL 光束背景初始化失败：", error);
    return false;
  }
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas || !gl || !program || !uniforms) return;

  const width = Math.max(1, Math.round(canvas.clientWidth || window.innerWidth));
  const height = Math.max(1, Math.round(canvas.clientHeight || window.innerHeight));
  const preferredPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelBudgetRatio = Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, width * height));
  const pixelRatio = Math.min(preferredPixelRatio, pixelBudgetRatio);
  const nextWidth = Math.max(1, Math.round(width * pixelRatio));
  const nextHeight = Math.max(1, Math.round(height * pixelRatio));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  const drawingWidth = gl.drawingBufferWidth;
  const drawingHeight = gl.drawingBufferHeight;
  gl.viewport(0, 0, drawingWidth, drawingHeight);
  gl.useProgram(program);
  gl.uniform2f(uniforms.iResolution, drawingWidth, drawingHeight);
  gl.uniform2f(uniforms.rayPos, drawingWidth * 0.5, drawingHeight * -0.2);
  gl.uniform2f(uniforms.rayDir, 0, 1);
}

function renderFrame(time = 0) {
  if (!gl || !program || !uniforms) return;

  gl.useProgram(program);
  gl.uniform1f(uniforms.iTime, time * 0.001);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function animate(time) {
  if (!isDark || reduceMotion || document.hidden || prefersCssFallback() || !program) {
    animationFrame = 0;
    return;
  }

  if (time - lastFrameAt >= FRAME_INTERVAL) {
    renderFrame(time);
    lastFrameAt = time;
  }
  animationFrame = requestAnimationFrame(animate);
}

function startAnimation() {
  if (
    animationFrame
    || !isDark
    || reduceMotion
    || document.hidden
    || prefersCssFallback()
    || !program
  ) return;
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

function clearFrame() {
  if (!gl) return;
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function syncPlayback() {
  isDark = document.documentElement.classList.contains("dark");
  reduceMotion = Boolean(motionQuery?.matches);

  if (!isDark) {
    stopAnimation();
    clearFrame();
    return;
  }

  if (prefersCssFallback()) {
    stopAnimation();
    fallbackVisible.value = true;
    return;
  }

  if (!rendererStartAllowed) {
    fallbackVisible.value = true;
    return;
  }

  if (!initRenderer()) return;
  fallbackVisible.value = false;
  resizeCanvas();

  if (reduceMotion) {
    stopAnimation();
    renderFrame(0);
    return;
  }

  renderFrame(performance.now());
  startAnimation();
}

function handleResize() {
  if (!isDark || prefersCssFallback() || !initRenderer()) return;
  resizeCanvas();
  renderFrame(reduceMotion ? 0 : performance.now());
}

function scheduleResize() {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    handleResize();
  });
}

function scheduleRendererStart() {
  rendererStartFrame = requestAnimationFrame(() => {
    rendererStartFrame = 0;
    rendererReadyFrame = requestAnimationFrame(() => {
      rendererReadyFrame = 0;
      rendererStartAllowed = true;
      syncPlayback();
    });
  });
}

function handleVisibilityChange() {
  if (document.hidden) stopAnimation();
  else syncPlayback();
}

function handleContextLost(event) {
  event.preventDefault();
  stopAnimation();
  gl = null;
  program = null;
  positionBuffer = null;
  uniforms = null;
  rendererUnavailable = true;
  fallbackVisible.value = true;
}

function handleContextRestored() {
  // A lost GPU context usually means the device rejected this workload.
  // Keep the inexpensive CSS fallback for the remainder of this page load.
  fallbackVisible.value = true;
}

function destroyRenderer() {
  stopAnimation();
  if (gl && positionBuffer) gl.deleteBuffer(positionBuffer);
  if (gl && program) gl.deleteProgram(program);
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  gl = null;
  program = null;
  positionBuffer = null;
  uniforms = null;
  isWebGl2 = false;
  rendererUnavailable = false;
  fallbackVisible.value = true;
}

onMounted(() => {
  const canvas = canvasRef.value;
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mobileRendererQuery = window.matchMedia(MOBILE_RENDERER_QUERY);
  if (motionQuery.addEventListener) motionQuery.addEventListener("change", syncPlayback);
  else motionQuery.addListener?.(syncPlayback);
  if (mobileRendererQuery.addEventListener) {
    mobileRendererQuery.addEventListener("change", syncPlayback);
  } else {
    mobileRendererQuery.addListener?.(syncPlayback);
  }
  themeObserver = new MutationObserver(syncPlayback);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleResize);
  if (canvas) {
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
  }
  if (hostRef.value) resizeObserver?.observe(hostRef.value);
  window.addEventListener("resize", scheduleResize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  syncPlayback();
  scheduleRendererStart();
});

onBeforeUnmount(() => {
  const canvas = canvasRef.value;
  if (motionQuery?.removeEventListener) motionQuery.removeEventListener("change", syncPlayback);
  else motionQuery?.removeListener?.(syncPlayback);
  if (mobileRendererQuery?.removeEventListener) {
    mobileRendererQuery.removeEventListener("change", syncPlayback);
  } else {
    mobileRendererQuery?.removeListener?.(syncPlayback);
  }
  themeObserver?.disconnect();
  resizeObserver?.disconnect();
  window.removeEventListener("resize", scheduleResize);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  canvas?.removeEventListener("webglcontextlost", handleContextLost);
  canvas?.removeEventListener("webglcontextrestored", handleContextRestored);
  if (rendererStartFrame) cancelAnimationFrame(rendererStartFrame);
  if (rendererReadyFrame) cancelAnimationFrame(rendererReadyFrame);
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  destroyRenderer();
});
</script>

<style scoped>
.light-rays-fallback {
  background:
    radial-gradient(ellipse 72% 58% at 50% -12%, rgb(212 226 241 / 42%), transparent 72%),
    linear-gradient(112deg, transparent 30%, rgb(185 207 231 / 10%) 49%, transparent 68%);
}
</style>
