// vesting — VESTS ↔ HP (Hive Power) conversion with the exact rational chain rate.
// The rate is total_vesting_fund_hive / total_vesting_shares (HIVE per VESTS),
// time-varying as the vesting fund accrues. Both sides are kept as exact
// rationals, so vests→HP→vests round-trips are exact by construction.
import type { Amount } from "@emsenn/animating/becoming/doing/working/accounting";
import { amount, rational } from "@emsenn/animating/becoming/doing/working/accounting";
import { expectCommodity, parseLegacyAsset } from "./asset.mjs";

/**
 * The slice of condenser_api.get_dynamic_global_properties this module needs.
 * Structurally compatible with the objects waggle fetches (the same field
 * names and string encodings the chain returns).
 */
export interface VestingPoolState {
  readonly total_vesting_fund_hive: string;
  readonly total_vesting_shares: string;
}

/** Exact rational HIVE-per-VESTS rate. */
export interface VestingRate {
  readonly num: bigint;
  readonly den: bigint;
}

/** Compute the exact HIVE-per-VESTS rate from dynamic global properties. */
export function vestingRate(dgp: VestingPoolState): VestingRate {
  const fund = expectCommodity(parseLegacyAsset(dgp.total_vesting_fund_hive), "HIVE");
  const shares = expectCommodity(parseLegacyAsset(dgp.total_vesting_shares), "VESTS");
  if (shares.num === 0n) throw new RangeError("hive-topology: total_vesting_shares is zero");
  // (fund.num/fund.den) ÷ (shares.num/shares.den), reduced.
  return rational(fund.num * shares.den, fund.den * shares.num);
}

/** Convert VESTS → HP (HIVE) exactly. Accepts an Amount or a legacy string. */
export function vestsToHp(vests: Amount | string, rate: VestingRate): Amount {
  const v = expectCommodity(typeof vests === "string" ? parseLegacyAsset(vests) : vests, "VESTS");
  return amount(v.num * rate.num, v.den * rate.den, "HIVE");
}

/** Convert HP (HIVE) → VESTS exactly. Accepts an Amount or a legacy string. */
export function hpToVests(hp: Amount | string, rate: VestingRate): Amount {
  const h = expectCommodity(typeof hp === "string" ? parseLegacyAsset(hp) : hp, "HIVE");
  if (rate.num === 0n) throw new RangeError("hive-topology: vesting rate is zero");
  return amount(h.num * rate.den, h.den * rate.num, "VESTS");
}

/**
 * Tiny cache for historical rates keyed by an opaque label (e.g. an ISO
 * timestamp or block number). The package stays pure: callers fetch the
 * historical DGP snapshots; this just memoizes the derived rationals.
 */
export interface VestingRateCache {
  get(key: string): VestingRate | undefined;
  put(key: string, dgp: VestingPoolState): VestingRate;
}

export function createVestingRateCache(): VestingRateCache {
  const rates = new Map<string, VestingRate>();
  return {
    get: (key) => rates.get(key),
    put: (key, dgp) => {
      const cached = rates.get(key);
      if (cached) return cached;
      const rate = vestingRate(dgp);
      rates.set(key, rate);
      return rate;
    },
  };
}
