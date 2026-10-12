import assert from "node:assert/strict";
import test from "node:test";
import { gradedFromParts as amount, gradedValue } from "@red-cup-engineering/exact-number-data-service/graded";
import { rationalUnits } from "@red-cup-engineering/exact-number-data-service/decimal-string";
import { rationalOfBigInts } from "@red-cup-engineering/exact-number-data-service/exact-number";
import { parseEngineOrderBook, parseInternalOrderBook, bookReport, judgeIntent } from "@red-cup-engineering/hive-blockchain-client-service/market.mjs";
import { curationProposal } from "../src/computing/curation/curation.mjs";

test("historical order-book carrier parses exactly and preserves propose-only judgment", () => {
  const book = parseInternalOrderBook({ bids: [{ hive: 1000, hbd: 900 }], asks: [{ hive: 1000, hbd: 1100 }, { hive: 1000, hbd: 1200 }] });
  const reading = { venue: "hive-internal", baseSymbol: "HIVE", quoteSymbol: "HBD", book };
  assert.deepEqual(bookReport(reading), {
    bestBid: { exact: "9/10 HBD", display: "0.9" }, bestAsk: { exact: "11/10 HBD", display: "1.1" },
    spread: { exact: "1/5 HBD", display: "0.2" }, midpoint: { exact: "1/1 HBD", display: "1" }, relativeSpreadBps: 2000,
  });
  assert.deepEqual(judgeIntent(reading, { side: "buy", quantity: amount(3n, 2n, "HIVE"), maxSlippageBps: 2000 }), {
    kind: "markets.intent.witness",
    proposal: { venue: "hive-internal", baseSymbol: "HIVE", quoteSymbol: "HBD", side: "buy", quantity: "1.5", limitPrice: "1.2", averagePrice: "1.13333333", cost: "1.7", slippageBps: 1333 },
  });
  assert.equal(judgeIntent(reading, { side: "buy", quantity: amount(3n, 1n, "HIVE") }).obstruction, "insufficient-depth");
  const engine = parseEngineOrderBook([{ price: "0.100", quantity: "20" }], [{ price: "0.120", quantity: "1.5" }], "TOKEN");
  assert.deepEqual(engine.asks[0].price, amount(3n, 25n, "SWAP.HIVE"));
});

test("curation proposal prices a vote in HBD from the chain's reward formula", () => {
  const observation = {
    author: "writer", permlink: "post", ageSeconds: 900, netRshares: 1_000_000n, absRshares: 1_000_000n,
    pendingPayoutHbdMicro: 10_000_000n, distinctVoters: 8, topVoterRshares: 500_000n, children: 2,
    authorReputationRaw: 10_000_000_000n, inCommunity: true, allowsCurationRewards: true, hasSourceLinks: true,
  };
  const proposal = curationProposal(observation, { currentMana: 30_000_000_000n }, { weightBps: 5_000, votePowerReserveRate: 50, hbdPerRshare: rationalOfBigInts(1n, 1_000_000n) });
  // 10,000,000 rshares in the early window, at 1 µHBD per rshare, earn half their value: 5 HBD.
  assert.deepEqual({ usedMana: proposal.usedMana, ourRshares: proposal.ourRshares, eligible: proposal.eligible, window: proposal.window }, {
    usedMana: 60_000_000n, ourRshares: 10_000_000n, eligible: true, window: "early",
  });
  assert.equal(rationalUnits(gradedValue(proposal.expectedHbd), 3, { rounding: "toward-zero" }), 5000n);
  assert.equal(proposal.valuation.admitted, true);
  assert.equal(proposal.merit > 0n, true);
});
