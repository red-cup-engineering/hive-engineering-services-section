// hive-section — Hive-specific section queries on a settled HiveTopologyCarrier.
// Thin wrappers over the generic meme-topology section layer with Hive term naming.
import {
  sectionOf,
  type SectionCarrier, type SectionEntry, type ChargeCarrier, type UtteranceCarrier,
} from "@emsenn/relating";
import { bottom } from "@emsenn/relating";
import type { HiveTopologyCarrier } from "./hive-topology.mjs";
import {
  hiveAccountTerm, hivePostTerm, hiveTagTerm, hiveCommunityTerm,
  hiveVotedOnPredicate, hiveUnvotedPredicate, hiveFollowsPredicate, hiveUnfollowedPredicate,
  hiveTaggedWithPredicate, hivePostedPredicate, hiveDeletedPredicate,
  hiveRebloggedPredicate, hiveMemberOfPredicate,
  hiveDelegatedToPredicate, hiveActivePredicate,
} from "./hive-topology.mjs";
import {
  hiveBlockTerm,
  hiveTransactionTerm,
  hiveOperationTerm,
  hiveBlockObservedPredicate,
  hiveBlockIrreversiblePredicate,
  hiveIncludedInBlockPredicate,
  hiveIncludedInTransactionPredicate,
  hiveWitnessedAtPredicate,
  type HiveChainReference,
} from "./hive-chain-observation.mjs";
import {
  hiveChargeAtBoundary,
  hiveEntriesForBoundaryMention,
  hiveEntriesForBoundaryPredicate,
  hiveEntriesForBoundarySubject,
} from "./hive-section-boundary.mjs";

export type { SectionCarrier, SectionEntry, ChargeCarrier };

/** Build the knowledge-least section of a HiveTopologyCarrier. */
export function hiveKnowledgeSection(carrier: HiveTopologyCarrier): SectionCarrier {
  return sectionOf(carrier.fixedPointReadings.knowledgeLeast);
}

/** Build the truth-least section of a HiveTopologyCarrier. */
export function hiveTruthSection(carrier: HiveTopologyCarrier): SectionCarrier {
  return sectionOf(carrier.fixedPointReadings.truthLeast);
}

// ---------- single-cell charge reads ----------

/** Charge at "voter voted-on author/permlink". */
export function hiveVoteCharge(
  section: SectionCarrier,
  voter: string,
  author: string,
  permlink: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveAccountTerm(voter), hiveVotedOnPredicate(), hivePostTerm(author, permlink));
}

/** Charge at "voter unvoted author/permlink" — the contrary claim's own cell, not a denial of the vote. */
export function hiveUnvoteCharge(
  section: SectionCarrier,
  voter: string,
  author: string,
  permlink: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveAccountTerm(voter), hiveUnvotedPredicate(), hivePostTerm(author, permlink));
}

/** Charge at "follower follows account". */
export function hiveFollowCharge(
  section: SectionCarrier,
  follower: string,
  account: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveAccountTerm(follower), hiveFollowsPredicate(), hiveAccountTerm(account));
}

/** Charge at "follower unfollowed account" — the contrary claim's own cell, not a denial of the follow. */
export function hiveUnfollowCharge(
  section: SectionCarrier,
  follower: string,
  account: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveAccountTerm(follower), hiveUnfollowedPredicate(), hiveAccountTerm(account));
}

/** Charge at "author posted author/permlink". */
export function hivePostCharge(
  section: SectionCarrier,
  author: string,
  permlink: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveAccountTerm(author), hivePostedPredicate(), hivePostTerm(author, permlink));
}

/** Charge at "author deleted author/permlink" — the contrary claim's own cell, not a denial of the post. */
export function hivePostDeletedCharge(
  section: SectionCarrier,
  author: string,
  permlink: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveAccountTerm(author), hiveDeletedPredicate(), hivePostTerm(author, permlink));
}

/** Charge at "account reblogged author/permlink". */
export function hiveReblogCharge(
  section: SectionCarrier,
  account: string,
  author: string,
  permlink: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveAccountTerm(account), hiveRebloggedPredicate(), hivePostTerm(author, permlink));
}

/** Charge at "post tagged-with tag". */
export function hiveTagCharge(
  section: SectionCarrier,
  author: string,
  permlink: string,
  tag: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hivePostTerm(author, permlink), hiveTaggedWithPredicate(), hiveTagTerm(tag));
}

/** Charge at "post member-of community". */
export function hiveCommunityCharge(
  section: SectionCarrier,
  author: string,
  permlink: string,
  community: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hivePostTerm(author, permlink), hiveMemberOfPredicate(), hiveCommunityTerm(community));
}

/** Charge at "delegator delegated-to recipient". */
export function hiveDelegationCharge(
  section: SectionCarrier,
  delegator: string,
  recipient: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveAccountTerm(delegator), hiveDelegatedToPredicate(), hiveAccountTerm(recipient));
}

/** Charge at "account is-active". */
export function hiveActiveCharge(
  section: SectionCarrier,
  account: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveAccountTerm(account), hiveActivePredicate());
}

export function hiveBlockObservedCharge(section: SectionCarrier, reference: Pick<HiveChainReference, "blockNum" | "blockId">): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveBlockTerm(reference), hiveBlockObservedPredicate());
}

export function hiveBlockIrreversibleCharge(section: SectionCarrier, reference: Pick<HiveChainReference, "blockNum" | "blockId">): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveBlockTerm(reference), hiveBlockIrreversiblePredicate());
}

export function hiveTransactionIncludedCharge(section: SectionCarrier, reference: HiveChainReference): ChargeCarrier {
  if (reference.transactionId === undefined) return bottom;
  return hiveChargeAtBoundary(section, hiveTransactionTerm(reference.transactionId), hiveIncludedInBlockPredicate(), hiveBlockTerm(reference));
}

export function hiveOperationIncludedCharge(section: SectionCarrier, reference: HiveChainReference): ChargeCarrier {
  if (reference.transactionId === undefined || reference.operationIndex === undefined) {
    return bottom;
  }
  return hiveChargeAtBoundary(
    section,
    hiveOperationTerm(reference.transactionId, reference.operationIndex),
    hiveIncludedInTransactionPredicate(),
    hiveTransactionTerm(reference.transactionId),
  );
}

export function hiveWitnessedAtCharge(section: SectionCarrier, fact: UtteranceCarrier, reference: HiveChainReference): ChargeCarrier {
  const locus = reference.transactionId !== undefined && reference.operationIndex !== undefined
    ? hiveOperationTerm(reference.transactionId, reference.operationIndex)
    : reference.transactionId !== undefined
      ? hiveTransactionTerm(reference.transactionId)
      : hiveBlockTerm(reference);
  return hiveChargeAtBoundary(section, fact.token, hiveWitnessedAtPredicate(), locus);
}

// ---------- multi-entry section reads ----------

/** All predicates asserted about an account. */
export function hiveAccountEntries(section: SectionCarrier, account: string): readonly SectionEntry[] {
  return hiveEntriesForBoundarySubject(section, hiveAccountTerm(account));
}

/** All predicates asserted about a post. */
export function hivePostEntries(section: SectionCarrier, author: string, permlink: string): readonly SectionEntry[] {
  return hiveEntriesForBoundaryMention(section, hivePostTerm(author, permlink));
}

/** All subjects that have asserted the voted-on predicate. */
export function hiveAllVoterEntries(section: SectionCarrier): readonly SectionEntry[] {
  return hiveEntriesForBoundaryPredicate(section, hiveVotedOnPredicate());
}

/** All subjects that have asserted the follows predicate. */
export function hiveAllFollowerEntries(section: SectionCarrier): readonly SectionEntry[] {
  return hiveEntriesForBoundaryPredicate(section, hiveFollowsPredicate());
}

/** All subjects that have asserted the posted predicate. */
export function hiveAllAuthorEntries(section: SectionCarrier): readonly SectionEntry[] {
  return hiveEntriesForBoundaryPredicate(section, hivePostedPredicate());
}

/** All subjects that have asserted the tagged-with predicate. */
export function hiveAllTaggedEntries(section: SectionCarrier): readonly SectionEntry[] {
  return hiveEntriesForBoundaryPredicate(section, hiveTaggedWithPredicate());
}
