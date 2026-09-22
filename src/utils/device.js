/** iPadOS can identify itself as desktop macOS when using a desktop browser UA. */
export function isIOSDevice(device = globalThis.navigator) {
  if (!device) return false;
  return /iPad|iPhone|iPod/i.test(device.userAgent || "")
    || (device.platform === "MacIntel" && device.maxTouchPoints > 1);
}
