import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { effectScope, ref } from "vue";
import {
  ensureLoginIdentity,
  useLoginFlow,
} from "../src/composables/useLoginFlow.js";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);
const originalFetch = globalThis.fetch;
const originalTencentCaptcha = globalThis.TencentCaptcha;

function restoreGlobal(name, value) {
  if (value === undefined) delete globalThis[name];
  else globalThis[name] = value;
}

function needCaptchaResponse() {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({ status: "need_captcha", mobile: "mobile-token" });
    },
  };
}

async function waitFor(predicate, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Condition was not reached in time");
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  }
}

function createLoginFlow(captchaScriptTimeoutMs) {
  const scope = effectScope();
  const open = ref(true);
  const flow = scope.run(() => useLoginFlow(open, { captchaScriptTimeoutMs }));
  flow.phone.value = "13800138000";
  return { flow, scope };
}

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
  } else {
    delete globalThis.localStorage;
  }
  restoreGlobal("fetch", originalFetch);
  restoreGlobal("TencentCaptcha", originalTencentCaptcha);
});

test("login identity remains stable when localStorage cannot be read or written", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("storage is blocked");
    },
  });

  const first = ensureLoginIdentity();
  const second = ensureLoginIdentity();

  assert.deepEqual(second, first);
  assert.match(first.appId, /^[a-zA-Z0-9]{64,256}$/);
  assert.match(first.deviceId, /^[a-f0-9]{32}$/);
});

test("captcha script loading times out and removes the script request", async () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem() {},
  };
  globalThis.fetch = async () => needCaptchaResponse();
  delete globalThis.TencentCaptcha;

  const { flow, scope } = createLoginFlow(10);
  const pending = flow.sendCode();

  await waitFor(() => flow.captchaScriptRequested.value);
  assert.equal(await pending, false);
  assert.equal(flow.captchaScriptRequested.value, false);
  assert.match(flow.message.value, /验证码组件加载超时/);
  scope.stop();
});

test("disposing the login scope settles captcha loading and clears its request", async () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem() {},
  };
  globalThis.fetch = async () => needCaptchaResponse();
  delete globalThis.TencentCaptcha;

  const { flow, scope } = createLoginFlow(1_000);
  const pending = flow.sendCode();

  await waitFor(() => flow.captchaScriptRequested.value);
  scope.stop();

  assert.equal(await pending, false);
  assert.equal(flow.captchaScriptRequested.value, false);

  flow.onCaptchaScriptLoad();
  flow.onCaptchaScriptError();
  assert.equal(flow.captchaScriptRequested.value, false);
});
