/**
 * hive-topology — the Hive blockchain as a meme-topology carrier.
 *
 * Extends financial-topology for the Hive domain:
 * - Social graph: accounts, posts, votes, follows, tags, communities
 * - Financial layer: HIVE, HBD, HP, and RC as financial positions on accounts
 * - Governance: delegations (HP), witnesses
 *
 * No codec imports; this library models *knowledge about* Hive, not wire encoding.
 * Use @emsenn/computing-with-hive-codecs to parse Hive API responses into entries, then build
 * utterances from those entries in your app layer.
 *
 * There is no denial: an unvote, unfollow, or deletion is its own claim of the
 * contrary predicate (hive.unvoted, hive.unfollowed, hive.deleted), never a
 * polarity against the original cell.
 */
import {
  utterance,
  mark,
  fixedPointReadingsOfUtterances,
  settleUtterances,
  type UtteranceCarrier,
  type MemeTopologyFixedPointReadings,
  type SettlementFiltration,
  type PredicationPredicate,
  type PredicationTerm,
} from "@emsenn/relating";
import {
  financialAccountTerm,
  financialCommodityTerm,
  financialPositionTerm,
  holdingUtterance,
  holdingClosedUtterance,
  liquidPositionUtterance,
  stakedPositionUtterance,
  denominationUtterance,
  transferUtterance,
  type FinancialTopologyCarrier,
} from "@emsenn/trading/financial";
import { predicationTerm, predicationPredicate, predicateMarkValue } from "../predication.mjs";

export type { UtteranceCarrier, PredicationTerm as TermInput, FinancialTopologyCarrier };

// Re-export financial-topology primitives for convenience
export {
  financialAccountTerm, financialCommodityTerm, financialPositionTerm,
  holdingUtterance, holdingClosedUtterance,
  liquidPositionUtterance, stakedPositionUtterance,
  denominationUtterance, transferUtterance,
};

/** Namespaced mark for a Hive account: "hive.account.<name>" */
export function hiveAccountTerm(name: string): PredicationTerm {
  return predicationTerm(`hive.account.${name}`);
}

/** Namespaced mark for a Hive post: "hive.post.<author>/<permlink>" */
export function hivePostTerm(author: string, permlink: string): PredicationTerm {
  return predicationTerm(`hive.post.${author}/${permlink}`);
}

/** Namespaced mark for a Hive community: "hive.community.<name>" */
export function hiveCommunityTerm(name: string): PredicationTerm {
  return predicationTerm(`hive.community.${name}`);
}

/** Namespaced mark for a Hive content tag: "hive.tag.<name>" */
export function hiveTagTerm(name: string): PredicationTerm {
  return predicationTerm(`hive.tag.${name}`);
}

// ---------- social predicate terms ----------

export function hiveVotedOnPredicate(): PredicationPredicate { return predicationPredicate("hive.voted-on"); }
export function hiveUnvotedPredicate(): PredicationPredicate { return predicationPredicate("hive.unvoted"); }
export function hiveFollowsPredicate(): PredicationPredicate { return predicationPredicate("hive.follows"); }
export function hiveUnfollowedPredicate(): PredicationPredicate { return predicationPredicate("hive.unfollowed"); }
export function hiveTaggedWithPredicate(): PredicationPredicate { return predicationPredicate("hive.tagged-with"); }
export function hivePostedPredicate(): PredicationPredicate { return predicationPredicate("hive.posted"); }
export function hiveDeletedPredicate(): PredicationPredicate { return predicationPredicate("hive.deleted"); }
export function hiveRebloggedPredicate(): PredicationPredicate { return predicationPredicate("hive.reblogged"); }
export function hiveMemberOfPredicate(): PredicationPredicate { return predicationPredicate("hive.member-of"); }
export function hiveDelegatedToPredicate(): PredicationPredicate { return predicationPredicate("hive.delegated-to"); }
export function hiveExistsPredicate(): PredicationPredicate { return predicationPredicate("hive.exists"); }
export function hiveActivePredicate(): PredicationPredicate { return predicationPredicate("hive.active"); }

// ---------- social utterance constructors ----------

/** Claim that voter has voted positively on author/permlink. */
export function hiveVoteUtterance(
  voter: string,
  author: string,
  permlink: string,
): UtteranceCarrier {
  return utterance(mark({ subject: hiveAccountTerm(voter), object: hivePostTerm(author, permlink) }), mark(predicateMarkValue(hiveVotedOnPredicate())));
}

/** Claim that voter has unvoted author/permlink (vote or downvote removal). */
export function hiveUnvoteUtterance(
  voter: string,
  author: string,
  permlink: string,
): UtteranceCarrier {
  return utterance(mark({ subject: hiveAccountTerm(voter), object: hivePostTerm(author, permlink) }), mark(predicateMarkValue(hiveUnvotedPredicate())));
}

/** Claim that follower follows account. */
export function hiveFollowUtterance(
  follower: string,
  account: string,
): UtteranceCarrier {
  return utterance(mark({ subject: hiveAccountTerm(follower), object: hiveAccountTerm(account) }), mark(predicateMarkValue(hiveFollowsPredicate())));
}

/** Claim that follower has unfollowed account. */
export function hiveUnfollowUtterance(
  follower: string,
  account: string,
): UtteranceCarrier {
  return utterance(mark({ subject: hiveAccountTerm(follower), object: hiveAccountTerm(account) }), mark(predicateMarkValue(hiveUnfollowedPredicate())));
}

/** Claim that a post exists at author/permlink. */
export function hivePostExistsUtterance(
  author: string,
  permlink: string,
): UtteranceCarrier {
  return utterance(mark({ subject: hiveAccountTerm(author), object: hivePostTerm(author, permlink) }), mark(predicateMarkValue(hivePostedPredicate())));
}

/** Claim that author has deleted the post at author/permlink. */
export function hivePostDeletedUtterance(
  author: string,
  permlink: string,
): UtteranceCarrier {
  return utterance(mark({ subject: hiveAccountTerm(author), object: hivePostTerm(author, permlink) }), mark(predicateMarkValue(hiveDeletedPredicate())));
}

/** Claim that account has reblogged author/permlink. */
export function hiveReblogUtterance(
  account: string,
  author: string,
  permlink: string,
): UtteranceCarrier {
  return utterance(mark({ subject: hiveAccountTerm(account), object: hivePostTerm(author, permlink) }), mark(predicateMarkValue(hiveRebloggedPredicate())));
}

/** Claim that post is tagged with a tag term. */
export function hiveTagUtterance(
  author: string,
  permlink: string,
  tag: string,
): UtteranceCarrier {
  return utterance(mark({ subject: hivePostTerm(author, permlink), object: hiveTagTerm(tag) }), mark(predicateMarkValue(hiveTaggedWithPredicate())));
}

/** Claim that post is in a community. */
export function hiveCommunityUtterance(
  author: string,
  permlink: string,
  community: string,
): UtteranceCarrier {
  return utterance(mark({ subject: hivePostTerm(author, permlink), object: hiveCommunityTerm(community) }), mark(predicateMarkValue(hiveMemberOfPredicate())));
}

/** Claim that an account is active (diagonal claim on the account term). */
export function hiveAccountActiveUtterance(account: string): UtteranceCarrier {
  return utterance(mark(hiveAccountTerm(account)), mark(predicateMarkValue(hiveActivePredicate())));
}

/** Claim that account delegates HP to recipient. */
export function hiveDelegationUtterance(
  delegator: string,
  recipient: string,
): UtteranceCarrier {
  return utterance(mark({ subject: hiveAccountTerm(delegator), object: hiveAccountTerm(recipient) }), mark(predicateMarkValue(hiveDelegatedToPredicate())));
}

// ---------- financial utterance helpers ----------
// Hive accounts are also financial accounts; use financialAccountTerm(accountName)
// to model HIVE/HBD/HP/RC positions. These helpers wrap the financial-topology
// utterances with Hive-idiomatic naming.

/** Claim that a Hive account holds a liquid HIVE balance. */
export function hiveBalanceUtterance(accountName: string): UtteranceCarrier {
  return holdingUtterance(accountName, "HIVE");
}

/** Claim that a Hive account's HIVE balance is liquid. */
export function hiveLiquidBalanceUtterance(accountName: string): UtteranceCarrier {
  return liquidPositionUtterance(accountName, "HIVE");
}

/** Claim that a Hive account holds HBD (Hive Backed Dollar). */
export function hiveHBDUtterance(accountName: string): UtteranceCarrier {
  return holdingUtterance(accountName, "HBD");
}

/** Claim that a Hive account's HBD balance is liquid. */
export function hiveLiquidHBDUtterance(accountName: string): UtteranceCarrier {
  return liquidPositionUtterance(accountName, "HBD");
}

/** Claim that a Hive account holds Hive Power (vested HIVE). */
export function hiveHivePowerUtterance(accountName: string): UtteranceCarrier {
  return holdingUtterance(accountName, "HP");
}

/** Claim that a Hive account's HP is staked (illiquid vested HIVE). */
export function hiveHivePowerStakedUtterance(accountName: string): UtteranceCarrier {
  return stakedPositionUtterance(accountName, "HP");
}

/** Claim that a Hive account holds Resource Credits (RC). */
export function hiveResourceCreditUtterance(accountName: string): UtteranceCarrier {
  return holdingUtterance(accountName, "RC");
}

// ---------- carrier settlement ----------

export interface HiveTopologyCarrier extends FinancialTopologyCarrier {
  readonly kind: "hive.topology.carrier";
  readonly utterances: readonly UtteranceCarrier[];
  readonly settlement: SettlementFiltration;
  readonly fixedPointReadings: MemeTopologyFixedPointReadings;
  readonly _hiveTopologyBrand: never;
}

/** Induce a settled HiveTopologyCarrier from an utterance log. */
export function induceHiveTopology(utterances: readonly UtteranceCarrier[]): HiveTopologyCarrier {
  const log = Object.freeze([...utterances]);
  return Object.freeze({
    kind: "hive.topology.carrier" as const,
    utterances: log,
    settlement: settleUtterances(log),
    fixedPointReadings: fixedPointReadingsOfUtterances(log),
  }) as HiveTopologyCarrier;
}

/** Extend an existing HiveTopologyCarrier with new utterances. */
export function extendHiveTopology(
  carrier: HiveTopologyCarrier,
  delta: readonly UtteranceCarrier[],
): HiveTopologyCarrier {
  return induceHiveTopology([...carrier.utterances, ...delta]);
}
