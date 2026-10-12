import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runHiveCurationCycle } from "../scripts/run-hive-curation-cycle.mjs";

const NOW = "2026-09-05T00:10:00.000Z";

function reply(payload) {
  return new Response(JSON.stringify(payload), { status: 200 });
}

function makeMockFetch({ postAgeSeconds }) {
  const created = new Date(new Date(NOW).getTime() - postAgeSeconds * 1000).toISOString().slice(0, -5);
  return async (input, init) => {
    const body = JSON.parse(init.body);
    if (body.method === "condenser_api.get_dynamic_global_properties") return reply(({ result: { head_block_number: 100000 } }));
    if (body.method === "bridge.get_ranked_posts") {
      return reply(({ result: [{ author: "alice", permlink: "p1", created, category: "hive-167922", pending_payout_value: "0.500 HBD", net_rshares: "5000000", abs_rshares: "5000000", children: 3, author_reputation: "100000000000", json_metadata: "{}", active_votes: ["v1", "v2", "v3", "v4", "v5"].map((voter) => ({ voter, rshares: "1000000" })) }] }));
    }
    if (body.method === "find") return reply(({ result: [] }));
    if (body.method === "findOne") return reply(({ result: null }));
    if (body.method === "condenser_api.get_accounts") {
      return reply(({
          result: [{ voting_manabar: { current_mana: 1000000000000, last_update_time: Math.floor(new Date(NOW).getTime() / 1000) }, vesting_shares: "1000000.000000 VESTS", delegated_vesting_shares: "0.000000 VESTS", received_vesting_shares: "0.000000 VESTS" }],
        }));
    }
    throw new Error(`unmocked method ${body.method}`);
  };
}

function policy(overrides) {
  return {
    accounts: ["emsenn0"],
    tags: [{ name: "POB", tag: "proofofbrain", symbol: "POB" }],
    postsPerTag: 5,
    dailyManaBudgetPercent: 20,
    minWeight: 100,
    maxWeight: 3000,
    dustPendingPayoutThresholdHbd: "0.02",
    dustWeight: 100,
    preferredTags: ["proofofbrain"],
    neverVoteAuthors: [],
    curationWindowSeconds: 300,
    curationWindowToleranceSeconds: 60,
    maxDailyBudgetPercent: 20,
    ...overrides,
  };
}

test("runs observe, schedule, and cast in one composed cycle and casts the one in-window candidate", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "run-hive-curation-cycle-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "emsenn0.wif"), "5Jtestwifvalue\n");

  const record = await runHiveCurationCycle({
    policy: policy({ journalRoot: root }),
    now: NOW,
    fetchImpl: makeMockFetch({ postAgeSeconds: 300 }),
    fixtures: { curationPrice: { hbdPerRshare: { num: 1n, den: 10_000_000n }, percentCurationRewards: 5000, votePowerReserveRate: 10 } },
    sign: async () => ({ status: "broadcast", id: "a".repeat(40) }),
  });

  assert.equal(record.type, "HiveCurationCycleRunRecord");
  assert.equal(record.accounts.emsenn0.schedule.scheduled.length, 1);
  assert.equal(record.accounts.emsenn0.schedule.scheduled[0].weight, 3000);
  assert.equal(record.accounts.emsenn0.cast.cast.length, 1);
  assert.equal(record.accounts.emsenn0.cast.cast[0].transactionId, "a".repeat(40));
});

test("records the signer refusing a vote (but still schedules it)", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "run-hive-curation-cycle-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const record = await runHiveCurationCycle({
    policy: policy({ journalRoot: root }),
    now: NOW,
    fetchImpl: makeMockFetch({ postAgeSeconds: 300 }),
    fixtures: { curationPrice: { hbdPerRshare: { num: 1n, den: 10_000_000n }, percentCurationRewards: 5000, votePowerReserveRate: 10 } },
    sign: async () => { throw Object.assign(new Error("refused"), { refusal: { status: "refused", datum: "key-unavailable", reason: "no posting key is stored for @emsenn0" } }); },
  });

  assert.equal(record.accounts.emsenn0.cast.cast.length, 0);
  assert.equal(record.accounts.emsenn0.cast.refused[0].reason, "key-unavailable");
});

