# observe-hive-internal-market
## Requirements
- `observes-internal-market-book`: The operation reads `condenser_api.get_order_book` (depth from `request.orderBookDepth`, default {{order-book-depth}}) from two public Hive JSON-RPC nodes (`request.nodes`, default `["https://api.hive.blog","https://api.openhive.network"]`) and returns the primary node's bids/asks, the best bid and best ask (each node's own `real_price` decimal string), the spread in HBD-per-HIVE and in basis points, and the summed HIVE/HBD depth within `request.bandBasisPoints` (default {{band-basis-points}}) of the mid price. [claims: order-book-shape]
- `witnesses-two-nodes`: The operation also reads `condenser_api.get_dynamic_global_properties` from both nodes and returns a `witnesses` array naming each node and its `head_block_number`.
- `refuses-node-disagreement`: The operation refuses (throws, message prefixed `HIVE_INTERNAL_MARKET_NODE_DISAGREEMENT`) when the two nodes' `head_block_number` values differ by more than `request.maxBlockGap` (default {{max-block-gap}}), or their best-bid/best-ask `real_price` values differ by more than `request.toleranceBasisPoints` (default {{tolerance-basis-points}}) basis points.
- `reads-ticker-and-volume`: The operation reads `market_history_api.get_ticker` and `market_history_api.get_volume` from the primary node, converting any NAI-amount object (`{amount,precision,nai}`) to a decimal string via the house `formatScaled` decimal primitive.
- `reads-feed-median`: The operation reads `condenser_api.get_feed_history` from the primary node and returns its `current_median_history` alongside the HBD-per-HIVE ratio it implies.
- `reads-external-hbd-usd`: The operation fetches HIVE/USD and HBD/USD from CoinGecko by composing `@red-cup-engineering/computer-ledger-system-services-section`'s own `fetchCoingeckoUsdPrices` (ids `hive` and `hive_dollar`), never a second CoinGecko fetch wrapper.
- `computes-haircut`: The operation derives the internal-market HBD/USD price (external HIVE/USD divided by the feed's HBD-per-HIVE ratio) and reports its haircut both against the CoinGecko HBD/USD spot and against the {{hbd-peg-usd}} peg, each as an absolute-USD decimal string and a basis-point decimal string.
- `reads-conversion-queue`: The operation reads `condenser_api.get_conversion_requests` and `condenser_api.get_collateralized_conversion_requests` from the primary node for every account in `request.accounts` (default `["emsenn0","michael561"]`).
- `exact-decimal-strings`: Every numeric quantity in the returned record is a decimal string: chain-native strings passed through unchanged, or values derived using `@red-cup-engineering/computer-ledger-system-services-section`'s BigInt-scaled decimal primitives (`parseDecimal`, `formatScaled`, `addDecimalStrings`, `multiplyDecimalStrings`, `stripUnitSuffix`) plus this operation's own BigInt-scaled division helper — never a JavaScript float carried into the record.
- `read-only`: The operation calls only read (`condenser_api`/`market_history_api`) JSON-RPC methods and the CoinGecko read endpoint; it never broadcasts a transaction, never signs anything, and accepts no private key.
- `supports-deterministic-replay`: The operation accepts an optional `request.fixtures` (literal, JSON-serializable pre-recorded node/CoinGecko results) and `request.now` (an injectable observation instant); when both are given for every read the request would otherwise make, the operation makes no network call at all and returns a fully deterministic record, so its own examples are exact-reproducible without live chain or market state.
## Prohibitions
- `no-second-coingecko-fetch`: The operation must not implement its own CoinGecko HTTP call; it must call `@red-cup-engineering/computer-ledger-system-services-section`'s own `fetchCoingeckoUsdPrices`. [claims: coingecko-fetch-has-one-owner, dep-computer-ledger-system-services-section, coingecko-simple-price]
- `no-second-decimal-arithmetic`: The operation must not re-implement decimal-string parsing, formatting, addition, or multiplication that `@red-cup-engineering/computer-ledger-system-services-section`'s `decimal.mjs` already exports; it may add exactly one new BigInt-scaled decimal-division helper, because no house decimal-division-strings primitive exists yet. [claims: decimal-arithmetic-has-one-owner, dep-computer-ledger-system-services-section]
- `no-order-placement`: The operation must never call a broadcast/write JSON-RPC method (`broadcast_transaction`, `broadcast_transaction_synchronous`, or any `*_operation` custom_json/limit-order method) and must never accept, read, or require a private key. [claims: reads-do-not-place-orders]
- `no-silent-disagreement`: The operation must never average, arbitrarily pick one, or otherwise silently reconcile the two nodes' order-book or block-number readings when they disagree beyond the declared tolerance; it throws instead, naming both nodes and both values in the refusal message. [claims: disagreement-is-refused]
## Laws
- `primitives-exist-once` | 561 Group working discipline | 2026-08-30 | CLAUDE.md | Applies to the CoinGecko fetch and all decimal arithmetic in this operation. | The CoinGecko USD-price reader and the BigInt-scaled decimal parse/format/add/multiply primitives live once, in `@red-cup-engineering/computer-ledger-system-services-section`; this operation composes them by exact pin rather than reimplementing any of them.
- `fabricate-do-not-hand-write` | 561 Group working discipline, dispatch-agents skill | 2026-09-04 | .claude/skills/dispatch-agents/SKILL.md | Applies to this whole operation source file. | The operation is born through the jsnode fabrication line from this work order, never hand-written.
- `liquidity-stays-liquid` | Operating constraint | 2026-09-04 | lib/emsenn/services/561-group/services/561-group-services-section/content/text/glossary/terms/fintech-friday.md | Applies to the operation's read-only, no-order-placement scope. | Capital on Hive stays liquid, and what warrants a live key is a connected, deep quantitative system, never a passed checklist; this operation is the read-only book/spread/depth/haircut/queue measurement `task:hive-internal-market-peg-ladder` needs before any adapter is allowed to place an order.
- `frictions-are-duties` | 561 Group working discipline | 2026-09-04 | .claude/rules/working-discipline.md | Applies to the one new decimal-division helper this operation adds. | No house decimal-division-strings primitive exists yet (`@red-cup-engineering/computer-ledger-system-services-section`'s `decimal.mjs` exports add and multiply only); this gap is admitted as a friction against that package rather than silently grown into a second decimal library.
## Standards
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation and its import.meta.main guard. | The package uses one executable ESM operation source file eligible for downstream staged package-birth assays.
- `hive-condenser-and-market-history-api` | Hive blockchain developer portal | 2026 revision | https://developers.hive.io/apidefinitions/ | Applies to every `condenser_api`/`market_history_api` JSON-RPC method this operation calls. | The operation calls exactly the read methods this reference names (`get_order_book`, `get_dynamic_global_properties`, `get_ticker`, `get_volume`, `get_feed_history`, `get_conversion_requests`, `get_collateralized_conversion_requests`) with the parameter shapes it documents.
- `coingecko-public-api-v3` | CoinGecko | Public API v3 | https://www.coingecko.com/en/api/documentation | Applies to the external HIVE/HBD USD price read, reached through the reused `fetchCoingeckoUsdPrices`. | The operation relies on CoinGecko's `simple/price` endpoint semantics (USD per named coin id) exactly as that reused reader already assumes.
## Open questions
- `wider-node-consensus` [nonblocking]: Two-node cross-check only (`api.hive.blog`, `api.openhive.network` by default); a wider N-node median consensus and a streaming (rather than point-in-time) read are left to `task:hive-internal-market-peg-ladder` and `task:hive-custom-json-stream-listener`.
## Claims
- `dep-read-javascript-node-standard-input-text-service` | measured | dependency | @red-cup-engineering/read-javascript-node-standard-input-text-service@0.2.1 is published on the Group registry | none | data/records/2026-10-19-work-order-evidence/npm-view-red-cup-engineering-read-javascript-node-standard-input-text-service-0-2-1.json | sha256:a728c6154931435124f49239416dc3f77bb9a492cd712481edef01815daced41 | npm view of @red-cup-engineering/read-javascript-node-standard-input-text-service@0.2.1 returned its name, version and integrity (2026-10-19)
- `dep-computer-ledger-system-services-section` | measured | dependency | @red-cup-engineering/computer-ledger-system-services-section@0.2.0 is published on the Group registry | none | data/records/2026-10-19-work-order-evidence/npm-view-red-cup-engineering-computer-ledger-system-services-section-0-2-0.json | sha256:17aa8b1f0046f26500660945a69ab13b974d0810d14edefde42e25e89d8960e5 | npm view of @red-cup-engineering/computer-ledger-system-services-section@0.2.0 returned its name, version and integrity (2026-10-19)
- `order-book-shape` | measured | api | condenser_api.get_order_book answers a keyless JSON-RPC call with bids and asks that carry a real_price decimal string | none | data/records/2026-10-19-work-order-evidence/hive-order-book-20.json | sha256:4e2eb7341061bf5045c024331b0245853c2a1d1b3c141d8800e54aed93ca25d1 | POST https://api.hive.blog condenser_api.get_order_book [20] returned HTTP 200 with result.bids and result.asks rows holding real_price, hive and hbd (2026-10-19)
- `coingecko-simple-price` | measured | api | CoinGecko's public simple/price endpoint answers a keyless request with usd prices by coin id | none | data/records/2026-10-19-work-order-evidence/coingecko.json | sha256:20f9748b7a01e4ad669071159570f4e99243f55a2e1e04bd8a6669a4bd199ec6 | GET https://api.coingecko.com/api/v3/simple/price?ids=hive_dollar,hive&vs_currencies=usd returned HTTP 200 with a usd price per id (2026-10-19)
- `order-book-depth` | conjectured | parameter | Twenty price levels per side show the book's depth near the mid | 20 levels | The levels within the band of the mid fit inside the first levels of each side | The count of levels within the band of the mid on each side, over recorded books | condenser_api.get_order_book from the default nodes, sampled | Set the depth to the 99th percentile of levels within the band | The order's present default
- `band-basis-points` | conjectured | parameter | The depth that matters is the depth within this many basis points of the mid | 200 bp | Liquidity within a few percent of the mid is what a trade of this desk's size meets | The price impact of the desk's trade sizes against depth, by distance from the mid | Recorded books and the desk's intended sizes | Set the band to the distance within which the desk's largest trade clears | The order's present default
- `max-block-gap` | conjectured | parameter | Two nodes' head blocks differing by more than this many blocks are not reading the same chain state | 3 blocks | Healthy public nodes stay within a few blocks of each other | The head_block_number gap between the default nodes over time | condenser_api.get_dynamic_global_properties from both nodes, sampled | Set the gap to the 99.9th percentile of healthy gaps | The order's present default
- `tolerance-basis-points` | conjectured | parameter | Two nodes' best prices agreeing within this many basis points are one reading | 50 bp | A single order-book price differs between healthy nodes by less than a small fraction | The relative disagreement between the nodes' best bid and ask over time | condenser_api.get_order_book from both nodes, sampled | Set the tolerance to the 99th percentile of observed disagreement | The order's present default
- `hbd-peg-usd` | derived | parameter | Hive Backed Dollar is designed to track one US dollar | 1 USD | citation:Hive whitepaper, HBD is pegged to one US dollar by design | The peg is the design target the haircut is measured against
- `coingecko-fetch-has-one-owner` | derived | world | The CoinGecko price fetch has one owner, published at the exact version this order pins | none | constraint:primitives-exist-once; claim:dep-computer-ledger-system-services-section | The law places the primitive once in its owner, and the pinned owner is on the registry, so composing it leaves nothing to reimplement and a second implementation is outside what the law permits
- `decimal-arithmetic-has-one-owner` | derived | world | Decimal-string parsing, formatting, addition and multiplication have one owner, published at the exact version this order pins | none | constraint:primitives-exist-once; claim:dep-computer-ledger-system-services-section | The law places the primitive once in its owner, and the pinned owner is on the registry, so composing it leaves nothing to reimplement and a second implementation is outside what the law permits
- `reads-do-not-place-orders` | derived | world | The condenser API this operation reads is a read method set, and a broadcast or limit-order call is a different one | none | constraint:hive-condenser-and-market-history-api; requirement:observes-internal-market-book | The operation reads through the cited read API and holds no key to sign with
- `disagreement-is-refused` | derived | world | Two nodes that disagree beyond tolerance leave no reading to report without choosing between them | none | requirement:refuses-node-disagreement | The requirement refuses on disagreement, which is the only alternative to averaging or picking one
## Package
```json
{"packageName":"@red-cup-engineering/observe-hive-internal-market-service","packageVersion":"0.1.0","license":"UNLICENSED","dependencies":{"@red-cup-engineering/computer-ledger-system-services-section":"0.2.0","@red-cup-engineering/read-javascript-node-standard-input-text-service":"0.2.1"},"devDependencies":{}}
```
## Operation
```mjs path=scripts/observe-hive-internal-market.mjs
#!/usr/bin/env node
import { fetchCoingeckoUsdPrices } from "@red-cup-engineering/computer-ledger-system-services-section/src/coingecko.mjs";
import {
  parseDecimal,
  formatScaled,
  addDecimalStrings,
  multiplyDecimalStrings,
  stripUnitSuffix,
} from "@red-cup-engineering/computer-ledger-system-services-section/src/decimal.mjs";
import { readJavascriptNodeStandardInputText } from "@red-cup-engineering/read-javascript-node-standard-input-text-service";

const DEFAULT_NODES = Object.freeze(["https://api.hive.blog", "https://api.openhive.network"]);
const DEFAULT_ACCOUNTS = Object.freeze(["emsenn0", "michael561"]);
const COINGECKO_IDS = Object.freeze({ hive: "hive", hbd: "hive_dollar" });

/** Negate a plain decimal string (parseDecimal-conformant); "0" and "0.0" negate to themselves. */
function negateDecimalString(text) {
  const { negative, whole, frac } = parseDecimal(text);
  const body = frac === "" ? whole : `${whole}.${frac}`;
  if (/^0(\.0*)?$/u.test(body)) return body;
  return negative ? body : `-${body}`;
}

/**
 * Divide two plain decimal strings exactly via BigInt-scaled integer division, truncated (never
 * rounded up) to `maxDecimals` fractional digits. No house decimal-division primitive exists yet
 * (`@red-cup-engineering/computer-ledger-system-services-section`'s decimal.mjs exports add and
 * multiply only, per `frictions-are-duties`); this is the one arithmetic primitive this operation
 * adds, kept module-local.
 * @param {string} a
 * @param {string} b
 * @param {number} [maxDecimals]
 * @returns {string}
 */
function divideDecimalStrings(a, b, maxDecimals = 12) {
  const left = parseDecimal(a);
  const right = parseDecimal(b);
  const leftMagnitude = BigInt(`${left.whole}${left.frac}`);
  const rightMagnitude = BigInt(`${right.whole}${right.frac}`);
  if (rightMagnitude === 0n) throw new RangeError(`observe-hive-internal-market: division by zero (${b})`);
  const numerator = leftMagnitude * 10n ** BigInt(right.frac.length + maxDecimals);
  const denominator = rightMagnitude * 10n ** BigInt(left.frac.length);
  const magnitude = numerator / denominator;
  const negative = left.negative !== right.negative;
  return formatScaled(negative ? -magnitude : magnitude, maxDecimals);
}

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

/** POST one JSON-RPC 2.0 request and return its `result`, throwing on an HTTP or RPC error. */
async function callNode(node, method, params, fetchImpl) {
  const response = await fetchImpl(node, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`observe-hive-internal-market: HTTP ${response.status} from ${node} calling ${method}`);
  const body = await response.json();
  if (body?.error) throw new Error(`observe-hive-internal-market: RPC error from ${node} calling ${method}: ${JSON.stringify(body.error)}`);
  return body?.result;
}

/** The order-book entry with the extreme `real_price` (`isBetter(candidate, current) => boolean`). */
function bestOf(entries, isBetter) {
  return (entries ?? []).reduce((best, entry) => (best === null || isBetter(Number(entry.real_price), Number(best.real_price)) ? entry : best), null);
}

/** Relative gap between two decimal-string prices, in basis points of their mean; `Infinity` if either is not finite. */
function relativeBpsGap(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity;
  const mid = (x + y) / 2;
  if (mid === 0) return 0;
  return (Math.abs(x - y) / mid) * 10000;
}

/** Sum an order-book side's HIVE/HBD amounts whose `real_price` lies within `bandBasisPoints` of `mid` (comparison only; reported sums stay exact BigInt-scaled). */
function sumWithinBand(entries, mid, bandBasisPoints, side) {
  const midNumber = Number(mid);
  const bound = midNumber * (bandBasisPoints / 10000);
  const lower = midNumber - bound;
  const upper = midNumber + bound;
  const within = (entries ?? []).filter((entry) => {
    const price = Number(entry.real_price);
    return side === "bid" ? price >= lower : price <= upper;
  });
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
 * @param {readonly string[]} [request.accounts] Accounts to read the HBD conversion queue for (default `["emsenn0","michael561"]`).
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
    resolveOrCall(fixtures?.dynamicGlobalProperties?.[primary], () => callNode(primary, "condenser_api.get_dynamic_global_properties", [], fetchImpl)),
    resolveOrCall(fixtures?.dynamicGlobalProperties?.[secondary], () => callNode(secondary, "condenser_api.get_dynamic_global_properties", [], fetchImpl)),
  ]);
  const [primaryBook, secondaryBook] = await Promise.all([
    resolveOrCall(fixtures?.orderBook?.[primary], () => callNode(primary, "condenser_api.get_order_book", [depth], fetchImpl)),
    resolveOrCall(fixtures?.orderBook?.[secondary], () => callNode(secondary, "condenser_api.get_order_book", [depth], fetchImpl)),
  ]);

  const blockGap = Math.abs(primaryDgp.head_block_number - secondaryDgp.head_block_number);
  if (blockGap > maxBlockGap) {
    throw new Error(
      `HIVE_INTERNAL_MARKET_NODE_DISAGREEMENT: head_block_number gap ${blockGap} exceeds maxBlockGap ${maxBlockGap} (${primary}=${primaryDgp.head_block_number}, ${secondary}=${secondaryDgp.head_block_number})`,
    );
  }

  const primaryBestBid = bestOf(primaryBook.bids, (a, b) => a > b);
  const primaryBestAsk = bestOf(primaryBook.asks, (a, b) => a < b);
  const secondaryBestBid = bestOf(secondaryBook.bids, (a, b) => a > b);
  const secondaryBestAsk = bestOf(secondaryBook.asks, (a, b) => a < b);
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
    resolveOrCall(fixtures?.ticker, () => callNode(primary, "market_history_api.get_ticker", {}, fetchImpl)),
    resolveOrCall(fixtures?.volume, () => callNode(primary, "market_history_api.get_volume", {}, fetchImpl)),
    resolveOrCall(fixtures?.feedHistory, () => callNode(primary, "condenser_api.get_feed_history", [], fetchImpl)),
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
      resolveOrCall(fixtureEntry?.conversions, () => callNode(primary, "condenser_api.get_conversion_requests", [account], fetchImpl)),
      resolveOrCall(fixtureEntry?.collateralizedConversions, () => callNode(primary, "condenser_api.get_collateralized_conversion_requests", [account], fetchImpl)),
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
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "observeHiveInternalMarket — Observes the Hive base-layer internal HIVE/HBD market book, spread, and depth cross-checked across two public nodes, the recent ticker and volume, the feed's median price, the external HIVE and HBD USD prices, the resulting haircut, and the HBD conversion queue, read-only.\n",
    );
  } else {
    const inputText = (await readJavascriptNodeStandardInputText({ type: "JavascriptNodeStandardInputTextReadRequest", version: 1 }, { standardInput: process.stdin })).text;
    for (const line of inputText.split("\n")) {
      if (line.length === 0) continue;
      try {
        process.stdout.write(`${JSON.stringify(await observeHiveInternalMarket(JSON.parse(line)))}\n`);
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  }
}
```
## Tests
```mjs path=test/observe-hive-internal-market.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { observeHiveInternalMarket } from "../scripts/observe-hive-internal-market.mjs";

const PRIMARY = "https://mock-primary.example";
const SECONDARY = "https://mock-secondary.example";

function bookFixture({ bidPrice, askPrice }) {
  return {
    bids: [
      { real_price: bidPrice, hive: 100000, hbd: 5490, created: "2026-09-05T00:00:00", order_price: { base: "5.490 HBD", quote: "100.000 HIVE" } },
      { real_price: "0.03", hive: 200000, hbd: 6000, created: "2026-09-05T00:00:01", order_price: { base: "6.000 HBD", quote: "200.000 HIVE" } },
    ],
    asks: [
      { real_price: askPrice, hive: 50000, hbd: 2755, created: "2026-09-05T00:00:02", order_price: { base: "2.755 HBD", quote: "50.000 HIVE" } },
      { real_price: "0.09", hive: 80000, hbd: 7200, created: "2026-09-05T00:00:03", order_price: { base: "7.200 HBD", quote: "80.000 HIVE" } },
    ],
  };
}

function makeMockFetch({ primaryBlock, secondaryBlock, primaryBook, secondaryBook, coingecko, conversions }) {
  return async (input, init) => {
    if (init?.method === "POST") {
      const node = String(input);
      const body = JSON.parse(init.body);
      if (body.method === "condenser_api.get_dynamic_global_properties") {
        return { ok: true, status: 200, json: async () => ({ result: { head_block_number: node === PRIMARY ? primaryBlock : secondaryBlock } }) };
      }
      if (body.method === "condenser_api.get_order_book") {
        return { ok: true, status: 200, json: async () => ({ result: node === PRIMARY ? primaryBook : secondaryBook }) };
      }
      if (body.method === "market_history_api.get_ticker") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              latest: "0.055", lowest_ask: "0.0551", highest_bid: "0.0549", percent_change: "0",
              hive_volume: { amount: "1000000", precision: 3, nai: "@@000000021" },
              hbd_volume: { amount: "50000", precision: 3, nai: "@@000000013" },
            },
          }),
        };
      }
      if (body.method === "market_history_api.get_volume") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              hive_volume: { amount: "1000000", precision: 3, nai: "@@000000021" },
              hbd_volume: { amount: "50000", precision: 3, nai: "@@000000013" },
            },
          }),
        };
      }
      if (body.method === "condenser_api.get_feed_history") {
        return { ok: true, status: 200, json: async () => ({ result: { current_median_history: { base: "0.05 HBD", quote: "1.000 HIVE" } } }) };
      }
      if (body.method === "condenser_api.get_conversion_requests") {
        return { ok: true, status: 200, json: async () => ({ result: conversions?.[body.params[0]]?.conversions ?? [] }) };
      }
      if (body.method === "condenser_api.get_collateralized_conversion_requests") {
        return { ok: true, status: 200, json: async () => ({ result: conversions?.[body.params[0]]?.collateralizedConversions ?? [] }) };
      }
      throw new Error(`unmocked method ${body.method}`);
    }
    return { ok: true, status: 200, json: async () => coingecko };
  };
}

test("observes the internal market book, spread, depth, ticker, feed, external price, haircut, and conversion queue", async () => {
  const book = bookFixture({ bidPrice: "0.0549", askPrice: "0.0551" });
  const fetchImpl = makeMockFetch({
    primaryBlock: 100000,
    secondaryBlock: 100001,
    primaryBook: book,
    secondaryBook: book,
    coingecko: { hive: { usd: 0.05 }, hive_dollar: { usd: 0.94 } },
    conversions: { emsenn0: { conversions: [{ id: 1, owner: "emsenn0", requestid: 1, amount: "10.000 HBD", conversion_date: "2026-09-10T00:00:00" }], collateralizedConversions: [] } },
  });

  const record = await observeHiveInternalMarket({ nodes: [PRIMARY, SECONDARY], fetchImpl });

  assert.equal(record.type, "HiveInternalMarketObservationRecord");
  assert.deepEqual(record.witnesses, [
    { node: PRIMARY, headBlockNumber: 100000 },
    { node: SECONDARY, headBlockNumber: 100001 },
  ]);
  assert.equal(record.bestBid, "0.0549");
  assert.equal(record.bestAsk, "0.0551");
  assert.equal(record.spread.hbdPerHive, "0.0002");
  assert.equal(record.spread.basisPoints, "36.363636");
  assert.equal(record.depthWithinBand.bid.hive, "100");
  assert.equal(record.depthWithinBand.bid.hbd, "5.49");
  assert.equal(record.depthWithinBand.bid.orders, 1);
  assert.equal(record.depthWithinBand.ask.hive, "50");
  assert.equal(record.depthWithinBand.ask.hbd, "2.755");
  assert.equal(record.depthWithinBand.ask.orders, 1);
  assert.equal(record.ticker.hiveVolume, "1000");
  assert.equal(record.ticker.hbdVolume, "50");
  assert.equal(record.volume.hiveVolume, "1000");
  assert.equal(record.volume.hbdVolume, "50");
  assert.ok(Math.abs(Number(record.feed.impliedHbdPerHive) - 0.05) < 1e-9);
  assert.equal(record.externalPrices.hiveUsd, "0.05");
  assert.equal(record.externalPrices.hbdUsd, "0.94");
  assert.equal(record.internalHbdPriceUsd, "1");
  assert.equal(record.haircut.vsOneDollarPar.absoluteUsd, "0");
  assert.equal(record.haircut.vsOneDollarPar.basisPoints, "0");
  assert.equal(record.haircut.vsExternalHbdUsd.absoluteUsd, "0.06");
  assert.equal(record.haircut.vsExternalHbdUsd.basisPoints, "638.297872");
  assert.equal(record.conversionQueue.emsenn0.conversions.length, 1);
  assert.equal(record.conversionQueue.michael561.conversions.length, 0);
});

test("refuses when the two nodes' head_block_number disagrees beyond maxBlockGap", async () => {
  const book = bookFixture({ bidPrice: "0.0549", askPrice: "0.0551" });
  const fetchImpl = makeMockFetch({
    primaryBlock: 100000,
    secondaryBlock: 100010,
    primaryBook: book,
    secondaryBook: book,
    coingecko: { hive: { usd: 0.05 }, hive_dollar: { usd: 0.94 } },
    conversions: {},
  });
  await assert.rejects(
    observeHiveInternalMarket({ nodes: [PRIMARY, SECONDARY], fetchImpl }),
    /HIVE_INTERNAL_MARKET_NODE_DISAGREEMENT: head_block_number gap/u,
  );
});

test("refuses when the two nodes' best bid/ask disagrees beyond toleranceBasisPoints", async () => {
  const primaryBook = bookFixture({ bidPrice: "0.0549", askPrice: "0.0551" });
  const secondaryBook = bookFixture({ bidPrice: "0.10", askPrice: "0.11" });
  const fetchImpl = makeMockFetch({
    primaryBlock: 100000,
    secondaryBlock: 100000,
    primaryBook,
    secondaryBook,
    coingecko: { hive: { usd: 0.05 }, hive_dollar: { usd: 0.94 } },
    conversions: {},
  });
  await assert.rejects(
    observeHiveInternalMarket({ nodes: [PRIMARY, SECONDARY], fetchImpl }),
    /HIVE_INTERNAL_MARKET_NODE_DISAGREEMENT: best-bid\/best-ask gap/u,
  );
});

test("refuses a request naming fewer than two nodes", async () => {
  await assert.rejects(observeHiveInternalMarket({ nodes: [PRIMARY] }), /request\.nodes must name at least two nodes/u);
});
```
## Examples
```json name="cross-checks two agreeing fixture nodes and reports a $0.06 haircut against the external HBD spot"
{"input":{"nodes":["https://api.hive.blog","https://api.openhive.network"],"now":"2026-09-05T00:00:00.000Z","fixtures":{"dynamicGlobalProperties":{"https://api.hive.blog":{"head_block_number":100000},"https://api.openhive.network":{"head_block_number":100001}},"orderBook":{"https://api.hive.blog":{"bids":[{"real_price":"0.0549","hive":100000,"hbd":5490,"created":"2026-09-05T00:00:00"},{"real_price":"0.03","hive":200000,"hbd":6000,"created":"2026-09-05T00:00:01"}],"asks":[{"real_price":"0.0551","hive":50000,"hbd":2755,"created":"2026-09-05T00:00:02"},{"real_price":"0.09","hive":80000,"hbd":7200,"created":"2026-09-05T00:00:03"}]},"https://api.openhive.network":{"bids":[{"real_price":"0.0549","hive":100000,"hbd":5490,"created":"2026-09-05T00:00:00"},{"real_price":"0.03","hive":200000,"hbd":6000,"created":"2026-09-05T00:00:01"}],"asks":[{"real_price":"0.0551","hive":50000,"hbd":2755,"created":"2026-09-05T00:00:02"},{"real_price":"0.09","hive":80000,"hbd":7200,"created":"2026-09-05T00:00:03"}]}},"ticker":{"latest":"0.055","lowest_ask":"0.0551","highest_bid":"0.0549","percent_change":"0","hive_volume":{"amount":"1000000","precision":3,"nai":"@@000000021"},"hbd_volume":{"amount":"50000","precision":3,"nai":"@@000000013"}},"volume":{"hive_volume":{"amount":"1000000","precision":3,"nai":"@@000000021"},"hbd_volume":{"amount":"50000","precision":3,"nai":"@@000000013"}},"feedHistory":{"current_median_history":{"base":"0.05 HBD","quote":"1.000 HIVE"}},"conversionQueue":{"emsenn0":{"conversions":[{"id":1,"owner":"emsenn0","requestid":1,"amount":"10.000 HBD","conversion_date":"2026-09-10T00:00:00"}],"collateralizedConversions":[]},"michael561":{"conversions":[],"collateralizedConversions":[]}},"coingecko":{"hive":0.05,"hive_dollar":0.94}}},"output":{"type":"HiveInternalMarketObservationRecord","version":1,"observedAt":"2026-09-05T00:00:00.000Z","witnesses":[{"node":"https://api.hive.blog","headBlockNumber":100000},{"node":"https://api.openhive.network","headBlockNumber":100001}],"book":{"depth":20,"bids":[{"priceHbdPerHive":"0.0549","hive":"100","hbd":"5.49","created":"2026-09-05T00:00:00"},{"priceHbdPerHive":"0.03","hive":"200","hbd":"6","created":"2026-09-05T00:00:01"}],"asks":[{"priceHbdPerHive":"0.0551","hive":"50","hbd":"2.755","created":"2026-09-05T00:00:02"},{"priceHbdPerHive":"0.09","hive":"80","hbd":"7.2","created":"2026-09-05T00:00:03"}]},"bestBid":"0.0549","bestAsk":"0.0551","spread":{"hbdPerHive":"0.0002","basisPoints":"36.363636"},"depthWithinBand":{"bandBasisPoints":200,"bid":{"hive":"100","hbd":"5.49","orders":1},"ask":{"hive":"50","hbd":"2.755","orders":1}},"ticker":{"latest":"0.055","lowestAsk":"0.0551","highestBid":"0.0549","percentChange":"0","hiveVolume":"1000","hbdVolume":"50"},"volume":{"hiveVolume":"1000","hbdVolume":"50"},"feed":{"currentMedianHistory":{"base":"0.05 HBD","quote":"1.000 HIVE"},"impliedHbdPerHive":"0.05"},"externalPrices":{"source":"coingecko","coingeckoIds":{"hive":"hive","hbd":"hive_dollar"},"hiveUsd":"0.05","hbdUsd":"0.94"},"internalHbdPriceUsd":"1","haircut":{"vsExternalHbdUsd":{"absoluteUsd":"0.06","basisPoints":"638.297872"},"vsOneDollarPar":{"absoluteUsd":"0","basisPoints":"0"}},"conversionQueue":{"emsenn0":{"conversions":[{"id":1,"owner":"emsenn0","requestid":1,"amount":"10.000 HBD","conversion_date":"2026-09-10T00:00:00"}],"collateralizedConversions":[]},"michael561":{"conversions":[],"collateralizedConversions":[]}}}}
```
## Traceability
- `observes-internal-market-book` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`, `hive-condenser-and-market-history-api`
- `witnesses-two-nodes` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-and-market-history-api`
- `refuses-node-disagreement` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-and-market-history-api`
- `reads-ticker-and-volume` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-and-market-history-api`, `primitives-exist-once`
- `reads-feed-median` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-and-market-history-api`
- `reads-external-hbd-usd` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `coingecko-public-api-v3`, `primitives-exist-once`
- `computes-haircut` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `frictions-are-duties`, `primitives-exist-once`
- `reads-conversion-queue` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-and-market-history-api`
- `exact-decimal-strings` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`, `frictions-are-duties`
- `read-only` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `liquidity-stays-liquid`, `fabricate-do-not-hand-write`
- `no-second-coingecko-fetch` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `coingecko-public-api-v3`, `primitives-exist-once`
- `no-second-decimal-arithmetic` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`, `frictions-are-duties`
- `no-order-placement` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `liquidity-stays-liquid`
- `no-silent-disagreement` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-and-market-history-api`
- `supports-deterministic-replay` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`, `fabricate-do-not-hand-write`
