const MARKET_POOLS_CONTRACT = "marketpools";
/** Add liquidity to an existing pool (or create if new). Requires active key. */
export function addLiquidity({ tokenPair, baseQuantity, quoteQuantity }) {
    return {
        contractName: MARKET_POOLS_CONTRACT,
        contractAction: "addLiquidity",
        contractPayload: { tokenPair, baseQuantity, quoteQuantity },
    };
}
/** Remove liquidity by burning shares. Requires active key. */
export function removeLiquidity({ tokenPair, shares }) {
    return {
        contractName: MARKET_POOLS_CONTRACT,
        contractAction: "removeLiquidity",
        contractPayload: { tokenPair, shares },
    };
}
/** Swap via the AMM. Requires active key. */
export function swapTokens({ tokenPair, tokenSymbol, tokenAmount, minAmountOut }) {
    return {
        contractName: MARKET_POOLS_CONTRACT,
        contractAction: "swapTokens",
        contractPayload: { tokenPair, tokenSymbol, tokenAmount, minAmountOut },
    };
}
