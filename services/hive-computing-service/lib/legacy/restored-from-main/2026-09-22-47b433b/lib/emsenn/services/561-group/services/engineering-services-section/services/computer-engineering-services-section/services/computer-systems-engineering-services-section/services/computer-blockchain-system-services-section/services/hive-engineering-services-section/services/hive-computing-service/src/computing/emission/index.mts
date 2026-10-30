/**
 * emission — the faucet: share of per-block emission as an exact rational.
 *
 * The apex thesis (see docs/max-alpha.md): below the curation layers there is a
 * deeper source of alpha — Hive *mints new HIVE every block*. That mint is the
 * faucet. Max alpha is not only correcting mispricing in the attention field;
 * it is maximizing your **share of the per-block emission**, net of the cost of
 * holding that share. This module models Hive's actual inflation schedule and
 * the consensus split of each block's mint, exactly.
 *
 * Hive's inflation-narrowing schedule (matches the steem/hive consensus
 * constants `HIVE_INFLATION_*` in chain.cpp): the annual inflation rate began
 * at ~9.5% APR and decreases by 0.01 percentage point (one basis point,
 * 1/10000) every 250,000 blocks, with a floor of 0.95% APR. With 3-second
 * blocks there are 20·60·24·365 = 10,512,000 blocks per year. New HIVE minted at
 * a block is `virtualSupply · inflationRate / blocksPerYear`, and that mint is
 * split into four consensus buckets: 65% content reward pool, 15% vesting
 * reward, 10% witness pay, 10% proposal fund (DHF).
 *
 * Exact throughout: the schedule constants are built as ratios of integers, the
 * supply and stakes are rationals, so every emitted quantity is an exact
 * rational — science on the money, no floats.
 *
 * ── Upstream adaptation (verified against the real published .d.ts) ──────────
 * The architect spec called for `@emsenn/relating/algebra`'s `Rational`.
 * That type is a *unary Peano* construction: `fromInt(n)` builds n nested set
 * successors, so even `rational(fromInt(1), fromInt(10000))` — the 0.01pp
 * decrement, the smallest constant this module needs — exhausts the heap, and a
 * realistic `virtualSupply` (~4·10⁸) or `HIVE_BLOCKS_PER_YEAR` (10,512,000)
 * cannot be represented at all. The relationality exact-rational facility is
 * therefore unusable at Hive's magnitudes. We keep the spec's exact-rational
 * contract and symbol vocabulary verbatim, but back it with the *bigint*-exact
 * rational already shipped in `@emsenn/ledger` (`rational(num, den)` →
 * lowest-terms `{ num: bigint; den: bigint }`), which is already a `@emsenn/computing-with-hive`
 * dependency. Same names (`rational`, `fromInt`, `ratFromInt`, `ratAdd`,
 * `ratSubtract`, `ratMultiply`, `divide`, `ratCompare`, `ratSign`, `ratZero`,
 * `ratOne`, type `Rational`), same exact semantics, no floats — and it actually
 * runs. The thin bare-rational operations relationality would have provided are
 * realized here over the bigint pair.
 */
import { rational as ledgerRational } from "@emsenn/animating/becoming/doing/working/accounting";

/** An exact rational: a lowest-terms ratio of arbitrary-precision integers. The
 *  same shape and exactness the architecture asked for, backed by bigint so it
 *  is feasible at Hive's real supply/block magnitudes (no float, no Peano). */
export interface Rational {
  readonly num: bigint;
  readonly den: bigint;
}

/** An exact integer — the numerator/denominator carrier. */
export type Integer = bigint;

/** Build an integer from a JS number (whole values only — money is never a
 *  float). */
export const fromInt = (value: number): Integer => BigInt(Math.trunc(value));

/** Construct an exact rational num/den in lowest terms (den ≠ 0). */
export const rational = (num: Integer, den: Integer): Rational => {
  const r = ledgerRational(num, den);
  return Object.freeze({ num: r.num, den: r.den });
};

/** The exact rational equal to the integer `value`. */
export const ratFromInt = (value: number): Rational => rational(fromInt(value), fromInt(1));

/** Zero and one as exact rationals. */
export const ratZero: Rational = rational(0n, 1n);
export const ratOne: Rational = rational(1n, 1n);

/** left + right, exact. */
export const ratAdd = (left: Rational, right: Rational): Rational =>
  rational(left.num * right.den + right.num * left.den, left.den * right.den);

/** left − right, exact. */
export const ratSubtract = (left: Rational, right: Rational): Rational =>
  rational(left.num * right.den - right.num * left.den, left.den * right.den);

/** left · right, exact. */
export const ratMultiply = (left: Rational, right: Rational): Rational =>
  rational(left.num * right.num, left.den * right.den);

/** left / right, exact (right ≠ 0). This is the rational division the spec's
 *  `ratDivide-or-rational` resolves to. */
export const divide = (left: Rational, right: Rational): Rational =>
  rational(left.num * right.den, left.den * right.num);

/** The sign of a rational: −1, 0, or +1 (denominators are kept positive). */
export const ratSign = (q: Rational): -1 | 0 | 1 =>
  q.num === 0n ? 0 : q.num > 0n ? 1 : -1;

/** Compare two rationals: −1 if left < right, 0 if equal, +1 if greater. */
export const ratCompare = (left: Rational, right: Rational): -1 | 0 | 1 => {
  const lhs = left.num * right.den;
  const rhs = right.num * left.den;
  return lhs === rhs ? 0 : lhs < rhs ? -1 : 1;
};

/** The initial annual inflation rate at the start of the narrowing era: 9.5%
 *  APR = 950/10000 (kept exact in lowest terms, 19/200). */
export const HIVE_INITIAL_INFLATION_RATE: Rational = rational(fromInt(950), fromInt(10000));

/** The floor of the narrowing schedule: 0.95% APR = 95/10000 (19/2000). The
 *  rate never decreases below this no matter how large the head block. */
export const HIVE_INFLATION_FLOOR_RATE: Rational = rational(fromInt(95), fromInt(10000));

/** The rate decrement applied once per narrowing interval: 0.01 percentage
 *  point = one basis point = 1/10000, exact. */
export const HIVE_INFLATION_DECREASE_PER_INTERVAL: Rational = rational(fromInt(1), fromInt(10000));

/** Blocks between successive 0.01pp decrements of the inflation rate. */
export const HIVE_INFLATION_NARROWING_INTERVAL = 250000;

/** Blocks per year at 3-second blocks: 20·60·24·365 = 10,512,000. The divisor
 *  that turns an annual inflation rate into a per-block emission fraction. */
export const HIVE_BLOCKS_PER_YEAR = 20 * 60 * 24 * 365;

/**
 * The exact annual inflation rate in force at `headBlock`.
 *
 * Theorem (the narrowing schedule): with interval index n = ⌊headBlock /
 * 250000⌋, the rate is `max(floor, initial − n · 0.01pp)`. It equals the
 * initial 9.5% at block 0, strictly decreases by exactly one basis point at
 * each interval boundary, and clamps at the 0.95% floor forever after. Integer
 * division of the block count selects the interval, so the result is an exact
 * rational at every block.
 */
export function inflationRate(headBlock: number): Rational {
  const n = Math.max(0, Math.floor(headBlock / HIVE_INFLATION_NARROWING_INTERVAL));
  const decreased = ratSubtract(
    HIVE_INITIAL_INFLATION_RATE,
    ratMultiply(ratFromInt(n), HIVE_INFLATION_DECREASE_PER_INTERVAL),
  );
  // Clamp to the floor: the schedule never narrows below 0.95% APR.
  return ratCompare(decreased, HIVE_INFLATION_FLOOR_RATE) < 0
    ? HIVE_INFLATION_FLOOR_RATE
    : decreased;
}

/**
 * New HIVE minted at `headBlock` given the current `virtualSupply` — the faucet
 * flow.
 *
 * Theorem: per-block emission = virtualSupply · inflationRate(headBlock) /
 * blocksPerYear. An exact rational: the annual mint spread evenly across the
 * year's blocks.
 */
export function blockEmission(headBlock: number, virtualSupply: Rational): Rational {
  return divide(
    ratMultiply(virtualSupply, inflationRate(headBlock)),
    ratFromInt(HIVE_BLOCKS_PER_YEAR),
  );
}

/**
 * Your exact fraction of every block's emission, given your stake and the total
 * stake competing for it.
 *
 * Theorem: faucetShare = yourStake / totalStake — the exact rational share of
 * the faucet. Guard: if totalStake is zero there is no faucet to share, so the
 * share is exactly zero (rather than an undefined division).
 */
export function faucetShare(yourStake: Rational, totalStake: Rational): Rational {
  if (ratSign(totalStake) === 0) return ratZero;
  return divide(yourStake, totalStake);
}

/** Hive's consensus split of a block's emission, each bucket an exact rational
 *  fraction of the total — and, by construction, summing to the total. */
export interface EmissionSplit {
  readonly kind: "hive-emission.split";
  /** The whole per-block mint this split partitions. */
  readonly total: Rational;
  /** Content reward pool — 65% of the mint. */
  readonly contentReward: Rational;
  /** Vesting (HIVE Power) reward — 15% of the mint. */
  readonly vestingReward: Rational;
  /** Witness pay — 10% of the mint. */
  readonly witnessPay: Rational;
  /** Proposal fund (DHF) — 10% of the mint. */
  readonly proposalFund: Rational;
}

// Consensus split fractions, exact ratios of integers — never floats.
const CONTENT_REWARD_FRACTION: Rational = rational(fromInt(65), fromInt(100));
const VESTING_REWARD_FRACTION: Rational = rational(fromInt(15), fromInt(100));
const WITNESS_PAY_FRACTION: Rational = rational(fromInt(10), fromInt(100));
const PROPOSAL_FUND_FRACTION: Rational = rational(fromInt(10), fromInt(100));

/**
 * The consensus partition of `headBlock`'s emission into its four buckets.
 *
 * Theorem (conservation): contentReward + vestingReward + witnessPay +
 * proposalFund = total, exactly. The fractions 65/100, 15/100, 10/100, 10/100
 * sum to 100/100 = 1, so distributing the exact mint by them conserves it with
 * no rounding — exact-rational arithmetic, no leak.
 */
export function emissionSplit(headBlock: number, virtualSupply: Rational): EmissionSplit {
  const total = blockEmission(headBlock, virtualSupply);
  return Object.freeze({
    kind: "hive-emission.split" as const,
    total,
    contentReward: ratMultiply(total, CONTENT_REWARD_FRACTION),
    vestingReward: ratMultiply(total, VESTING_REWARD_FRACTION),
    witnessPay: ratMultiply(total, WITNESS_PAY_FRACTION),
    proposalFund: ratMultiply(total, PROPOSAL_FUND_FRACTION),
  });
}

/** The apex objective: your slice of the faucet, gross and net of cost. */
export interface FaucetObjective {
  readonly kind: "hive-emission.faucetObjective";
  /** New HIVE minted at this block — the whole faucet flow. */
  readonly perBlockEmission: Rational;
  /** Your exact fraction of it. */
  readonly share: Rational;
  /** Your gross take: perBlockEmission · share. */
  readonly grossYourEmission: Rational;
  /** Your take net of the per-block cost of holding the share — the apex value. */
  readonly netYourEmission: Rational;
}

/**
 * The apex objective from docs/max-alpha.md: **maximize your share of per-block
 * emission, net of cost**.
 *
 * Theorem: grossYourEmission = blockEmission · faucetShare; netYourEmission =
 * grossYourEmission − perBlockCost. The faucet mints every block whether or not
 * any mispricing exists, so the deepest alpha is the largest sustainable
 * net-positive slice of that mint. All quantities exact — the objective is a
 * rational you can compare and optimize without float drift.
 */
export function maxFaucetShare(
  headBlock: number,
  virtualSupply: Rational,
  yourStake: Rational,
  totalStake: Rational,
  perBlockCost: Rational,
): FaucetObjective {
  const perBlockEmission = blockEmission(headBlock, virtualSupply);
  const share = faucetShare(yourStake, totalStake);
  const grossYourEmission = ratMultiply(perBlockEmission, share);
  const netYourEmission = ratSubtract(grossYourEmission, perBlockCost);
  return Object.freeze({
    kind: "hive-emission.faucetObjective" as const,
    perBlockEmission,
    share,
    grossYourEmission,
    netYourEmission,
  });
}
