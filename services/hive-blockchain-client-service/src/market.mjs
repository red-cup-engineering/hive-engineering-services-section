// market — the chain's order books as exact amounts: the internal HIVE/HBD book (integer satoshi
// rows) and a Hive-Engine token's buy/sell books (decimal rows) read as graded order books, which
// the gaming market walks; a book report and an intent judgement over them.
import { bestAsk, bestBid, marketBuyWalk, marketSellWalk, midpoint, spread } from "@red-cup-engineering/exact-order-book-service";
import { ratSign, ratSubtract } from "@red-cup-engineering/exact-number-data-service/exact-number";
import { decimalOfRational, decimalUnits, formatUnits, rationalOfDecimal, rationalUnits, terminatingPlaces } from "@red-cup-engineering/exact-number-data-service/decimal-string";
import { gradeOf, graded, gradedFromParts, gradedRatio, gradedSign, gradedToExactString, gradedValue } from "@red-cup-engineering/exact-number-data-service/graded";

function malformed(message) { throw new TypeError(`hive order book: ${message}`); }
function outOfRange(message) { throw new RangeError(`hive order book: ${message}`); }

/** A value as the chain reads it: exact when it terminates, else 8 places, never overstated. */
const display = (value) => decimalOfRational(gradedValue(value), terminatingPlaces(gradedValue(value)) ?? 8, { rounding: "toward-zero" });
/** A dimensionless ratio in basis points, rounded half away from zero. */
const bps = (ratio) => Number(rationalUnits(ratio, 4));

function internalLevel(row, side, index) {
  if (row === null || typeof row !== "object") malformed(`${side}[${index}] is not an object`);
  const { hive, hbd } = row;
  if (!Number.isSafeInteger(hive)) malformed(`${side}[${index}].hive is not an integer satoshi field`);
  if (!Number.isSafeInteger(hbd)) malformed(`${side}[${index}].hbd is not an integer satoshi field`);
  if (hive <= 0) outOfRange(`${side}[${index}].hive must be positive`);
  if (hbd < 0) outOfRange(`${side}[${index}].hbd must be non-negative`);
  return { price: gradedFromParts(hbd, hive, "HBD"), quantity: gradedFromParts(hive, 1000n, "HIVE") };
}
export function parseInternalOrderBook(raw) {
  if (raw === null || typeof raw !== "object") malformed("internal order book is not an object");
  if (!Array.isArray(raw.bids) || !Array.isArray(raw.asks)) malformed("internal order book must carry bids and asks arrays");
  return { bids: raw.bids.map((row, index) => internalLevel(row, "bids", index)), asks: raw.asks.map((row, index) => internalLevel(row, "asks", index)) };
}
function decimal(text) { try { return typeof text === "string" ? rationalOfDecimal(text) : null; } catch { return null; } }
function engineLevel(row, side, index, symbol) {
  if (row === null || typeof row !== "object") malformed(`${side}[${index}] is not an object`);
  const price = decimal(row.price); const quantity = decimal(row.quantity);
  if (!price) malformed(`${side}[${index}].price is not a decimal`);
  if (!quantity) malformed(`${side}[${index}].quantity is not a decimal`);
  if (ratSign(price) < 0 || ratSign(quantity) < 0) outOfRange(`${side}[${index}] must be non-negative`);
  return { price: graded(price, "SWAP.HIVE"), quantity: graded(quantity, symbol) };
}
export function parseEngineOrderBook(rawBuy, rawSell, symbol) {
  if (typeof symbol !== "string" || symbol === "") malformed("engine book symbol must be a non-empty string");
  if (!Array.isArray(rawBuy) || !Array.isArray(rawSell)) malformed("engine book sides must be arrays");
  return { bids: rawBuy.map((row, index) => engineLevel(row, "buyBook", index, symbol)), asks: rawSell.map((row, index) => engineLevel(row, "sellBook", index, symbol)) };
}

// A Hive-Engine buyBook or sellBook as it can be filled now: canonical 8-place prices and
// `precision`-place quantities, rows with a malformed account or order id or an expiry at or
// before `observedUnix` dropped, best price first (highest bid, lowest ask), ties by order id.
export function liveEngineBook(rows, precision, side, observedUnix) {
  if (side !== "bid" && side !== "ask") malformed('liveEngineBook side must be "bid" or "ask"');
  return rows.map((row) => ({ account: String(row.account ?? "").toLowerCase(), price: formatUnits(decimalUnits(row.price, 8), 8),
    quantity: formatUnits(decimalUnits(row.quantity, precision), precision), orderId: String(row.txId ?? ""), expiration: Number(row.expiration) }))
    .filter((row) => /^[a-z][a-z0-9.-]{2,15}$/u.test(row.account) && /^[0-9a-f]{40}(?:-[0-9]+)?$/u.test(row.orderId)
      && Number.isSafeInteger(row.expiration) && row.expiration > observedUnix)
    .sort((left, right) => { const delta = decimalUnits(left.price, 8) - decimalUnits(right.price, 8);
      return delta === 0n ? left.orderId.localeCompare(right.orderId) : (side === "ask") === (delta < 0n) ? -1 : 1; })
    .map((row) => Object.freeze(row));
}

export function bookReport(reading) {
  const bid = bestBid(reading.book); const ask = bestAsk(reading.book);
  const result = {};
  if (bid) result.bestBid = { exact: gradedToExactString(bid.price), display: display(bid.price) };
  if (ask) result.bestAsk = { exact: gradedToExactString(ask.price), display: display(ask.price) };
  if (bid && ask) {
    const s = spread(reading.book); const m = midpoint(reading.book);
    result.spread = { exact: gradedToExactString(s), display: display(s) };
    result.midpoint = { exact: gradedToExactString(m), display: display(m) };
    result.relativeSpreadBps = bps(gradedRatio(s, m));
  }
  return result;
}
function obstruction(obstruction, detail, shortfall) { return { kind: "markets.intent.obstruction", obstruction, detail, ...(shortfall ? { shortfall } : {}) }; }
export function judgeIntent(reading, intent) {
  if (intent.side !== "buy" && intent.side !== "sell") malformed('intent side must be "buy" or "sell"');
  if (!intent.quantity || gradedSign(intent.quantity) <= 0) outOfRange("intent quantity must be positive");
  if (intent.maxSlippageBps !== undefined && (!Number.isSafeInteger(intent.maxSlippageBps) || intent.maxSlippageBps < 0)) outOfRange("maxSlippageBps must be a non-negative integer");
  const buy = intent.side === "buy"; const crossed = buy ? reading.book.asks : reading.book.bids;
  const pair = `${reading.venue} ${reading.baseSymbol}/${reading.quoteSymbol}`;
  if (crossed.length === 0) return obstruction("empty-book-side", `no ${buy ? "asks" : "bids"} on ${pair}`);
  const result = buy ? marketBuyWalk(reading.book, intent.quantity) : marketSellWalk(reading.book, intent.quantity);
  if (gradedSign(result.shortfall) > 0) return obstruction("insufficient-depth", `book fills ${display(result.filled)} of ${display(intent.quantity)} on ${pair}`, display(result.shortfall));
  const m = midpoint(reading.book);
  let slippageBps = 0;
  if (m !== undefined) {
    const average = gradedValue(result.averagePrice), mid = gradedValue(m);
    slippageBps = bps(gradedRatio(graded(buy ? ratSubtract(average, mid) : ratSubtract(mid, average), gradeOf(m)), m));
    if (intent.maxSlippageBps !== undefined && slippageBps > intent.maxSlippageBps) return obstruction("slippage-exceeds-bound", `slippage ${slippageBps} bps exceeds bound ${intent.maxSlippageBps} bps on ${pair}`);
  } else if (intent.maxSlippageBps !== undefined) return obstruction("empty-book-side", `no ${buy ? "bids" : "asks"} on ${pair}: no midpoint to bound slippage against`);
  return { kind: "markets.intent.witness", proposal: { venue: reading.venue, baseSymbol: reading.baseSymbol, quoteSymbol: reading.quoteSymbol, side: intent.side, quantity: display(intent.quantity), limitPrice: display(result.worst), averagePrice: display(result.averagePrice), cost: display(result.cost), slippageBps } };
}
