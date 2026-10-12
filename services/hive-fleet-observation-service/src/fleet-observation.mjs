import { addDecimalStrings } from "@red-cup-engineering/exact-number-data-service/decimal-string";

/** Pure Hive observation data: no provider identity, journal custody or execution authority.
 * Decimal balances remain exact; missing observations cannot support a fleet total. */
function quantity(value, suffix) {
  if (typeof value !== "string" || !value.endsWith(` ${suffix}`)) return null;
  const amount = value.slice(0, -(suffix.length + 1));
  try { return addDecimalStrings([amount]); } catch { return null; }
}

const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const flag = (value) => typeof value === "boolean" ? value : null;
function sumCounts(values) {
  let total = 0;
  for (const value of values) {
    if (value === null || value > Number.MAX_SAFE_INTEGER - total) return null;
    total += value;
  }
  return total;
}

export function projectHiveFleetObservation(tick, tickDigest) {
  if (!Array.isArray(tick?.accounts)) throw new TypeError("Hive observation requires an explicit source account scope");
  const seen = new Set();
  for (const account of tick.accounts) {
    const name = account?.account;
    if (account === null || typeof account !== "object" || Array.isArray(account)
        || typeof name !== "string" || name === "" || name !== name.trim()) {
      throw new TypeError("Hive observation requires nonempty string account identities without surrounding whitespace");
    }
    if (seen.has(name)) throw new TypeError(`Hive observation has a duplicate account identity: ${name}`);
    seen.add(name);
  }
  const accounts = tick.accounts.map((account) => ({
    account: account.account,
    liquid: { hive: quantity(account.trading?.hive, "HIVE"), hbd: quantity(account.trading?.hbd, "HBD") },
    voting: { planned: count(account.voting?.votesPlanned), broadcast: count(account.voting?.votesBroadcast),
      skipped: count(account.voting?.votesSkipped), errors: count(account.voting?.execution?.errors) },
    trading: { mode: account.trading?.mode ?? "unknown", planned: count(account.trading?.tradesPlanned),
      executed: count(account.trading?.tradesExecuted), liquidityPlanned: count(account.trading?.lpPlanned),
      liquidityExecuted: count(account.trading?.lpExecuted), savingsExecuted: flag(account.trading?.savingsExecuted) },
  })).sort((left, right) => left.account.localeCompare(right.account));
  const sum = (field) => Array.isArray(tick.accounts) && accounts.every((account) => account.liquid[field] !== null)
    ? addDecimalStrings(["0", ...accounts.map((account) => account.liquid[field])]) : null;
  const execution = {
    votesBroadcast: sumCounts(accounts.map((account) => account.voting.broadcast)),
    votesSkipped: sumCounts(accounts.map((account) => account.voting.skipped)),
    voteErrors: sumCounts(accounts.map((account) => account.voting.errors)),
    tradesExecuted: sumCounts(accounts.map((account) => account.trading.executed)),
    liquidityMovesExecuted: sumCounts(accounts.map((account) => account.trading.liquidityExecuted)),
  };
  return { type: "HiveFleetCustodyObservation", sourceTick: { id: tickDigest, settledAt: tick.ts },
    fleet: { running: flag(tick.running), liveFlag: flag(tick.live),
      enabledLanes: Array.isArray(tick.enabled) && tick.enabled.every((lane) => typeof lane === "string" && lane.length > 0) ? [...tick.enabled] : null,
      accountCount: accounts.length },
    aggregateLiquid: { hive: sum("hive"), hbd: sum("hbd") },
    accounts, execution,
    interpretationLimits: ["Hive-and-Hive-Engine-only", "not-a-cross-chain-position",
      "live-flag-does-not-prove-broadcast", "balances-are-source-tick-observations-not-custody-title", "unobserved-balances-are-unknown-not-zero"],
    credentialAccess: false, chainMutation: false };
}

