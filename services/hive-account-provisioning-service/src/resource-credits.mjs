/**
 * Resource credits an account the house holds needs for a day of speaking. Every post and reply is a
 * comment_operation; the account declares how many it speaks a day (`comments`), and the chain's own average
 * cost of a comment (rc_api.get_rc_operation_stats) prices them. When its mana cannot cover them, the house
 * account `from` delegates RC to it (delegate_rc, signed with `from`'s posting key), never past the declared
 * `ceiling`, and never more than `from` holds of its own: RC delegated to `from` cannot be lent on.
 *
 * A delegation only grows here. Lowering one is a choice about the house's RC, not a reconcile.
 */

const REGENERATION_SECONDS = 5 * 24 * 60 * 60;

/** An RC account's mana now: what it held at its last update, regenerated linearly over five days to its max. */
export function manaNow(row, now = Date.now()) {
  const max = Number(row.max_rc);
  const elapsed = Math.max(0, now / 1000 - Number(row.rc_manabar.last_update_time));
  return Math.min(max, Number(row.rc_manabar.current_mana) + Math.floor((max * elapsed) / REGENERATION_SECONDS));
}

async function delegation(rpc, from, to) {
  const { rc_direct_delegations: rows = [] } = await rpc.call("rc_api.list_rc_direct_delegations", { start: [from, to], limit: 1 });
  const row = rows.find((candidate) => candidate.from === from && candidate.to === to);
  return row ? Number(row.delegated_rc) : 0;
}

/**
 * Keep `account`'s RC able to cover `rc.comments` comments, delegating from `rc.from` up to `rc.ceiling`. Resolves
 * to `{ state, mana, needed, delegated, ... }` with state `enough`, `delegated`, `would-delegate`, `at-ceiling`
 * or `lender-short`.
 */
export async function ensureResourceCredits({ account, rc, vault, hive, dryRun = false, notify = () => {}, now = Date.now() }) {
  const { comments, ceiling, from } = rc;
  if (!Number.isInteger(comments) || comments < 1) throw new TypeError(`${account}'s "rc" needs "comments", the comments it speaks a day`);
  if (!Number.isSafeInteger(ceiling) || ceiling < 0) throw new TypeError(`${account}'s "rc" needs "ceiling", the most RC the house lends it`);
  if (!from) throw new TypeError(`${account}'s "rc" names no account to lend it RC, and it has no creator`);
  const reader = hive({});
  const [{ rc_accounts: rows }, stats, delegated] = await Promise.all([
    reader.rpc.call("rc_api.find_rc_accounts", { accounts: [account, from] }),
    reader.rpc.call("rc_api.get_rc_operation_stats", { operation: "comment_operation" }),
    delegation(reader.rpc, from, account),
  ]);
  const own = rows.find((row) => row.account === account);
  const lender = rows.find((row) => row.account === from);
  if (!own || !lender) throw new Error(`rc_api knows no ${own ? from : account}`);
  const mana = manaNow(own, now);
  const needed = comments * Number(stats.avg_cost_rc);
  const result = { account, from, comments, comment: Number(stats.avg_cost_rc), mana, needed, delegated, ceiling };
  if (mana >= needed) return { ...result, state: "enough" };

  const want = Math.min(ceiling, delegated + (needed - mana));
  if (want <= delegated) {
    notify(`hive: ${account} needs ${needed} RC for ${comments} comments and holds ${mana}; ${from}'s delegation is at its ceiling ${ceiling}`);
    return { ...result, state: "at-ceiling" };
  }
  const lendable = Number(lender.max_rc) - Number(lender.received_delegated_rc) - Number(lender.delegated_rc);
  if (want - delegated > Math.min(lendable, manaNow(lender, now))) {
    notify(`hive: ${from} cannot lend ${account} ${want - delegated} more RC (it has ${lendable} of its own unlent)`);
    return { ...result, state: "lender-short", lendable };
  }
  if (dryRun) return { ...result, state: "would-delegate", max_rc: want };
  const posting = await vault.read(from, "posting.wif");
  if (!posting) throw new Error(`the vault at ${vault.describe} holds no posting key for ${from}`);
  const { id } = await hive({ account: from, keys: { posting } }).delegateRc({ delegatees: [account], max_rc: want });
  notify(`hive: ${from} delegates ${want} RC to ${account} (transaction ${id})`);
  return { ...result, state: "delegated", max_rc: want, transaction: id };
}
