// vote-value — rshares, voting mana, and the HIVE/HBD value of a vote.
//
// Implements current Hive mainnet rules (HF20 mana accounting, HF25 linear
// reward curve), verified 2026-06-11 against the chain sources:
//   - openhive-network/hive libraries/protocol/include/hive/protocol/config.hpp
//     (HIVE_VOTING_MANA_REGENERATION_SECONDS = 432000, HIVE_VOTE_DUST_THRESHOLD
//      = 50000000, HIVE_100_PERCENT = 10000, HIVE_REDUCED_VOTE_POWER_RATE = 10)
//   - openhive-network/hive libraries/chain/hive_evaluator_social.cpp
//     (hf20_vote_evaluator: used_mana = current_mana × |weight| × 86400 / 10000,
//      then ceil-divided by vote_power_reserve_rate × 432000; rshares =
//      max(0, used_mana − dust); a full-power 100% vote therefore consumes
//      ~1/50 of current mana, and mana regenerates fully in 5 days.)
//
// All mana/rshares math is bigint; all money math is exact rational Amounts.
import type { Amount } from "@emsenn/animating/becoming/doing/working/accounting";
import { scale, rational, times } from "@emsenn/animating/becoming/doing/working/accounting";
import { expectCommodity, parseLegacyAsset } from "./asset.mjs";

export const HIVE_100_PERCENT = 10_000n;
/** Voting mana regenerates from 0 to max in exactly 5 days. */
export const VOTING_MANA_REGENERATION_SECONDS = 432_000n;
/** Subtracted from every vote's used mana before it becomes rshares. */
export const VOTE_DUST_THRESHOLD = 50_000_000n;
/** dgp.vote_power_reserve_rate on mainnet since HF19 ("10 full votes per day"). */
export const DEFAULT_VOTE_POWER_RESERVE_RATE = 10;
const SECONDS_PER_DAY = 86_400n;

/**
 * Max voting mana is the account's effective vesting shares expressed in
 * VESTS satoshis (6 decimal places). Effective shares = own + received
 * delegations − delegated out − power-down adjustment; callers compute that
 * from already-fetched account state.
 */
export function maxManaFromVests(vests: Amount | string): bigint {
  const v = expectCommodity(typeof vests === "string" ? parseLegacyAsset(vests) : vests, "VESTS");
  return (v.num * 1_000_000n) / v.den;
}

export interface ManaState {
  readonly currentMana: bigint;
  readonly maxMana: bigint;
}

/**
 * Linear mana regeneration: current + max × elapsed / 432000, clamped to max.
 * Reaches exactly max at elapsedSeconds ≥ 432000 (5 days).
 */
export function regeneratedMana({ currentMana, maxMana, elapsedSeconds }: ManaState & { readonly elapsedSeconds: number | bigint }): bigint {
  const elapsed = BigInt(elapsedSeconds);
  if (elapsed < 0n) throw new RangeError("hive-topology: negative elapsedSeconds");
  const next = currentMana + (maxMana * elapsed) / VOTING_MANA_REGENERATION_SECONDS;
  return next > maxMana ? maxMana : next;
}

export interface VoteCost {
  /** Mana deducted from the voter's manabar. */
  readonly usedMana: bigint;
  /** Reward shares contributed to the post (used mana minus the dust threshold, floored at 0). */
  readonly rshares: bigint;
}

/**
 * HF20+ vote cost. `weightBps` is the vote weight in basis points
 * (10000 = 100% upvote; sign is ignored — downvote mana subtleties with the
 * separate downvote pool are not modeled here).
 */
export function voteRshares({
  currentMana,
  weightBps,
  votePowerReserveRate = DEFAULT_VOTE_POWER_RESERVE_RATE,
}: {
  readonly currentMana: bigint;
  readonly weightBps: number;
  readonly votePowerReserveRate?: number;
}): VoteCost {
  const absW = BigInt(Math.abs(weightBps));
  if (absW > HIVE_100_PERCENT) throw new RangeError("hive-topology: |weightBps| must be ≤ 10000");
  // Chain order of operations: multiply, divide by HIVE_100_PERCENT, then ceil-divide.
  const scaled = (currentMana * absW * SECONDS_PER_DAY) / HIVE_100_PERCENT;
  const maxVoteDenom = BigInt(votePowerReserveRate) * VOTING_MANA_REGENERATION_SECONDS;
  const usedMana = (scaled + maxVoteDenom - 1n) / maxVoteDenom;
  const r = usedMana - VOTE_DUST_THRESHOLD;
  return { usedMana, rshares: r > 0n ? r : 0n };
}

/** Voting-power decay per vote: the manabar after casting a vote (~1/50 of current mana for a full vote). */
export function manaAfterVote(state: ManaState & { readonly weightBps: number; readonly votePowerReserveRate?: number }): bigint {
  const { usedMana } = voteRshares({
    currentMana: state.currentMana,
    weightBps: state.weightBps,
    ...(state.votePowerReserveRate !== undefined ? { votePowerReserveRate: state.votePowerReserveRate } : {}),
  });
  const next = state.currentMana - usedMana;
  return next > 0n ? next : 0n;
}

/**
 * HIVE value of rshares under the post-HF25 linear reward curve:
 * value = reward_balance × rshares / recent_claims. Exact rational; linearity
 * in rshares is exact (value(2r) = 2·value(r)).
 */
export function voteValueHive({
  rshares,
  rewardBalance,
  recentClaims,
}: {
  readonly rshares: bigint;
  readonly rewardBalance: Amount;
  readonly recentClaims: bigint;
}): Amount {
  if (recentClaims <= 0n) throw new RangeError("hive-topology: recentClaims must be positive");
  return scale(rewardBalance, rational(rshares, recentClaims));
}

/** Median feed price as exact rationals: `base` in HBD per `quote` in HIVE. */
export interface MedianPrice {
  readonly base: Amount;
  readonly quote: Amount;
}

/** Convert a HIVE amount to HBD at the median feed price: hbd = hive × base / quote. */
export function hiveToHbd(hive: Amount, median: MedianPrice): Amount {
  expectCommodity(hive, median.quote.commodity);
  if (median.quote.num === 0n) throw new RangeError("hive-topology: median price quote is zero");
  // hive × base / quote, via inherited primitives: multiply magnitudes into the
  // base commodity, then divide by the quote rational. Exact, same value as the
  // hand-rolled cross-multiply.
  return scale(times(hive, median.base, median.base.commodity), rational(median.quote.den, median.quote.num));
}
