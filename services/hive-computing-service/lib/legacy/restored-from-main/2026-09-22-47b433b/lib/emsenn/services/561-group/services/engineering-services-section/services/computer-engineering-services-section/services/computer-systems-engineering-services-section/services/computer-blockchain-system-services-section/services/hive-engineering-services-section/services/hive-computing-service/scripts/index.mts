// scripts — executable Hive boundary morphisms.
import { HiveComputer } from "@emsenn/computing-with-hive/client";
import { fetchCurationRun } from "./run/curate.mjs";
import { fetchMarketRun } from "./run/market.mjs";

// Agent-operations surface: the curation/market/trade run functions and the
// tick recorders are the package's reusable autonomous-operations vocabulary.
// They were previously private to the read morphisms below; an orchestrator
// (e.g. the Aagaard fleet platform) needs the full propose-and-execute pipeline,
// so they are part of the public capability surface, not re-rolled downstream.
export { fetchCurationRun } from "./run/curate.mjs";
export type { CurationResult, CurationRunOptions, FeedSource } from "./run/curate.mjs";
export type { CurationProposal, PostObservation, Decision, Acted, Abstained, VoteAction, WitnessingThresholds } from "./run/curate.mjs";
export { fetchMarketRun } from "./run/market.mjs";
export type { MarketRunResult, MarketSectionResult, HEBalance, LpPosition, PoolState, BookReport, MarketReading } from "./run/market.mjs";
export { inferTrades, inferLp, executeLp, executeTrades, inferHbdSavings, executeHbdSavings } from "./run/trade.mjs";
export type { TradeInference, TradeConfig, AccountLiquidity, LpInference, LpExecutionResult, TradeExecutionResult, SavingsInference } from "./run/trade.mjs";
export { appendTickSnapshot } from "./run/tick.mjs";
export type { TickSnapshot } from "./run/tick.mjs";
export { appendMarketSnapshot, readMarketHistory } from "./run/market-history.mjs";
export type { MarketPriceSnapshot } from "./run/market-history.mjs";
export { appendJsonl, readJsonl } from "./run/jsonl.mjs";

export type HiveScriptAction = "scripts.curation" | "scripts.market" | "scripts.wallet";
export type HiveScriptKey = "curation" | "market" | "wallet";
export type HiveScriptParams = Readonly<Record<string, string>>;
export type HiveScriptMorphism = (params: HiveScriptParams) => Promise<unknown>;
export type HiveScriptMorphismRegistry = { readonly [action in HiveScriptAction]: HiveScriptMorphism };
export type HiveScriptMap = { readonly [key in HiveScriptKey]: HiveScriptMorphism };

export interface HiveScriptConfig {
  readonly account: string;
  readonly postingKey?: string | undefined;
  readonly activeKey?: string | undefined;
  readonly nodes?: readonly string[] | undefined;
}

export const hiveScriptActions: readonly HiveScriptAction[] = Object.freeze([
  "scripts.curation",
  "scripts.market",
  "scripts.wallet",
]);

export const hiveScriptKeys: readonly HiveScriptKey[] = Object.freeze([
  "curation",
  "market",
  "wallet",
]);

function isHiveScriptAction(action: string): action is HiveScriptAction {
  return action === "scripts.curation" || action === "scripts.market" || action === "scripts.wallet";
}

function hiveScriptKey(action: HiveScriptAction): HiveScriptKey {
  return action.slice("scripts.".length) as HiveScriptKey;
}

function hiveComputer(config: HiveScriptConfig): HiveComputer {
  const keys: Record<string, string> = {};
  if (config.postingKey) keys["posting"] = config.postingKey;
  if (config.activeKey) keys["active"] = config.activeKey;
  return new HiveComputer({
    account: config.account,
    ...(config.nodes ? { nodes: config.nodes } : {}),
    ...(Object.keys(keys).length > 0 ? { keys } : {}),
  });
}

export function createHiveScriptMorphisms(config: HiveScriptConfig): HiveScriptMorphismRegistry {
  const hive = hiveComputer(config);

  return Object.freeze({
    async "scripts.curation"(_params: HiveScriptParams) {
      return fetchCurationRun(hive, config.account, { includeFollowingFeed: true });
    },
    async "scripts.market"(_params: HiveScriptParams) {
      return fetchMarketRun(hive, config.account);
    },
    async "scripts.wallet"(_params: HiveScriptParams) {
      const accounts = await hive.getAccounts([config.account]);
      return accounts[0] ?? null;
    },
  } satisfies HiveScriptMorphismRegistry);
}

export async function runHiveScript(
  action: HiveScriptAction,
  params: HiveScriptParams,
  config: HiveScriptConfig,
): Promise<unknown> {
  return createHiveScriptMorphisms(config)[action](params);
}

export async function evalHiveScript(
  action: string,
  params: HiveScriptParams,
  config: HiveScriptConfig,
): Promise<unknown> {
  if (!isHiveScriptAction(action)) {
    throw new TypeError(`hive scripts: unsupported action ${JSON.stringify(action)} (expected ${hiveScriptActions.join(", ")})`);
  }
  return runHiveScript(action, params, config);
}

export function createHiveScripts(config: HiveScriptConfig): HiveScriptMap {
  const morphisms = createHiveScriptMorphisms(config);
  return Object.freeze(Object.fromEntries(
    hiveScriptActions.map((action) => [hiveScriptKey(action), morphisms[action]]),
  ) as HiveScriptMap);
}
