// chain — Hive read methods over an RpcClient.
import { deriveReferenceBlock } from "./codecs/index.mjs";
import type {
  DynamicGlobalPropertiesState,
  FeedHistory as RewardFeedHistory,
  LegacyPrice,
  RewardFund as RewardFundState,
} from "./computing/topology/rewards.mjs";
import type { RpcClient } from "./rpc.mjs";

export type { LegacyPrice };

export interface DynamicGlobalProperties extends DynamicGlobalPropertiesState {
  readonly head_block_number: number;
  readonly head_block_id: string;
  readonly time: string;
  readonly [key: string]: unknown;
}

export interface HiveAccount {
  readonly name: string;
  readonly balance: string;
  readonly hbd_balance: string;
  readonly vesting_shares: string;
  readonly reward_hive_balance: string;
  readonly reward_hbd_balance: string;
  readonly reward_vesting_balance: string;
  readonly posting_json_metadata?: string;
  readonly json_metadata?: string;
  readonly [key: string]: unknown;
}

export interface RankedPostsOptions {
  readonly sort: string;
  readonly tag?: string | undefined;
  readonly observer?: string | undefined;
  readonly limit?: number | undefined;
  readonly start_author?: string | undefined;
  readonly start_permlink?: string | undefined;
}

export interface AccountPostsOptions {
  readonly sort?: string | undefined;
  readonly account: string;
  readonly limit?: number | undefined;
  readonly start_author?: string | undefined;
  readonly start_permlink?: string | undefined;
  readonly observer?: string | undefined;
}

export async function getDynamicGlobalProperties(rpc: RpcClient): Promise<DynamicGlobalProperties> {
  return rpc.call<DynamicGlobalProperties>("condenser_api.get_dynamic_global_properties", []);
}

export async function getReferenceBlockData(rpc: RpcClient): Promise<{
  ref_block_num: number;
  ref_block_prefix: number;
  time: string;
  head_block_number: number;
}> {
  const dgp = await getDynamicGlobalProperties(rpc);
  const { ref_block_num, ref_block_prefix } = deriveReferenceBlock(dgp.head_block_number, dgp.head_block_id);
  return { ref_block_num, ref_block_prefix, time: dgp.time, head_block_number: dgp.head_block_number };
}

export async function getAccounts(rpc: RpcClient, names: readonly string[]): Promise<HiveAccount[]> {
  return rpc.call<HiveAccount[]>("condenser_api.get_accounts", [[...names]]);
}

/**
 * Reverse key index: for each public key, which accounts list it in an
 * authority. Covers owner/active/posting (NOT memo keys — those are not
 * indexed; match memo keys against get_accounts authorities instead).
 */
export async function getKeyReferences(rpc: RpcClient, keys: readonly string[]): Promise<string[][]> {
  if (keys.length === 0) return [];
  const result = await rpc.call<{ accounts: string[][] }>(
    "account_by_key_api.get_key_references",
    { keys: [...keys] },
  );
  return result.accounts;
}

export async function getContent(rpc: RpcClient, author: string, permlink: string): Promise<unknown> {
  return rpc.call("condenser_api.get_content", [author, permlink]);
}

export async function getPost(
  rpc: RpcClient,
  { author, permlink, observer }: { author: string; permlink: string; observer?: string },
): Promise<unknown> {
  return rpc.call("bridge.get_post", { author, permlink, observer: observer ?? "" });
}

export async function getRankedPosts(rpc: RpcClient, opts: RankedPostsOptions): Promise<unknown[]> {
  return rpc.call<unknown[]>("bridge.get_ranked_posts", {
    sort: opts.sort,
    tag: opts.tag ?? "",
    observer: opts.observer ?? "",
    limit: opts.limit,
    start_author: opts.start_author,
    start_permlink: opts.start_permlink,
  });
}

export async function getAccountPosts(rpc: RpcClient, opts: AccountPostsOptions): Promise<unknown[]> {
  return rpc.call<unknown[]>("bridge.get_account_posts", {
    sort: opts.sort ?? "blog",
    account: opts.account,
    limit: opts.limit,
    start_author: opts.start_author,
    start_permlink: opts.start_permlink,
    observer: opts.observer ?? "",
  });
}

export async function getProfile(
  rpc: RpcClient,
  { account, observer }: { account: string; observer?: string },
): Promise<unknown> {
  return rpc.call("bridge.get_profile", { account, observer: observer ?? "" });
}

export async function getFollowCount(rpc: RpcClient, account: string): Promise<unknown> {
  return rpc.call("condenser_api.get_follow_count", [account]);
}

export async function getFollowers(
  rpc: RpcClient,
  account: string,
  start?: string,
  type?: string,
  limit?: number,
): Promise<unknown[]> {
  return rpc.call<unknown[]>("condenser_api.get_followers", [account, start ?? "", type ?? "blog", limit ?? 1000]);
}

export async function getFollowing(
  rpc: RpcClient,
  account: string,
  start?: string,
  type?: string,
  limit?: number,
): Promise<unknown[]> {
  return rpc.call<unknown[]>("condenser_api.get_following", [account, start ?? "", type ?? "blog", limit ?? 1000]);
}

export async function getAccountHistory(
  rpc: RpcClient,
  account: string,
  start?: number,
  limit?: number,
): Promise<unknown[]> {
  return rpc.call<unknown[]>("condenser_api.get_account_history", [account, start ?? -1, limit ?? 20]);
}

export interface OrderBookEntry {
  readonly order_price: LegacyPrice;
  readonly real_price: string;
  /** Raw HIVE amount in millis (integer; 17767 = 17.767 HIVE). */
  readonly hive: number;
  /** Raw HBD amount in millis (integer). */
  readonly hbd: number;
  readonly created: string;
}

export interface OrderBook {
  readonly bids: readonly OrderBookEntry[];
  readonly asks: readonly OrderBookEntry[];
}

export interface MarketTicker {
  readonly latest: string;
  readonly lowest_ask: string;
  readonly highest_bid: string;
  readonly percent_change: string;
  readonly hive_volume: string;
  readonly hbd_volume: string;
}

export interface MarketVolume {
  readonly hive_volume: string;
  readonly hbd_volume: string;
}

export interface MarketTrade {
  readonly date: string;
  readonly current_pays: string;
  readonly open_pays: string;
  readonly taker?: string;
  readonly maker?: string;
}

/** One side (HIVE or HBD) of a market-history bucket; raw integer amounts in millis. */
export interface MarketHistoryBucketSide {
  readonly high: number;
  readonly low: number;
  readonly open: number;
  readonly close: number;
  readonly volume: number;
}

export interface MarketHistoryBucket {
  readonly id: number;
  readonly open: string;
  readonly seconds: number;
  readonly hive: MarketHistoryBucketSide;
  readonly non_hive: MarketHistoryBucketSide;
}

export interface OpenOrder {
  readonly id: number;
  readonly created: string;
  readonly expiration: string;
  readonly seller: string;
  readonly orderid: number;
  /** Raw amount for sale in millis of the sell_price base asset. */
  readonly for_sale: number;
  readonly sell_price: LegacyPrice;
  readonly real_price: string;
  readonly [key: string]: unknown;
}

export interface ConversionRequest {
  readonly id: number;
  readonly owner: string;
  readonly requestid: number;
  readonly amount: string;
  readonly conversion_date: string;
}

export interface CollateralizedConversionRequest {
  readonly id: number;
  readonly owner: string;
  readonly requestid: number;
  readonly collateral_amount: string;
  readonly converted_amount: string;
  readonly conversion_date: string;
}

export interface SavingsWithdraw {
  readonly id: number;
  readonly from: string;
  readonly to: string;
  readonly memo: string;
  readonly request_id: number;
  readonly amount: string;
  readonly complete: string;
}

export interface VestingDelegation {
  readonly id: number;
  readonly delegator: string;
  readonly delegatee: string;
  readonly vesting_shares: string;
  readonly min_delegation_time: string;
}

export interface WithdrawRoute {
  readonly id: number;
  readonly from_account: string;
  readonly to_account: string;
  readonly percent: number;
  readonly auto_vest: boolean;
}

export interface ChainFeedHistory extends RewardFeedHistory {
  readonly id: number;
  readonly price_history: readonly LegacyPrice[];
  readonly [key: string]: unknown;
}

export interface ChainRewardFund extends RewardFundState {
  readonly id: number;
  readonly name: string;
  readonly last_update: string;
  readonly content_constant: string;
  readonly percent_content_rewards: number;
}

export async function getOrderBook(rpc: RpcClient, limit?: number): Promise<OrderBook> {
  return rpc.call<OrderBook>("condenser_api.get_order_book", [limit ?? 500]);
}

export async function getTicker(rpc: RpcClient): Promise<MarketTicker> {
  return rpc.call<MarketTicker>("condenser_api.get_ticker", []);
}

export async function getVolume(rpc: RpcClient): Promise<MarketVolume> {
  return rpc.call<MarketVolume>("condenser_api.get_volume", []);
}

export async function getTradeHistory(
  rpc: RpcClient,
  start: string,
  end: string,
  limit?: number,
): Promise<MarketTrade[]> {
  return rpc.call<MarketTrade[]>("condenser_api.get_trade_history", [start, end, limit ?? 1000]);
}

export async function getMarketHistory(
  rpc: RpcClient,
  bucketSeconds: number,
  start: string,
  end: string,
): Promise<MarketHistoryBucket[]> {
  const result = await rpc.call<{ buckets: MarketHistoryBucket[] }>("market_history_api.get_market_history", {
    bucket_seconds: bucketSeconds,
    start,
    end,
  });
  return result.buckets;
}

export async function getOpenOrders(rpc: RpcClient, account: string): Promise<OpenOrder[]> {
  return rpc.call<OpenOrder[]>("condenser_api.get_open_orders", [account]);
}

export async function getConversionRequests(rpc: RpcClient, account: string): Promise<ConversionRequest[]> {
  return rpc.call<ConversionRequest[]>("condenser_api.get_conversion_requests", [account]);
}

export async function getCollateralizedConversionRequests(
  rpc: RpcClient,
  account: string,
): Promise<CollateralizedConversionRequest[]> {
  return rpc.call<CollateralizedConversionRequest[]>("condenser_api.get_collateralized_conversion_requests", [account]);
}

export async function getSavingsWithdrawFrom(rpc: RpcClient, account: string): Promise<SavingsWithdraw[]> {
  return rpc.call<SavingsWithdraw[]>("condenser_api.get_savings_withdraw_from", [account]);
}

export async function getVestingDelegations(
  rpc: RpcClient,
  account: string,
  from?: string,
  limit?: number,
): Promise<VestingDelegation[]> {
  return rpc.call<VestingDelegation[]>("condenser_api.get_vesting_delegations", [account, from ?? "", limit ?? 1000]);
}

export async function getWithdrawRoutes(
  rpc: RpcClient,
  account: string,
  type?: string,
): Promise<WithdrawRoute[]> {
  return rpc.call<WithdrawRoute[]>("condenser_api.get_withdraw_routes", [account, type ?? "all"]);
}

export async function getCurrentMedianHistoryPrice(rpc: RpcClient): Promise<LegacyPrice> {
  return rpc.call<LegacyPrice>("condenser_api.get_current_median_history_price", []);
}

export async function getFeedHistory(rpc: RpcClient): Promise<ChainFeedHistory> {
  return rpc.call<ChainFeedHistory>("condenser_api.get_feed_history", []);
}

export async function getRewardFund(rpc: RpcClient, name?: string): Promise<ChainRewardFund> {
  return rpc.call<ChainRewardFund>("condenser_api.get_reward_fund", [name ?? "post"]);
}

export async function broadcastTransaction(rpc: RpcClient, tx: unknown): Promise<void> {
  await rpc.call("condenser_api.broadcast_transaction", [tx]);
}

export async function broadcastTransactionSynchronous(rpc: RpcClient, tx: unknown): Promise<unknown> {
  return rpc.call("condenser_api.broadcast_transaction_synchronous", [tx]);
}
