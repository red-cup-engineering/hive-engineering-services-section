import assert from "node:assert/strict";
import test from "node:test";
import { scheduleSetOfVotes } from "../scripts/schedule-set-of-votes.mjs";

const NOW = "2026-09-05T00:10:00.000Z";
const YIELD_READOUT = {
  tags: [{ tag: "proofofbrain", yieldHbdPerMillionRshares: "0.1" }],
  accounts: { emsenn0: { votingManabar: { maxManaRaw: "1000000000000", currentManaRaw: "1000000000000" } } },
};

// A bridge.get_ranked_posts record five minutes old: discussed, broadly voted, in a community.
function post(overrides = {}, entry = {}) {
  return { tag: "proofofbrain", symbol: "POB", post: { ...{
    author: "alice", permlink: "p1", category: "hive-167922", created: "2026-09-05T00:05:00",
    net_rshares: "5000000", abs_rshares: "5000000", pending_payout_value: "0.500 HBD", children: 3,
    author_reputation: "100000000000", json_metadata: "{}",
    active_votes: ["v1", "v2", "v3", "v4", "v5"].map((voter) => ({ voter, rshares: "1000000" })),
  }, ...overrides }, ...entry };
}

test("schedules a preferred-tag post at max weight inside the window and budget", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: YIELD_READOUT,
    account: "emsenn0",
    candidatePosts: [post({})],
    policy: { preferredTags: ["proofofbrain"] },
    now: NOW,
  });
  assert.equal(record.scheduled.length, 1);
  assert.equal(record.scheduled[0].weight, 10000);
  assert.equal(record.scheduled[0].author, "alice");
  assert.equal(record.refused.length, 0);
  assert.ok(Number(record.scheduled[0].expectedCurationReturnHbd) > 0);
});

test("applies the dust weight to a low-payout post regardless of tag preference", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: YIELD_READOUT,
    account: "emsenn0",
    candidatePosts: [post({ pending_payout_value: "0.001 HBD" })],
    policy: { preferredTags: ["proofofbrain"] },
    now: NOW,
  });
  assert.equal(record.scheduled[0].weight, 100);
});

test("refuses an excluded author", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: YIELD_READOUT,
    account: "emsenn0",
    candidatePosts: [post({ author: "spammer" })],
    policy: { neverVoteAuthors: ["spammer"] },
    now: NOW,
  });
  assert.deepEqual(record.refused[0].reason, "author-excluded");
});

test("refuses a post outside the curation window", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: YIELD_READOUT,
    account: "emsenn0",
    candidatePosts: [post({ created: "2026-09-05T00:09:30" })],
    now: NOW,
  });
  assert.equal(record.refused[0].reason, "outside-window");
});

test("refuses once the daily mana budget is spent", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: {
      tags: YIELD_READOUT.tags,
      accounts: { emsenn0: { votingManabar: { maxManaRaw: "1000000000000", currentManaRaw: "1000000000000" } } },
    },
    account: "emsenn0",
    candidatePosts: [post({ permlink: "p1" }), post({ permlink: "p2" }), post({ permlink: "p3" })],
    policy: { preferredTags: ["proofofbrain"], dailyManaBudgetPercent: 2 },
    now: NOW,
  });
  assert.equal(record.scheduled.length, 1);
  assert.equal(record.refused.length, 2);
  assert.equal(record.refused[0].reason, "over-budget");
});

test("refuses a post the account already voted", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: YIELD_READOUT,
    account: "emsenn0",
    candidatePosts: [post({ active_votes: ["emsenn0", "v2", "v3", "v4", "v5"].map((voter) => ({ voter, rshares: "1000000" })) })],
    now: NOW,
  });
  assert.equal(record.refused[0].reason, "already-voted");
});

test("refuses when the account is not a key of yieldReadout.accounts", () => {
  assert.throws(
    () => scheduleSetOfVotes({ yieldReadout: YIELD_READOUT, account: "unknown561", candidatePosts: [], now: NOW }),
    /request\.account unknown561 is not a key/u,
  );
});
