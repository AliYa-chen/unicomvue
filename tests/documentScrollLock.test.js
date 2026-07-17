import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { effectScope, nextTick, ref } from "vue";
import { useDocumentScrollLock } from "../src/composables/useDocumentScrollLock.js";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

function restoreGlobal(name, value) {
  if (value === undefined) delete globalThis[name];
  else globalThis[name] = value;
}

afterEach(() => {
  restoreGlobal("window", originalWindow);
  restoreGlobal("document", originalDocument);
});

test("nested modal locks restore document styles and scroll only after the final release", async () => {
  const root = {
    clientWidth: 1180,
    style: {
      overflow: "clip",
      overscrollBehavior: "contain",
    },
  };
  const body = {
    style: {
      position: "relative",
      top: "1px",
      left: "2px",
      width: "auto",
      overflow: "visible",
      overscrollBehavior: "auto",
      paddingRight: "3px",
    },
  };
  const scrollCalls = [];

  globalThis.window = {
    scrollX: 12,
    scrollY: 340,
    innerWidth: 1200,
    getComputedStyle: () => ({ paddingRight: "3px" }),
    scrollTo: (...coordinates) => scrollCalls.push(coordinates),
  };
  globalThis.document = { documentElement: root, body };

  const loginOpen = ref(false);
  const privacyOpen = ref(false);
  const scope = effectScope();
  scope.run(() => {
    useDocumentScrollLock(loginOpen);
    useDocumentScrollLock(privacyOpen);
  });

  loginOpen.value = true;
  await nextTick();
  assert.equal(body.style.position, "fixed");
  assert.equal(body.style.top, "-340px");
  assert.equal(body.style.left, "-12px");
  assert.equal(body.style.paddingRight, "23px");

  privacyOpen.value = true;
  await nextTick();
  loginOpen.value = false;
  await nextTick();
  assert.equal(body.style.position, "fixed");
  assert.deepEqual(scrollCalls, []);

  privacyOpen.value = false;
  await nextTick();
  assert.deepEqual(root.style, {
    overflow: "clip",
    overscrollBehavior: "contain",
  });
  assert.deepEqual(body.style, {
    position: "relative",
    top: "1px",
    left: "2px",
    width: "auto",
    overflow: "visible",
    overscrollBehavior: "auto",
    paddingRight: "3px",
  });
  assert.deepEqual(scrollCalls, [[12, 340]]);

  scope.stop();
});
