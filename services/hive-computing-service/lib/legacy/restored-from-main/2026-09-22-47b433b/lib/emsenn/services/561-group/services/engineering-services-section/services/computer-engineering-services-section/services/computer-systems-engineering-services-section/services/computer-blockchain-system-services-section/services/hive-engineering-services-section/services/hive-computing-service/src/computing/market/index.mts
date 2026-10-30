/**
 * @emsenn/computing-with-hive-market-topology — Hive's markets as a market-topology
 * specialization: the internal HIVE/HBD book and the Hive Engine token
 * books (each priced in SWAP.HIVE) bound to market terms.
 *
 * Carriers merge with hive-topology and its ./engine sidechain carriers —
 * the chains' social, financial, and market fields share one floor.
 */

// ---------- venues and book terms ----------
export {
  HIVE_INTERNAL_VENUE,
  HIVE_ENGINE_VENUE,
  HIVE_ENGINE_QUOTE_SYMBOL,
  hiveInternalBookTerm,
  hiveEngineBookTerm,
} from "./hive-market-topology.mjs";

// ---------- internal-market utterances ----------
export {
  hiveInternalListedUtterance,
  hiveInternalBidUtterance,
  hiveInternalBidEndedUtterance,
  hiveInternalAskUtterance,
  hiveInternalAskEndedUtterance,
  hiveInternalOrderPlacedUtterance,
  hiveInternalFillUtterance,
  hiveInternalQuoteUtterance,
} from "./hive-market-topology.mjs";

// ---------- Hive Engine market utterances ----------
export {
  hiveEngineMarketListedUtterance,
  hiveEngineMarketBidUtterance,
  hiveEngineMarketBidEndedUtterance,
  hiveEngineMarketAskUtterance,
  hiveEngineMarketAskEndedUtterance,
  hiveEngineMarketOrderPlacedUtterance,
  hiveEngineMarketFillUtterance,
  hiveEngineMarketQuoteUtterance,
} from "./hive-market-topology.mjs";

// ---------- carrier ----------
export { induceHiveMarketTopology, extendHiveMarketTopology } from "./hive-market-topology.mjs";
export type {
  HiveMarketTopologyCarrier, MarketTopologyCarrier, UtteranceCarrier,
} from "./hive-market-topology.mjs";

// ---------- section reads ----------
export {
  hiveMarketKnowledgeSection,
  hiveMarketTruthSection,
  hiveInternalListedCharge,
  hiveInternalBidCharge,
  hiveInternalAskCharge,
  hiveInternalPlacedCharge,
  hiveInternalFillCharge,
  hiveInternalQuoteCharge,
  hiveEngineMarketListedCharge,
  hiveEngineMarketBidCharge,
  hiveEngineMarketAskCharge,
  hiveEngineMarketPlacedCharge,
  hiveEngineMarketFillCharge,
  hiveEngineMarketQuoteCharge,
} from "./hive-market-section.mjs";
export type { SectionCarrier, SectionEntry, ChargeCarrier } from "./hive-market-section.mjs";

// ---------- microstructure laws (re-surfaced from market-topology) ----------
export {
  bestBid, bestAsk, spread, midpoint, relativeSpread,
  marketBuyWalk, marketSellWalk,
} from "@emsenn/trading/market";
export type { BookLevel, OrderBook, BookWalk } from "@emsenn/trading/market";
