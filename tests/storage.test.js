import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getStorageItem,
  getStorageJson,
  removeStorageItem,
  setStorageItem,
  setStorageJson,
} from "../src/services/storage.js";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
  } else {
    delete globalThis.localStorage;
  }
});

test("storage helpers fall back when localStorage access throws", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("storage is blocked");
    },
  });

  assert.equal(getStorageItem("token", "fallback"), "fallback");
  assert.deepEqual(getStorageJson("account", { safe: true }), { safe: true });
  assert.equal(setStorageItem("token", "value"), false);
  assert.equal(setStorageJson("account", { id: 1 }), false);
  assert.equal(removeStorageItem("token"), false);
});

test("storage helpers contain errors thrown by individual storage methods", () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error("read failed");
    },
    setItem() {
      throw new Error("write failed");
    },
    removeItem() {
      throw new Error("remove failed");
    },
  };

  assert.equal(getStorageItem("token", "fallback"), "fallback");
  assert.equal(getStorageJson("account", null), null);
  assert.equal(setStorageItem("token", "value"), false);
  assert.equal(setStorageJson("account", { id: 1 }), false);
  assert.equal(removeStorageItem("token"), false);
});

test("JSON storage helpers reject malformed and unserializable values", () => {
  const values = new Map([["broken", "{not-json"]]);
  globalThis.localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };

  assert.deepEqual(getStorageJson("broken", []), []);
  assert.equal(setStorageJson("undefined", undefined), false);

  const circular = {};
  circular.self = circular;
  assert.equal(setStorageJson("circular", circular), false);

  assert.equal(setStorageJson("valid", { id: 7 }), true);
  assert.deepEqual(getStorageJson("valid"), { id: 7 });
});
