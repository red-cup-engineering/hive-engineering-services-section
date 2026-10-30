// market — builders for the Hive Engine "market" contract (token ⇄ SWAP.HIVE
// order book). Each returns an EngineAction ready for engineCustomJson.
//
// Quantities and prices are decimal STRINGS (price is SWAP.HIVE per token,
// up-to-8 precision); callers must pre-format (see formatAmount). Payload
// shapes verified against hive-engine/steemsmartcontracts contracts/market.js.
import type { EngineAction } from "./core.mjs";

const MARKET_CONTRACT = "market";

export interface MarketLimitOrderInput {
  readonly symbol: string;
  /** Token quantity to buy/sell, as a decimal string. */
  readonly quantity: string;
  /** Price in SWAP.HIVE per token, as a decimal string (max 8 decimals). */
  readonly price: string;
}

/** Place a limit buy order. */
export function marketLimitBuy({ symbol, quantity, price }: MarketLimitOrderInput): EngineAction {
  return {
    contractName: MARKET_CONTRACT,
    contractAction: "buy",
    contractPayload: { symbol, quantity, price },
  };
}

/** Place a limit sell order. */
export function marketLimitSell({ symbol, quantity, price }: MarketLimitOrderInput): EngineAction {
  return {
    contractName: MARKET_CONTRACT,
    contractAction: "sell",
    contractPayload: { symbol, quantity, price },
  };
}

export interface MarketCancelInput {
  readonly type: "buy" | "sell";
  /** The order's transaction id (txID returned when the order was placed). */
  readonly id: string;
}

/** Cancel an open order by its txID. */
export function marketCancel({ type, id }: MarketCancelInput): EngineAction {
  return {
    contractName: MARKET_CONTRACT,
    contractAction: "cancel",
    contractPayload: { type, id },
  };
}

export interface MarketSwapBuyInput {
  readonly symbol: string;
  /** SWAP.HIVE amount to spend, as a decimal string. */
  readonly quantity: string;
}

/** Market buy: spend `quantity` SWAP.HIVE against the best asks. */
export function marketSwapBuy({ symbol, quantity }: MarketSwapBuyInput): EngineAction {
  return {
    contractName: MARKET_CONTRACT,
    contractAction: "marketBuy",
    contractPayload: { symbol, quantity },
  };
}

export interface MarketSwapSellInput {
  readonly symbol: string;
  /** Token quantity to sell, as a decimal string. */
  readonly quantity: string;
}

/** Market sell: sell `quantity` tokens into the best bids. */
export function marketSwapSell({ symbol, quantity }: MarketSwapSellInput): EngineAction {
  return {
    contractName: MARKET_CONTRACT,
    contractAction: "marketSell",
    contractPayload: { symbol, quantity },
  };
}
