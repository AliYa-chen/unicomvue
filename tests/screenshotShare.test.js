import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { effectScope, ref } from "vue";
import {
  MAX_SCREENSHOT_DIMENSION,
  MAX_SCREENSHOT_PIXELS,
  getScreenshotPixelRatio,
  useScreenshotShare,
} from "../src/composables/useScreenshotShare.js";

const originalAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

function createTarget(width, height) {
  return {
    clientWidth: width,
    clientHeight: height,
    scrollWidth: width,
    scrollHeight: height,
    getBoundingClientRect: () => ({ width, height }),
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Condition was not reached in time");
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  }
}

afterEach(() => {
  if (originalAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame = originalAnimationFrame;
  if (originalCancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
  else globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
});

test("screenshot scale caps DPR, total pixels, and long-edge dimensions", () => {
  const phoneTarget = createTarget(390, 844);
  assert.equal(getScreenshotPixelRatio(phoneTarget, 3), 2);

  const longTarget = createTarget(1_000, 5_000);
  const longRatio = getScreenshotPixelRatio(longTarget, 3);
  assert.ok(longRatio < 1);
  assert.ok(1_000 * longRatio * 5_000 * longRatio <= MAX_SCREENSHOT_PIXELS);

  const veryLongTarget = createTarget(500, 20_000);
  const veryLongRatio = getScreenshotPixelRatio(veryLongTarget, 3);
  assert.ok(20_000 * veryLongRatio <= MAX_SCREENSHOT_DIMENSION);
});

test("timed-out capture remains mutually exclusive until its renderer settles", async () => {
  let nextFrameId = 0;
  globalThis.requestAnimationFrame = (callback) => {
    const frameId = ++nextFrameId;
    globalThis.queueMicrotask(() => callback(0));
    return frameId;
  };
  globalThis.cancelAnimationFrame = () => {};

  const captures = [createDeferred(), createDeferred()];
  const captureOptions = [];
  const notifications = [];
  let captureCount = 0;
  const scope = effectScope();
  const share = scope.run(() => useScreenshotShare({
    captureTarget: ref(createTarget(390, 2_000)),
    excludedTarget: ref(null),
    downloadLink: ref(null),
    isDark: ref(false),
    notify: (...args) => notifications.push(args),
    updateStatus: () => {},
    screenshotTimeoutMs: 10,
    captureToBlob: (_target, options) => {
      captureOptions.push(options);
      return captures[captureCount++].promise;
    },
  }));

  const firstShare = share.shareScreenshot();
  await waitFor(() => captureCount === 1);
  assert.equal(share.isSharing.value, true);
  assert.equal(share.watermarkVisible.value, true);
  await firstShare;

  assert.equal(share.isSharing.value, false);
  assert.equal(share.watermarkVisible.value, false);
  assert.match(notifications.at(-1)[0], /超时/);
  assert.ok(captureOptions[0].pixelRatio <= 2);

  await share.shareScreenshot();
  assert.equal(captureCount, 1);
  assert.match(notifications.at(-1)[0], /仍在处理中/);

  const lateFailure = assert.rejects(captures[0].promise, /late renderer failure/);
  captures[0].reject(new Error("late renderer failure"));
  await lateFailure;
  const secondShare = share.shareScreenshot();
  await waitFor(() => captureCount === 2);
  captures[1].resolve(null);
  await secondShare;
  assert.equal(captureCount, 2);

  scope.stop();
});

test("disposing the scope restores UI while an underlying capture settles later", async () => {
  globalThis.requestAnimationFrame = (callback) => {
    globalThis.queueMicrotask(() => callback(0));
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};

  const capture = createDeferred();
  let captureStarted = false;
  const scope = effectScope();
  const share = scope.run(() => useScreenshotShare({
    captureTarget: ref(createTarget(390, 844)),
    excludedTarget: ref(null),
    downloadLink: ref(null),
    isDark: ref(false),
    notify: () => {},
    updateStatus: () => {},
    screenshotTimeoutMs: 1_000,
    captureToBlob: () => {
      captureStarted = true;
      return capture.promise;
    },
  }));

  const pendingShare = share.shareScreenshot();
  await waitFor(() => captureStarted);
  scope.stop();
  await pendingShare;

  assert.equal(share.isSharing.value, false);
  assert.equal(share.watermarkVisible.value, false);

  const lateFailure = assert.rejects(capture.promise, /capture disposed/);
  capture.reject(new Error("capture disposed"));
  await lateFailure;
});
