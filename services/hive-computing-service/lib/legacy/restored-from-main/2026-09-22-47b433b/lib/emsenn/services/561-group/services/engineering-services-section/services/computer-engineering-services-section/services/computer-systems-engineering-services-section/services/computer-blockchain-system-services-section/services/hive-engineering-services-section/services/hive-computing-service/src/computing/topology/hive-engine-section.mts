// hive-engine-section — HE-specific section queries on a settled HiveEngineTopologyCarrier.
// Thin wrappers over the generic meme-topology section layer with HE term naming.
// There is no denial: an ended state is read at its contrary predicate's cell,
// never as a falsity polarity on the original cell.
import {
  sectionOf,
  type SectionCarrier, type SectionEntry, type ChargeCarrier,
} from "@emsenn/relating";
import {
  financialAccountTerm, financialCommodityTerm, financialPositionTerm,
  holdsPositionPredicate, isLiquidPredicate, isStakedPredicate,
} from "@emsenn/trading/financial";
import type { HiveEngineTopologyCarrier } from "./hive-engine-topology.mjs";
import {
  hiveEngineTokenTerm, hiveEngineOrderTerm, hiveEngineDelegationTerm, hiveEngineNftTerm,
  hiveEngineDelegatedPredicate, hiveEngineUndelegatedPredicate,
  hiveEngineOpenOrderPredicate, hiveEngineClosedOrderPredicate,
  hiveEngineNftOwnedPredicate, hiveEngineNftReleasedPredicate,
  hiveEngineUnstakedPredicate, hiveEngineListedPredicate,
} from "./hive-engine-topology.mjs";
import {
  hiveChargeAtBoundary,
  hiveEntriesForBoundaryPredicate,
  hiveEntriesForBoundarySubject,
} from "./hive-section-boundary.mjs";

export type { SectionCarrier, SectionEntry, ChargeCarrier };

/** Build the knowledge-least section of a HiveEngineTopologyCarrier. */
export function hiveEngineKnowledgeSection(carrier: HiveEngineTopologyCarrier): SectionCarrier {
  return sectionOf(carrier.fixedPointReadings.knowledgeLeast);
}

/** Build the truth-least section of a HiveEngineTopologyCarrier. */
export function hiveEngineTruthSection(carrier: HiveEngineTopologyCarrier): SectionCarrier {
  return sectionOf(carrier.fixedPointReadings.truthLeast);
}

// ---------- single-cell charge reads ----------

/** Charge at "account holds token". */
export function hiveEngineHoldsCharge(
  section: SectionCarrier,
  account: string,
  symbol: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, financialAccountTerm(account), holdsPositionPredicate(), financialCommodityTerm(symbol));
}

/** Charge at "account's token position is liquid". */
export function hiveEngineLiquidCharge(
  section: SectionCarrier,
  account: string,
  symbol: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, financialPositionTerm(account, symbol), isLiquidPredicate(), financialCommodityTerm(symbol));
}

/** Charge at "account's token position is staked". */
export function hiveEngineStakeCharge(
  section: SectionCarrier,
  account: string,
  symbol: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, financialPositionTerm(account, symbol), isStakedPredicate(), financialCommodityTerm(symbol));
}

/** Charge at "account's token position is unstaked" — the contrary predicate of is-staked. */
export function hiveEngineUnstakedCharge(
  section: SectionCarrier,
  account: string,
  symbol: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, financialPositionTerm(account, symbol), hiveEngineUnstakedPredicate(), financialCommodityTerm(symbol));
}

/** Charge at "delegation from→to of token is in force". */
export function hiveEngineDelegationCharge(
  section: SectionCarrier,
  from: string,
  to: string,
  symbol: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveEngineDelegationTerm(from, to, symbol), hiveEngineDelegatedPredicate(), hiveEngineTokenTerm(symbol));
}

/** Charge at "delegation from→to of token ended" — the contrary predicate of delegated. */
export function hiveEngineUndelegationCharge(
  section: SectionCarrier,
  from: string,
  to: string,
  symbol: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveEngineDelegationTerm(from, to, symbol), hiveEngineUndelegatedPredicate(), hiveEngineTokenTerm(symbol));
}

/** Charge at "account has open order". */
export function hiveEngineOpenOrderCharge(
  section: SectionCarrier,
  account: string,
  orderId: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, financialAccountTerm(account), hiveEngineOpenOrderPredicate(), hiveEngineOrderTerm(orderId));
}

/** Charge at "account's order closed" — the contrary predicate of open-order. */
export function hiveEngineOrderClosedCharge(
  section: SectionCarrier,
  account: string,
  orderId: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, financialAccountTerm(account), hiveEngineClosedOrderPredicate(), hiveEngineOrderTerm(orderId));
}

/** Charge at "account owns NFT instance". */
export function hiveEngineNftCharge(
  section: SectionCarrier,
  account: string,
  contract: string,
  nftId: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, financialAccountTerm(account), hiveEngineNftOwnedPredicate(), hiveEngineNftTerm(contract, nftId));
}

/** Charge at "account released NFT instance" — the contrary predicate of nft-owned. */
export function hiveEngineNftReleasedCharge(
  section: SectionCarrier,
  account: string,
  contract: string,
  nftId: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, financialAccountTerm(account), hiveEngineNftReleasedPredicate(), hiveEngineNftTerm(contract, nftId));
}

/** Charge at "token is listed" — a diagonal cell on the token term. */
export function hiveEngineListedCharge(
  section: SectionCarrier,
  symbol: string,
): ChargeCarrier {
  return hiveChargeAtBoundary(section, hiveEngineTokenTerm(symbol), hiveEngineListedPredicate());
}

// ---------- multi-entry section reads ----------

/** All predicates claimed about an account (financial-account subject). */
export function hiveEngineAccountEntries(section: SectionCarrier, account: string): readonly SectionEntry[] {
  return hiveEntriesForBoundarySubject(section, financialAccountTerm(account));
}

/** All predicates claimed about a token as a chain object. */
export function hiveEngineTokenEntries(section: SectionCarrier, symbol: string): readonly SectionEntry[] {
  return hiveEntriesForBoundarySubject(section, hiveEngineTokenTerm(symbol));
}

/** All holding entries (subjects of holds-position; spans HE tokens and any merged financial layer). */
export function hiveEngineAllHolderEntries(section: SectionCarrier): readonly SectionEntry[] {
  return hiveEntriesForBoundaryPredicate(section, holdsPositionPredicate());
}

/** All in-force delegation entries. Ended delegations live at the undelegated predicate. */
export function hiveEngineAllDelegationEntries(section: SectionCarrier): readonly SectionEntry[] {
  return hiveEntriesForBoundaryPredicate(section, hiveEngineDelegatedPredicate());
}

/** All ended-delegation entries — the contrary predicate's cells. */
export function hiveEngineAllUndelegationEntries(section: SectionCarrier): readonly SectionEntry[] {
  return hiveEntriesForBoundaryPredicate(section, hiveEngineUndelegatedPredicate());
}

/** All open-order entries. Closed orders live at the closed-order predicate. */
export function hiveEngineAllOrderEntries(section: SectionCarrier): readonly SectionEntry[] {
  return hiveEntriesForBoundaryPredicate(section, hiveEngineOpenOrderPredicate());
}

/** All NFT-ownership entries. Released NFTs live at the nft-released predicate. */
export function hiveEngineAllNftEntries(section: SectionCarrier): readonly SectionEntry[] {
  return hiveEntriesForBoundaryPredicate(section, hiveEngineNftOwnedPredicate());
}
