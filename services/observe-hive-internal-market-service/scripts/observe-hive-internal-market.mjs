#!/usr/bin/env node
import { RpcClient } from "@red-cup-engineering/hive-blockchain-client-service/rpc.mjs";
import { fetchCoingeckoUsdPrices } from "@red-cup-engineering/farolfi/ledger/maintenance/coingecko";
import {
  parseDecimal,
  formatScaled,
  addDecimalStrings,
  multiplyDecimalStrings,
  stripUnitSuffix,
  negateDecimalString,
  divideDecimalStrings,
  compareDecimalStrings,
} from "@red-cup-engineering/computer-data-engineering-services-section/number/decimal-string";
import { runJavascriptNodeOperation } from "../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

const DEFAULT_NODES = Object.freeze(["https://api.hive.blog", "https://api.openhive.network"]);
const DEFAULT_ACCOUNTS = Object.freeze([]);
const COINGECKO_IDS = Object.freeze({ hive: "hive", hbd: "hive_dollar" });

/** Ratio-in-basis-points of `numerator` over `denominator`, truncated to 6 fractional digits. */
function basisPoints(numerator, denominator) {
  return divideDecimalStrings(multiplyDecimalStrings(numerator, "10000", 30), denominator, 6);
}

/** Convert a market_history_api NAI-amount object (or a plain asset string) to a decimal string. */
function naiToDecimalString(amount) {
  if (amount == null) return null;
  if (typeof amount === "string") return stripUnitSuffix(amount);
  return formatScaled(BigInt(amount.amount), amount.precision);
}

/** The order-book entry with the extreme `real_price` (`isBetter(comparison of candidate to current) => boolean`). */
function bestOf(entries, isBetter) {
  return (entries ?? []).reduce((best, entry) => (best === null || isBetter(compareDecimalStrings(entry.real_price, best.real_price)) ? entry : best), null);
}

/** Relative gap between two decimal-string prices, in basis points of their mean; `Infinity` if either is missing. */
function relativeBpsGap(a, b) {
  if (a === undefined || b === undefined) return Infinity;
  const difference = compareDecimalStrings(a, b) >= 0 ? addDecimalStrings([a, negateDecimalString(b)]) : addDecimalStrings([b, negateDecimalString(a)]);
  const mid = divideDecimalStrings(addDecimalStrings([a, b]), "2", 12);
  return compareDecimalStrings(mid, "0") === 0 ? 0 : Number(basisPoints(difference, mid));
}

/** Sum an order-book side's HIVE/HBD amounts whose `real_price` lies within `bandBasisPoints` of `mid`, exactly. */
function sumWithinBand(entries, mid, bandBasisPoints, side) {
  const bound = divideDecimalStrings(multiplyDecimalStrings(mid, String(bandBasisPoints), 30), "10000", 30);
  const within = (entries ?? []).filter((entry) => side === "bid"
    ? compareDecimalStrings(entry.real_price, addDecimalStrings([mid, negateDecimalString(bound)])) >= 0
    : compareDecimalStrings(entry.real_price, addDecimalStrings([mid, bound])) <= 0);
  const sum = (field) => (within.length === 0 ? "0" : formatScaled(within.reduce((total, entry) => total + BigInt(entry[field]), 0n), 3));
  return { hive: sum("hive"), hbd: sum("hbd"), orders: within.length };
}

/** Project one order-book entry to its reported shape. */
function projectEntry(entry) {
  return { priceHbdPerHive: entry.real_price, hive: formatScaled(BigInt(entry.hive), 3), hbd: formatScaled(BigInt(entry.hbd), 3), created: entry.created };
}

/** `fixtureValue` when given (a literal pre-recorded result), else the awaited live call — the one seam every read in this operation goes through, so a fully-fixtured request never touches the network. */
async function resolveOrCall(fixtureValue, liveCall) {
  return fixtureValue !== undefined ? fixtureValue : liveCall();
}

/**
 * Observes the Hive base-layer internal HIVE/HBD market book, spread, and depth cross-checked across two public nodes, the recent ticker and volume, the feed's median price, the external HIVE and HBD USD prices, the resulting haircut, and the HBD conversion queue, read-only.
 * @param {object} [request]
 * @param {readonly string[]} [request.nodes] Two public Hive JSON-RPC node base URLs to
 *   cross-check (default `["https://api.hive.blog","https://api.openhive.network"]`).
 * @param {number} [request.orderBookDepth] `condenser_api.get_order_book` depth per side (default 20).
 * @param {number} [request.bandBasisPoints] Price band around mid, in basis points, for the reported depth sums (default 200).
 * @param {number} [request.toleranceBasisPoints] Max allowed best-bid/best-ask disagreement between the two nodes, in basis points, before refusal (default 50).
 * @param {number} [request.maxBlockGap] Max allowed head-block-number disagreement between the two nodes before refusal (default 3).
 * @param {readonly string[]} [request.accounts] Accounts to read the HBD conversion queue for (default none).
 * @param {typeof fetch} [request.fetchImpl] Injectable fetch implementation, for tests.
 * @param {object} [request.fixtures] Literal pre-recorded results (`dynamicGlobalProperties`, `orderBook` keyed by node; `ticker`, `volume`, `feedHistory` for the primary node; `conversionQueue` keyed by account; `coingecko` keyed by CoinGecko id) that stand in for the live read they name, for deterministic replay.
 * @param {string} [request.now] An injectable ISO instant for `observedAt`, for deterministic replay (default the real current time).
 * @returns {Promise<object>} A `HiveInternalMarketObservationRecord`: `{type,version,observedAt,witnesses,book,bestBid,bestAsk,spread,depthWithinBand,ticker,volume,feed,externalPrices,internalHbdPriceUsd,haircut,conversionQueue}`.
 * @throws {TypeError} When `request.nodes` names fewer than two nodes.
 * @throws {Error} `HIVE_INTERNAL_MARKET_NODE_DISAGREEMENT` when the two nodes' head-block-number or best-bid/best-ask readings disagree beyond the declared tolerance.
 * @throws {Error} `HIVE_INTERNAL_MARKET_EXTERNAL_PRICE_UNAVAILABLE` when CoinGecko does not price HIVE and/or HBD.
 */
export async function observeHiveInternalMarket(request = {}) {
  const nodes = request.nodes ?? DEFAULT_NODES;
  if (!Array.isArray(nodes) || nodes.length < 2) throw new TypeError("observe-hive-internal-market: request.nodes must name at least two nodes");
  const depth = request.orderBookDepth ?? 20;
  const bandBasisPoints = request.bandBasisPoints ?? 200;
  const toleranceBasisPoints = request.toleranceBasisPoints ?? 50;
  const maxBlockGap = request.maxBlockGap ?? 3;
  const accounts = request.accounts ?? DEFAULT_ACCOUNTS;
  const fetchImpl = request.fetchImpl ?? fetch;
  const fixtures = request.fixtures;
  const [primary, secondary] = nodes;

  const [primaryDgp, secondaryDgp] = await Promise.all([
    resolveOrCall(fixtures?.dynamicGlobalProperties?.[primary], () => new RpcClient({ nodes: [primary], fetch: fetchImpl }).call("condenser_api.get_dynamic_global_properties", [])),
    resolveOrCall(fixtures?.dynamicGlobalProperties?.[secondary], () => new RpcClient({ nodes: [secondary], fetch: fetchImpl }).call("condenser_api.get_dynamic_global_properties", [])),
  ]);
  const [primaryBook, secondaryBook] = await Promise.all([
    resolveOrCall(fixtures?.orderBook?.[primary], () => new RpcClient({ nodes: [primary], fetch: fetchImpl }).call("condenser_api.get_order_book", [depth])),
    resolveOrCall(fixtures?.orderBook?.[secondary], () => new RpcClient({ nodes: [secondary], fetch: fetchImpl }).call("condenser_api.get_order_book", [depth])),
  ]);

  const blockGap = Math.abs(primaryDgp.head_block_number - secondaryDgp.head_block_number);
  if (blockGap > maxBlockGap) {
    throw new Error(
      `HIVE_INTERNAL_MARKET_NODE_DISAGREEMENT: head_block_number gap ${blockGap} exceeds maxBlockGap ${maxBlockGap} (${primary}=${primaryDgp.head_block_number}, ${secondary}=${secondaryDgp.head_block_number})`,
    );
  }

  const primaryBestBid = bestOf(primaryBook.bids, (order) => order > 0);
  const primaryBestAsk = bestOf(primaryBook.asks, (order) => order < 0);
  const secondaryBestBid = bestOf(secondaryBook.bids, (order) => order > 0);
  const secondaryBestAsk = bestOf(secondaryBook.asks, (order) => order < 0);
  const bidGapBps = relativeBpsGap(primaryBestBid?.real_price, secondaryBestBid?.real_price);
  const askGapBps = relativeBpsGap(primaryBestAsk?.real_price, secondaryBestAsk?.real_price);
  if (bidGapBps > toleranceBasisPoints || askGapBps > toleranceBasisPoints) {
    throw new Error(
      `HIVE_INTERNAL_MARKET_NODE_DISAGREEMENT: best-bid/best-ask gap (bid ${bidGapBps.toFixed(4)}bps, ask ${askGapBps.toFixed(4)}bps) exceeds toleranceBasisPoints ${toleranceBasisPoints} (${primary} vs ${secondary})`,
    );
  }

  const bestBid = primaryBestBid.real_price;
  const bestAsk = primaryBestAsk.real_price;
  const spreadHbdPerHive = addDecimalStrings([bestAsk, negateDecimalString(bestBid)]);
  const mid = divideDecimalStrings(addDecimalStrings([bestBid, bestAsk]), "2", 12);
  const spreadBasisPoints = basisPoints(spreadHbdPerHive, mid);
  const bidDepth = sumWithinBand(primaryBook.bids, mid, bandBasisPoints, "bid");
  const askDepth = sumWithinBand(primaryBook.asks, mid, bandBasisPoints, "ask");

  const [ticker, volume, feed] = await Promise.all([
    resolveOrCall(fixtures?.ticker, () => new RpcClient({ nodes: [primary], fetch: fetchImpl }).call("market_history_api.get_ticker", {})),
    resolveOrCall(fixtures?.volume, () => new RpcClient({ nodes: [primary], fetch: fetchImpl }).call("market_history_api.get_volume", {})),
    resolveOrCall(fixtures?.feedHistory, () => new RpcClient({ nodes: [primary], fetch: fetchImpl }).call("condenser_api.get_feed_history", [])),
  ]);
  const feedMedian = feed.current_median_history;
  const impliedHbdPerHive = divideDecimalStrings(stripUnitSuffix(feedMedian.base), stripUnitSuffix(feedMedian.quote), 12);

  const coingeckoPrices = fixtures?.coingecko
    ? new Map(Object.entries(fixtures.coingecko))
    : await fetchCoingeckoUsdPrices([COINGECKO_IDS.hive, COINGECKO_IDS.hbd], { fetchImpl });
  const hiveUsd = coingeckoPrices.get(COINGECKO_IDS.hive);
  const hbdUsdExternal = coingeckoPrices.get(COINGECKO_IDS.hbd);
  if (hiveUsd === undefined || hbdUsdExternal === undefined) {
    throw new Error(`HIVE_INTERNAL_MARKET_EXTERNAL_PRICE_UNAVAILABLE: coingecko did not price ${COINGECKO_IDS.hive} and/or ${COINGECKO_IDS.hbd}`);
  }
  const hiveUsdString = String(hiveUsd);
  const hbdUsdExternalString = String(hbdUsdExternal);
  const internalHbdPriceUsd = divideDecimalStrings(hiveUsdString, impliedHbdPerHive, 12);
  const haircutVsExternalUsd = addDecimalStrings([internalHbdPriceUsd, negateDecimalString(hbdUsdExternalString)]);
  const haircutVsExternalBasisPoints = basisPoints(haircutVsExternalUsd, hbdUsdExternalString);
  const haircutVsParUsd = addDecimalStrings([internalHbdPriceUsd, negateDecimalString("1")]);
  const haircutVsParBasisPoints = basisPoints(haircutVsParUsd, "1");

  const conversionQueue = {};
  for (const account of accounts) {
    const fixtureEntry = fixtures?.conversionQueue?.[account];
    const [conversions, collateralizedConversions] = await Promise.all([
      resolveOrCall(fixtureEntry?.conversions, () => new RpcClient({ nodes: [primary], fetch: fetchImpl }).call("condenser_api.get_conversion_requests", [account])),
      resolveOrCall(fixtureEntry?.collateralizedConversions, () => new RpcClient({ nodes: [primary], fetch: fetchImpl }).call("condenser_api.get_collateralized_conversion_requests", [account])),
    ]);
    conversionQueue[account] = { conversions, collateralizedConversions };
  }

  return {
    type: "HiveInternalMarketObservationRecord",
    version: 1,
    observedAt: (request.now ? new Date(request.now) : new Date()).toISOString(),
    witnesses: [
      { node: primary, headBlockNumber: primaryDgp.head_block_number },
      { node: secondary, headBlockNumber: secondaryDgp.head_block_number },
    ],
    book: { depth, bids: (primaryBook.bids ?? []).map(projectEntry), asks: (primaryBook.asks ?? []).map(projectEntry) },
    bestBid,
    bestAsk,
    spread: { hbdPerHive: spreadHbdPerHive, basisPoints: spreadBasisPoints },
    depthWithinBand: { bandBasisPoints, bid: bidDepth, ask: askDepth },
    ticker: {
      latest: ticker.latest,
      lowestAsk: ticker.lowest_ask,
      highestBid: ticker.highest_bid,
      percentChange: ticker.percent_change,
      hiveVolume: naiToDecimalString(ticker.hive_volume),
      hbdVolume: naiToDecimalString(ticker.hbd_volume),
    },
    volume: { hiveVolume: naiToDecimalString(volume.hive_volume), hbdVolume: naiToDecimalString(volume.hbd_volume) },
    feed: { currentMedianHistory: feedMedian, impliedHbdPerHive },
    externalPrices: { source: "coingecko", coingeckoIds: COINGECKO_IDS, hiveUsd: hiveUsdString, hbdUsd: hbdUsdExternalString },
    internalHbdPriceUsd,
    haircut: {
      vsExternalHbdUsd: { absoluteUsd: haircutVsExternalUsd, basisPoints: haircutVsExternalBasisPoints },
      vsOneDollarPar: { absoluteUsd: haircutVsParUsd, basisPoints: haircutVsParBasisPoints },
    },
    conversionQueue,
  };
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "observe-hive-internal-market", description: "Observes the Hive base-layer internal HIVE/HBD market book, spread, and depth cross-checked across two public nodes, the recent ticker and volume, the feed's median price, the external HIVE and HBD USD prices, the resulting haircut, and the HBD conversion queue, read-only.", operation: observeHiveInternalMarket }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
