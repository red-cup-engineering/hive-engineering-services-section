// market — fetch + parse Hive market data; propose-only order judgments.
// Token books are auto-detected from the account's actual HE balances.
import type { HiveComputer } from "@emsenn/computing-with-hive/client";
import {
  parseInternalOrderBook,
  parseEngineOrderBook,
  bookReport,
  type OrderBook,
  type BookReport,
  type MarketReading,
} from "@emsenn/trading/computer";

export type { BookReport, MarketReading };

export interface HEBalance {
  readonly symbol: string;
  readonly balance: string;
}

export interface LpPosition {
  readonly tokenPair: string;
  readonly shares: string;
}

export interface PoolState {
  readonly tokenPair: string;
  /** Total base token quantity held in the AMM pool. */
  readonly baseQuantity: string;
  /** Total quote token quantity held in the AMM pool. */
  readonly quoteQuantity: string;
  readonly precision: number;
  /** HE marketpools trade fee multiplier, e.g. "0.9975" for 0.25% fee. */
  readonly tradeFeeMultiplier: string;
}

export interface MarketSectionResult {
  readonly venue: string;
  readonly baseSymbol: string;
  readonly quoteSymbol: string;
  readonly reading: MarketReading;
  readonly report: BookReport;
}

export interface MarketRunResult {
  readonly markets: readonly MarketSectionResult[];
  readonly heBalances: readonly HEBalance[];
  readonly lpPositions: readonly LpPosition[];
  readonly poolStates: readonly PoolState[];
}

const ENGINE_NODE = "https://api.hive-engine.com/rpc/contracts";

async function engineRpc(id: number, method: "find", params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(ENGINE_NODE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!res.ok) throw new Error(`Hive Engine API ${res.status}`);
  const payload = await res.json() as { result?: unknown };
  if (payload.result === undefined) throw new Error("Hive Engine API: no result");
  return payload.result;
}

async function fetchEngineBook(symbol: string): Promise<OrderBook> {
  const [buyRows, sellRows] = await Promise.all([
    engineRpc(1, "find", { contract: "market", table: "buyBook", query: { symbol }, limit: 100, offset: 0, indexes: [] }),
    engineRpc(2, "find", { contract: "market", table: "sellBook", query: { symbol }, limit: 100, offset: 0, indexes: [] }),
  ]);
  return parseEngineOrderBook(buyRows, sellRows, symbol);
}

async function fetchAccountTokenBalances(account: string): Promise<readonly HEBalance[]> {
  try {
    const rows = await engineRpc(1, "find", {
      contract: "tokens",
      table: "balances",
      query: { account },
      limit: 100,
      offset: 0,
      indexes: [],
    });
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r): r is { symbol: string; balance: string } =>
        r !== null && typeof r === "object" && typeof r.symbol === "string" && typeof r.balance === "string")
      .map((r) => ({ symbol: r.symbol, balance: r.balance }));
  } catch {
    return [];
  }
}

async function fetchLpPositions(account: string): Promise<readonly LpPosition[]> {
  try {
    const rows = await engineRpc(3, "find", {
      contract: "marketpools",
      table: "liquidityPositions",
      query: { account },
      limit: 100,
      offset: 0,
      indexes: [],
    });
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r): r is { tokenPair: string; shares: string } =>
        r !== null && typeof r === "object" &&
        typeof r.tokenPair === "string" && typeof r.shares === "string")
      .map((r) => ({ tokenPair: r.tokenPair, shares: r.shares }));
  } catch {
    return [];
  }
}

async function fetchPool(tokenPair: string): Promise<PoolState | null> {
  try {
    const rows = await engineRpc(4, "find", {
      contract: "marketpools",
      table: "pools",
      query: { tokenPair },
      limit: 1,
      offset: 0,
      indexes: [],
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const r = rows[0] as Record<string, unknown>;
    if (typeof r.tokenPair !== "string" || typeof r.baseQuantity !== "string" || typeof r.quoteQuantity !== "string") return null;
    return {
      tokenPair: r.tokenPair,
      baseQuantity: r.baseQuantity,
      quoteQuantity: r.quoteQuantity,
      precision: typeof r.precision === "number" ? r.precision : 8,
      tradeFeeMultiplier: typeof r.tradeFeeMultiplier === "string" ? r.tradeFeeMultiplier : "0.9975",
    };
  } catch {
    return null;
  }
}

export async function fetchMarketRun(
  hive: HiveComputer,
  account: string,
): Promise<MarketRunResult> {
  const [internalResult, heBalances, lpPositions] = await Promise.all([
    (async (): Promise<MarketSectionResult | null> => {
      try {
        const raw = await hive.rpc.call<unknown>("condenser_api.get_order_book", [100]);
        const book = parseInternalOrderBook(raw);
        const reading: MarketReading = { venue: "hive-internal", baseSymbol: "HIVE", quoteSymbol: "HBD", book };
        return { venue: "hive-internal", baseSymbol: "HIVE", quoteSymbol: "HBD", reading, report: bookReport(reading) };
      } catch {
        return null;
      }
    })(),
    fetchAccountTokenBalances(account),
    fetchLpPositions(account),
  ]);

  const results: MarketSectionResult[] = [];
  if (internalResult !== null) results.push(internalResult);

  await Promise.all(
    heBalances.map(async ({ symbol }) => {
      if (symbol === "SWAP.HIVE") return;
      try {
        const book = await fetchEngineBook(symbol);
        const reading: MarketReading = { venue: "hive-engine", baseSymbol: symbol, quoteSymbol: "SWAP.HIVE", book };
        results.push({ venue: "hive-engine", baseSymbol: symbol, quoteSymbol: "SWAP.HIVE", reading, report: bookReport(reading) });
      } catch {
        // obstruction — no order book data for this symbol
      }
    }),
  );

  const pairsToQuery = new Set<string>();
  for (const pos of lpPositions) pairsToQuery.add(pos.tokenPair);
  for (const bal of heBalances) {
    if (bal.symbol === "SWAP.HIVE") continue;
    pairsToQuery.add(`SWAP.HIVE:${bal.symbol}`);
    pairsToQuery.add(`${bal.symbol}:SWAP.HIVE`);
  }
  const poolResults = await Promise.all([...pairsToQuery].map(fetchPool));
  const poolStates = poolResults.filter((p): p is PoolState => p !== null);

  return { markets: results, heBalances, lpPositions, poolStates };
}
