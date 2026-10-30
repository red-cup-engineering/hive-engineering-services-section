/**
 * @emsenn/computing-with-hive-codecs/engine — zero-dependency Hive Engine sidechain codecs.
 *
 * Hive Engine actions are custom_json operations on Hive L1 with id
 * "ssc-mainnet-hive" and payload { contractName, contractAction,
 * contractPayload }. The engine core has the types, formatAmount, and the
 * wrappers that produce hive-codecs Operation tuples (required_auths =
 * ACTIVE authority). The tokens/market/nft/pools modules hold per-contract
 * builders; they are exported as namespaces here (their builder names overlap),
 * or import them directly via the ./engine/tokens, ./engine/market,
 * ./engine/nft, ./engine/pools subpaths.
 */
// ---------- engine core ----------
export { SSC_MAINNET_HIVE, enginePayload, engineCustomJson, formatAmount } from "./engine/core.mjs";
// ---------- contract builders ----------
export * as tokens from "./engine/tokens.mjs";
export * as market from "./engine/market.mjs";
export * as nft from "./engine/nft.mjs";
export * as pools from "./engine/pools.mjs";
