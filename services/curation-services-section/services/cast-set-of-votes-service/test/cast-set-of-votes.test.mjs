import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { castSetOfVotes } from "../scripts/cast-set-of-votes.mjs";

function schedule(overrides) {
  return {
    type: "VoteScheduleRecord",
    version: 1,
    account: "emsenn0",
    generatedAt: "2026-09-05T00:10:00.000Z",
    manaBudgetRaw: "200000000000",
    manaBudgetPercent: 20,
    scheduled: [{ tag: "proofofbrain", author: "alice", permlink: "p1", weight: 10000, time: "2026-09-05T00:10:00.000Z", expectedCurationReturnHbd: "100000" }],
    refused: [],
    ...overrides,
  };
}

test("casts a scheduled vote through the injected signer and journals it", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "cast-set-of-votes-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const calls = [];
  const record = await castSetOfVotes({
    schedule: schedule({}),
    account: "emsenn0",
    journalRoot: root,
    sign: async (request) => { calls.push(request); return { status: "broadcast", id: "a".repeat(40) }; },
  });
  assert.equal(record.refusal, null);
  assert.equal(record.cast.length, 1);
  assert.equal(record.cast[0].transactionId, "a".repeat(40));
  assert.deepEqual([calls[0].lane, calls[0].role, calls[0].operation[0]], ["voting", "posting", "vote"]);
});

test("refuses without casting when the schedule's budget exceeds the ceiling", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "cast-set-of-votes-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const record = await castSetOfVotes({
    schedule: schedule({ manaBudgetPercent: 50 }),
    account: "emsenn0",
    journalRoot: root,
    maxDailyBudgetPercent: 20,
    sign: async () => { throw new Error("must not be called"); },
  });
  assert.equal(record.cast.length, 0);
  assert.equal(record.refusal.reason, "budget-exceeds-ceiling");
});

test("records a vote the signer refuses and casts the rest", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "cast-set-of-votes-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const record = await castSetOfVotes({
    schedule: schedule({}),
    account: "emsenn0",
    journalRoot: root,
    sign: async () => { throw Object.assign(new Error("refused"), { refusal: { status: "refused", datum: "key-unavailable", reason: "no posting key is stored for @emsenn0" } }); },
  });
  assert.equal(record.cast.length, 0);
  assert.equal(record.refused[0].reason, "key-unavailable");
  assert.equal(record.refusal, null);
});

test("refuses when the account does not match the schedule's account", async () => {
  await assert.rejects(
    castSetOfVotes({ schedule: schedule({}), account: "michael561", journalRoot: "/nonexistent" }),
    /request\.account michael561 does not match request\.schedule\.account emsenn0/u,
  );
});
