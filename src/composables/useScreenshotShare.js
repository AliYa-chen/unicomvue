import { nextTick, onScopeDispose, readonly, ref } from "vue";

const SCREENSHOT_TIMEOUT_MS = 20_000;
export const MAX_SCREENSHOT_PIXELS = 4_000_000;
export const MAX_SCREENSHOT_DIMENSION = 4_096;
export const MAX_SCREENSHOT_PIXEL_RATIO = 2;

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

export function useScreenshotShare({
  captureTarget,
  excludedTarget,
  downloadLink,
  isDark,
  notify,
  updateStatus,
  captureToBlob = null,
  screenshotTimeoutMs = SCREENSHOT_TIMEOUT_MS,
}) {
  const isSharing = ref(false);
  const watermarkVisible = ref(false);
  const downloadUrl = ref("");
  const downloadFilename = ref("");

  let disposed = false;
  const pendingFrames = new Map();
  const screenshotTimeouts = new Map();
  let downloadCleanupTimer = null;
  let pendingCapture = null;

  function releaseDownloadUrl() {
    if (downloadCleanupTimer !== null) clearTimeout(downloadCleanupTimer);
    downloadCleanupTimer = null;

    if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value);
    downloadUrl.value = "";
    downloadFilename.value = "";
  }

  function waitForNextFrame() {
    return new Promise((resolve) => {
      const frameId = requestAnimationFrame(() => {
        pendingFrames.delete(frameId);
        resolve();
      });
      pendingFrames.set(frameId, resolve);
    });
  }

  function withTimeout(promise) {
    return new Promise((resolve, reject) => {
      let settled = false;

      function settle(callback, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        screenshotTimeouts.delete(timeout);
        callback(value);
      }

      const timeout = setTimeout(() => {
        settle(reject, new Error("截图生成超时，请稍后重试"));
      }, screenshotTimeoutMs);
      screenshotTimeouts.set(timeout, () => {
        settle(reject, new Error("截图生成已取消"));
      });

      promise.then(
        (value) => settle(resolve, value),
        (error) => settle(reject, error),
      );
    });
  }

  async function captureScreenshot() {
    await nextTick();
    await waitForNextFrame();
    const target = captureTarget.value;
    if (disposed || !target) return null;

    const renderToBlob = captureToBlob || (await import("html-to-image")).toBlob;
    return renderToBlob(target, {
      backgroundColor: isDark.value ? "#18181b" : "#fafafa",
      cacheBust: true,
      pixelRatio: getScreenshotPixelRatio(target),
      filter: (node) => node !== excludedTarget.value,
    });
  }

  function startCapture() {
    const capture = captureScreenshot();
    pendingCapture = capture;

    // Keep the mutex until the renderer itself settles, even if the UI times out first.
    capture.then(
      () => {
        if (pendingCapture === capture) pendingCapture = null;
      },
      () => {
        if (pendingCapture === capture) pendingCapture = null;
      },
    );
    return capture;
  }

  async function downloadScreenshot(blob) {
    releaseDownloadUrl();
    downloadUrl.value = URL.createObjectURL(blob);
    downloadFilename.value = `联通套餐-${new Date().toISOString().slice(0, 10)}.png`;
    await nextTick();

    if (disposed) return;
    downloadLink.value?.click();
    downloadCleanupTimer = setTimeout(releaseDownloadUrl, 1000);
  }

  async function shareScreenshot() {
    if (!captureTarget.value || disposed) return;
    if (pendingCapture || isSharing.value) {
      notify("上一张截图仍在处理中，请稍后重试", "error");
      return;
    }

    isSharing.value = true;
    watermarkVisible.value = true;

    try {
      const blob = await withTimeout(startCapture());

      if (disposed) return;
      if (!blob) throw new Error("截图生成失败");
      watermarkVisible.value = false;

      if (globalThis.navigator?.clipboard?.write && globalThis.ClipboardItem) {
        try {
          await globalThis.navigator.clipboard.write([
            new globalThis.ClipboardItem({ "image/png": blob }),
          ]);
          notify("截图已复制到剪贴板");
          return;
        } catch {
          // Image clipboard support varies; downloading is the reliable fallback.
        }
      }

      await downloadScreenshot(blob);
      if (!disposed) notify("图片剪贴板不可用，截图已下载", "download");
    } catch (error) {
      if (!disposed) notify(error?.message || "截图生成失败", "error");
    } finally {
      watermarkVisible.value = false;
      isSharing.value = false;
    }
  }

  async function copyText(value, label) {
    if (!value) {
      notify(`当前账号没有 ${label}，请先登录`, "error");
      return false;
    }

    const writeText = globalThis.navigator?.clipboard?.writeText;
    if (typeof writeText !== "function") {
      notify(`浏览器未允许复制 ${label}`, "error");
      return false;
    }

    try {
      await writeText.call(globalThis.navigator.clipboard, value);
      if (disposed) return false;
      updateStatus(`${label} 复制成功`, "ok");
      notify(`${label} 已复制`);
      return true;
    } catch {
      if (!disposed) notify(`浏览器未允许复制 ${label}`, "error");
      return false;
    }
  }

  onScopeDispose(() => {
    disposed = true;
    pendingFrames.forEach((resolve, frameId) => {
      cancelAnimationFrame(frameId);
      resolve();
    });
    pendingFrames.clear();
    screenshotTimeouts.forEach((cancel) => cancel());
    screenshotTimeouts.clear();
    releaseDownloadUrl();
  });

  return {
    isSharing: readonly(isSharing),
    watermarkVisible: readonly(watermarkVisible),
    downloadUrl: readonly(downloadUrl),
    downloadFilename: readonly(downloadFilename),
    shareScreenshot,
    copyText,
  };
}
