// reward-pool — assemble a pure RewardPoolState from raw condenser_api shapes.
//
// This package never fetches anything: callers (e.g. apps/waggle) fetch
// condenser_api.get_reward_fund, get_dynamic_global_properties, and
// get_feed_history / get_current_median_history_price, then hand the raw
// objects here. The input interfaces below declare only the fields this
// package reads and use the chain's own field names and string encodings, so
// they are structurally compatible with waggle's chain types without this
// package depending on waggle.
import type { Amount } from "@emsenn/animating/becoming/doing/working/accounting";
import { expectCommodity, parseLegacyAsset } from "./asset.mjs";
import { vestingRate, type VestingPoolState, type VestingRate } from "./vesting.mjs";
import type { MedianPrice } from "./vote-value.mjs";

/** condenser_api.get_reward_fund("post") — the fields the math needs. */
export interface RewardFund {
  readonly reward_balance: string;
  readonly recent_claims: string;
  readonly percent_curation_rewards: number;
  readonly author_reward_curve: string;
  readonly curation_reward_curve: string;
}

/** Legacy price: { base: "0.048 HBD", quote: "1.000 HIVE" }. */
export interface LegacyPrice {
  readonly base: string;
  readonly quote: string;
}

/** condenser_api.get_feed_history — the field the math needs. */
export interface FeedHistory {
  readonly current_median_history: LegacyPrice;
}

/** Dynamic global properties slice: vesting pool plus voting parameters. */
export interface DynamicGlobalPropertiesState extends VestingPoolState {
  readonly vote_power_reserve_rate?: number;
  readonly early_voting_seconds?: number;
  readonly mid_voting_seconds?: number;
}

/** Everything the reward math needs, parsed once into exact values. */
export interface RewardPoolState {
  /** Reward fund balance (HIVE), exact. */
  readonly rewardBalance: Amount;
  /** recent_claims as an integer (sum of recent payout claims, rshares-scaled). */
  readonly recentClaims: bigint;
  /** Curation share of payouts in basis points (5000 = 50% on mainnet). */
  readonly percentCurationRewards: number;
  readonly authorRewardCurve: string;
  readonly curationRewardCurve: string;
  /** HIVE-per-VESTS, exact rational. */
  readonly vestingRate: VestingRate;
  /** Median HBD-per-HIVE feed price, exact; absent if no feed input was given. */
  readonly medianPrice?: MedianPrice;
  /** dgp.vote_power_reserve_rate (10 on mainnet since HF19). */
  readonly votePowerReserveRate: number;
}

/** Parse a legacy price into exact rationals. */
export function parseMedianPrice(price: LegacyPrice): MedianPrice {
  return {
    base: parseLegacyAsset(price.base),
    quote: parseLegacyAsset(price.quote),
  };
}

/**
 * Build a RewardPoolState from already-fetched chain state. The math in
 * vote-value.mts/curation.mts assumes linear curves (mainnet post-HF25);
 * assembly throws if the fund reports anything else so stale assumptions
 * fail loudly rather than silently miscomputing.
 */
export function assembleRewardPoolState({
  rewardFund,
  dynamicGlobalProperties,
  feedHistory,
  medianPrice,
}: {
  readonly rewardFund: RewardFund;
  readonly dynamicGlobalProperties: DynamicGlobalPropertiesState;
  readonly feedHistory?: FeedHistory;
  readonly medianPrice?: LegacyPrice;
}): RewardPoolState {
  if (rewardFund.author_reward_curve !== "linear" || rewardFund.curation_reward_curve !== "linear") {
    throw new Error(
      `hive-topology: only linear reward curves are supported (got author=${rewardFund.author_reward_curve}, curation=${rewardFund.curation_reward_curve})`,
    );
  }
  const rewardBalance = expectCommodity(parseLegacyAsset(rewardFund.reward_balance), "HIVE");
  if (!/^\d+$/.test(rewardFund.recent_claims)) {
    throw new Error(`hive-topology: unparseable recent_claims "${rewardFund.recent_claims}"`);
  }
  const price = medianPrice ?? feedHistory?.current_median_history;
  return {
    rewardBalance,
    recentClaims: BigInt(rewardFund.recent_claims),
    percentCurationRewards: rewardFund.percent_curation_rewards,
    authorRewardCurve: rewardFund.author_reward_curve,
    curationRewardCurve: rewardFund.curation_reward_curve,
    vestingRate: vestingRate(dynamicGlobalProperties),
    ...(price !== undefined ? { medianPrice: parseMedianPrice(price) } : {}),
    votePowerReserveRate: dynamicGlobalProperties.vote_power_reserve_rate ?? 10,
  };
}
