// trade — propose-only inference + optional live execution for HIVE/HBD, HE markets, and HE AMM pools.
import { judgeIntent, type IntentJudgment, type Amount } from "@emsenn/trading/computer";
import { engineCustomJson, formatAmount } from "@emsenn/computing-with-hive/codecs/engine";
import { marketSwapSell as heSell } from "@emsenn/computing-with-hive/codecs/engine/market";
import { addLiquidity } from "@emsenn/computing-with-hive/codecs/engine/pools";
import { parseLegacyAsset, formatLegacyAsset } from "@emsenn/computing-with-hive/computing/topology/rewards";
import { amount, rational } from "@emsenn/animating/becoming/doing/working/accounting";
import { parseDecimal, format } from "@emsenn/computing-with-ledgers";
import type { HiveComputer } from "@emsenn/computing-with-hive/client";
import type { MarketSectionResult, HEBalance, LpPosition, PoolState } from "./market.mjs";
import type { MarketPriceSnapshot } from "./market-history.mjs";

function parseHiveAmount(s: string): { value: bigint; decimals: number; symbol: string } {
  let a: Amount;
  try { a = parseLegacyAsset(s); } catch { return { value: 0n, decimals: 3, symbol: "" }; }
  const decimals = 3;
  return { value: (a.num * 1000n) / a.den, decimals, symbol: a.commodity };
}

function hiveAmountStr(decimalStr: string, symbol: string): string {
  const [whole = "0", frac = ""] = decimalStr.split(".");
  const padded = frac.padEnd(3, "0").slice(0, 3);
  return `${whole}.${padded} ${symbol}`;
}

export interface AccountLiquidity {
  readonly hive: string;
  readonly hbd: string;
  readonly heBalances: readonly HEBalance[];
  readonly lpPositions?: readonly LpPosition[];
}

export interface TradeConfig {
  /** Internal-market cap in milli-HIVE (default 1000 = 1.000 HIVE). */
  readonly capHiveMilli?: number;
  /** Internal-market cap in milli-HBD (default 1000 = 1.000 HBD). */
  readonly capHbdMilli?: number;
  /** Symbols that are LP targets this cycle — excluded from the sell loop to avoid circular round-trips. */
  readonly lpTargetSymbols?: ReadonlySet<string>;
  /** Percentage magnitude of 24h price change that triggers trend-aware skipping (default 3). */
  readonly trendBiasSensitivityPct?: number;
  /** Recent market price snapshots used for trend filtering. */
  readonly marketHistory?: readonly MarketPriceSnapshot[];
}

export interface TradeInference {
  readonly venue: string;
  readonly baseSymbol: string;
  readonly quoteSymbol: string;
  readonly reasoning: string;
  readonly side: "buy" | "sell";
  readonly quantityStr: string;
  readonly judgment: IntentJudgment;
}

const HE_SELL_FRACTION_NUM = 1n;
const HE_SELL_FRACTION_DEN = 5n;
const HE_MIN_SWAP_HIVE_REVENUE = 0.001;
const LP_MIN_SWAP_HIVE = 0.001;

export function inferTrades(
  markets: readonly MarketSectionResult[],
  liquidity: AccountLiquidity = { hive: "0.000 HIVE", hbd: "0.000 HBD", heBalances: [] },
  config: TradeConfig = {},
): readonly TradeInference[] {
  const capHive = BigInt(config.capHiveMilli ?? 1_000);
  const capHbd = BigInt(config.capHbdMilli ?? 1_000);
  const results: TradeInference[] = [];

  let skipInternalSell = false;
  let skipInternalBuy = false;
  if (config.marketHistory !== undefined && config.marketHistory.length > 0) {
    const last = config.marketHistory[config.marketHistory.length - 1];
    const pctChange = last !== undefined ? parseFloat(last.percentChange24h) : 0;
    const threshold = config.trendBiasSensitivityPct ?? 3;
    if (pctChange < -threshold) skipInternalSell = true;
    if (pctChange > threshold) skipInternalBuy = true;
  }

  const hiveLiq = parseHiveAmount(liquidity.hive);
  const hbdLiq = parseHiveAmount(liquidity.hbd);

  const lpProtectedSymbols = new Set<string>();
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
    } else if (market.venue === "hive-engine") {
      if (lpProtectedSymbols.has(market.baseSymbol)) continue;
      if (config.lpTargetSymbols?.has(market.baseSymbol)) continue;
      const bal = liquidity.heBalances.find((b) => b.symbol === market.baseSymbol);
      if (!bal) continue;
      const balStr = bal.balance;
      const [whole = "0", frac = ""] = balStr.split(".");
      const decimals = frac.length;
      const balInt = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0").slice(0, decimals) || "0");
      const sellAmt = (balInt * HE_SELL_FRACTION_NUM) / HE_SELL_FRACTION_DEN;
      if (sellAmt === 0n) continue;
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

export interface LpInference {
  readonly tokenPair: string;
  readonly baseQuantity: string;
  readonly quoteQuantity: string;
  readonly reasoning: string;
}

type R = { readonly num: bigint; readonly den: bigint };
const rmul = (a: R, b: R): R => rational(a.num * b.num, a.den * b.den);
const rdiv = (a: R, b: R): R => rational(a.num * b.den, a.den * b.num);
const rle = (a: R, b: R): boolean => a.num * b.den <= b.num * a.den;
const rlt = (a: R, b: R): boolean => a.num * b.den < b.num * a.den;
const rpos = (a: R): boolean => a.num > 0n;
const LP_MIN_SWAP_HIVE_R: R = rational(1n, 1000n);

export function inferLp(
  poolStates: readonly PoolState[],
  lpPositions: readonly LpPosition[],
  heBalances: readonly HEBalance[],
): readonly LpInference[] {
  const results: LpInference[] = [];

  const balanceOf = (symbol: string): R => {
    const b = heBalances.find((h) => h.symbol === symbol);
    const d = b ? parseDecimal(b.balance) : null;
    return d ? rational(d.num, d.den) : rational(0n, 1n);
  };

  const existingPairs = new Set(lpPositions.map((p) => p.tokenPair));

  for (const pool of poolStates) {
    const [left, right] = pool.tokenPair.split(":");
    if (!left || !right) continue;

    const isSwapHiveBase = left === "SWAP.HIVE";
    const isSwapHiveQuote = right === "SWAP.HIVE";
    if (!isSwapHiveBase && !isSwapHiveQuote) continue;

    const swapHiveSide = isSwapHiveBase ? "base" : "quote";
    const otherSymbol = isSwapHiveBase ? right : left;

    const swapHiveBal = balanceOf("SWAP.HIVE");
    const tokenBal = balanceOf(otherSymbol);

    if (rlt(swapHiveBal, LP_MIN_SWAP_HIVE_R) || !rpos(tokenBal)) continue;

    const poolBaseD = parseDecimal(pool.baseQuantity);
    const poolQuoteD = parseDecimal(pool.quoteQuantity);
    if (!poolBaseD || !poolQuoteD) continue;
    const poolBase = rational(poolBaseD.num, poolBaseD.den);
    const poolQuote = rational(poolQuoteD.num, poolQuoteD.den);
    if (!rpos(poolBase) || !rpos(poolQuote)) continue;
    const ratioQuotePerBase = rdiv(poolQuote, poolBase);

    let baseQty: R;
    let quoteQty: R;
    if (swapHiveSide === "base") {
      const fromSwapHiveQuote = rmul(swapHiveBal, ratioQuotePerBase);
      if (rle(fromSwapHiveQuote, tokenBal)) {
        baseQty = swapHiveBal;
        quoteQty = fromSwapHiveQuote;
      } else {
        baseQty = rdiv(tokenBal, ratioQuotePerBase);
        quoteQty = tokenBal;
      }
      if (rlt(baseQty, LP_MIN_SWAP_HIVE_R)) continue;
    } else {
      const fromSwapHiveBase = rdiv(swapHiveBal, ratioQuotePerBase);
      if (rle(fromSwapHiveBase, tokenBal)) {
        baseQty = fromSwapHiveBase;
        quoteQty = swapHiveBal;
      } else {
        baseQty = tokenBal;
        quoteQty = rmul(tokenBal, ratioQuotePerBase);
      }
      if (rlt(quoteQty, LP_MIN_SWAP_HIVE_R)) continue;
    }

    const action = existingPairs.has(pool.tokenPair) ? "compound" : "new";
    const places = Math.min(pool.precision, 8);
    const baseStr = format(amount(baseQty.num, baseQty.den, "_"), { places, grouping: false });
    const quoteStr = format(amount(quoteQty.num, quoteQty.den, "_"), { places, grouping: false });
    results.push({
      tokenPair: pool.tokenPair,
      baseQuantity: baseStr,
      quoteQuantity: quoteStr,
      reasoning: `${action} LP ${pool.tokenPair} (base=${baseStr}, quote=${quoteStr})`,
    });
  }

  return results;
}

export interface LpExecutionResult {
  readonly inference: LpInference;
  readonly txId: string;
}

export async function executeLp(
  inferences: readonly LpInference[],
  hive: HiveComputer,
  account: string,
): Promise<readonly LpExecutionResult[]> {
  const results: LpExecutionResult[] = [];
  for (const inference of inferences) {
    try {
      const op = engineCustomJson(account, addLiquidity({
        tokenPair: inference.tokenPair,
        baseQuantity: inference.baseQuantity,
        quoteQuantity: inference.quoteQuantity,
      }));
      const { id } = await hive.broadcast([op], "active");
      results.push({ inference, txId: id });
    } catch {
      // individual LP failures are non-fatal
    }
  }
  return results;
}

export interface TradeExecutionResult {
  readonly inference: TradeInference;
  readonly txId: string;
}

export interface SavingsInference {
  readonly action: "deposit-hbd";
  readonly amount: string;
  readonly reasoning: string;
}

export function inferHbdSavings(
  hbdBalance: string,
  minLiquidHbdMilli: number = 1_000,
): SavingsInference | null {
  const parsed = parseHiveAmount(hbdBalance);
  const minLiquid = BigInt(Math.round(minLiquidHbdMilli));
  const depositMilli = parsed.value - minLiquid;
  if (depositMilli < 1n) return null;
  const depositStr = formatLegacyAsset(amount(depositMilli, 1000n, "HBD"));
  return {
    action: "deposit-hbd",
    amount: depositStr,
    reasoning: `deposit ${depositStr} to savings (balance: ${hbdBalance}, keeping ${minLiquidHbdMilli}mHBD liquid)`,
  };
}

export async function executeHbdSavings(
  inference: SavingsInference,
  hive: HiveComputer,
  account: string,
): Promise<string | null> {
  try {
    const { id } = await hive.transferToSavings({ to: account, amount: inference.amount, memo: "" });
    return id;
  } catch {
    return null;
  }
}

export async function executeTrades(
  inferences: readonly TradeInference[],
  hive: HiveComputer,
  account: string,
): Promise<readonly TradeExecutionResult[]> {
  const results: TradeExecutionResult[] = [];

  for (const inference of inferences) {
    if (inference.judgment.kind !== "markets.intent.witness") continue;
    const p = inference.judgment.proposal;

    try {
      if (inference.venue === "hive-internal") {
        let txId: string;
        if (inference.side === "buy") {
          const amountToSell = hiveAmountStr(p.cost, "HBD");
          const minToReceive = hiveAmountStr(p.quantity, "HIVE");
          const { id } = await hive.limitOrderCreate({ amountToSell, minToReceive, fillOrKill: true });
          txId = id;
        } else {
          const amountToSell = hiveAmountStr(p.quantity, "HIVE");
          const minToReceive = hiveAmountStr(p.cost, "HBD");
          const { id } = await hive.limitOrderCreate({ amountToSell, minToReceive, fillOrKill: true });
          txId = id;
        }
        results.push({ inference, txId });
      } else if (inference.venue === "hive-engine") {
        if (Number(p.cost) < HE_MIN_SWAP_HIVE_REVENUE) continue;
        const quantity = formatAmount(p.quantity, 8);
        const op = engineCustomJson(account, heSell({ symbol: inference.baseSymbol, quantity }));
        const { id } = await hive.broadcast([op], "active");
        results.push({ inference, txId: id });
      }
    } catch {
      // individual trade failures are non-fatal
    }
  }

  return results;
}
