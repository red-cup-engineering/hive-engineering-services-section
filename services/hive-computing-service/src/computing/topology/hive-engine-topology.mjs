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
 * wire encoding. Use @red-cup-engineering/hive-blockchain-client-service/engine.mjs to build the custom_json
 * operations that change this state.
 */
import { tokenValue, utterance } from "@red-cup-engineering/signcell/cell";
import { settleMembrane } from "@red-cup-engineering/signcraft/membrane";
import { financialAccountTerm, financialCommodityTerm, financialPositionTerm, holdingUtterance, holdingClosedUtterance, liquidPositionUtterance, stakedPositionUtterance, } from "@red-cup-engineering/organizing/accounting/topology/financial";
// Re-export financial-topology primitives for convenience
export { financialAccountTerm, financialCommodityTerm, financialPositionTerm, holdingUtterance, holdingClosedUtterance, liquidPositionUtterance, stakedPositionUtterance, };
/** Pair an utterance with its provenance. */
export function hiveEngineEvidence(utteranceCarrier, provenance) {
    return Object.freeze({
        kind: "hive-engine-topology.evidence",
        utterance: utteranceCarrier,
        provenance: Object.freeze({ ...provenance }),
    });
}
// ---------- term constructors ----------
/** Namespaced term for a Hive Engine token as a chain object: "hive-engine.token.<SYM>" */
export function hiveEngineTokenTerm(symbol) {
    return `hive-engine.token.${symbol}`;
}
/** Namespaced term for a Hive Engine market order: "hive-engine.order.<id>" */
export function hiveEngineOrderTerm(orderId) {
    return `hive-engine.order.${orderId}`;
}
/** Namespaced term for a token-scoped delegation: "hive-engine.delegation.<from>.<to>.<SYM>" */
export function hiveEngineDelegationTerm(from, to, symbol) {
    return `hive-engine.delegation.${from}.${to}.${symbol}`;
}
/** Namespaced term for an NFT instance: "hive-engine.nft.<contract>.<id>" */
export function hiveEngineNftTerm(contract, nftId) {
    return `hive-engine.nft.${contract}.${nftId}`;
}
// ---------- predicate terms ----------
export function hiveEngineDelegatedPredicate() { return "hive-engine.delegated"; }
/** Contrary of hive-engine.delegated: the delegation ended. Its own claim, not a denial. */
export function hiveEngineUndelegatedPredicate() { return "hive-engine.undelegated"; }
export function hiveEngineOpenOrderPredicate() { return "hive-engine.open-order"; }
/** Contrary of hive-engine.open-order: the order closed (filled, cancelled, or expired). Its own claim, not a denial. */
export function hiveEngineClosedOrderPredicate() { return "hive-engine.closed-order"; }
export function hiveEngineNftOwnedPredicate() { return "hive-engine.nft-owned"; }
/** Contrary of hive-engine.nft-owned: the NFT was released (transferred out or burned). Its own claim, not a denial. */
export function hiveEngineNftReleasedPredicate() { return "hive-engine.nft-released"; }
/** Contrary of financial.is-staked for HE positions: the unstake completed. Its own claim, not a denial. */
export function hiveEngineUnstakedPredicate() { return "hive-engine.unstaked"; }
export function hiveEngineListedPredicate() { return "hive-engine.listed"; }
// ---------- holding utterance helpers ----------
// Hive Engine accounts are Hive accounts acting as financial accounts; token
// balances are financial positions whose commodity is the HE symbol
// (e.g. "BEE", "SWAP.HIVE"). These wrap financial-topology's utterances
// with HE-idiomatic naming, exactly as hive-topology wraps HIVE/HBD/HP.
/** Claim that an account holds a balance of a Hive Engine token. */
export function hiveEngineHoldingUtterance(account, symbol) {
    return holdingUtterance(account, symbol);
}
/** Claim that an account's token holding closed (transferred out, burned). */
export function hiveEngineHoldingClosedUtterance(account, symbol) {
    return holdingClosedUtterance(account, symbol);
}
/** Claim that an account's token balance is liquid (transferable now). */
export function hiveEngineLiquidBalanceUtterance(account, symbol) {
    return liquidPositionUtterance(account, symbol);
}
/** Claim that an account has staked a token. */
export function hiveEngineStakeUtterance(account, symbol) {
    return stakedPositionUtterance(account, symbol);
}
/** Claim that an account's token position is unstaked (unstake completed) — the contrary of is-staked. */
export function hiveEngineUnstakeUtterance(account, symbol) {
    return utterance({ subject: financialPositionTerm(account, symbol), object: financialCommodityTerm(symbol) }, hiveEngineUnstakedPredicate());
}
// ---------- HE-specific utterance constructors ----------
/** Claim that a token-scoped delegation from one account to another is in force. */
export function hiveEngineDelegationUtterance(from, to, symbol) {
    return utterance({ subject: hiveEngineDelegationTerm(from, to, symbol), object: hiveEngineTokenTerm(symbol) }, hiveEngineDelegatedPredicate());
}
/** Claim that a token-scoped delegation ended (undelegation completed) — the contrary of delegated. */
export function hiveEngineUndelegationUtterance(from, to, symbol) {
    return utterance({ subject: hiveEngineDelegationTerm(from, to, symbol), object: hiveEngineTokenTerm(symbol) }, hiveEngineUndelegatedPredicate());
}
/** Claim that an account has an open order on the HE market. */
export function hiveEngineOpenOrderUtterance(account, orderId) {
    return utterance({ subject: financialAccountTerm(account), object: hiveEngineOrderTerm(orderId) }, hiveEngineOpenOrderPredicate());
}
/** Claim that an order closed (filled, cancelled, or expired) — the contrary of open-order. */
export function hiveEngineOrderClosedUtterance(account, orderId) {
    return utterance({ subject: financialAccountTerm(account), object: hiveEngineOrderTerm(orderId) }, hiveEngineClosedOrderPredicate());
}
/** Claim that an account owns an NFT instance. */
export function hiveEngineNftOwnedUtterance(account, contract, nftId) {
    return utterance({ subject: financialAccountTerm(account), object: hiveEngineNftTerm(contract, nftId) }, hiveEngineNftOwnedPredicate());
}
/** Claim that an NFT instance was released (transferred out or burned) — the contrary of nft-owned. */
export function hiveEngineNftReleasedUtterance(account, contract, nftId) {
    return utterance({ subject: financialAccountTerm(account), object: hiveEngineNftTerm(contract, nftId) }, hiveEngineNftReleasedPredicate());
}
/** Claim that a token is listed (registered) on Hive Engine — a diagonal claim on the token term. */
export function hiveEngineTokenListedUtterance(symbol) {
    return utterance(hiveEngineTokenTerm(symbol), hiveEngineListedPredicate());
}
/** Induce a settled HiveEngineTopologyCarrier from an utterance log. */
export function induceHiveEngineTopology(utterances) {
    const log = Object.freeze([...utterances]);
    return Object.freeze({
        kind: "hive-engine.topology.carrier",
        utterances: log,
        // Each utterance tells its cell, witnessed by its own token (relating's membrane), settled by SignCraft.
        settlement: settleMembrane(log, tokenValue),
    });
}
/** Extend an existing HiveEngineTopologyCarrier with new utterances. */
export function extendHiveEngineTopology(carrier, delta) {
    return induceHiveEngineTopology([...carrier.utterances, ...delta]);
}
