// nft — builders for the Hive Engine "nft" contract (transfer, issue) and the
// "nftmarket" contract (sell, cancel, buy). Each returns an EngineAction.
//
// Payload shapes verified against hive-engine/steemsmartcontracts
// contracts/nft.js and contracts/nftmarket.js. Note the asymmetry: the nft
// contract's transfer takes `nfts` as [{ symbol, ids }] (multi-collection),
// while nftmarket actions take a single `symbol` plus `nfts` as a flat array
// of instance-id strings.
import type { EngineAction } from "./core.mjs";

const NFT_CONTRACT = "nft";
const NFT_MARKET_CONTRACT = "nftmarket";

/** NFT instances of one collection: instance ids are numeric strings. */
export interface NftIdGroup {
  readonly symbol: string;
  readonly ids: readonly string[];
}

export interface NftTransferInput {
  readonly to: string;
  readonly nfts: readonly NftIdGroup[];
}

/** Transfer NFT instances (possibly across collections) to another account. */
export function nftTransfer({ to, nfts }: NftTransferInput): EngineAction {
  return {
    contractName: NFT_CONTRACT,
    contractAction: "transfer",
    contractPayload: { to, nfts: nfts.map(({ symbol, ids }) => ({ symbol, ids: [...ids] })) },
  };
}

export interface NftIssueInput {
  readonly symbol: string;
  readonly to: string;
  /** Token symbol used to pay the issuance fee (e.g. "BEE"). */
  readonly feeSymbol: string;
  /** Optional map of token symbol → quantity (decimal string) to lock in the instance. */
  readonly lockTokens?: Readonly<Record<string, string>>;
  /** Optional data-property values for the new instance. */
  readonly properties?: Readonly<Record<string, unknown>>;
}

/** Issue one NFT instance (sender must be authorized to issue for the collection). */
export function nftIssue({ symbol, to, feeSymbol, lockTokens, properties }: NftIssueInput): EngineAction {
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

export interface NftMarketSellInput {
  readonly symbol: string;
  /** Instance ids (numeric strings) to list. */
  readonly nfts: readonly string[];
  /** Asking price per instance, as a decimal string. */
  readonly price: string;
  /** Token symbol the price is denominated in (e.g. "SWAP.HIVE"). */
  readonly priceSymbol: string;
  /** Market fee in basis points (0–10000). */
  readonly fee: number;
}

/** List NFT instances for sale on the nftmarket contract. */
export function nftMarketSell({ symbol, nfts, price, priceSymbol, fee }: NftMarketSellInput): EngineAction {
  return {
    contractName: NFT_MARKET_CONTRACT,
    contractAction: "sell",
    contractPayload: { symbol, nfts: [...nfts], price, priceSymbol, fee },
  };
}

export interface NftMarketCancelInput {
  readonly symbol: string;
  /** Instance ids (numeric strings) whose listings to cancel. */
  readonly nfts: readonly string[];
}

/** Cancel open nftmarket listings. */
export function nftMarketCancel({ symbol, nfts }: NftMarketCancelInput): EngineAction {
  return {
    contractName: NFT_MARKET_CONTRACT,
    contractAction: "cancel",
    contractPayload: { symbol, nfts: [...nfts] },
  };
}

export interface NftMarketBuyInput {
  readonly symbol: string;
  /** Instance ids (numeric strings) to buy. */
  readonly nfts: readonly string[];
  /** Account credited with the market (agent) fee, e.g. the front-end's account. */
  readonly marketAccount: string;
  /** Optional price-protection cap: max total price as a decimal string. */
  readonly expPrice?: string;
  /** Optional price-protection cap: token symbol expPrice is denominated in. */
  readonly expPriceSymbol?: string;
}

/** Buy listed NFT instances from the nftmarket contract. */
export function nftMarketBuy({ symbol, nfts, marketAccount, expPrice, expPriceSymbol }: NftMarketBuyInput): EngineAction {
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
