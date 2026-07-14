import assert from "node:assert/strict";
import { test } from "node:test";
import { effectScope, ref } from "vue";
import { useUsageDashboard } from "../src/composables/useUsageDashboard.js";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("a stale account failure cannot overwrite or remove the current account", async () => {
  const staleUsage = createDeferred();
  const activeToken = ref("token-current-account-value");
  let removedAccountCount = 0;
  let loginRequestCount = 0;

  const accountStore = {
    ecsToken: activeToken,
    hasAccounts: ref(true),
    updateAccountPackageName() {},
    updateActiveAccountMobile() {},
    removeActiveAccount() {
      removedAccountCount += 1;
      return { token: activeToken.value };
    },
  };
  const scope = effectScope();
  const dashboard = scope.run(() => useUsageDashboard(
    {
      accountStore,
      notify: () => {},
      onRequireLogin: () => {
        loginRequestCount += 1;
      },
    },
    {
      fetchUsage: (token) => (
        token === "token-stale-account-value"
          ? staleUsage.promise
          : Promise.resolve({ code: "0000", resources: [], unshared: [] })
      ),
      fetchBasicData: () => Promise.resolve({ code: "0000", rate_mbps: 2000 }),
      fetchQciData: () => Promise.resolve({ code: "0000", qci_num: 6 }),
    },
  ));

  activeToken.value = "token-stale-account-value";
  const staleRefresh = dashboard.refresh();
  activeToken.value = "token-current-account-value";
  await dashboard.refresh();

  const staleError = new Error("stale token failure");
  staleError.status = 401;
  staleError.data = { code: "TOKEN_EXPIRED" };
  staleUsage.reject(staleError);
  await staleRefresh;

  assert.equal(removedAccountCount, 0);
  assert.equal(loginRequestCount, 0);
  assert.equal(dashboard.statusText.value, "已刷新");
  assert.equal(dashboard.signedRate.value, "2000Mbps");
  assert.equal(dashboard.qciLevel.value, "6");

  scope.stop();
});
