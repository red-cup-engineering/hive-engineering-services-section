// hive-market-section — Hive-venue section queries on a settled HiveMarketTopologyCarrier.
// Thin wrappers over market-topology's section reads with the venues bound.
import {
  marketKnowledgeSection, marketTruthSection,
  marketListedCharge, marketBidCharge, marketAskCharge,
  marketPlacedCharge, marketFillCharge, marketQuoteCharge,
  type SectionCarrier, type SectionEntry, type ChargeCarrier,
} from "@emsenn/trading/market";
import type { HiveMarketTopologyCarrier } from "./hive-market-topology.mjs";
import { HIVE_INTERNAL_VENUE, HIVE_ENGINE_VENUE, HIVE_ENGINE_QUOTE_SYMBOL } from "./hive-market-topology.mjs";

export type { SectionCarrier, SectionEntry, ChargeCarrier };

/** Build the knowledge-least section of a HiveMarketTopologyCarrier. */
export function hiveMarketKnowledgeSection(carrier: HiveMarketTopologyCarrier): SectionCarrier {
  return marketKnowledgeSection(carrier);
}

/** Build the truth-least section of a HiveMarketTopologyCarrier. */
export function hiveMarketTruthSection(carrier: HiveMarketTopologyCarrier): SectionCarrier {
  return marketTruthSection(carrier);
}

// ---------- internal-market charges ----------

/** Charge at "the internal HIVE/HBD book is listed". */
export function hiveInternalListedCharge(section: SectionCarrier): ChargeCarrier {
  return marketListedCharge(section, HIVE_INTERNAL_VENUE, "HIVE", "HBD");
}

/** Charge at "order bids the internal book". */
export function hiveInternalBidCharge(section: SectionCarrier, orderId: string): ChargeCarrier {
  return marketBidCharge(section, HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}

/** Charge at "order asks the internal book". */
export function hiveInternalAskCharge(section: SectionCarrier, orderId: string): ChargeCarrier {
  return marketAskCharge(section, HIVE_INTERNAL_VENUE, "HIVE", "HBD", orderId);
}

/** Charge at "account placed internal-market order". */
export function hiveInternalPlacedCharge(section: SectionCarrier, account: string, orderId: string): ChargeCarrier {
  return marketPlacedCharge(section, account, HIVE_INTERNAL_VENUE, orderId);
}

/** Charge at "fill executed on the internal book". */
export function hiveInternalFillCharge(section: SectionCarrier, fillId: string): ChargeCarrier {
  return marketFillCharge(section, HIVE_INTERNAL_VENUE, "HIVE", "HBD", fillId);
}

/** Charge at "quote observed on the internal book". */
export function hiveInternalQuoteCharge(section: SectionCarrier, quoteId: string): ChargeCarrier {
  return marketQuoteCharge(section, HIVE_INTERNAL_VENUE, "HIVE", "HBD", quoteId);
}

// ---------- Hive Engine market charges ----------

/** Charge at "the HE market lists a token book". */
export function hiveEngineMarketListedCharge(section: SectionCarrier, symbol: string): ChargeCarrier {
  return marketListedCharge(section, HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL);
}

/** Charge at "order bids an HE token book". */
export function hiveEngineMarketBidCharge(section: SectionCarrier, symbol: string, orderId: string): ChargeCarrier {
  return marketBidCharge(section, HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}

/** Charge at "order asks an HE token book". */
export function hiveEngineMarketAskCharge(section: SectionCarrier, symbol: string, orderId: string): ChargeCarrier {
  return marketAskCharge(section, HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, orderId);
}

/** Charge at "account placed an HE market order". */
export function hiveEngineMarketPlacedCharge(section: SectionCarrier, account: string, orderId: string): ChargeCarrier {
  return marketPlacedCharge(section, account, HIVE_ENGINE_VENUE, orderId);
}

/** Charge at "fill executed on an HE token book". */
export function hiveEngineMarketFillCharge(section: SectionCarrier, symbol: string, fillId: string): ChargeCarrier {
  return marketFillCharge(section, HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, fillId);
}

/** Charge at "quote observed on an HE token book". */
export function hiveEngineMarketQuoteCharge(section: SectionCarrier, symbol: string, quoteId: string): ChargeCarrier {
  return marketQuoteCharge(section, HIVE_ENGINE_VENUE, symbol, HIVE_ENGINE_QUOTE_SYMBOL, quoteId);
}
