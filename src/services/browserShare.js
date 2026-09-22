export async function renderElementToBlob(target, options, renderer = null) {
  const renderToBlob = renderer || (await import("html-to-image")).toBlob;
  return renderToBlob(target, options);
}

export async function tryCopyPngBlob(blob) {
  const clipboard = globalThis.navigator?.clipboard;
  if (typeof clipboard?.write !== "function" || !globalThis.ClipboardItem) {
    return false;
  }

  try {
    await clipboard.write([
      new globalThis.ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    // Image clipboard support varies between browsers and permission states.
    return false;
  }
}

export async function tryCopyText(value) {
  const clipboard = globalThis.navigator?.clipboard;
  if (typeof clipboard?.writeText !== "function") return false;

  try {
    await clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function createDownloadUrl(blob) {
  return URL.createObjectURL(blob);
}

export function revokeDownloadUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

export function triggerDownload(target) {
  target?.click();
}
