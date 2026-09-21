const wallpaperCache = new Map();
const plainWallpaperCache = new Map();
const maskCache = new Map();
const MAX_CACHE_ENTRIES = 8;
const MASK_HALO_BLUR = 9;
const MASK_HALO_ALPHA = 0.82;
const MASK_MOTION_ALPHA = 0.18;
const MASK_MOTION_BLUR = 3;
const MASK_MOTION_INSET = 10;

const PALETTES = Object.freeze({
  light: Object.freeze({
    base: "#fafafa",
    wash: [
      [0, "rgba(255, 255, 255, 0.92)"],
      [0.42, "rgba(255, 255, 255, 0.48)"],
      [0.76, "rgba(255, 255, 255, 0.12)"],
      [1, "rgba(255, 255, 255, 0)"],
    ],
    cool: [
      [0, "rgba(191, 219, 254, 0.34)"],
      [0.38, "rgba(219, 234, 254, 0.2)"],
      [0.72, "rgba(224, 231, 255, 0.08)"],
      [1, "rgba(224, 231, 255, 0)"],
    ],
    shade: [
      [0, "rgba(212, 212, 216, 0.2)"],
      [0.46, "rgba(228, 228, 231, 0.1)"],
      [1, "rgba(228, 228, 231, 0)"],
    ],
  }),
  dark: Object.freeze({
    base: "#18181b",
    wash: [
      [0, "rgba(82, 82, 91, 0.42)"],
      [0.42, "rgba(63, 63, 70, 0.22)"],
      [0.76, "rgba(39, 39, 42, 0.08)"],
      [1, "rgba(39, 39, 42, 0)"],
    ],
    cool: [
      [0, "rgba(49, 46, 129, 0.3)"],
      [0.4, "rgba(30, 58, 138, 0.16)"],
      [0.74, "rgba(15, 23, 42, 0.06)"],
      [1, "rgba(15, 23, 42, 0)"],
    ],
    shade: [
      [0, "rgba(9, 9, 11, 0.26)"],
      [0.48, "rgba(9, 9, 11, 0.1)"],
      [1, "rgba(9, 9, 11, 0)"],
    ],
  }),
});

function drawSoftBlob(context, x, y, radiusX, radiusY, colorStops) {
  context.save();
  context.translate(x, y);
  context.scale(radiusX, radiusY);

  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, color] of colorStops) gradient.addColorStop(offset, color);

  context.fillStyle = gradient;
  context.fillRect(-1, -1, 2, 2);
  context.restore();
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const right = x + width;
  const bottom = y + height;

  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fill();
}

function remember(cache, key, value) {
  cache.set(key, value);
  if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  return value;
}

function getNativeRenderScale() {
  const deviceScale = Number(globalThis.devicePixelRatio);
  return Number.isFinite(deviceScale) && deviceScale > 0 ? deviceScale : 1;
}

/**
 * Produce an opaque local backdrop for the vendored WebGL renderer.
 * Its context uses alpha:false, so transparency is approximated with the app
 * shell color and softly feathered light instead of a visibly tiled image.
 */
export function createLiquidGlassWallpaper(width, height, dark) {
  const safeWidth = Math.max(2, Math.round(width));
  const safeHeight = Math.max(2, Math.round(height));
  const scale = getNativeRenderScale();
  const key = `${safeWidth}x${safeHeight}:${dark ? "dark" : "light"}:${scale}`;
  const cached = wallpaperCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(safeWidth * scale);
  canvas.height = Math.round(safeHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return "";

  const palette = dark ? PALETTES.dark : PALETTES.light;
  context.scale(scale, scale);
  context.fillStyle = palette.base;
  context.fillRect(0, 0, safeWidth, safeHeight);

  // Each radial gradient reaches full transparency before its bounds. This
  // gives the glass some color to refract while keeping the texture's outer
  // edge identical to the page background, so no hard rectangle is exposed.
  drawSoftBlob(
    context,
    safeWidth * 0.5,
    safeHeight * 0.42,
    safeWidth * 0.48,
    safeHeight * 0.68,
    palette.wash,
  );
  drawSoftBlob(
    context,
    safeWidth * 0.28,
    safeHeight * 0.46,
    safeWidth * 0.3,
    safeHeight * 0.58,
    palette.cool,
  );
  drawSoftBlob(
    context,
    safeWidth * 0.76,
    safeHeight * 0.6,
    safeWidth * 0.28,
    safeHeight * 0.52,
    palette.shade,
  );

  const wallpaper = canvas.toDataURL("image/png");
  return remember(wallpaperCache, key, wallpaper);
}

/**
 * Produce a solid renderer backdrop that visually merges into a plain app
 * surface. This is useful for compact controls where decorative light blobs
 * would expose the otherwise opaque WebGL canvas as a separate panel.
 */
export function createLiquidGlassPlainWallpaper(width, height, dark, surface = "soft") {
  if (typeof document === "undefined") return "";

  const safeWidth = Math.max(2, Math.round(width));
  const safeHeight = Math.max(2, Math.round(height));
  const scale = getNativeRenderScale();
  const lightColor = surface === "plain" ? "#ffffff" : "#fbfbfb";
  const color = dark ? PALETTES.dark.base : lightColor;
  const key = `${safeWidth}x${safeHeight}:${color}:${scale}`;
  const cached = plainWallpaperCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(safeWidth * scale);
  canvas.height = Math.round(safeHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return remember(plainWallpaperCache, key, canvas.toDataURL("image/png"));
}

/**
 * Mask the renderer's opaque wallpaper to the visible capsule. The softened
 * halo leaves room for the liquid animation without exposing canvas corners.
 */
export function createLiquidGlassMask(
  width,
  height,
  overscanX = 36,
  overscanY = 24,
  navHeight = 64,
) {
  if (typeof document === "undefined") return "";

  const safeWidth = Math.max(2, Math.round(width));
  const safeHeight = Math.max(2, Math.round(height));
  const safeOverscanX = Math.max(0, Math.min(overscanX, (safeWidth - 1) / 2));
  const safeOverscanY = Math.max(0, Math.min(overscanY, (safeHeight - 1) / 2));
  const innerHeight = Math.max(1, safeHeight - safeOverscanY * 2);
  const requestedHeight = Number.isFinite(navHeight) ? navHeight : innerHeight;
  const capsuleHeightCss = Math.max(1, Math.min(requestedHeight, innerHeight));
  const capsuleYCss = safeOverscanY + (innerHeight - capsuleHeightCss) / 2;
  const scale = getNativeRenderScale();
  const key = [
    safeWidth,
    safeHeight,
    safeOverscanX,
    safeOverscanY,
    capsuleHeightCss,
    scale,
  ].join(":");
  const cached = maskCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(safeWidth * scale);
  canvas.height = Math.round(safeHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return "";

  const x = safeOverscanX * scale;
  const y = capsuleYCss * scale;
  const capsuleWidth = (safeWidth - safeOverscanX * 2) * scale;
  const capsuleHeight = capsuleHeightCss * scale;
  const radius = Math.min(capsuleWidth, capsuleHeight) / 2;
  const minimumGap = Math.min(
    safeOverscanX,
    capsuleYCss,
    safeWidth - safeOverscanX - capsuleWidth / scale,
    safeHeight - capsuleYCss - capsuleHeightCss,
  );
  const haloBlur = Math.max(
    0,
    Math.min(MASK_HALO_BLUR, (minimumGap - 1 / scale) / 3),
  );

  // A very faint, wide capsule preserves the enlarged liquid indicator while
  // keeping the opaque renderer's square corners fully transparent.
  const motionInsetX = Math.min(MASK_MOTION_INSET * scale, canvas.width / 2);
  const motionInsetY = Math.min(MASK_MOTION_INSET * scale, canvas.height / 2);
  const motionWidth = Math.max(1, canvas.width - motionInsetX * 2);
  const motionHeight = Math.max(1, canvas.height - motionInsetY * 2);
  const motionRadius = Math.min(motionWidth, motionHeight) / 2;

  context.fillStyle = "#fff";
  context.save();
  context.filter = `blur(${MASK_MOTION_BLUR * scale}px)`;
  context.globalAlpha = MASK_MOTION_ALPHA;
  drawRoundedRect(
    context,
    motionInsetX,
    motionInsetY,
    motionWidth,
    motionHeight,
    motionRadius,
  );
  context.restore();

  context.save();
  context.filter = `blur(${haloBlur * scale}px)`;
  context.globalAlpha = MASK_HALO_ALPHA;
  drawRoundedRect(context, x, y, capsuleWidth, capsuleHeight, radius);
  context.restore();

  context.fillStyle = "#fff";
  drawRoundedRect(context, x, y, capsuleWidth, capsuleHeight, radius);

  return remember(maskCache, key, canvas.toDataURL("image/png"));
}
