import assert from "node:assert/strict";
import test from "node:test";
import { ensureResourceCredits, manaNow } from "../src/resource-credits.mjs";

const NOW = 1_790_990_406_000;
const COMMENT = 1_000_000_000;

/** rc_api as the chain answers it; delegate_rc moves mana from lender to delegatee as HF26 does. */
function fakeChain({ mana = 2_000_000_000, max = 4_800_000_000, lenderOwn = 10_000_000_000, received = 30_000_000_000, delegated = 0 } = {}) {
  const state = {
    accounts: {
      sigridsong: { account: "sigridsong", max_rc: max + delegated, rc_manabar: { current_mana: mana, last_update_time: NOW / 1000 }, delegated_rc: 0, received_delegated_rc: delegated },
      group561: { account: "group561", max_rc: lenderOwn + received - delegated, rc_manabar: { current_mana: lenderOwn + received, last_update_time: NOW / 1000 }, delegated_rc: delegated, received_delegated_rc: received },
    },
    delegations: delegated ? [{ from: "group561", to: "sigridsong", delegated_rc: delegated }] : [],
    broadcasts: [],
  };
  const hive = ({ account, keys } = {}) => ({
    rpc: {
      call: async (method, params) => {
        if (method === "rc_api.find_rc_accounts") return { rc_accounts: params.accounts.map((name) => state.accounts[name]).filter(Boolean) };
        if (method === "rc_api.get_rc_operation_stats") return { avg_cost_rc: COMMENT };
        if (method === "rc_api.list_rc_direct_delegations") return { rc_direct_delegations: state.delegations.filter(({ from }) => from === params.start[0]) };
        throw new Error(method);
      },
    },
    delegateRc: async ({ delegatees, max_rc }) => {
      assert.equal(account, "group561");
      assert.equal(keys.posting, "group561-posting");
      state.broadcasts.push({ delegatees, max_rc });
      const before = state.delegations.find(({ to }) => to === delegatees[0])?.delegated_rc ?? 0;
      state.delegations = [{ from: "group561", to: delegatees[0], delegated_rc: max_rc }];
      const added = max_rc - before;
      Object.assign(state.accounts.sigridsong, { max_rc: state.accounts.sigridsong.max_rc + added, received_delegated_rc: max_rc });
      state.accounts.sigridsong.rc_manabar.current_mana += added;
      state.accounts.group561.delegated_rc = max_rc;
      return { id: "tx-rc" };
    },
  });
  return { state, hive };
}

const vault = { describe: "test", read: async (account, file) => (account === "group561" && file === "posting.wif" ? "group561-posting" : null) };
const RC = { comments: 6, ceiling: 8_000_000_000, from: "group561" };

test("an account that cannot afford a day's comments is lent the difference; the next turn finds it enough", async () => {
  const chain = fakeChain();
  const first = await ensureResourceCredits({ account: "sigridsong", rc: RC, vault, hive: chain.hive, now: NOW });
  assert.equal(first.state, "delegated");
  assert.equal(first.max_rc, 6 * COMMENT - 2_000_000_000);
  assert.deepEqual(chain.state.broadcasts, [{ delegatees: ["sigridsong"], max_rc: 4_000_000_000 }]);
  const again = await ensureResourceCredits({ account: "sigridsong", rc: RC, vault, hive: chain.hive, now: NOW });
  assert.equal(again.state, "enough");
  assert.ok(again.mana >= 5 * COMMENT);
  assert.equal(again.delegated, 4_000_000_000);
  assert.equal(chain.state.broadcasts.length, 1);
});

test("a delegation never passes its ceiling, nor what the lender holds of its own", async () => {
  const capped = fakeChain({ mana: 0 });
  const result = await ensureResourceCredits({ account: "sigridsong", rc: { ...RC, ceiling: 3_000_000_000 }, vault, hive: capped.hive, now: NOW });
  assert.equal(result.max_rc, 3_000_000_000);
  const notices = [];
  assert.equal((await ensureResourceCredits({ account: "sigridsong", rc: { ...RC, ceiling: 3_000_000_000 }, vault, hive: capped.hive, now: NOW, notify: (line) => notices.push(line) })).state, "at-ceiling");
  assert.match(notices[0], /at its ceiling/u);

  const poor = fakeChain({ mana: 0, lenderOwn: 1_000_000_000 });
  const short = await ensureResourceCredits({ account: "sigridsong", rc: RC, vault, hive: poor.hive, now: NOW });
  assert.equal(short.state, "lender-short");
  assert.equal(poor.state.broadcasts.length, 0);
});

test("a dry run lends nothing; mana regenerates over five days to its max", async () => {
  const chain = fakeChain();
  assert.equal((await ensureResourceCredits({ account: "sigridsong", rc: RC, vault, hive: chain.hive, dryRun: true, now: NOW })).state, "would-delegate");
  assert.equal(chain.state.broadcasts.length, 0);
  const row = { max_rc: 5_000, rc_manabar: { current_mana: 1_000, last_update_time: 0 } };
  assert.equal(manaNow(row, 0), 1_000);
  assert.equal(manaNow(row, 86_400_000), 2_000);
  assert.equal(manaNow(row, 10 * 86_400_000), 5_000);
  await assert.rejects(ensureResourceCredits({ account: "sigridsong", rc: { ceiling: 1 }, vault, hive: chain.hive }), /needs "comments"/u);
});
