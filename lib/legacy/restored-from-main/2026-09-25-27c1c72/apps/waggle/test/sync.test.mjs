import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncAccount, loadBalances } from "../src/sync.mjs";

function operation(sequence, type, data) {
  return [sequence, {
    block: 100 + sequence,
    trx_in_block: 0,
    op_in_trx: 0,
    trx_id: `transaction-${sequence}`,
    timestamp: `2026-09-${String(sequence + 1).padStart(2, "0")}T12:00:00`,
    virtual_op: 0,
    op: [type, data],
  }];
}

function offlineClient() {
  const history = [
    operation(0, "vote", { voter: "alice" }),
    operation(1, "interest", { interest: "0.250 HBD" }),
    operation(2, "fill_transfer_from_savings", { amount: "1.000 HIVE" }),
    operation(3, "transfer_to_savings", { to: "alice", amount: "2.000 HIVE" }),
    operation(4, "transfer", { from: "bob", to: "alice", amount: "5.000 HIVE", memo: "offline fixture" }),
  ];
  return {
    async getAccountHistory(account, start, limit) {
      assert.equal(account, "alice");
      const high = start === -1 ? history.length - 1 : start;
      const low = limit === 0 ? 0 : Math.max(0, high - limit + 1);
      return history.filter(([sequence]) => sequence >= low && sequence <= high);
    },
    async getAccount(account) {
      assert.equal(account, "alice");
      return {
        balance: "4.000 HIVE",
        hbd_balance: "0.000 HBD",
        savings_balance: "1.000 HIVE",
        savings_hbd_balance: "0.250 HBD",
      };
    },
  };
}

test("offline sync books Hive history exactly, reconciles it, and replays without duplicate postings", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "waggle-sync-"));
  try {
    const client = offlineClient();
    const first = await syncAccount({ client, account: "alice", root, pageLimit: 2 });
    assert.equal(first.opsFetched, 5);
    assert.equal(first.transactionsTotal, 4);
    assert.equal(first.unmappedTotal, 1);
    assert.equal(first.lastSeq, 4);
    assert.equal(first.reconcile.reconciled, true);
    assert.deepEqual(first.balances.filter((line) => line.startsWith("Assets:")), [
      "Assets:Hbd:Savings  0.250 HBD",
      "Assets:Hive:Liquid  4.000 HIVE",
      "Assets:Hive:Savings  1.000 HIVE",
    ]);
    const persisted = JSON.parse(readFileSync(path.join(root, "alice", "ledger.json"), "utf8"));
    assert.equal(persisted.transactions[0].postings[0].amount.__amount, true);
    assert.equal(typeof persisted.transactions[0].postings[0].amount.num, "string");
    const replay = await syncAccount({ client, account: "alice", root, pageLimit: 2 });
    assert.equal(replay.opsFetched, 0);
    assert.equal(replay.transactionsTotal, 4);
    assert.equal(replay.unmappedTotal, 1);
    assert.equal(replay.reconcile.reconciled, true);
    assert.deepEqual(loadBalances("alice", root).balances, first.balances);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
