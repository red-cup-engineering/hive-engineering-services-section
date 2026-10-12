/** Plain-fetch reads against the public Hive and Hive-Engine JSON-RPC endpoints. No Hive read
 *  client is published on the house registry; this is the thin, direct substitute. */

const HIVE_API = "https://api.hive.blog";
const HIVE_ENGINE_API = "https://api.hive-engine.com/rpc/contracts";

/**
 * @typedef {{ name: string, balance: string, hbd_balance: string, vesting_shares: string }} HiveAccount
 * @typedef {{ account: string, symbol: string, balance: string, stake?: string }} HiveEngineBalance
 */

function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/**
 * POST one JSON-RPC request, retrying a transient HTTP 5xx response a bounded number of times
 * with linear backoff. Public Hive-Engine nodes rate-limit under burst concurrency; a 503 there
 * is momentary load, not evidence the data does not exist.
 */
async function postJsonRpc(url, method, params, fetchImpl, { retries = 4, retryDelayMs = 400 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await delay(retryDelayMs * attempt);
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!response.ok) {
      lastError = new Error(`hive-chain: HTTP ${response.status} from ${url}`);
      if (response.status >= 500 && attempt < retries) continue;
      throw lastError;
    }
    const body = await response.json();
    if (body?.error) throw new Error(`hive-chain: RPC error from ${url}: ${JSON.stringify(body.error)}`);
    return body?.result;
  }
  throw lastError;
}

/**
 * Read Hive accounts via `condenser_api.get_accounts`.
 * @param {readonly string[]} accountNames
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<HiveAccount[]>}
 */
export async function fetchHiveAccounts(accountNames, { fetchImpl = fetch } = {}) {
  const result = await postJsonRpc(HIVE_API, "condenser_api.get_accounts", [accountNames], fetchImpl);
  if (!Array.isArray(result)) throw new Error("hive-chain: get_accounts did not return an array");
  return result;
}

/**
 * Read Hive-Engine fungible token balances for a set of accounts via the `tokens`/`balances`
 * table. Excludes NFT instances by construction: this table holds only fungible balances.
 * @param {readonly string[]} accountNames
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<HiveEngineBalance[]>}
 */
export async function fetchHiveEngineBalances(accountNames, { fetchImpl = fetch } = {}) {
  const result = await postJsonRpc(HIVE_ENGINE_API, "find", {
    contract: "tokens", table: "balances", query: { account: { $in: accountNames } }, limit: 1000,
  }, fetchImpl);
  if (!Array.isArray(result)) throw new Error("hive-chain: tokens/balances did not return an array");
  return result;
}

/**
 * Read a Hive-Engine token's market metrics (its `lastPrice` in SWAP.HIVE), if a market exists
 * for it.
 * @param {string} symbol
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ symbol: string, lastPrice: string } | null>}
 */
export async function fetchHiveEngineMetrics(symbol, { fetchImpl = fetch } = {}) {
  const result = await postJsonRpc(HIVE_ENGINE_API, "find", {
    contract: "market", table: "metrics", query: { symbol },
  }, fetchImpl);
  if (!Array.isArray(result) || result.length === 0) return null;
  return { symbol: result[0].symbol, lastPrice: result[0].lastPrice };
}
