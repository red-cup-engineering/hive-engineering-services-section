import assert from "node:assert/strict";

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consumeHiveLoginNonce, mintHiveLoginNonce, readHiveLoginNonces } from "../src/nonce.mjs";

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "ops-mcp-hive-nonce-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("mints a nonce that consumes exactly once", () => withDir((dir) => {
  let ms = 1_000_000;
  const { nonce, expiresAt } = mintHiveLoginNonce({ stateDir: dir, ttlMs: 300_000, now: () => ms, token: () => "fixed-nonce" });
  assert.equal(nonce, "fixed-nonce");
  assert.equal(expiresAt, 1_300_000);
  assert.deepEqual(readHiveLoginNonces(dir), { "fixed-nonce": 1_300_000 });
  assert.equal(consumeHiveLoginNonce({ stateDir: dir, nonce: "fixed-nonce", now: () => ms }), true);
  assert.equal(consumeHiveLoginNonce({ stateDir: dir, nonce: "fixed-nonce", now: () => ms }), false, "one-time use");
  assert.deepEqual(readHiveLoginNonces(dir), {});
}));

test("refuses an expired nonce and prunes it", () => withDir((dir) => {
  let ms = 1_000_000;
  mintHiveLoginNonce({ stateDir: dir, ttlMs: 1_000, now: () => ms, token: () => "expiring-nonce" });
  ms += 1_001;
  assert.equal(consumeHiveLoginNonce({ stateDir: dir, nonce: "expiring-nonce", now: () => ms }), false);
  assert.deepEqual(readHiveLoginNonces(dir), {});
}));

test("refuses an unknown nonce without throwing", () => withDir((dir) => {
  assert.equal(consumeHiveLoginNonce({ stateDir: dir, nonce: "never-minted" }), false);
}));

test("minting prunes other already-expired nonces from the same file", () => withDir((dir) => {
  let ms = 1_000_000;
  mintHiveLoginNonce({ stateDir: dir, ttlMs: 1_000, now: () => ms, token: () => "old" });
  ms += 2_000;
  mintHiveLoginNonce({ stateDir: dir, ttlMs: 300_000, now: () => ms, token: () => "fresh" });
  assert.deepEqual(readHiveLoginNonces(dir), { fresh: ms + 300_000 });
}));

test("readHiveLoginNonces reads {} for a missing file", () => withDir((dir) => {
  assert.deepEqual(readHiveLoginNonces(dir), {});
}));
