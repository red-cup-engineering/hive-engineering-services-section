/**
 * @emsenn/computing-with-hive-topology/engine — Hive Engine sidechain as a meme-topology carrier.
 *
 * Extends financial-topology: HE accounts are Hive accounts acting as
 * financial accounts; token balances, liquid positions, and stakes are
 * financial positions whose commodities are HE symbols. HE-specific
 * relations — token-scoped delegations, open market orders, NFT ownership,
 * token listing — carry hive-engine terms and predicates. Evidence enters
 * only by articulating utterances; an event that ends a state claims its
 * contrary predicate.
 *
 * No wire encoding here — for the custom_json builders that change this
 * state see @emsenn/computing-with-hive-codecs/engine.
 */

// ---------- re-exported financial-topology primitives ----------
export type { FinancialTopologyCarrier } from "./hive-engine-topology.mjs";
export {
  financialAccountTerm, financialCommodityTerm, financialPositionTerm,
  holdingUtterance, holdingClosedUtterance,
  liquidPositionUtterance, stakedPositionUtterance,
} from "./hive-engine-topology.mjs";

// ---------- provenance ----------
export type { HiveEngineProvenance, HiveEngineEvidenceCarrier } from "./hive-engine-topology.mjs";
export { hiveEngineEvidence } from "./hive-engine-topology.mjs";

// ---------- term constructors ----------
export {
  hiveEngineTokenTerm,
  hiveEngineOrderTerm,
  hiveEngineDelegationTerm,
  hiveEngineNftTerm,
} from "./hive-engine-topology.mjs";

// ---------- predicate terms ----------
export {
  hiveEngineDelegatedPredicate,
  hiveEngineUndelegatedPredicate,
  hiveEngineOpenOrderPredicate,
  hiveEngineClosedOrderPredicate,
  hiveEngineNftOwnedPredicate,
  hiveEngineNftReleasedPredicate,
  hiveEngineUnstakedPredicate,
  hiveEngineListedPredicate,
} from "./hive-engine-topology.mjs";

// ---------- holding utterance helpers ----------
export {
  hiveEngineHoldingUtterance,
  hiveEngineHoldingClosedUtterance,
  hiveEngineLiquidBalanceUtterance,
  hiveEngineStakeUtterance,
  hiveEngineUnstakeUtterance,
} from "./hive-engine-topology.mjs";

// ---------- HE-specific utterance constructors ----------
export {
  hiveEngineDelegationUtterance,
  hiveEngineUndelegationUtterance,
  hiveEngineOpenOrderUtterance,
  hiveEngineOrderClosedUtterance,
  hiveEngineNftOwnedUtterance,
  hiveEngineNftReleasedUtterance,
  hiveEngineTokenListedUtterance,
} from "./hive-engine-topology.mjs";

// ---------- carrier ----------
export { induceHiveEngineTopology, extendHiveEngineTopology } from "./hive-engine-topology.mjs";
export type { HiveEngineTopologyCarrier, UtteranceCarrier } from "./hive-engine-topology.mjs";

// ---------- section reads ----------
export {
  hiveEngineKnowledgeSection,
  hiveEngineTruthSection,
  hiveEngineHoldsCharge,
  hiveEngineLiquidCharge,
  hiveEngineStakeCharge,
  hiveEngineUnstakedCharge,
  hiveEngineDelegationCharge,
  hiveEngineUndelegationCharge,
  hiveEngineOpenOrderCharge,
  hiveEngineOrderClosedCharge,
  hiveEngineNftCharge,
  hiveEngineNftReleasedCharge,
  hiveEngineListedCharge,
  hiveEngineAccountEntries,
  hiveEngineTokenEntries,
  hiveEngineAllHolderEntries,
  hiveEngineAllDelegationEntries,
  hiveEngineAllUndelegationEntries,
  hiveEngineAllOrderEntries,
  hiveEngineAllNftEntries,
} from "./hive-engine-section.mjs";
export type { SectionCarrier, SectionEntry, ChargeCarrier } from "./hive-engine-section.mjs";

// ---------- financial section reads ----------
export {
  financialKnowledgeSection,
  financialTruthSection,
  holdingCharge,
  closedPositionCharge,
  liquidCharge,
  stakedCharge,
} from "@emsenn/trading/financial";
