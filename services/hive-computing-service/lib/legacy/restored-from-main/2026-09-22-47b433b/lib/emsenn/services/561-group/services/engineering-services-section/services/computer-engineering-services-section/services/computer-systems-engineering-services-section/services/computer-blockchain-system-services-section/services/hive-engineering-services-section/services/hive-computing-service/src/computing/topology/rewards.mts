/**
 * rewards — the Hive reward pool's quantitative laws, as ruled 2026-06-11:
 * a domain's math lives as subpath modules of its -topology package.
 *
 * Vote rshares/mana/value (HF20 mana accounting, HF25 linear curve), reward
 * pool assembly from already-fetched chain state, and the legacy asset-string
 * codec the chain states amounts in. No network, no floats in money paths:
 * bigint rshares and exact rational Amounts from @emsenn/computing-with-ledgers.
 * Companion subpaths: ./vesting (VESTS↔HP), ./curation (HF25 windows).
 */
export { ASSET_PLACES, parseLegacyAsset, formatLegacyAsset, expectCommodity } from "./asset.mjs";
export {
  HIVE_100_PERCENT, VOTING_MANA_REGENERATION_SECONDS, VOTE_DUST_THRESHOLD,
  DEFAULT_VOTE_POWER_RESERVE_RATE,
  maxManaFromVests, regeneratedMana, voteRshares, manaAfterVote,
  voteValueHive, hiveToHbd,
} from "./vote-value.mjs";
export type { ManaState, VoteCost, MedianPrice } from "./vote-value.mjs";
export { parseMedianPrice, assembleRewardPoolState } from "./reward-pool.mjs";
export type {
  RewardFund, LegacyPrice, FeedHistory, DynamicGlobalPropertiesState, RewardPoolState,
} from "./reward-pool.mjs";
