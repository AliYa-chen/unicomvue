import assert from "node:assert/strict";
import { test } from "node:test";
import {
  postJson,
  UnicomApiError,
} from "../src/services/unicomApi.js";

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(data);
    },
  };
}

test("postJson enforces its deadline even when response parsing never settles", async () => {
  let requestSignal;

  await assert.rejects(
    postJson("https://example.test/api", { id: 1 }, {
      fetchImpl: async (_url, options) => {
        requestSignal = options.signal;
        return {
          ok: true,
          status: 200,
          text: () => new Promise(() => {}),
        };
      },
      timeoutMs: 10,
    }),
    (error) => {
      assert.ok(error instanceof UnicomApiError);
      assert.equal(error.message, "请求超时，请稍后重试");
      return true;
    },
  );

  assert.equal(requestSignal.aborted, true);
});

test("postJson combines an external abort signal with its request signal", async () => {
  const controller = new globalThis.AbortController();
  let requestSignal;

  const pending = postJson("https://example.test/api", {}, {
    signal: controller.signal,
    fetchImpl: (_url, options) => {
      requestSignal = options.signal;
      return new Promise(() => {});
    },
    timeoutMs: 1_000,
  });

  controller.abort();

  await assert.rejects(pending, (error) => error?.name === "AbortError");
  assert.notEqual(requestSignal, controller.signal);
  assert.equal(requestSignal.aborted, true);
});

test("postJson skips fetch for an already aborted external signal", async () => {
  const controller = new globalThis.AbortController();
  controller.abort();
  let fetchCalled = false;

  await assert.rejects(
    postJson("https://example.test/api", {}, {
      signal: controller.signal,
      fetchImpl: async () => {
        fetchCalled = true;
        return jsonResponse({ status: "success" });
      },
    }),
    (error) => error?.name === "AbortError",
  );

  assert.equal(fetchCalled, false);
});

test("postJson removes the external abort listener after success", async () => {
  let abortListener;
  let removedListener;
  const externalSignal = {
    aborted: false,
    reason: undefined,
    addEventListener(event, listener) {
      assert.equal(event, "abort");
      abortListener = listener;
    },
    removeEventListener(event, listener) {
      assert.equal(event, "abort");
      removedListener = listener;
    },
  };

  const result = await postJson("https://example.test/api", { id: 7 }, {
    signal: externalSignal,
    fetchImpl: async () => jsonResponse({ status: "success" }),
    timeoutMs: 1_000,
  });

  assert.deepEqual(result, { status: "success" });
  assert.equal(typeof abortListener, "function");
  assert.equal(removedListener, abortListener);
});
