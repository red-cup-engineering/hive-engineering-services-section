// pools — builders for the Hive Engine "marketpools" contract (AMM liquidity
// pools). Each returns an EngineAction ready for engineCustomJson.
//
// All quantities are decimal STRINGS at the token's precision (max 8); callers
// must pre-format (see formatAmount). Payload shapes verified against
// hive-engine/steemsmartcontracts contracts/marketpools.js.
import type { EngineAction } from "./core.mjs";

const MARKET_POOLS_CONTRACT = "marketpools";

export interface AddLiquidityInput {
  /** Token pair identifier, e.g. "SWAP.HIVE:CENT". */
  readonly tokenPair: string;
  /** Base token quantity (left side of the pair), decimal string. */
  readonly baseQuantity: string;
  /** Quote token quantity (right side of the pair), decimal string. */
  readonly quoteQuantity: string;
}

/** Add liquidity to an existing pool (or create if new). Requires active key. */
export function addLiquidity({ tokenPair, baseQuantity, quoteQuantity }: AddLiquidityInput): EngineAction {
  return {
    contractName: MARKET_POOLS_CONTRACT,
    contractAction: "addLiquidity",
    contractPayload: { tokenPair, baseQuantity, quoteQuantity },
  };
}

export interface RemoveLiquidityInput {
  /** Token pair identifier. */
  readonly tokenPair: string;
  /** LP share quantity to burn, decimal string. */
  readonly shares: string;
}

/** Remove liquidity by burning shares. Requires active key. */
export function removeLiquidity({ tokenPair, shares }: RemoveLiquidityInput): EngineAction {
  return {
    contractName: MARKET_POOLS_CONTRACT,
    contractAction: "removeLiquidity",
    contractPayload: { tokenPair, shares },
  };
}

export interface SwapTokensInput {
  /** Token pair identifier. */
  readonly tokenPair: string;
  /** Which token in the pair you are providing. */
  readonly tokenSymbol: string;
  /** Amount of tokenSymbol to provide, decimal string. */
  readonly tokenAmount: string;
  /** Minimum acceptable output amount (slippage protection), decimal string. */
  readonly minAmountOut: string;
}

/** Swap via the AMM. Requires active key. */
export function swapTokens({ tokenPair, tokenSymbol, tokenAmount, minAmountOut }: SwapTokensInput): EngineAction {
  return {
    contractName: MARKET_POOLS_CONTRACT,
    contractAction: "swapTokens",
    contractPayload: { tokenPair, tokenSymbol, tokenAmount, minAmountOut },
  };
}
