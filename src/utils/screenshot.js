export const MAX_SCREENSHOT_PIXELS = 4_000_000;
export const MAX_SCREENSHOT_DIMENSION = 4_096;

const MAX_SCREENSHOT_PIXEL_RATIO = 2;

function getPositiveDimension(...values) {
  const dimensions = values.filter((value) => Number.isFinite(value) && value > 0);
  return Math.max(1, Math.ceil(Math.max(0, ...dimensions)));
}

export function getScreenshotPixelRatio(
  target,
  requestedPixelRatio = globalThis.devicePixelRatio || 1,
) {
  const bounds = target?.getBoundingClientRect?.();
  const width = getPositiveDimension(
    target?.clientWidth,
    target?.scrollWidth,
    bounds?.width,
  );
  const height = getPositiveDimension(
    target?.clientHeight,
    target?.scrollHeight,
    bounds?.height,
  );
  const deviceScale = Number.isFinite(requestedPixelRatio) && requestedPixelRatio > 0
    ? requestedPixelRatio
    : 1;

  return Math.min(
    deviceScale,
    MAX_SCREENSHOT_PIXEL_RATIO,
    Math.sqrt(MAX_SCREENSHOT_PIXELS / (width * height)),
    MAX_SCREENSHOT_DIMENSION / width,
    MAX_SCREENSHOT_DIMENSION / height,
  );
}

export function createScreenshotFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const localDate = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
  return `联通套餐-${localDate}.png`;
}
