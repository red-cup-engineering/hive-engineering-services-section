/**
 * hive-engine-topology — the Hive Engine sidechain as a meme-topology carrier.
 *
 * Extends financial-topology for the Hive Engine domain, mirroring
 * hive-topology's term/predicate/utterance/carrier pattern:
 * - Holdings, liquid balances, and stakes map onto financial-topology's
 *   position utterances (token symbols are the commodities)
 * - HE-specific relations get hive-engine terms and predicates: token-scoped
 *   delegations, open market orders, NFT ownership, token listing
 *
 * Evidence enters only by articulating utterances; there is no denial. An
 * event that ends a state (transfer out, fill, cancel, burn, unstake,
 * undelegation) is its own claim of the contrary predicate, never a polarity
 * against the original claim. Quantities do not live in the topology —
 * balances and order sizes ride as exact decimal strings in provenance,
 * carried beside the utterance in HiveEngineEvidenceCarrier; the topology
 * models the existence of holdings. Quantities belong to the accounting bridge.
 *
 * No codec imports; this library models *knowledge about* Hive Engine, not
 * wire encoding. Use @emsenn/computing-with-hive-codecs/engine to build the custom_json
 * operations that change this state.
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
  type FinancialTopologyCarrier,
} from "@emsenn/trading/financial";
import { predicationTerm, predicationPredicate, predicateMarkValue } from "../predication.mjs";

export type { UtteranceCarrier, PredicationTerm as TermInput, FinancialTopologyCarrier };

// Re-export financial-topology primitives for convenience
export {
  financialAccountTerm, financialCommodityTerm, financialPositionTerm,
  holdingUtterance, holdingClosedUtterance,
  liquidPositionUtterance, stakedPositionUtterance,
};

// ---------- provenance ----------

/**
 * The provenance shape HE evidence is expected to carry. `state-api` marks a
 * contracts-API snapshot; `event-api` marks an entry from the append-only
 * event log. Quantities are exact decimal strings, never floats.
 */
export interface HiveEngineProvenance {
  readonly source: "state-api" | "event-api";
  readonly timestamp?: string;
  readonly blockNum?: number;
  readonly eventNum?: number;
  readonly transactionHash?: string;
  readonly quantity?: string;
}

/** An utterance with its Hive Engine provenance riding beside it — provenance is package structure, never kernel structure. */
export interface HiveEngineEvidenceCarrier {
  readonly kind: "hive-engine-topology.evidence";
  readonly utterance: UtteranceCarrier;
  readonly provenance: HiveEngineProvenance;
}

/** Pair an utterance with its provenance. */
export function hiveEngineEvidence(
  utteranceCarrier: UtteranceCarrier,
  provenance: HiveEngineProvenance,
): HiveEngineEvidenceCarrier {
  return Object.freeze({
    kind: "hive-engine-topology.evidence" as const,
    utterance: utteranceCarrier,
    provenance: Object.freeze({ ...provenance }),
  });
}

// ---------- term constructors ----------

/** Namespaced mark for a Hive Engine token as a chain object: "hive-engine.token.<SYM>" */
export function hiveEngineTokenTerm(symbol: string): PredicationTerm {
  return predicationTerm(`hive-engine.token.${symbol}`);
}

/** Namespaced mark for a Hive Engine market order: "hive-engine.order.<id>" */
export function hiveEngineOrderTerm(orderId: string): PredicationTerm {
  return predicationTerm(`hive-engine.order.${orderId}`);
}

/** Namespaced mark for a token-scoped delegation: "hive-engine.delegation.<from>.<to>.<SYM>" */
export function hiveEngineDelegationTerm(from: string, to: string, symbol: string): PredicationTerm {
  return predicationTerm(`hive-engine.delegation.${from}.${to}.${symbol}`);
}

/** Namespaced mark for an NFT instance: "hive-engine.nft.<contract>.<id>" */
export function hiveEngineNftTerm(contract: string, nftId: string): PredicationTerm {
  return predicationTerm(`hive-engine.nft.${contract}.${nftId}`);
}

// ---------- predicate terms ----------

export function hiveEngineDelegatedPredicate(): PredicationPredicate { return predicationPredicate("hive-engine.delegated"); }
/** Contrary of hive-engine.delegated: the delegation ended. Its own claim, not a denial. */
export function hiveEngineUndelegatedPredicate(): PredicationPredicate { return predicationPredicate("hive-engine.undelegated"); }
export function hiveEngineOpenOrderPredicate(): PredicationPredicate { return predicationPredicate("hive-engine.open-order"); }
/** Contrary of hive-engine.open-order: the order closed (filled, cancelled, or expired). Its own claim, not a denial. */
export function hiveEngineClosedOrderPredicate(): PredicationPredicate { return predicationPredicate("hive-engine.closed-order"); }
export function hiveEngineNftOwnedPredicate(): PredicationPredicate { return predicationPredicate("hive-engine.nft-owned"); }
/** Contrary of hive-engine.nft-owned: the NFT was released (transferred out or burned). Its own claim, not a denial. */
export function hiveEngineNftReleasedPredicate(): PredicationPredicate { return predicationPredicate("hive-engine.nft-released"); }
/** Contrary of financial.is-staked for HE positions: the unstake completed. Its own claim, not a denial. */
export function hiveEngineUnstakedPredicate(): PredicationPredicate { return predicationPredicate("hive-engine.unstaked"); }
export function hiveEngineListedPredicate(): PredicationPredicate { return predicationPredicate("hive-engine.listed"); }

// ---------- holding utterance helpers ----------
// Hive Engine accounts are Hive accounts acting as financial accounts; token
// balances are financial positions whose commodity is the HE symbol
// (e.g. "BEE", "SWAP.HIVE"). These wrap financial-topology's utterances
// with HE-idiomatic naming, exactly as hive-topology wraps HIVE/HBD/HP.

/** Claim that an account holds a balance of a Hive Engine token. */
export function hiveEngineHoldingUtterance(account: string, symbol: string): UtteranceCarrier {
  return holdingUtterance(account, symbol);
}

/** Claim that an account's token holding closed (transferred out, burned). */
export function hiveEngineHoldingClosedUtterance(account: string, symbol: string): UtteranceCarrier {
  return holdingClosedUtterance(account, symbol);
}

/** Claim that an account's token balance is liquid (transferable now). */
export function hiveEngineLiquidBalanceUtterance(account: string, symbol: string): UtteranceCarrier {
  return liquidPositionUtterance(account, symbol);
}

/** Claim that an account has staked a token. */
export function hiveEngineStakeUtterance(account: string, symbol: string): UtteranceCarrier {
  return stakedPositionUtterance(account, symbol);
}

/** Claim that an account's token position is unstaked (unstake completed) — the contrary of is-staked. */
export function hiveEngineUnstakeUtterance(account: string, symbol: string): UtteranceCarrier {
  return utterance(
    mark({ subject: financialPositionTerm(account, symbol), object: financialCommodityTerm(symbol) }),
    mark(predicateMarkValue(hiveEngineUnstakedPredicate())),
  );
}

// ---------- HE-specific utterance constructors ----------

/** Claim that a token-scoped delegation from one account to another is in force. */
export function hiveEngineDelegationUtterance(from: string, to: string, symbol: string): UtteranceCarrier {
  return utterance(
    mark({ subject: hiveEngineDelegationTerm(from, to, symbol), object: hiveEngineTokenTerm(symbol) }),
    mark(predicateMarkValue(hiveEngineDelegatedPredicate())),
  );
}

/** Claim that a token-scoped delegation ended (undelegation completed) — the contrary of delegated. */
export function hiveEngineUndelegationUtterance(from: string, to: string, symbol: string): UtteranceCarrier {
  return utterance(
    mark({ subject: hiveEngineDelegationTerm(from, to, symbol), object: hiveEngineTokenTerm(symbol) }),
    mark(predicateMarkValue(hiveEngineUndelegatedPredicate())),
  );
}

/** Claim that an account has an open order on the HE market. */
export function hiveEngineOpenOrderUtterance(account: string, orderId: string): UtteranceCarrier {
  return utterance(
    mark({ subject: financialAccountTerm(account), object: hiveEngineOrderTerm(orderId) }),
    mark(predicateMarkValue(hiveEngineOpenOrderPredicate())),
  );
}

/** Claim that an order closed (filled, cancelled, or expired) — the contrary of open-order. */
export function hiveEngineOrderClosedUtterance(account: string, orderId: string): UtteranceCarrier {
  return utterance(
    mark({ subject: financialAccountTerm(account), object: hiveEngineOrderTerm(orderId) }),
    mark(predicateMarkValue(hiveEngineClosedOrderPredicate())),
  );
}

/** Claim that an account owns an NFT instance. */
export function hiveEngineNftOwnedUtterance(account: string, contract: string, nftId: string): UtteranceCarrier {
  return utterance(
    mark({ subject: financialAccountTerm(account), object: hiveEngineNftTerm(contract, nftId) }),
    mark(predicateMarkValue(hiveEngineNftOwnedPredicate())),
  );
}

/** Claim that an NFT instance was released (transferred out or burned) — the contrary of nft-owned. */
export function hiveEngineNftReleasedUtterance(account: string, contract: string, nftId: string): UtteranceCarrier {
  return utterance(
    mark({ subject: financialAccountTerm(account), object: hiveEngineNftTerm(contract, nftId) }),
    mark(predicateMarkValue(hiveEngineNftReleasedPredicate())),
  );
}

/** Claim that a token is listed (registered) on Hive Engine — a diagonal claim on the token term. */
export function hiveEngineTokenListedUtterance(symbol: string): UtteranceCarrier {
  return utterance(mark(hiveEngineTokenTerm(symbol)), mark(predicateMarkValue(hiveEngineListedPredicate())));
}

// ---------- carrier settlement ----------

export interface HiveEngineTopologyCarrier extends FinancialTopologyCarrier {
  readonly kind: "hive-engine.topology.carrier";
  readonly utterances: readonly UtteranceCarrier[];
  readonly settlement: SettlementFiltration;
  readonly fixedPointReadings: MemeTopologyFixedPointReadings;
  readonly _hiveEngineTopologyBrand: never;
}

/** Induce a settled HiveEngineTopologyCarrier from an utterance log. */
export function induceHiveEngineTopology(utterances: readonly UtteranceCarrier[]): HiveEngineTopologyCarrier {
  const log = Object.freeze([...utterances]);
  return Object.freeze({
    kind: "hive-engine.topology.carrier" as const,
    utterances: log,
    settlement: settleUtterances(log),
    fixedPointReadings: fixedPointReadingsOfUtterances(log),
  }) as HiveEngineTopologyCarrier;
}

/** Extend an existing HiveEngineTopologyCarrier with new utterances. */
export function extendHiveEngineTopology(
  carrier: HiveEngineTopologyCarrier,
  delta: readonly UtteranceCarrier[],
): HiveEngineTopologyCarrier {
  return induceHiveEngineTopology([...carrier.utterances, ...delta]);
}
