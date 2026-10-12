// incentive/execute — execute an AUTO-authorized incentive response (#26 tail).
//
// Only offers the authorization model marked `auto` reach here, and only their
// non-posting actions (vote, reblog, follow) are ever run — comment/post are
// impossible (posting is locked; the authorizer routes them to the human gate).
// Even an `auto` offer broadcasts ONLY when the fleet is armed and the account
// holds the posting key; otherwise it is recorded as would-do. Delegation is
// never auto-run (it moves stake with an amount no announcement reliably states)
// — it is downgraded to a nomination by returning `skipped`.
//
// Every broadcast goes through the one upstream signing client (HiveClient's
// first-class `vote`/`reblog`/`follow`). No hand-rolled ops.

/** Execute an auto-authorized offer's actions, gated by `armed`. */
export async function executeAutoOffer(member, authorized, armed) {
  const offer = authorized.scored.offer;
  const results = [];

  for (const kind of offer.requiredActions) {
    if (!armed) {
      results.push({ kind, status: "dry-run", note: "fleet not armed" });
      continue;
    }
    if (!member.hasPosting) {
      results.push({ kind, status: "skipped", note: "no posting key" });
      continue;
    }
    try {
      if (kind === "vote") {
        const { id } = await member.hive.vote({ author: offer.source.author, permlink: offer.source.permlink, weight: 10000 });
        results.push({ kind: "vote", status: "broadcast", txId: id });
      } else if (kind === "reblog") {
        const { id } = await member.hive.reblog({ author: offer.source.author, permlink: offer.source.permlink });
        results.push({ kind: "reblog", status: "broadcast", txId: id });
      } else if (kind === "follow") {
        const { id } = await member.hive.follow(offer.source.author);
        results.push({ kind: "follow", status: "broadcast", txId: id });
      } else {
        // delegate / comment / post never auto-run.
        results.push({ kind, status: "skipped", note: "class not auto-executable" });
      }
    } catch (err) {
      results.push({ kind, status: "error", note: err instanceof Error ? err.message : String(err) });
    }
  }
  return Object.freeze({ offerId: offer.id, actions: Object.freeze(results) });
}
