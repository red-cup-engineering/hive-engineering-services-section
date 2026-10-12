// curation — HF25+ curation-window eligibility and proportional curation shares.
//
// HF25 rules, verified 2026-06-11 against the chain sources:
//   - openhive-network/hive libraries/protocol/include/hive/protocol/config.hpp:
//       HIVE_REVERSE_AUCTION_WINDOW_SECONDS_HF25 = 0   (reverse auction disabled)
//       HIVE_EARLY_VOTING_SECONDS_HF25 = 24*60*60      (first 24h: full weight)
//       HIVE_MID_VOTING_SECONDS_HF25   = 48*60*60      (next 48h)
//       HIVE_CASHOUT_WINDOW_SECONDS    = 7 days
//       HIVE_UPVOTE_LOCKOUT_SECONDS    = 12 hours
//   - openhive-network/hive libraries/chain/hive_evaluator_social.cpp
//     (hf20_vote_evaluator): a vote's curation weight is
//     W(R_after) − W(R_before) under the reward fund's curation curve —
//     linear on mainnet post-HF25, so the weight is just the vote's rshares —
//     then divided by `phase_1_factor = 2` in the mid window
//     [24h, 24h+48h) and by `phase_2_factor = 8` from 72h until payout.
//     (The factors are "chosen empirically" per the source comment.)
//
// The curation pool itself is percent_curation_rewards (5000 bps = 50% on the
// mainnet post fund) of the comment's payout; each eligible voter receives a
// share proportional to their vote weight over the comment's total vote
// weight. The 12-hour upvote-lockout rshares scaling and the dust threshold
// apply when the vote's rshares are computed (see vote-value.mts), not here.
import type { Amount } from "@emsenn/animating/becoming/doing/working/accounting";
import { scale, rational, zero } from "@emsenn/animating/becoming/doing/working/accounting";

export const REVERSE_AUCTION_SECONDS = 0; // disabled since HF25
export const EARLY_VOTING_SECONDS = 86_400; // 24h, full weight
export const MID_VOTING_SECONDS = 172_800; // following 48h, weight ÷ 2
export const MID_WINDOW_PENALTY = 2n;
export const LATE_WINDOW_PENALTY = 8n;
export const CASHOUT_WINDOW_SECONDS = 604_800; // 7 days
export const UPVOTE_LOCKOUT_SECONDS = 43_200; // final 12h before payout

export type CurationWindow = "early" | "mid" | "late" | "closed";

/** Which HF25 curation window a vote at `secondsSinceCreation` falls into. */
export function curationWindow(secondsSinceCreation: number): CurationWindow {
  if (secondsSinceCreation < 0) throw new RangeError("hive-topology: negative secondsSinceCreation");
  if (secondsSinceCreation >= CASHOUT_WINDOW_SECONDS) return "closed";
  if (secondsSinceCreation < EARLY_VOTING_SECONDS) return "early";
  if (secondsSinceCreation < EARLY_VOTING_SECONDS + MID_VOTING_SECONDS) return "mid";
  return "late";
}

/** The divisor applied to a vote's curation weight in each window (1, 2, 8; 0 weight when closed). */
export function curationPenaltyDivisor(window: CurationWindow): bigint {
  switch (window) {
    case "early": return 1n;
    case "mid": return MID_WINDOW_PENALTY;
    case "late": return LATE_WINDOW_PENALTY;
    case "closed": return 0n;
  }
}

/** Whether a vote can earn curation rewards at all. */
export function isCurationEligible({
  rshares,
  secondsSinceCreation,
  allowsCurationRewards = true,
  percentCurationRewards = 5000,
}: {
  readonly rshares: bigint;
  readonly secondsSinceCreation: number;
  readonly allowsCurationRewards?: boolean;
  readonly percentCurationRewards?: number;
}): boolean {
  return (
    rshares > 0n &&
    allowsCurationRewards &&
    percentCurationRewards > 0 &&
    curationWindow(secondsSinceCreation) !== "closed"
  );
}

/**
 * A vote's curation weight under the linear post-HF25 curve.
 * `commentRsharesBefore` is the comment's accumulated positive rshares before
 * this vote landed (0 for the first vote); the weight is the marginal claim
 * W(after) − W(before) = voteRshares for the linear curve, then window-penalized.
 */
export function voteCurationWeight({
  voteRshares,
  secondsSinceCreation,
  commentRsharesBefore = 0n,
}: {
  readonly voteRshares: bigint;
  readonly secondsSinceCreation: number;
  readonly commentRsharesBefore?: bigint;
}): bigint {
  if (voteRshares <= 0n) return 0n; // downvotes and dust earn no curation
  const before = commentRsharesBefore < 0n ? 0n : commentRsharesBefore;
  const after = before + voteRshares;
  const marginal = after - before; // linear curve: W(R) = R
  const divisor = curationPenaltyDivisor(curationWindow(secondsSinceCreation));
  if (divisor === 0n) return 0n;
  return marginal / divisor;
}

/**
 * Split a curation pool proportionally by vote weight. Exact rational shares:
 * the returned amounts sum to exactly `curationPool` in rational arithmetic
 * (each share is pool × wᵢ / Σw). A zero total weight yields all-zero shares.
 */
export function curationShares({
  weights,
  curationPool,
}: {
  readonly weights: readonly bigint[];
  readonly curationPool: Amount;
}): Amount[] {
  let total = 0n;
  for (const w of weights) {
    if (w < 0n) throw new RangeError("hive-topology: negative curation weight");
    total += w;
  }
  if (total === 0n) return weights.map(() => zero(curationPool.commodity));
  return weights.map((w) => scale(curationPool, rational(w, total)));
}

/** The curation pool for a comment payout: payout × percentCurationRewards / 10000, exact. */
export function curationPool(commentPayout: Amount, percentCurationRewards: number): Amount {
  if (percentCurationRewards < 0 || percentCurationRewards > 10000) {
    throw new RangeError("hive-topology: percentCurationRewards must be within [0, 10000]");
  }
  return scale(commentPayout, rational(BigInt(percentCurationRewards), 10_000n));
}
