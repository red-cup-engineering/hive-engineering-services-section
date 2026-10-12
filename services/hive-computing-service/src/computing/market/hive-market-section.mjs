// hive-market-section — Hive-venue section queries on a settled HiveMarketTopologyCarrier.
// Thin wrappers over market-topology's section reads with the venues bound.
import { marketKnowledgeSection, marketTruthSection, marketListedEvidence, marketBidEvidence, marketAskEvidence, marketPlacedEvidence, marketFillEvidence, marketQuoteEvidence, } from "@red-cup-engineering/organizing/accounting/topology/market";
import { HIVE_INTERNAL_VENUE, HIVE_ENGINE_VENUE, HIVE_ENGINE_QUOTE_SYMBOL } from "./hive-market-topology.mjs";
/** The settled section of a HiveMarketTopologyCarrier. */
export const hiveMarketKnowledgeSection = marketKnowledgeSection;
/** The settled section of, read in the truth order: a HiveMarketTopologyCarrier. */
export const hiveMarketTruthSection = marketTruthSection;
// ---------- internal-market evidence ----------
/** Evidence at "the internal HIVE/HBD book is listed". */
export function hiveInternalListedEvidence(section) {
    return marketListedEvidence(section, HIVE_INTERNAL_VENUE, "HIVE", "HBD");
}
/** Evidence at "order bids the internal book". */
export function hiveInternalBidEvidence(section, orderId) {
    return marketBidEvidence(section, HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}
/** Evidence at "order asks the internal book". */
export function hiveInternalAskEvidence(section, orderId) {
    return marketAskEvidence(section, HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}
/** Evidence at "account placed internal-market order". */
export function hiveInternalPlacedEvidence(section, account, orderId) {
    return marketPlacedEvidence(section, account, HIVE_INTERNAL_VENUE, orderId);
}
/** Evidence at "fill executed on the internal book". */
export function hiveInternalFillEvidence(section, fillId) {
    return marketFillEvidence(section, HIVE_INTERNAL_VENUE, "HIVE", "HBD", fillId);
}
/** Evidence at "quote observed on the internal book". */
export function hiveInternalQuoteEvidence(section, quoteId) {
    return marketQuoteEvidence(section, HIVE_INTERNAL_VENUE, "HIVE", "HBD", quoteId);
}
// ---------- Hive Engine market evidence ----------
/** Evidence at "the HE market lists a token book". */
export function hiveEngineMarketListedEvidence(section, symbol) {
    return marketListedEvidence(section, HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL);
}
/** Evidence at "order bids an HE token book". */
export function hiveEngineMarketBidEvidence(section, symbol, orderId) {
    return marketBidEvidence(section, HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}
/** Evidence at "order asks an HE token book". */
export function hiveEngineMarketAskEvidence(section, symbol, orderId) {
    return marketAskEvidence(section, HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}
/** Evidence at "account placed an HE market order". */
export function hiveEngineMarketPlacedEvidence(section, account, orderId) {
    return marketPlacedEvidence(section, account, HIVE_ENGINE_VENUE, orderId);
}
/** Evidence at "fill executed on an HE token book". */
export function hiveEngineMarketFillEvidence(section, symbol, fillId) {
    return marketFillEvidence(section, HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, fillId);
}
/** Evidence at "quote observed on an HE token book". */
export function hiveEngineMarketQuoteEvidence(section, symbol, quoteId) {
    return marketQuoteEvidence(section, HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, quoteId);
}
