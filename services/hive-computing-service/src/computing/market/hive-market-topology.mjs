import { marketBookTerm, marketListedUtterance, marketBidUtterance, marketBidEndedUtterance, marketAskUtterance, marketAskEndedUtterance, marketOrderPlacedUtterance, marketFillUtterance, marketQuoteUtterance, induceMarketTopology, } from "@red-cup-engineering/organizing/accounting/topology/market";
// ---------- venues ----------
/** The chain's built-in HIVE/HBD market. */
export const HIVE_INTERNAL_VENUE = "hive-internal";
/** The Hive Engine market contract. */
export const HIVE_ENGINE_VENUE = "hive-engine";
/** The quote commodity every HE book is priced in. */
export const HIVE_ENGINE_QUOTE_SYMBOL = "SWAP.HIVE";
// ---------- book terms ----------
/** The internal market's one book: "market.book.hive-internal.HIVE/HBD" */
export function hiveInternalBookTerm() {
    return marketBookTerm(HIVE_INTERNAL_VENUE, "HIVE", "HBD");
}
/** An HE token book: "market.book.hive-engine.<SYM>/SWAP.HIVE" */
export function hiveEngineBookTerm(symbol) {
    return marketBookTerm(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL);
}
// ---------- internal-market utterances ----------
/** Claim the internal HIVE/HBD book is listed (it always is; settle it once per carrier). */
export function hiveInternalListedUtterance() {
    return marketListedUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD");
}
/** Claim an open bid on the internal book. */
export function hiveInternalBidUtterance(orderId) {
    return marketBidUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}
/** Claim a bid on the internal book ended (filled, cancelled, or expired) — its own claim, beside the bid. */
export function hiveInternalBidEndedUtterance(orderId) {
    return marketBidEndedUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}
/** Claim an open ask on the internal book. */
export function hiveInternalAskUtterance(orderId) {
    return marketAskUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}
/** Claim an ask on the internal book ended (filled, cancelled, or expired) — its own claim, beside the ask. */
export function hiveInternalAskEndedUtterance(orderId) {
    return marketAskEndedUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}
/** Claim that an account placed an internal-market order. */
export function hiveInternalOrderPlacedUtterance(account, orderId) {
    return marketOrderPlacedUtterance(account, HIVE_INTERNAL_VENUE, orderId);
}
/** Claim a fill on the internal book. */
export function hiveInternalFillUtterance(fillId) {
    return marketFillUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", fillId);
}
/** Claim a quote observation of the internal book. */
export function hiveInternalQuoteUtterance(quoteId) {
    return marketQuoteUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", quoteId);
}
// ---------- Hive Engine market utterances ----------
/** Claim that the HE market lists a token book. */
export function hiveEngineMarketListedUtterance(symbol) {
    return marketListedUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL);
}
/** Claim an open bid on an HE token book. */
export function hiveEngineMarketBidUtterance(symbol, orderId) {
    return marketBidUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}
/** Claim a bid on an HE token book ended (filled, cancelled, or expired) — its own claim, beside the bid. */
export function hiveEngineMarketBidEndedUtterance(symbol, orderId) {
    return marketBidEndedUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}
/** Claim an open ask on an HE token book. */
export function hiveEngineMarketAskUtterance(symbol, orderId) {
    return marketAskUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}
/** Claim an ask on an HE token book ended (filled, cancelled, or expired) — its own claim, beside the ask. */
export function hiveEngineMarketAskEndedUtterance(symbol, orderId) {
    return marketAskEndedUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}
/** Claim that an account placed an HE market order. */
export function hiveEngineMarketOrderPlacedUtterance(account, orderId) {
    return marketOrderPlacedUtterance(account, HIVE_ENGINE_VENUE, orderId);
}
/** Claim a fill on an HE token book. */
export function hiveEngineMarketFillUtterance(symbol, fillId) {
    return marketFillUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, fillId);
}
/** Claim a quote observation of an HE token book. */
export function hiveEngineMarketQuoteUtterance(symbol, quoteId) {
    return marketQuoteUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, quoteId);
}
/** Induce a settled HiveMarketTopologyCarrier from an utterance log. */
export function induceHiveMarketTopology(utterances) {
    return induceMarketTopology(utterances);
}
/** Extend an existing HiveMarketTopologyCarrier with new utterances. */
export function extendHiveMarketTopology(carrier, delta) {
    return induceHiveMarketTopology([...carrier.utterances, ...delta]);
}
