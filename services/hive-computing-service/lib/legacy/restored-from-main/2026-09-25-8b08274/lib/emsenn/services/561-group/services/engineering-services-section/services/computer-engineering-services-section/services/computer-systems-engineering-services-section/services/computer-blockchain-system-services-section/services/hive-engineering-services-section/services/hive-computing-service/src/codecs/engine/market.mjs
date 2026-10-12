const MARKET_CONTRACT = "market";
/** Place a limit buy order. */
export function marketLimitBuy({ symbol, quantity, price }) {
    return {
        contractName: MARKET_CONTRACT,
        contractAction: "buy",
        contractPayload: { symbol, quantity, price },
    };
}
/** Place a limit sell order. */
export function marketLimitSell({ symbol, quantity, price }) {
    return {
        contractName: MARKET_CONTRACT,
        contractAction: "sell",
        contractPayload: { symbol, quantity, price },
    };
}
/** Cancel an open order by its txID. */
export function marketCancel({ type, id }) {
    return {
        contractName: MARKET_CONTRACT,
        contractAction: "cancel",
        contractPayload: { type, id },
    };
}
/** Market buy: spend `quantity` SWAP.HIVE against the best asks. */
export function marketSwapBuy({ symbol, quantity }) {
    return {
        contractName: MARKET_CONTRACT,
        contractAction: "marketBuy",
        contractPayload: { symbol, quantity },
    };
}
/** Market sell: sell `quantity` tokens into the best bids. */
export function marketSwapSell({ symbol, quantity }) {
    return {
        contractName: MARKET_CONTRACT,
        contractAction: "marketSell",
        contractPayload: { symbol, quantity },
    };
}
