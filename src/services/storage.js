function getLocalStorage() {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function getStorageItem(key, fallback = "") {
  const storage = getLocalStorage();
  if (!storage) return fallback;

  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setStorageItem(key, value) {
  const storage = getLocalStorage();
  if (!storage) return false;

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorageItem(key) {
  const storage = getLocalStorage();
  if (!storage) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getStorageJson(key, fallback = null) {
  const value = getStorageItem(key, null);
  if (value === null) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function setStorageJson(key, value) {
  try {
    const serializedValue = JSON.stringify(value);
    if (serializedValue === undefined) return false;
    return setStorageItem(key, serializedValue);
  } catch {
    return false;
  }
}
