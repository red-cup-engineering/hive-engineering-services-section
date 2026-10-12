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

function makeMockFetch(options) {
  const answer = answerMock(options);
  return async (input, init) => {
    const reply = await answer(input, init);
    return new Response(JSON.stringify(await reply.json()), { status: reply.status });
  };
}

function answerMock({ primaryBlock, secondaryBlock, primaryBook, secondaryBook, coingecko, conversions }) {
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

  const record = await observeHiveInternalMarket({ nodes: [PRIMARY, SECONDARY], accounts: ["emsenn0", "michael561"], fetchImpl });

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
    observeHiveInternalMarket({ nodes: [PRIMARY, SECONDARY], accounts: ["emsenn0", "michael561"], fetchImpl }),
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
    observeHiveInternalMarket({ nodes: [PRIMARY, SECONDARY], accounts: ["emsenn0", "michael561"], fetchImpl }),
    /HIVE_INTERNAL_MARKET_NODE_DISAGREEMENT: best-bid\/best-ask gap/u,
  );
});

test("refuses a request naming fewer than two nodes", async () => {
  await assert.rejects(observeHiveInternalMarket({ nodes: [PRIMARY] }), /request\.nodes must name at least two nodes/u);
});
