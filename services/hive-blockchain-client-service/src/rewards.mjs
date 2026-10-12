// rewards — Hive's reward and resource rules as exact arithmetic: the VESTS/HIVE rate, voting
// mana (HF20 accounting), vote rshares and value under the linear HF25 curve, the reward pool
// assembled from already-fetched chain state, and the HF25 curation windows. No network, no
// floats in money paths: bigint rshares and exact rational amounts.
import { divide, ratIsZero, ratMultiply, rationalOfBigInts } from "@red-cup-engineering/exact-number-data-service/exact-number";
import { rationalUnits } from "@red-cup-engineering/exact-number-data-service/decimal-string";
import { gradeOf, graded, gradedScale, gradedValue, gradedZero } from "@red-cup-engineering/exact-number-data-service/graded";
import { expectCommodity, parseLegacyAsset } from "./asset.mjs";

// --- vesting ---
/** Compute the exact HIVE-per-VESTS rate from dynamic global properties. */
export function vestingRate(dgp) {
    const fund = expectCommodity(parseLegacyAsset(dgp.total_vesting_fund_hive), "HIVE");
    const shares = expectCommodity(parseLegacyAsset(dgp.total_vesting_shares), "VESTS");
    if (ratIsZero(gradedValue(shares)))
        throw new RangeError("hive rewards: total_vesting_shares is zero");
    return divide(gradedValue(fund), gradedValue(shares));
}
/** Convert VESTS → HP (HIVE) exactly. Accepts an Amount or a legacy string. */
export function vestsToHp(vests, rate) {
    const v = expectCommodity(typeof vests === "string" ? parseLegacyAsset(vests) : vests, "VESTS");
    return graded(ratMultiply(gradedValue(v), rate), "HIVE");
}
/** Convert HP (HIVE) → VESTS exactly. Accepts an Amount or a legacy string. */
export function hpToVests(hp, rate) {
    const h = expectCommodity(typeof hp === "string" ? parseLegacyAsset(hp) : hp, "HIVE");
    if (ratIsZero(rate))
        throw new RangeError("hive rewards: vesting rate is zero");
    return graded(divide(gradedValue(h), rate), "VESTS");
}
export function createVestingRateCache() {
    const rates = new Map();
    return {
        get: (key) => rates.get(key),
        put: (key, dgp) => {
            const cached = rates.get(key);
            if (cached)
                return cached;
            const rate = vestingRate(dgp);
            rates.set(key, rate);
            return rate;
        },
    };
}

// --- voting mana and vote value ---
export const HIVE_100_PERCENT = 10000n;
/** Voting mana regenerates from 0 to max in exactly 5 days. */
export const VOTING_MANA_REGENERATION_SECONDS = 432000n;
/** Subtracted from every vote's used mana before it becomes rshares. */
export const VOTE_DUST_THRESHOLD = 50000000n;
/** dgp.vote_power_reserve_rate on mainnet since HF19 ("10 full votes per day"). */
export const DEFAULT_VOTE_POWER_RESERVE_RATE = 10;
const SECONDS_PER_DAY = 86400n;
/**
 * Max voting mana is the account's effective vesting shares expressed in
 * VESTS satoshis (6 decimal places). Effective shares = own + received
 * delegations − delegated out − power-down adjustment; callers compute that
 * from already-fetched account state.
 */
export function maxManaFromVests(vests) {
    const v = expectCommodity(typeof vests === "string" ? parseLegacyAsset(vests) : vests, "VESTS");
    return rationalUnits(gradedValue(v), 6, { rounding: "toward-zero" });
}
/**
 * Linear mana regeneration: current + max × elapsed / 432000, clamped to max.
 * Reaches exactly max at elapsedSeconds ≥ 432000 (5 days).
 */
export function regeneratedMana({ currentMana, maxMana, elapsedSeconds }) {
    const elapsed = BigInt(elapsedSeconds);
    if (elapsed < 0n)
        throw new RangeError("hive rewards: negative elapsedSeconds");
    const next = currentMana + (maxMana * elapsed) / VOTING_MANA_REGENERATION_SECONDS;
    return next > maxMana ? maxMana : next;
}
/**
 * HF20+ vote cost. `weightBps` is the vote weight in basis points
 * (10000 = 100% upvote; sign is ignored — downvote mana subtleties with the
 * separate downvote pool are not modeled here).
 */
export function voteRshares({ currentMana, weightBps, votePowerReserveRate = DEFAULT_VOTE_POWER_RESERVE_RATE, }) {
    const absW = BigInt(Math.abs(weightBps));
    if (absW > HIVE_100_PERCENT)
        throw new RangeError("hive rewards: |weightBps| must be ≤ 10000");
    // Chain order of operations: multiply, divide by HIVE_100_PERCENT, then ceil-divide.
    const scaled = (currentMana * absW * SECONDS_PER_DAY) / HIVE_100_PERCENT;
    const maxVoteDenom = BigInt(votePowerReserveRate) * VOTING_MANA_REGENERATION_SECONDS;
    const usedMana = (scaled + maxVoteDenom - 1n) / maxVoteDenom;
    const r = usedMana - VOTE_DUST_THRESHOLD;
    return { usedMana, rshares: r > 0n ? r : 0n };
}
/** Voting-power decay per vote: the manabar after casting a vote (~1/50 of current mana for a full vote). */
export function manaAfterVote(state) {
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
export function voteValueHive({ rshares, rewardBalance, recentClaims, }) {
    if (recentClaims <= 0n)
        throw new RangeError("hive rewards: recentClaims must be positive");
    return gradedScale(rewardBalance, rationalOfBigInts(BigInt(rshares), BigInt(recentClaims)));
}
/** Convert a HIVE amount to HBD at the median feed price: hbd = hive × base / quote. */
export function hiveToHbd(hive, median) {
    expectCommodity(hive, gradeOf(median.quote));
    if (ratIsZero(gradedValue(median.quote)))
        throw new RangeError("hive rewards: median price quote is zero");
    return graded(divide(ratMultiply(gradedValue(hive), gradedValue(median.base)), gradedValue(median.quote)), gradeOf(median.base));
}

/** Effective vesting shares in raw VESTS units (6 places): own + received − delegated out. */
export function effectiveVestingShares(account) {
    const raw = (text) => maxManaFromVests(text);
    return raw(account.vesting_shares) + raw(account.received_vesting_shares) - raw(account.delegated_vesting_shares);
}
/** An account's voting mana at `nowSeconds`, regenerated from its voting_manabar; max mana is its effective vesting shares. */
export function currentVotingMana(account, nowSeconds) {
    const maxMana = effectiveVestingShares(account);
    const currentMana = regeneratedMana({
        currentMana: BigInt(account.voting_manabar.current_mana),
        maxMana,
        elapsedSeconds: Math.max(0, Math.floor(nowSeconds) - account.voting_manabar.last_update_time),
    });
    return { currentMana, maxMana };
}

// --- reward pool ---
/** Parse a legacy price into exact rationals. */
export function parseMedianPrice(price) {
    return {
        base: parseLegacyAsset(price.base),
        quote: parseLegacyAsset(price.quote),
    };
}
/**
 * Build a RewardPoolState from already-fetched chain state. The math in
 * vote-value and curation rules here assume linear curves (mainnet post-HF25);
 * assembly throws if the fund reports anything else so stale assumptions
 * fail loudly rather than silently miscomputing.
 */
export function assembleRewardPoolState({ rewardFund, dynamicGlobalProperties, feedHistory, medianPrice, }) {
    if (rewardFund.author_reward_curve !== "linear" || rewardFund.curation_reward_curve !== "linear") {
        throw new Error(`hive rewards: only linear reward curves are supported (got author=${rewardFund.author_reward_curve}, curation=${rewardFund.curation_reward_curve})`);
    }
    const rewardBalance = expectCommodity(parseLegacyAsset(rewardFund.reward_balance), "HIVE");
    if (!/^\d+$/.test(rewardFund.recent_claims)) {
        throw new Error(`hive rewards: unparseable recent_claims "${rewardFund.recent_claims}"`);
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

// --- HF25 curation windows ---
export const REVERSE_AUCTION_SECONDS = 0; // disabled since HF25
export const EARLY_VOTING_SECONDS = 86_400; // 24h, full weight
export const MID_VOTING_SECONDS = 172_800; // following 48h, weight ÷ 2
export const MID_WINDOW_PENALTY = 2n;
export const LATE_WINDOW_PENALTY = 8n;
export const CASHOUT_WINDOW_SECONDS = 604_800; // 7 days
export const UPVOTE_LOCKOUT_SECONDS = 43_200; // final 12h before payout
/** Which HF25 curation window a vote at `secondsSinceCreation` falls into. */
export function curationWindow(secondsSinceCreation) {
    if (secondsSinceCreation < 0)
        throw new RangeError("hive rewards: negative secondsSinceCreation");
    if (secondsSinceCreation >= CASHOUT_WINDOW_SECONDS)
        return "closed";
    if (secondsSinceCreation < EARLY_VOTING_SECONDS)
        return "early";
    if (secondsSinceCreation < EARLY_VOTING_SECONDS + MID_VOTING_SECONDS)
        return "mid";
    return "late";
}
/** The divisor applied to a vote's curation weight in each window (1, 2, 8; 0 weight when closed). */
export function curationPenaltyDivisor(window) {
    switch (window) {
        case "early": return 1n;
        case "mid": return MID_WINDOW_PENALTY;
        case "late": return LATE_WINDOW_PENALTY;
        case "closed": return 0n;
    }
}
/** Whether a vote can earn curation rewards at all. */
export function isCurationEligible({ rshares, secondsSinceCreation, allowsCurationRewards = true, percentCurationRewards = 5000, }) {
    return (rshares > 0n &&
        allowsCurationRewards &&
        percentCurationRewards > 0 &&
        curationWindow(secondsSinceCreation) !== "closed");
}
/**
 * A vote's curation weight under the linear post-HF25 curve.
 * `commentRsharesBefore` is the comment's accumulated positive rshares before
 * this vote landed (0 for the first vote); the weight is the marginal claim
 * W(after) − W(before) = voteRshares for the linear curve, then window-penalized.
 */
export function voteCurationWeight({ voteRshares, secondsSinceCreation, commentRsharesBefore = 0n, }) {
    if (voteRshares <= 0n)
        return 0n; // downvotes and dust earn no curation
    const before = commentRsharesBefore < 0n ? 0n : commentRsharesBefore;
    const after = before + voteRshares;
    const marginal = after - before; // linear curve: W(R) = R
    const divisor = curationPenaltyDivisor(curationWindow(secondsSinceCreation));
    if (divisor === 0n)
        return 0n;
    return marginal / divisor;
}
/**
 * Split a curation pool proportionally by vote weight. Exact rational shares:
 * the returned amounts sum to exactly `curationPool` in rational arithmetic
 * (each share is pool × wᵢ / Σw). A zero total weight yields all-zero shares.
 */
export function curationShares({ weights, curationPool, }) {
    let total = 0n;
    for (const w of weights) {
        if (w < 0n)
            throw new RangeError("hive rewards: negative curation weight");
        total += w;
    }
    if (total === 0n)
        return weights.map(() => gradedZero(gradeOf(curationPool)));
    return weights.map((w) => gradedScale(curationPool, rationalOfBigInts(w, total)));
}
/** The curation pool for a comment payout: payout × percentCurationRewards / 10000, exact. */
export function curationPool(commentPayout, percentCurationRewards) {
    if (percentCurationRewards < 0 || percentCurationRewards > 10000) {
        throw new RangeError("hive rewards: percentCurationRewards must be within [0, 10000]");
    }
    return gradedScale(commentPayout, rationalOfBigInts(BigInt(percentCurationRewards), 10000n));
}

// --- the value of a curation vote ---

/** The chain's HBD per rshare: reward_balance / recent_claims HIVE, at the median price. */
export function chainHbdPerRshare(pool) {
    if (!pool.medianPrice) throw new Error("hive rewards: the reward pool carries no median price");
    return gradedValue(hiveToHbd(gradedScale(pool.rewardBalance, rationalOfBigInts(1n, pool.recentClaims)), pool.medianPrice));
}

/** HBD per rshare as a community actually realizes it: pending payout per net rshare of its recent posts. */
export function observedHbdPerRshare({ pendingPayoutHbd, netRshares }) {
    const payout = expectCommodity(typeof pendingPayoutHbd === "string" ? parseLegacyAsset(`${pendingPayoutHbd} HBD`) : pendingPayoutHbd, "HBD");
    if (BigInt(netRshares) <= 0n) return null;
    return divide(gradedValue(payout), rationalOfBigInts(BigInt(netRshares), 1n));
}

/**
 * The expected curation reward of one vote, in HBD. Under the linear HF25 curves the curation pool
 * is percentCurationRewards of the post's payout and is split by curation weight, and every vote's
 * weight is its rshares divided by its window penalty; later votes add to the pool and to the total
 * weight in proportion. So a vote earns its window-penalized weight, valued at the price per rshare
 * its post realizes, times the curation percentage. `hbdPerRshare` is that price: the chain's
 * (chainHbdPerRshare), or a community's observed one (observedHbdPerRshare) where one is known.
 * @returns {{eligible, window, usedMana, rshares, curationWeight, expectedHbd}}
 */
export function expectedCurationReward({
    currentMana, weightBps, secondsSinceCreation, hbdPerRshare,
    allowsCurationRewards = true, percentCurationRewards = 5000, votePowerReserveRate = DEFAULT_VOTE_POWER_RESERVE_RATE,
}) {
    const { usedMana, rshares } = voteRshares({ currentMana, weightBps, votePowerReserveRate });
    const window = curationWindow(Math.max(0, secondsSinceCreation));
    const eligible = isCurationEligible({ rshares, secondsSinceCreation: Math.max(0, secondsSinceCreation), allowsCurationRewards, percentCurationRewards });
    const curationWeight = eligible ? voteCurationWeight({ voteRshares: rshares, secondsSinceCreation: Math.max(0, secondsSinceCreation) }) : 0n;
    const expectedHbd = graded(ratMultiply(rationalOfBigInts(curationWeight * BigInt(percentCurationRewards), 10000n), hbdPerRshare), "HBD");
    return Object.freeze({ eligible, window, usedMana, rshares, curationWeight, expectedHbd });
}

/** The price a curation vote is valued at, from already-fetched chain state: HBD per rshare,
 *  the curation percentage and the vote reserve rate. */
export function curationPriceOf({ rewardFund, dynamicGlobalProperties, medianPrice }) {
    const pool = assembleRewardPoolState({ rewardFund, dynamicGlobalProperties, medianPrice });
    return Object.freeze({ hbdPerRshare: chainHbdPerRshare(pool), percentCurationRewards: pool.percentCurationRewards, votePowerReserveRate: pool.votePowerReserveRate });
}
