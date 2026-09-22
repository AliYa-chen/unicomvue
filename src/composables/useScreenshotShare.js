import { nextTick, onScopeDispose, readonly, ref } from "vue";
import {
  createScreenshotFilename,
  getScreenshotPixelRatio,
  MAX_SCREENSHOT_DIMENSION,
  MAX_SCREENSHOT_PIXELS,
} from "@/utils/screenshot";
import {
  createDownloadUrl,
  renderElementToBlob,
  revokeDownloadUrl,
  triggerDownload,
  tryCopyPngBlob,
  tryCopyText,
} from "@/services/browserShare";
import { getErrorMessage } from "@/utils/errors";

const SCREENSHOT_TIMEOUT_MS = 20_000;

export {
  getScreenshotPixelRatio,
  MAX_SCREENSHOT_DIMENSION,
  MAX_SCREENSHOT_PIXELS,
};

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

    revokeDownloadUrl(downloadUrl.value);
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

    return renderElementToBlob(target, {
      backgroundColor: isDark.value ? "#18181b" : "#fafafa",
      cacheBust: true,
      pixelRatio: getScreenshotPixelRatio(target),
      filter: (node) => node !== excludedTarget?.value,
    }, captureToBlob);
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
    downloadUrl.value = createDownloadUrl(blob);
    downloadFilename.value = createScreenshotFilename();
    await nextTick();

    if (disposed) return;
    triggerDownload(downloadLink.value);
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

      if (await tryCopyPngBlob(blob)) {
        if (!disposed) {
          notify("截图已复制到剪贴板");
        }
        return;
      }

      await downloadScreenshot(blob);
      if (!disposed) notify("图片剪贴板不可用，截图已下载", "download");
    } catch (error) {
      if (!disposed) notify(getErrorMessage(error, "截图生成失败"), "error");
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

    if (!(await tryCopyText(value))) {
      if (!disposed) {
        notify(`浏览器未允许复制 ${label}`, "error");
      }
      return false;
    }

    if (disposed) return false;
    updateStatus(`${label} 复制成功`, "ok");
    notify(`${label} 已复制`);
    return true;
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
