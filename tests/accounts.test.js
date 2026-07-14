import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAccounts } from "../src/domain/accounts.js";

const TOKEN_A = "token-a-12345678901234567890";
const TOKEN_B = "token-b-12345678901234567890";
const LEGACY_TOKEN = "legacy-123456789012345678901";

test("normalizeAccounts migrates a legacy token and removes duplicate tokens", () => {
  const accounts = normalizeAccounts([
    {
      id: "stored-account",
      token: `  ${TOKEN_A}  `,
      phone: "13800138000",
      loginType: "sms",
      createdAt: 100,
      updatedAt: 200,
    },
    {
      id: "duplicate-token",
      token: TOKEN_A,
    },
  ], {
    legacyToken: LEGACY_TOKEN,
    createId: (_account, index) => `generated-${index}`,
    now: 1_000,
  });

  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].id, "stored-account");
  assert.equal(accounts[0].token, TOKEN_A);
  assert.equal(accounts[0].phone, "13800138000");
  assert.equal(accounts[1].token, LEGACY_TOKEN);
  assert.equal(accounts[1].loginType, "token");
  assert.equal(accounts[1].createdAt, 1_000);
  assert.equal(accounts[1].updatedAt, 1_000);
});

test("normalizeAccounts repairs duplicate IDs even when the ID factory collides", () => {
  const accounts = normalizeAccounts([
    { id: "shared-id", token: TOKEN_A },
    { id: "shared-id", token: TOKEN_B },
  ], {
    legacyToken: LEGACY_TOKEN,
    createId: () => "shared-id",
    now: 2_000,
  });

  assert.equal(accounts.length, 3);
  assert.equal(accounts[0].id, "shared-id");
  assert.equal(new Set(accounts.map((account) => account.id)).size, 3);
  assert.ok(accounts.every((account) => account.id.length > 0));
  assert.deepEqual(
    accounts.map((account) => account.token),
    [TOKEN_A, TOKEN_B, LEGACY_TOKEN],
  );
});

test("normalizeAccounts ignores malformed records and an already migrated legacy token", () => {
  const accounts = normalizeAccounts([
    { id: "valid", token: LEGACY_TOKEN },
    { id: "too-short", token: "short" },
    null,
  ], {
    legacyToken: ` ${LEGACY_TOKEN} `,
    now: 3_000,
  });

  assert.deepEqual(accounts.map((account) => account.id), ["valid"]);
});
