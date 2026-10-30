/**
 * hive-market-topology — Hive's markets as a market-topology specialization.
 *
 * Two venues, bound to market-topology terms:
 * - "hive-internal": the chain's built-in HIVE/HBD order book
 *   (condenser/market_history APIs)
 * - "hive-engine": the HE market contract's token books, each priced in
 *   SWAP.HIVE by convention
 *
 * The hive-<domain>-<field> convention (ruled 2026-06-12): this package is
 * Hive's market field; hive-topology is Hive's social/financial field;
 * hive-topology/engine is the sidechain's state field. Carriers from all
 * three merge, since they share meme-topology and financial-topology terms.
 *
 * Evidence enters only by articulating utterances. There is no denial: an
 * ended order is its own claim of the ending event, a cell beside the
 * opening claim — history is monotone, the opening claim stands.
 *
 * HBD↔HIVE conversions are not market structure (no book, a 3.5-day
 * median-price mechanism with fees) — they belong to the capital stratum,
 * not here.
 */
import { type UtteranceCarrier, type PredicationTerm } from "@emsenn/relating";
import {
  marketBookTerm,
  marketListedUtterance,
  marketBidUtterance, marketBidEndedUtterance,
  marketAskUtterance, marketAskEndedUtterance,
  marketOrderPlacedUtterance,
  marketFillUtterance, marketQuoteUtterance,
  induceMarketTopology,
  type MarketTopologyCarrier,
} from "@emsenn/trading/market";

export type { UtteranceCarrier, PredicationTerm as TermInput, MarketTopologyCarrier };

// ---------- venues ----------

/** The chain's built-in HIVE/HBD market. */
export const HIVE_INTERNAL_VENUE = "hive-internal";
/** The Hive Engine market contract. */
export const HIVE_ENGINE_VENUE = "hive-engine";
/** The quote commodity every HE book is priced in. */
export const HIVE_ENGINE_QUOTE_SYMBOL = "SWAP.HIVE";

// ---------- book terms ----------

/** The internal market's one book: "market.book.hive-internal.HIVE/HBD" */
export function hiveInternalBookTerm(): PredicationTerm {
  return marketBookTerm(HIVE_INTERNAL_VENUE, "HIVE", "HBD");
}

/** An HE token book: "market.book.hive-engine.<SYM>/SWAP.HIVE" */
export function hiveEngineBookTerm(symbol: string): PredicationTerm {
  return marketBookTerm(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL);
}

// ---------- internal-market utterances ----------

/** Claim the internal HIVE/HBD book is listed (it always is; settle it once per carrier). */
export function hiveInternalListedUtterance(): UtteranceCarrier {
  return marketListedUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD");
}

/** Claim an open bid on the internal book. */
export function hiveInternalBidUtterance(orderId: string): UtteranceCarrier {
  return marketBidUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}

/** Claim a bid on the internal book ended (filled, cancelled, or expired) — its own claim, beside the bid. */
export function hiveInternalBidEndedUtterance(orderId: string): UtteranceCarrier {
  return marketBidEndedUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}

/** Claim an open ask on the internal book. */
export function hiveInternalAskUtterance(orderId: string): UtteranceCarrier {
  return marketAskUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}

/** Claim an ask on the internal book ended (filled, cancelled, or expired) — its own claim, beside the ask. */
export function hiveInternalAskEndedUtterance(orderId: string): UtteranceCarrier {
  return marketAskEndedUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}

/** Claim that an account placed an internal-market order. */
export function hiveInternalOrderPlacedUtterance(account: string, orderId: string): UtteranceCarrier {
  return marketOrderPlacedUtterance(account, HIVE_INTERNAL_VENUE, orderId);
}

/** Claim a fill on the internal book. */
export function hiveInternalFillUtterance(fillId: string): UtteranceCarrier {
  return marketFillUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", fillId);
}

/** Claim a quote observation of the internal book. */
export function hiveInternalQuoteUtterance(quoteId: string): UtteranceCarrier {
  return marketQuoteUtterance(HIVE_INTERNAL_VENUE, "HIVE", "HBD", quoteId);
}

// ---------- Hive Engine market utterances ----------

/** Claim that the HE market lists a token book. */
export function hiveEngineMarketListedUtterance(symbol: string): UtteranceCarrier {
  return marketListedUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL);
}

/** Claim an open bid on an HE token book. */
export function hiveEngineMarketBidUtterance(symbol: string, orderId: string): UtteranceCarrier {
  return marketBidUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}

/** Claim a bid on an HE token book ended (filled, cancelled, or expired) — its own claim, beside the bid. */
export function hiveEngineMarketBidEndedUtterance(symbol: string, orderId: string): UtteranceCarrier {
  return marketBidEndedUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}

/** Claim an open ask on an HE token book. */
export function hiveEngineMarketAskUtterance(symbol: string, orderId: string): UtteranceCarrier {
  return marketAskUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}

/** Claim an ask on an HE token book ended (filled, cancelled, or expired) — its own claim, beside the ask. */
export function hiveEngineMarketAskEndedUtterance(symbol: string, orderId: string): UtteranceCarrier {
  return marketAskEndedUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}

/** Claim that an account placed an HE market order. */
export function hiveEngineMarketOrderPlacedUtterance(account: string, orderId: string): UtteranceCarrier {
  return marketOrderPlacedUtterance(account, HIVE_ENGINE_VENUE, orderId);
}

/** Claim a fill on an HE token book. */
export function hiveEngineMarketFillUtterance(symbol: string, fillId: string): UtteranceCarrier {
  return marketFillUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, fillId);
}

/** Claim a quote observation of an HE token book. */
export function hiveEngineMarketQuoteUtterance(symbol: string, quoteId: string): UtteranceCarrier {
  return marketQuoteUtterance(HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, quoteId);
}

// ---------- carrier settlement ----------

export interface HiveMarketTopologyCarrier extends MarketTopologyCarrier {
  readonly _hiveMarketTopologyBrand: never;
}

/** Induce a settled HiveMarketTopologyCarrier from an utterance log. */
export function induceHiveMarketTopology(utterances: readonly UtteranceCarrier[]): HiveMarketTopologyCarrier {
  return induceMarketTopology(utterances) as HiveMarketTopologyCarrier;
}

/** Extend an existing HiveMarketTopologyCarrier with new utterances. */
export function extendHiveMarketTopology(
  carrier: HiveMarketTopologyCarrier,
  delta: readonly UtteranceCarrier[],
): HiveMarketTopologyCarrier {
  return induceHiveMarketTopology([...carrier.utterances, ...delta]);
}
