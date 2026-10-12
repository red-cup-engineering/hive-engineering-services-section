import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchHiveAccounts,
  fetchHiveEngineBalances,
  fetchHiveEngineMetrics,
} from "../src/index.mjs";

function jsonResponse(result) {
  return { ok: true, async json() { return { jsonrpc: "2.0", result }; } };
}

test("reads Hive accounts through the condenser RPC", async () => {
  const requests = [];
  const accounts = await fetchHiveAccounts(["aagaard"], {
    fetchImpl: async (url, request) => {
      requests.push({ url, body: JSON.parse(request.body) });
      return jsonResponse([{ name: "aagaard", balance: "1.000 HIVE" }]);
    },
  });

  assert.deepEqual(accounts, [{ name: "aagaard", balance: "1.000 HIVE" }]);
  assert.equal(requests[0].url, "https://api.hive.blog");
  assert.deepEqual(requests[0].body, {
    jsonrpc: "2.0", id: 1, method: "condenser_api.get_accounts", params: [["aagaard"]],
  });
});

test("reads fungible Hive-Engine balances and market metrics", async () => {
  const requests = [];
  const fetchImpl = async (_url, request) => {
    const body = JSON.parse(request.body);
    requests.push(body);
    if (body.params.table === "balances") {
      return jsonResponse([{ account: "aagaard", symbol: "BEE", balance: "2", stake: "3" }]);
    }
    return jsonResponse([{ symbol: "BEE", lastPrice: "0.001" }]);
  };

  assert.deepEqual(await fetchHiveEngineBalances(["aagaard"], { fetchImpl }), [
    { account: "aagaard", symbol: "BEE", balance: "2", stake: "3" },
  ]);
  assert.deepEqual(await fetchHiveEngineMetrics("BEE", { fetchImpl }), {
    symbol: "BEE", lastPrice: "0.001",
  });
  assert.deepEqual(requests.map((request) => request.params), [
    { contract: "tokens", table: "balances", query: { account: { $in: ["aagaard"] } }, limit: 1000 },
    { contract: "market", table: "metrics", query: { symbol: "BEE" } },
  ]);
});

test("retries a transient Hive-Engine response and treats an absent market as no metric", async () => {
  let attempts = 0;
  const metric = await fetchHiveEngineMetrics("NO-MARKET", {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) return { ok: false, status: 503 };
      return jsonResponse([]);
    },
  });
  assert.equal(attempts, 2);
  assert.equal(metric, null);
});
