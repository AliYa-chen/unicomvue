import { UNICOM_STORAGE_KEYS } from "@/config/unicom";
import { getStorageItem, setStorageItem } from "@/services/storage";

const APP_ID_PATTERN = /^[a-zA-Z0-9]{64,256}$/;
const DEVICE_ID_PATTERN = /^[a-f0-9]{32}$/;

const identityCache = {
  appId: "",
  deviceId: "",
};

function generateAppId() {
  const digit = () => String(Math.floor(Math.random() * 10));
  return digit() + "f" + digit() + "af" + digit() + digit() + "ad"
    + digit() + "912d306b5053abf90c7ebbb695887bc"
    + "870ae0706d573c348539c26c5c0a878641fcc0d3e90acb9be1e6ef858a"
    + "59af546f3c826988332376b7d18c8ea2398ee3a9c3db947e2471d32a49612";
}

function generateDeviceId() {
  const bytes = new Uint8Array(16);

  try {
    if (typeof globalThis.crypto?.getRandomValues !== "function") {
      throw new Error("Secure random values are unavailable");
    }
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ensureLoginIdentity() {
  let appId = getStorageItem(UNICOM_STORAGE_KEYS.appId, "");
  if (!APP_ID_PATTERN.test(appId)) {
    appId = APP_ID_PATTERN.test(identityCache.appId)
      ? identityCache.appId
      : generateAppId();
    setStorageItem(UNICOM_STORAGE_KEYS.appId, appId);
  }
  identityCache.appId = appId;

  let deviceId = getStorageItem(UNICOM_STORAGE_KEYS.deviceId, "");
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    deviceId = DEVICE_ID_PATTERN.test(identityCache.deviceId)
      ? identityCache.deviceId
      : generateDeviceId();
    setStorageItem(UNICOM_STORAGE_KEYS.deviceId, deviceId);
  }
  identityCache.deviceId = deviceId;

  return { appId, deviceId };
}
