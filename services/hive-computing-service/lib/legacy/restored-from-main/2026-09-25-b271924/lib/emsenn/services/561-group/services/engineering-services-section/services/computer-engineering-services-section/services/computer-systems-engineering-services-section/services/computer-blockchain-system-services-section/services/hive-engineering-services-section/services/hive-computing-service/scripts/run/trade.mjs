// trade — propose-only inference + optional live execution for HIVE/HBD, HE markets, and HE AMM pools.
import { judgeIntent, parseDecimal, formatDecimal } from "@red-cup-engineering/hive-blockchain-client-service/market.mjs";
import { engineCustomJson, formatAmount, market, pools } from "@red-cup-engineering/hive-blockchain-client-service/engine.mjs";
import { parseLegacyAsset, formatLegacyAsset } from "@red-cup-engineering/hive-blockchain-client-service/asset.mjs";
import { amount, rational } from "@lenticule-science/metrologic/number/commodity-amount";
function parseHiveAmount(s) {
    let a;
    try {
        a = parseLegacyAsset(s);
    }
    catch {
        return { value: 0n, decimals: 3, symbol: "" };
    }
    const decimals = 3;
    return { value: (a.num * 1000n) / a.den, decimals, symbol: a.commodity };
}
function hiveAmountStr(decimalStr, symbol) {
    const [whole = "0", frac = ""] = decimalStr.split(".");
    const padded = frac.padEnd(3, "0").slice(0, 3);
    return `${whole}.${padded} ${symbol}`;
}
const HE_SELL_FRACTION_NUM = 1n;
const HE_SELL_FRACTION_DEN = 5n;
const HE_MIN_SWAP_HIVE_REVENUE = 0.001;
const LP_MIN_SWAP_HIVE = 0.001;
export function inferTrades(markets, liquidity = { hive: "0.000 HIVE", hbd: "0.000 HBD", heBalances: [] }, config = {}) {
    const capHive = BigInt(config.capHiveMilli ?? 1_000);
    const capHbd = BigInt(config.capHbdMilli ?? 1_000);
    const results = [];
    let skipInternalSell = false;
    let skipInternalBuy = false;
    if (config.marketHistory !== undefined && config.marketHistory.length > 0) {
        const last = config.marketHistory[config.marketHistory.length - 1];
        const pctChange = last !== undefined ? parseFloat(last.percentChange24h) : 0;
        const threshold = config.trendBiasSensitivityPct ?? 3;
        if (pctChange < -threshold)
            skipInternalSell = true;
        if (pctChange > threshold)
            skipInternalBuy = true;
    }
    const hiveLiq = parseHiveAmount(liquidity.hive);
    const hbdLiq = parseHiveAmount(liquidity.hbd);
    const lpProtectedSymbols = new Set();
    for (const pos of liquidity.lpPositions ?? []) {
        for (const sym of pos.tokenPair.split(":")) {
            lpProtectedSymbols.add(sym);
        }
    }
    for (const market of markets) {
        const { reading } = market;
        if (market.venue === "hive-internal") {
            if (!skipInternalBuy) {
                const buyHBDAvail = hbdLiq.value < capHbd ? hbdLiq.value : capHbd;
                if (buyHBDAvail > 0n) {
                    const probeQty = amount(1n, 1n, "HIVE");
                    results.push({
                        venue: market.venue,
                        baseSymbol: market.baseSymbol,
                        quoteSymbol: market.quoteSymbol,
                        reasoning: `buy HIVE: probe 1 HIVE cost in HBD (avail: ${liquidity.hbd})`,
                        side: "buy",
                        quantityStr: "1 HIVE",
                        judgment: judgeIntent(reading, { side: "buy", quantity: probeQty, maxSlippageBps: 200 }),
                    });
                }
            }
            if (!skipInternalSell) {
                const sellHIVEAvail = hiveLiq.value < capHive ? hiveLiq.value : capHive;
                if (sellHIVEAvail > 0n) {
                    const probeQty = amount(BigInt(sellHIVEAvail), 1000n, "HIVE");
                    results.push({
                        venue: market.venue,
                        baseSymbol: market.baseSymbol,
                        quoteSymbol: market.quoteSymbol,
                        reasoning: `sell HIVE: probe ${String(sellHIVEAvail)}mHIVE (avail: ${liquidity.hive})`,
                        side: "sell",
                        quantityStr: formatLegacyAsset(amount(sellHIVEAvail, 1000n, "HIVE")),
                        judgment: judgeIntent(reading, { side: "sell", quantity: probeQty, maxSlippageBps: 200 }),
                    });
                }
            }
        }
        else if (market.venue === "hive-engine") {
            if (lpProtectedSymbols.has(market.baseSymbol))
                continue;
            if (config.lpTargetSymbols?.has(market.baseSymbol))
                continue;
            const bal = liquidity.heBalances.find((b) => b.symbol === market.baseSymbol);
            if (!bal)
                continue;
            const balStr = bal.balance;
            const [whole = "0", frac = ""] = balStr.split(".");
            const decimals = frac.length;
            const balInt = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0").slice(0, decimals) || "0");
            const sellAmt = (balInt * HE_SELL_FRACTION_NUM) / HE_SELL_FRACTION_DEN;
            if (sellAmt === 0n)
                continue;
            const sellStr = formatAmount(sellAmt, decimals > 8 ? 8 : decimals);
            const qty = amount(sellAmt, 10n ** BigInt(decimals > 8 ? 8 : decimals), market.baseSymbol);
            results.push({
                venue: market.venue,
                baseSymbol: market.baseSymbol,
                quoteSymbol: market.quoteSymbol,
                reasoning: `sell 20% of ${market.baseSymbol} balance (${bal.balance})`,
                side: "sell",
                quantityStr: `${sellStr} ${market.baseSymbol}`,
                judgment: judgeIntent(reading, { side: "sell", quantity: qty, maxSlippageBps: 500 }),
            });
        }
    }
    return results;
}
const rmul = (a, b) => rational(a.num * b.num, a.den * b.den);
const rdiv = (a, b) => rational(a.num * b.den, a.den * b.num);
const rle = (a, b) => a.num * b.den <= b.num * a.den;
const rlt = (a, b) => a.num * b.den < b.num * a.den;
const rpos = (a) => a.num > 0n;
const LP_MIN_SWAP_HIVE_R = rational(1n, 1000n);
export function inferLp(poolStates, lpPositions, heBalances) {
    const results = [];
    const balanceOf = (symbol) => {
        const b = heBalances.find((h) => h.symbol === symbol);
        const d = b ? parseDecimal(b.balance) : null;
        return d ? rational(d.num, d.den) : rational(0n, 1n);
    };
    const existingPairs = new Set(lpPositions.map((p) => p.tokenPair));
    for (const pool of poolStates) {
        const [left, right] = pool.tokenPair.split(":");
        if (!left || !right)
            continue;
        const isSwapHiveBase = left === "SWAP.HIVE";
        const isSwapHiveQuote = right === "SWAP.HIVE";
        if (!isSwapHiveBase && !isSwapHiveQuote)
            continue;
        const swapHiveSide = isSwapHiveBase ? "base" : "quote";
        const otherSymbol = isSwapHiveBase ? right : left;
        const swapHiveBal = balanceOf("SWAP.HIVE");
        const tokenBal = balanceOf(otherSymbol);
        if (rlt(swapHiveBal, LP_MIN_SWAP_HIVE_R) || !rpos(tokenBal))
            continue;
        const poolBaseD = parseDecimal(pool.baseQuantity);
        const poolQuoteD = parseDecimal(pool.quoteQuantity);
        if (!poolBaseD || !poolQuoteD)
            continue;
        const poolBase = rational(poolBaseD.num, poolBaseD.den);
        const poolQuote = rational(poolQuoteD.num, poolQuoteD.den);
        if (!rpos(poolBase) || !rpos(poolQuote))
            continue;
        const ratioQuotePerBase = rdiv(poolQuote, poolBase);
        let baseQty;
        let quoteQty;
        if (swapHiveSide === "base") {
            const fromSwapHiveQuote = rmul(swapHiveBal, ratioQuotePerBase);
            if (rle(fromSwapHiveQuote, tokenBal)) {
                baseQty = swapHiveBal;
                quoteQty = fromSwapHiveQuote;
            }
            else {
                baseQty = rdiv(tokenBal, ratioQuotePerBase);
                quoteQty = tokenBal;
            }
            if (rlt(baseQty, LP_MIN_SWAP_HIVE_R))
                continue;
        }
        else {
            const fromSwapHiveBase = rdiv(swapHiveBal, ratioQuotePerBase);
            if (rle(fromSwapHiveBase, tokenBal)) {
                baseQty = fromSwapHiveBase;
                quoteQty = swapHiveBal;
            }
            else {
                baseQty = tokenBal;
                quoteQty = rmul(tokenBal, ratioQuotePerBase);
            }
            if (rlt(quoteQty, LP_MIN_SWAP_HIVE_R))
                continue;
        }
        const action = existingPairs.has(pool.tokenPair) ? "compound" : "new";
        const places = Math.min(pool.precision, 8);
        const baseStr = formatDecimal(rational(baseQty.num, baseQty.den), places);
        const quoteStr = formatDecimal(rational(quoteQty.num, quoteQty.den), places);
        results.push({
            tokenPair: pool.tokenPair,
            baseQuantity: baseStr,
            quoteQuantity: quoteStr,
            reasoning: `${action} LP ${pool.tokenPair} (base=${baseStr}, quote=${quoteStr})`,
        });
    }
    return results;
}
export function inferHbdSavings(hbdBalance, minLiquidHbdMilli = 1_000) {
    const parsed = parseHiveAmount(hbdBalance);
    const minLiquid = BigInt(Math.round(minLiquidHbdMilli));
    const depositMilli = parsed.value - minLiquid;
    if (depositMilli < 1n)
        return null;
    const depositStr = formatLegacyAsset(amount(depositMilli, 1000n, "HBD"));
    return {
        action: "deposit-hbd",
        amount: depositStr,
        reasoning: `deposit ${depositStr} to savings (balance: ${hbdBalance}, keeping ${minLiquidHbdMilli}mHBD liquid)`,
    };
}
