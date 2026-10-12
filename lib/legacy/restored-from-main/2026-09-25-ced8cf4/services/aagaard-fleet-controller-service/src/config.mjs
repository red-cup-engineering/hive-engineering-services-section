// config — the capability gates and per-account policy of the Aagaard fleet.
//
// Aagaard orchestrates a fleet of Hive accounts across four capability lanes.
// Two are *operational* (the platform may act on-chain): `voting` (spends only
// regenerating voting-mana to claim a share of each block's content-reward
// mint) and `trading` (moves liquid value on the internal HIVE/HBD market, the
// Hive-Engine token books, and the AMM pools). Two are *prepared but locked*:
// `posting` (composing content) and `gaming` (playing on-chain games with
// staked assets) are fully built but MUST NOT broadcast until a human flips
// them on — `lockedCapabilities` cannot be enabled at runtime, only in source.
//
// Safety is layered, not implicit:
//   1. `dryRun` (global) — when true NO broadcast leaves the process; every lane
//      computes its full plan and the orchestrator records it. Default-on; a
//      human exports AAGAARD_LIVE=1 to arm the fleet.
//   2. capability gates — voting/trading on, posting/gaming locked off.
//   3. per-account `tradingLive` — only the sandbox account (sigmund-vexler)
//      is permitted live financial action; every other account is propose-only
//      on the trading lane even when the fleet is armed.
// The gates compose by AND: an op broadcasts iff live AND capability-enabled AND
// (for trades) the account is trading-live.

import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";

import { resolveStrategy } from "./strategy.mjs";

export const ALL_CAPABILITIES = Object.freeze([
  "voting",
  "trading",
  "posting",
  "gaming",
]);

/** Capabilities that are prepared in code but can NEVER be armed at runtime.
 *  Enabling them is a source edit a human makes after reviewing the lane. */
export const LOCKED_CAPABILITIES = Object.freeze(["posting", "gaming"]);

export function isLocked(capability) {
  return LOCKED_CAPABILITIES.includes(capability);
}

/** Per-account risk envelope for the trading lane. Milli-units are thousandths
 *  of a token (1_000 = 1.000 HIVE/HBD), matching the chain's 3-dp assets. */

  

const CONSERVATIVE_RISK = Object.freeze({
  capHiveMilli: 1_000,
  capHbdMilli: 1_000,
  minLiquidHbdMilli: 1_000,
  maxVoteWeightBps: 5_000,
  tradingLive: false,
});

/** The sandbox account: the one place live financial shenanigans are allowed.
 *  Larger caps, full vote weight, and the only `tradingLive` envelope. */
const SANDBOX_RISK = Object.freeze({
  capHiveMilli: 5_000,
  capHbdMilli: 5_000,
  minLiquidHbdMilli: 500,
  maxVoteWeightBps: 10_000,
  tradingLive: true,
});

const SANDBOX_ACCOUNT = "sigmund-vexler";

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Lanes operational for an account: voting fleet-wide; trading fleet-wide
 *  (propose-only off the sandbox); posting/gaming are prepared per-account but
 *  excluded from the *enabled* set by the lock, so they never broadcast. */
function defaultCapabilities() {
  return Object.freeze(["voting", "trading", "posting", "gaming"]);
}

function riskFor(account) {
  return account === SANDBOX_ACCOUNT ? SANDBOX_RISK : CONSERVATIVE_RISK;
}

/**
 * Load the fleet policy. Accounts come from the Propolis config (so the read
 * surface and the operational surface name the same fleet); the operational
 * overlay (gates, caps, cadence, live) comes from an optional aagaard.config.json
 * merged over safe defaults. `live` is forced on only by AAGAARD_LIVE=1 in the
 * environment OR an explicit `"live": true` in the config — never by accident.
 */
export function loadAagaardConfig(options

) {
  const env = options.env ?? process.env;
  const propolis = isRecord(readJson(options.propolisConfigPath)) ? (readJson(options.propolisConfigPath)) : {};

  let overlay = {};
  if (options.aagaardConfigPath) {
    try {
      const raw = readJson(options.aagaardConfigPath);
      if (isRecord(raw)) overlay = raw;
    } catch {
      // no operational overlay — safe defaults stand
    }
  }

  const accountNames = Array.isArray(propolis["accounts"])
    ? propolis["accounts"]
        .filter((a) => isRecord(a) && typeof a["account"] === "string")
        .map((a) => a.account)
    : [];

  const keyRoot = expandHome(
    options.keyRoot
      ?? (typeof overlay["keyRoot"] === "string" ? (overlay["keyRoot"]) : undefined)
      ?? (typeof propolis["keyRoot"] === "string" ? (propolis["keyRoot"]) : "~/.config/blockchain/hive"),
  );

  const live = env["AAGAARD_LIVE"] === "1" || overlay["live"] === true;

  const enabledRaw = Array.isArray(overlay["enabled"])
    ? (overlay["enabled"]).filter((c) => ALL_CAPABILITIES.includes(c))
    : (["voting", "trading"]);
  // Locked lanes can never be in the enabled set, whatever the config says.
  const enabled = Object.freeze(enabledRaw.filter((c) => !isLocked(c)));

  const cadenceSeconds = typeof overlay["cadenceSeconds"] === "number" && overlay["cadenceSeconds"] >= 60
    ? overlay["cadenceSeconds"]
    : 900;

  const accountOverrides = isRecord(overlay["accounts"]) ? (overlay["accounts"]) : {};

  const accounts = Object.freeze(
    accountNames.map((account) => {
      const ov = isRecord(accountOverrides[account]) ? (accountOverrides[account]) : {};
      const baseRisk = riskFor(account);
      const risk = Object.freeze({
        capHiveMilli: typeof ov["capHiveMilli"] === "number" ? ov["capHiveMilli"] : baseRisk.capHiveMilli,
        capHbdMilli: typeof ov["capHbdMilli"] === "number" ? ov["capHbdMilli"] : baseRisk.capHbdMilli,
        minLiquidHbdMilli: typeof ov["minLiquidHbdMilli"] === "number" ? ov["minLiquidHbdMilli"] : baseRisk.minLiquidHbdMilli,
        maxVoteWeightBps: typeof ov["maxVoteWeightBps"] === "number" ? ov["maxVoteWeightBps"] : baseRisk.maxVoteWeightBps,
        tradingLive: typeof ov["tradingLive"] === "boolean" ? ov["tradingLive"] : baseRisk.tradingLive,
      });
      const incentiveAuto = Array.isArray(ov["incentiveAuto"])
        ? Object.freeze((ov["incentiveAuto"]).filter((x) => typeof x === "string"))
        : Object.freeze([]);
      const strategy = resolveStrategy(account, ov["strategy"]);
      return Object.freeze({ account, capabilities: defaultCapabilities(), risk, incentiveAuto, strategy });
    }),
  );

  const nodes = Array.isArray(propolis["nodes"])
    ? Object.freeze((propolis["nodes"]).filter((n) => typeof n === "string"))
    : undefined;

  return Object.freeze({
    name: typeof propolis["name"] === "string" ? (propolis["name"]) : "aagaard",
    keyRoot,
    live,
    enabled,
    cadenceSeconds,
    accounts,
    ...(nodes === undefined ? {} : { nodes }),
  });
}

/** Whether a capability is operational right now: globally enabled and not
 *  locked. Locked lanes never report enabled regardless of config. */
export function capabilityEnabled(config, capability) {
  return !isLocked(capability) && config.enabled.includes(capability);
}
