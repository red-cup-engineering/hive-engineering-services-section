const NFT_CONTRACT = "nft";
const NFT_MARKET_CONTRACT = "nftmarket";
/** Transfer NFT instances (possibly across collections) to another account. */
export function nftTransfer({ to, nfts }) {
    return {
        contractName: NFT_CONTRACT,
        contractAction: "transfer",
        contractPayload: { to, nfts: nfts.map(({ symbol, ids }) => ({ symbol, ids: [...ids] })) },
    };
}
/** Issue one NFT instance (sender must be authorized to issue for the collection). */
export function nftIssue({ symbol, to, feeSymbol, lockTokens, properties }) {
    return {
        contractName: NFT_CONTRACT,
        contractAction: "issue",
        contractPayload: {
            symbol,
            to,
            feeSymbol,
            ...(lockTokens === undefined ? {} : { lockTokens }),
            ...(properties === undefined ? {} : { properties }),
        },
    };
}
/** List NFT instances for sale on the nftmarket contract. */
export function nftMarketSell({ symbol, nfts, price, priceSymbol, fee }) {
    return {
        contractName: NFT_MARKET_CONTRACT,
        contractAction: "sell",
        contractPayload: { symbol, nfts: [...nfts], price, priceSymbol, fee },
    };
}
/** Cancel open nftmarket listings. */
export function nftMarketCancel({ symbol, nfts }) {
    return {
        contractName: NFT_MARKET_CONTRACT,
        contractAction: "cancel",
        contractPayload: { symbol, nfts: [...nfts] },
    };
}
/** Buy listed NFT instances from the nftmarket contract. */
export function nftMarketBuy({ symbol, nfts, marketAccount, expPrice, expPriceSymbol }) {
    return {
        contractName: NFT_MARKET_CONTRACT,
        contractAction: "buy",
        contractPayload: {
            symbol,
            nfts: [...nfts],
            marketAccount,
            ...(expPrice === undefined ? {} : { expPrice }),
            ...(expPriceSymbol === undefined ? {} : { expPriceSymbol }),
        },
    };
}
