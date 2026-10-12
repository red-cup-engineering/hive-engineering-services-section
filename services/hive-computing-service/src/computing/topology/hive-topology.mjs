/**
 * hive-topology — the Hive blockchain as a meme-topology carrier.
 *
 * Extends financial-topology for the Hive domain:
 * - Social graph: accounts, posts, votes, follows, tags, communities
 * - Financial layer: HIVE, HBD, HP, and RC as financial positions on accounts
 * - Governance: delegations (HP), witnesses
 *
 * No codec imports; this library models *knowledge about* Hive, not wire encoding.
 * Read Hive through @red-cup-engineering/hive-blockchain-client-service to parse Hive API responses into entries, then build
 * utterances from those entries in your app layer.
 *
 * There is no denial: an unvote, unfollow, or deletion is its own claim of the
 * contrary predicate (hive.unvoted, hive.unfollowed, hive.deleted), never a
 * polarity against the original cell.
 */
import { tokenValue, utterance } from "@red-cup-engineering/signcell/cell";
import { settleMembrane } from "@red-cup-engineering/signcraft/membrane";
import { financialAccountTerm, financialCommodityTerm, financialPositionTerm, holdingUtterance, holdingClosedUtterance, liquidPositionUtterance, stakedPositionUtterance, denominationUtterance, transferUtterance, } from "@red-cup-engineering/organizing/accounting/topology/financial";
// Re-export financial-topology primitives for convenience
export { financialAccountTerm, financialCommodityTerm, financialPositionTerm, holdingUtterance, holdingClosedUtterance, liquidPositionUtterance, stakedPositionUtterance, denominationUtterance, transferUtterance, };
/** Namespaced term for a Hive account: "hive.account.<name>" */
export function hiveAccountTerm(name) {
    return `hive.account.${name}`;
}
/** Namespaced term for a Hive post: "hive.post.<author>/<permlink>" */
export function hivePostTerm(author, permlink) {
    return `hive.post.${author}/${permlink}`;
}
/** Namespaced term for a Hive community: "hive.community.<name>" */
export function hiveCommunityTerm(name) {
    return `hive.community.${name}`;
}
/** Namespaced term for a Hive content tag: "hive.tag.<name>" */
export function hiveTagTerm(name) {
    return `hive.tag.${name}`;
}
// ---------- social predicate terms ----------
export function hiveVotedOnPredicate() { return "hive.voted-on"; }
export function hiveUnvotedPredicate() { return "hive.unvoted"; }
export function hiveFollowsPredicate() { return "hive.follows"; }
export function hiveUnfollowedPredicate() { return "hive.unfollowed"; }
export function hiveTaggedWithPredicate() { return "hive.tagged-with"; }
export function hivePostedPredicate() { return "hive.posted"; }
export function hiveDeletedPredicate() { return "hive.deleted"; }
export function hiveRebloggedPredicate() { return "hive.reblogged"; }
export function hiveMemberOfPredicate() { return "hive.member-of"; }
export function hiveDelegatedToPredicate() { return "hive.delegated-to"; }
export function hiveExistsPredicate() { return "hive.exists"; }
export function hiveActivePredicate() { return "hive.active"; }
// ---------- social utterance constructors ----------
/** Claim that voter has voted positively on author/permlink. */
export function hiveVoteUtterance(voter, author, permlink) {
    return utterance({ subject: hiveAccountTerm(voter), object: hivePostTerm(author, permlink) }, hiveVotedOnPredicate());
}
/** Claim that voter has unvoted author/permlink (vote or downvote removal). */
export function hiveUnvoteUtterance(voter, author, permlink) {
    return utterance({ subject: hiveAccountTerm(voter), object: hivePostTerm(author, permlink) }, hiveUnvotedPredicate());
}
/** Claim that follower follows account. */
export function hiveFollowUtterance(follower, account) {
    return utterance({ subject: hiveAccountTerm(follower), object: hiveAccountTerm(account) }, hiveFollowsPredicate());
}
/** Claim that follower has unfollowed account. */
export function hiveUnfollowUtterance(follower, account) {
    return utterance({ subject: hiveAccountTerm(follower), object: hiveAccountTerm(account) }, hiveUnfollowedPredicate());
}
/** Claim that a post exists at author/permlink. */
export function hivePostExistsUtterance(author, permlink) {
    return utterance({ subject: hiveAccountTerm(author), object: hivePostTerm(author, permlink) }, hivePostedPredicate());
}
/** Claim that author has deleted the post at author/permlink. */
export function hivePostDeletedUtterance(author, permlink) {
    return utterance({ subject: hiveAccountTerm(author), object: hivePostTerm(author, permlink) }, hiveDeletedPredicate());
}
/** Claim that account has reblogged author/permlink. */
export function hiveReblogUtterance(account, author, permlink) {
    return utterance({ subject: hiveAccountTerm(account), object: hivePostTerm(author, permlink) }, hiveRebloggedPredicate());
}
/** Claim that post is tagged with a tag term. */
export function hiveTagUtterance(author, permlink, tag) {
    return utterance({ subject: hivePostTerm(author, permlink), object: hiveTagTerm(tag) }, hiveTaggedWithPredicate());
}
/** Claim that post is in a community. */
export function hiveCommunityUtterance(author, permlink, community) {
    return utterance({ subject: hivePostTerm(author, permlink), object: hiveCommunityTerm(community) }, hiveMemberOfPredicate());
}
/** Claim that an account is active (diagonal claim on the account term). */
export function hiveAccountActiveUtterance(account) {
    return utterance(hiveAccountTerm(account), hiveActivePredicate());
}
/** Claim that account delegates HP to recipient. */
export function hiveDelegationUtterance(delegator, recipient) {
    return utterance({ subject: hiveAccountTerm(delegator), object: hiveAccountTerm(recipient) }, hiveDelegatedToPredicate());
}
// ---------- financial utterance helpers ----------
// Hive accounts are also financial accounts; use financialAccountTerm(accountName)
// to model HIVE/HBD/HP/RC positions. These helpers wrap the financial-topology
// utterances with Hive-idiomatic naming.
/** Claim that a Hive account holds a liquid HIVE balance. */
export function hiveBalanceUtterance(accountName) {
    return holdingUtterance(accountName, "HIVE");
}
/** Claim that a Hive account's HIVE balance is liquid. */
export function hiveLiquidBalanceUtterance(accountName) {
    return liquidPositionUtterance(accountName, "HIVE");
}
/** Claim that a Hive account holds HBD (Hive Backed Dollar). */
export function hiveHBDUtterance(accountName) {
    return holdingUtterance(accountName, "HBD");
}
/** Claim that a Hive account's HBD balance is liquid. */
export function hiveLiquidHBDUtterance(accountName) {
    return liquidPositionUtterance(accountName, "HBD");
}
/** Claim that a Hive account holds Hive Power (vested HIVE). */
export function hiveHivePowerUtterance(accountName) {
    return holdingUtterance(accountName, "HP");
}
/** Claim that a Hive account's HP is staked (illiquid vested HIVE). */
export function hiveHivePowerStakedUtterance(accountName) {
    return stakedPositionUtterance(accountName, "HP");
}
/** Claim that a Hive account holds Resource Credits (RC). */
export function hiveResourceCreditUtterance(accountName) {
    return holdingUtterance(accountName, "RC");
}
/** Induce a settled HiveTopologyCarrier from an utterance log. */
export function induceHiveTopology(utterances) {
    const log = Object.freeze([...utterances]);
    return Object.freeze({
        kind: "hive.topology.carrier",
        utterances: log,
        // Each utterance tells its cell, witnessed by its own token (relating's membrane), settled by SignCraft.
        settlement: settleMembrane(log, tokenValue),
    });
}
/** Extend an existing HiveTopologyCarrier with new utterances. */
export function extendHiveTopology(carrier, delta) {
    return induceHiveTopology([...carrier.utterances, ...delta]);
}
