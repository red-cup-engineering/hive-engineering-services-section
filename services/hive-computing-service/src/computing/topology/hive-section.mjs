// hive-section — Hive-specific section queries on a settled HiveTopologyCarrier.
// Thin wrappers over the generic meme-topology section layer with Hive term naming.
import { hiveAccountTerm, hivePostTerm, hiveTagTerm, hiveCommunityTerm, hiveVotedOnPredicate, hiveUnvotedPredicate, hiveFollowsPredicate, hiveUnfollowedPredicate, hiveTaggedWithPredicate, hivePostedPredicate, hiveDeletedPredicate, hiveRebloggedPredicate, hiveMemberOfPredicate, hiveDelegatedToPredicate, hiveActivePredicate, } from "./hive-topology.mjs";
import { hiveBlockTerm, hiveTransactionTerm, hiveOperationTerm, hiveBlockObservedPredicate, hiveBlockIrreversiblePredicate, hiveIncludedInBlockPredicate, hiveIncludedInTransactionPredicate, hiveWitnessedAtPredicate, } from "./hive-chain-observation.mjs";
import { coincides } from "@red-cup-engineering/signcell/cell";
import { noEvidence } from "@red-cup-engineering/signchain/bilattice";
import { about, evidenceIn, under } from "@red-cup-engineering/signcraft/settle";
import { financialKnowledgeSection } from "@red-cup-engineering/organizing/accounting/topology/financial";
/** The settled section of a HiveTopologyCarrier. */
export const hiveKnowledgeSection = financialKnowledgeSection;
/** The settled section of, read in the truth order: a HiveTopologyCarrier. */
export const hiveTruthSection = financialKnowledgeSection;
// ---------- single-cell evidence reads ----------
/** Evidence at "voter voted-on author/permlink". */
export function hiveVoteEvidence(section, voter, author, permlink) {
    return evidenceIn(section, hiveAccountTerm(voter), hiveVotedOnPredicate(), hivePostTerm(author, permlink));
}
/** Evidence at "voter unvoted author/permlink" — the contrary claim's own cell, not a denial of the vote. */
export function hiveUnvoteEvidence(section, voter, author, permlink) {
    return evidenceIn(section, hiveAccountTerm(voter), hiveUnvotedPredicate(), hivePostTerm(author, permlink));
}
/** Evidence at "follower follows account". */
export function hiveFollowEvidence(section, follower, account) {
    return evidenceIn(section, hiveAccountTerm(follower), hiveFollowsPredicate(), hiveAccountTerm(account));
}
/** Evidence at "follower unfollowed account" — the contrary claim's own cell, not a denial of the follow. */
export function hiveUnfollowEvidence(section, follower, account) {
    return evidenceIn(section, hiveAccountTerm(follower), hiveUnfollowedPredicate(), hiveAccountTerm(account));
}
/** Evidence at "author posted author/permlink". */
export function hivePostEvidence(section, author, permlink) {
    return evidenceIn(section, hiveAccountTerm(author), hivePostedPredicate(), hivePostTerm(author, permlink));
}
/** Evidence at "author deleted author/permlink" — the contrary claim's own cell, not a denial of the post. */
export function hivePostDeletedEvidence(section, author, permlink) {
    return evidenceIn(section, hiveAccountTerm(author), hiveDeletedPredicate(), hivePostTerm(author, permlink));
}
/** Evidence at "account reblogged author/permlink". */
export function hiveReblogEvidence(section, account, author, permlink) {
    return evidenceIn(section, hiveAccountTerm(account), hiveRebloggedPredicate(), hivePostTerm(author, permlink));
}
/** Evidence at "post tagged-with tag". */
export function hiveTagEvidence(section, author, permlink, tag) {
    return evidenceIn(section, hivePostTerm(author, permlink), hiveTaggedWithPredicate(), hiveTagTerm(tag));
}
/** Evidence at "post member-of community". */
export function hiveCommunityEvidence(section, author, permlink, community) {
    return evidenceIn(section, hivePostTerm(author, permlink), hiveMemberOfPredicate(), hiveCommunityTerm(community));
}
/** Evidence at "delegator delegated-to recipient". */
export function hiveDelegationEvidence(section, delegator, recipient) {
    return evidenceIn(section, hiveAccountTerm(delegator), hiveDelegatedToPredicate(), hiveAccountTerm(recipient));
}
/** Evidence at "account is-active". */
export function hiveActiveEvidence(section, account) {
    return evidenceIn(section, hiveAccountTerm(account), hiveActivePredicate());
}
export function hiveBlockObservedEvidence(section, reference) {
    return evidenceIn(section, hiveBlockTerm(reference), hiveBlockObservedPredicate());
}
export function hiveBlockIrreversibleEvidence(section, reference) {
    return evidenceIn(section, hiveBlockTerm(reference), hiveBlockIrreversiblePredicate());
}
export function hiveTransactionIncludedEvidence(section, reference) {
    if (reference.transactionId === undefined)
        return noEvidence;
    return evidenceIn(section, hiveTransactionTerm(reference.transactionId), hiveIncludedInBlockPredicate(), hiveBlockTerm(reference));
}
export function hiveOperationIncludedEvidence(section, reference) {
    if (reference.transactionId === undefined || reference.operationIndex === undefined) {
        return noEvidence;
    }
    return evidenceIn(section, hiveOperationTerm(reference.transactionId, reference.operationIndex), hiveIncludedInTransactionPredicate(), hiveTransactionTerm(reference.transactionId));
}
export function hiveWitnessedAtEvidence(section, fact, reference) {
    const locus = reference.transactionId !== undefined && reference.operationIndex !== undefined
        ? hiveOperationTerm(reference.transactionId, reference.operationIndex)
        : reference.transactionId !== undefined
            ? hiveTransactionTerm(reference.transactionId)
            : hiveBlockTerm(reference);
    return evidenceIn(section, fact.token, hiveWitnessedAtPredicate(), locus);
}
// ---------- multi-entry section reads ----------
/** The settled cells a term stands in, as subject or object. */
const mentioning = (section, term) => Object.freeze(section.filter((at) => coincides(at.subject, term) || coincides(at.object, term)));
/** All predicates asserted about an account. */
export function hiveAccountEntries(section, account) {
    return about(section, hiveAccountTerm(account));
}
/** All predicates asserted about a post. */
export function hivePostEntries(section, author, permlink) {
    return mentioning(section, hivePostTerm(author, permlink));
}
/** All subjects that have asserted the voted-on predicate. */
export function hiveAllVoterEntries(section) {
    return under(section, hiveVotedOnPredicate());
}
/** All subjects that have asserted the follows predicate. */
export function hiveAllFollowerEntries(section) {
    return under(section, hiveFollowsPredicate());
}
/** All subjects that have asserted the posted predicate. */
export function hiveAllAuthorEntries(section) {
    return under(section, hivePostedPredicate());
}
/** All subjects that have asserted the tagged-with predicate. */
export function hiveAllTaggedEntries(section) {
    return under(section, hiveTaggedWithPredicate());
}
