/** Exact Hive order-book parsing and propose-only intent judgment. */
import { amount, rational } from "@lenticule-science/metrologic/number/commodity-amount";

function malformed(message) { throw new TypeError(`hive order book: ${message}`); }
function outOfRange(message) { throw new RangeError(`hive order book: ${message}`); }

export function parseDecimal(text) {
  if (typeof text !== "string" || !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = body.split(".");
  const den = 10n ** BigInt(fraction.length);
  return rational((negative ? -1n : 1n) * BigInt(`${whole || "0"}${fraction}`), den);
}

/** A terminating decimal is printed exactly; recurring values use 8 places. */
export function formatDecimal(value, places) {
  if (places === undefined) {
    let rest = value.den; let twos = 0; let fives = 0;
    while (rest % 2n === 0n) { rest /= 2n; twos += 1; }
    while (rest % 5n === 0n) { rest /= 5n; fives += 1; }
    places = rest === 1n ? Math.max(twos, fives) : 8;
  }
  const scale = 10n ** BigInt(places);
  const sign = value.num < 0n ? "-" : "";
  const rounded = ((value.num < 0n ? -value.num : value.num) * scale) / value.den;
  const digits = rounded.toString().padStart(places + 1, "0");
  return places === 0 ? `${sign}${digits}` : `${sign}${digits.slice(0, -places)}.${digits.slice(-places)}`;
}

function internalLevel(row, side, index) {
  if (row === null || typeof row !== "object") malformed(`${side}[${index}] is not an object`);
  const { hive, hbd } = row;
  if (!Number.isSafeInteger(hive)) malformed(`${side}[${index}].hive is not an integer satoshi field`);
  if (!Number.isSafeInteger(hbd)) malformed(`${side}[${index}].hbd is not an integer satoshi field`);
  if (hive <= 0) outOfRange(`${side}[${index}].hive must be positive`);
  if (hbd < 0) outOfRange(`${side}[${index}].hbd must be non-negative`);
  return { price: amount(BigInt(hbd), BigInt(hive), "HBD"), quantity: amount(BigInt(hive), 1000n, "HIVE") };
}
export function parseInternalOrderBook(raw) {
  if (raw === null || typeof raw !== "object") malformed("internal order book is not an object");
  if (!Array.isArray(raw.bids) || !Array.isArray(raw.asks)) malformed("internal order book must carry bids and asks arrays");
  return { bids: raw.bids.map((row, index) => internalLevel(row, "bids", index)), asks: raw.asks.map((row, index) => internalLevel(row, "asks", index)) };
}
function engineLevel(row, side, index, symbol) {
  if (row === null || typeof row !== "object") malformed(`${side}[${index}] is not an object`);
  const price = parseDecimal(row.price); const quantity = parseDecimal(row.quantity);
  if (!price) malformed(`${side}[${index}].price is not a decimal`);
  if (!quantity) malformed(`${side}[${index}].quantity is not a decimal`);
  if (price.num < 0n || quantity.num < 0n) outOfRange(`${side}[${index}] must be non-negative`);
  return { price: amount(price.num, price.den, "SWAP.HIVE"), quantity: amount(quantity.num, quantity.den, symbol) };
}
export function parseEngineOrderBook(rawBuy, rawSell, symbol) {
  if (typeof symbol !== "string" || symbol === "") malformed("engine book symbol must be a non-empty string");
  if (!Array.isArray(rawBuy) || !Array.isArray(rawSell)) malformed("engine book sides must be arrays");
  return { bids: rawBuy.map((row, index) => engineLevel(row, "buyBook", index, symbol)), asks: rawSell.map((row, index) => engineLevel(row, "sellBook", index, symbol)) };
}

const compare = (left, right) => left.num * right.den < right.num * left.den ? -1 : left.num * right.den > right.num * left.den ? 1 : 0;
const add = (left, right) => rational(left.num * right.den + right.num * left.den, left.den * right.den);
const subtract = (left, right) => rational(left.num * right.den - right.num * left.den, left.den * right.den);
const multiply = (left, right) => rational(left.num * right.num, left.den * right.den);
const divide = (left, right) => rational(left.num * right.den, left.den * right.num);
export const bestBid = (book) => [...book.bids].sort((a, b) => compare(b.price, a.price))[0];
export const bestAsk = (book) => [...book.asks].sort((a, b) => compare(a.price, b.price))[0];
export function bookReport(reading) {
  const bid = bestBid(reading.book); const ask = bestAsk(reading.book);
  const result = {};
  if (bid) result.bestBid = { exact: `${bid.price.num}/${bid.price.den} ${bid.price.commodity}`, display: formatDecimal(bid.price) };
  if (ask) result.bestAsk = { exact: `${ask.price.num}/${ask.price.den} ${ask.price.commodity}`, display: formatDecimal(ask.price) };
  if (bid && ask) {
    const spread = subtract(ask.price, bid.price);
    const midpoint = divide(add(ask.price, bid.price), rational(2n));
    result.spread = { exact: `${spread.num}/${spread.den} ${spread.commodity ?? ask.price.commodity}`, display: formatDecimal(spread) };
    result.midpoint = { exact: `${midpoint.num}/${midpoint.den} ${midpoint.commodity ?? ask.price.commodity}`, display: formatDecimal(midpoint) };
    result.relativeSpreadBps = Number(roundHalfUp(spread.num * midpoint.den * 10000n, spread.den * midpoint.num));
  }
  return result;
}
function roundHalfUp(num, den) { const sign = num < 0n ? -1n : 1n; const magnitude = num < 0n ? -num : num; return sign * ((2n * magnitude + den) / (2n * den)); }
function walk(levels, quantity, ascending) {
  let remaining = rational(quantity.num, quantity.den); let filled = rational(0n); let cost = rational(0n); let worst;
  for (const level of [...levels].sort((a, b) => ascending ? compare(a.price, b.price) : compare(b.price, a.price))) {
    const taken = compare(remaining, level.quantity) < 0 ? remaining : level.quantity;
    if (taken.num <= 0n) break;
    filled = add(filled, taken); cost = add(cost, multiply(taken, level.price)); remaining = subtract(remaining, taken); worst = level.price;
    if (remaining.num <= 0n) break;
  }
  return { filled, shortfall: remaining, cost, averagePrice: filled.num === 0n ? undefined : divide(cost, filled), worst };
}
function obstruction(obstruction, detail, shortfall) { return { kind: "markets.intent.obstruction", obstruction, detail, ...(shortfall ? { shortfall } : {}) }; }
export function judgeIntent(reading, intent) {
  if (intent.side !== "buy" && intent.side !== "sell") malformed('intent side must be "buy" or "sell"');
  if (!intent.quantity || intent.quantity.num <= 0n) outOfRange("intent quantity must be positive");
  if (intent.maxSlippageBps !== undefined && (!Number.isSafeInteger(intent.maxSlippageBps) || intent.maxSlippageBps < 0)) outOfRange("maxSlippageBps must be a non-negative integer");
  const buy = intent.side === "buy"; const crossed = buy ? reading.book.asks : reading.book.bids;
  const pair = `${reading.venue} ${reading.baseSymbol}/${reading.quoteSymbol}`;
  if (crossed.length === 0) return obstruction("empty-book-side", `no ${buy ? "asks" : "bids"} on ${pair}`);
  const result = walk(crossed, intent.quantity, buy);
  if (result.shortfall.num > 0n) return obstruction("insufficient-depth", `book fills ${formatDecimal(result.filled)} of ${formatDecimal(intent.quantity)} on ${pair}`, formatDecimal(result.shortfall));
  const bid = bestBid(reading.book); const ask = bestAsk(reading.book);
  let slippageBps = 0;
  if (bid && ask) {
    const midpoint = divide(add(bid.price, ask.price), rational(2n));
    const delta = buy ? subtract(result.averagePrice, midpoint) : subtract(midpoint, result.averagePrice);
    slippageBps = Number(roundHalfUp(delta.num * midpoint.den * 10000n, delta.den * midpoint.num));
    if (intent.maxSlippageBps !== undefined && slippageBps > intent.maxSlippageBps) return obstruction("slippage-exceeds-bound", `slippage ${slippageBps} bps exceeds bound ${intent.maxSlippageBps} bps on ${pair}`);
  } else if (intent.maxSlippageBps !== undefined) return obstruction("empty-book-side", `no ${buy ? "bids" : "asks"} on ${pair}: no midpoint to bound slippage against`);
  return { kind: "markets.intent.witness", proposal: { venue: reading.venue, baseSymbol: reading.baseSymbol, quoteSymbol: reading.quoteSymbol, side: intent.side, quantity: formatDecimal(intent.quantity), limitPrice: formatDecimal(result.worst), averagePrice: formatDecimal(result.averagePrice), cost: formatDecimal(result.cost), slippageBps } };
}
