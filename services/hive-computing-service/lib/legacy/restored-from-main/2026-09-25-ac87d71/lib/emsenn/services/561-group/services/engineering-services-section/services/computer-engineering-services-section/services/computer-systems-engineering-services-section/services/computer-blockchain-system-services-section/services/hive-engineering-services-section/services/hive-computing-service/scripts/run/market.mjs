import { parseInternalOrderBook, parseEngineOrderBook, bookReport, } from "@red-cup-engineering/hive-blockchain-client-service/market.mjs";
import { EngineClient } from "@red-cup-engineering/hive-blockchain-client-service/engine.mjs";
const engine = new EngineClient();
async function fetchEngineBook(symbol) {
    const [buyRows, sellRows] = await Promise.all([
        engine.find("market", "buyBook", { symbol }, { limit: 100 }),
        engine.find("market", "sellBook", { symbol }, { limit: 100 }),
    ]);
    return parseEngineOrderBook(buyRows, sellRows, symbol);
}
async function fetchAccountTokenBalances(account) {
    try {
        const rows = await engine.find("tokens", "balances", { account }, { limit: 100 });
        if (!Array.isArray(rows))
            return [];
        return rows
            .filter((r) => r !== null && typeof r === "object" && typeof r.symbol === "string" && typeof r.balance === "string")
            .map((r) => ({ symbol: r.symbol, balance: r.balance }));
    }
    catch {
        return [];
    }
}
async function fetchLpPositions(account) {
    try {
        const rows = await engine.find("marketpools", "liquidityPositions", { account }, { limit: 100 });
        if (!Array.isArray(rows))
            return [];
        return rows
            .filter((r) => r !== null && typeof r === "object" &&
            typeof r.tokenPair === "string" && typeof r.shares === "string")
            .map((r) => ({ tokenPair: r.tokenPair, shares: r.shares }));
    }
    catch {
        return [];
    }
}
async function fetchPool(tokenPair) {
    try {
        const rows = await engine.find("marketpools", "pools", { tokenPair }, { limit: 1 });
        if (!Array.isArray(rows) || rows.length === 0)
            return null;
        const r = rows[0];
        if (typeof r.tokenPair !== "string" || typeof r.baseQuantity !== "string" || typeof r.quoteQuantity !== "string")
            return null;
        return {
            tokenPair: r.tokenPair,
            baseQuantity: r.baseQuantity,
            quoteQuantity: r.quoteQuantity,
            precision: typeof r.precision === "number" ? r.precision : 8,
            tradeFeeMultiplier: typeof r.tradeFeeMultiplier === "string" ? r.tradeFeeMultiplier : "0.9975",
        };
    }
    catch {
        return null;
    }
}
export async function fetchMarketRun(hive, account) {
    const [internalResult, heBalances, lpPositions] = await Promise.all([
        (async () => {
            try {
                const raw = await hive.rpc.call("condenser_api.get_order_book", [100]);
                const book = parseInternalOrderBook(raw);
                const reading = { venue: "hive-internal", baseSymbol: "HIVE", quoteSymbol: "HBD", book };
                return { venue: "hive-internal", baseSymbol: "HIVE", quoteSymbol: "HBD", reading, report: bookReport(reading) };
            }
            catch {
                return null;
            }
        })(),
        fetchAccountTokenBalances(account),
        fetchLpPositions(account),
    ]);
    const results = [];
    if (internalResult !== null)
        results.push(internalResult);
    await Promise.all(heBalances.map(async ({ symbol }) => {
        if (symbol === "SWAP.HIVE")
            return;
        try {
            const book = await fetchEngineBook(symbol);
            const reading = { venue: "hive-engine", baseSymbol: symbol, quoteSymbol: "SWAP.HIVE", book };
            results.push({ venue: "hive-engine", baseSymbol: symbol, quoteSymbol: "SWAP.HIVE", reading, report: bookReport(reading) });
        }
        catch {
            // obstruction — no order book data for this symbol
        }
    }));
    const pairsToQuery = new Set();
    for (const pos of lpPositions)
        pairsToQuery.add(pos.tokenPair);
    for (const bal of heBalances) {
        if (bal.symbol === "SWAP.HIVE")
            continue;
        pairsToQuery.add(`SWAP.HIVE:${bal.symbol}`);
        pairsToQuery.add(`${bal.symbol}:SWAP.HIVE`);
    }
    const poolResults = await Promise.all([...pairsToQuery].map(fetchPool));
    const poolStates = poolResults.filter((p) => p !== null);
    return { markets: results, heBalances, lpPositions, poolStates };
}
