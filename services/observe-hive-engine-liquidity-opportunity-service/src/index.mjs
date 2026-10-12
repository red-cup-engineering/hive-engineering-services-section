/** Keyless discovery of one Hive Engine constant-product liquidity opportunity. */
import { normalizeEarningOpportunity } from "@red-cup-engineering/normalize-earning-opportunity-service";
import { EngineClient, ENGINE_NODES } from "@red-cup-engineering/hive-blockchain-client-service/engine.mjs";
const ACCOUNT = /^[a-z][a-z0-9.-]{2,15}$/u;
const SYMBOL = /^[A-Z][A-Z0-9.]{0,15}$/u;

function validateInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("hive-engine opportunity: input must be an object");
  }
  if (!ACCOUNT.test(input.account ?? "")) throw new TypeError("hive-engine opportunity: invalid public account");
  if (!SYMBOL.test(input.baseSymbol ?? "") || !SYMBOL.test(input.quoteSymbol ?? "")) {
    throw new TypeError("hive-engine opportunity: invalid token symbol");
  }
  if (input.baseSymbol === input.quoteSymbol) throw new RangeError("hive-engine opportunity: token symbols must differ");
  return Object.freeze({ account: input.account, baseSymbol: input.baseSymbol, quoteSymbol: input.quoteSymbol });
}

function findParams(contract, table, query, limit = 2) {
  return { contract, table, query, limit, offset: 0 };
}

function one(path, rows) {
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Hive Engine ${path} must return exactly one row`);
  return rows[0];
}

function positive(path, value) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value) || Number(value) <= 0) {
    throw new Error(`Hive Engine ${path} must be a positive decimal`);
  }
  return value;
}

/**
 * Read public contract tables only. This operation cannot sign, construct, or
 * broadcast a transaction, and the returned candidate is not an action grant.
 */
export async function observeHiveEngineLiquidityOpportunity(input, injected = {}) {
  const { account, baseSymbol, quoteSymbol } = validateInput(input);
  const fetchImpl = injected.fetchImpl ?? fetch;
  const timeoutMs = injected.timeoutMs ?? 15_000;
  const now = injected.now ?? (() => new Date());
  const observedDate = now();
  if (!(observedDate instanceof Date) || !Number.isFinite(observedDate.getTime())) {
    throw new TypeError("hive-engine opportunity: now() must return a valid Date");
  }
  // One node for the whole observation, so the block boundary and the rows come from one view.
  const node = injected.node ?? ENGINE_NODES[0];
  const engine = new EngineClient({ nodes: [node], fetch: fetchImpl, timeout: timeoutMs });
  const contractsEndpoint = `${node}/contracts`;
  const blockchainEndpoint = `${node}/blockchain`;
  const pair = `${baseSymbol}:${quoteSymbol}`;
  const baseQuery = findParams("tokens", "balances", { account, symbol: baseSymbol });
  const quoteQuery = findParams("tokens", "balances", { account, symbol: quoteSymbol });
  const poolQuery = findParams("marketpools", "pools", { tokenPair: pair });
  const paramsQuery = findParams("marketpools", "params", {});

  const beforeBlock = await engine.getLatestBlockInfo();
  const [baseRows, quoteRows, poolRows, parameterRows] = await Promise.all([
    engine.call("contracts", "find", baseQuery),
    engine.call("contracts", "find", quoteQuery),
    engine.call("contracts", "find", poolQuery),
    engine.call("contracts", "find", paramsQuery),
  ]);
  const afterBlock = await engine.getLatestBlockInfo();
  const base = one(`${baseSymbol} balance`, baseRows);
  const quote = one(`${quoteSymbol} balance`, quoteRows);
  const pool = one(`${pair} pool`, poolRows);
  const parameters = one("marketpools parameters", parameterRows);
  const baseBalance = positive(`${baseSymbol} balance`, base.balance);
  const quoteBalance = positive(`${quoteSymbol} balance`, quote.balance);
  const baseReserve = positive(`${pair} base reserve`, pool.baseQuantity);
  const quoteReserve = positive(`${pair} quote reserve`, pool.quoteQuantity);
  const tradeFeeMultiplier = positive("trade fee multiplier", parameters.tradeFeeMul);
  const feeFraction = (1 - Number(tradeFeeMultiplier)).toFixed(4);
  if (Number(feeFraction) <= 0 || Number(feeFraction) >= 1) {
    throw new Error("Hive Engine trade fee multiplier does not imply a bounded positive fee");
  }
  const blockNumber = beforeBlock.blockNumber;
  const blockHash = beforeBlock.hash;
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 0 || !/^[0-9a-f]{64}$/u.test(blockHash ?? "")) {
    throw new Error("Hive Engine latest block boundary is invalid");
  }
  if (afterBlock.blockNumber !== blockNumber || afterBlock.hash !== blockHash) {
    throw new Error("Hive Engine block advanced during the opportunity observation");
  }

  const provenance = [
    { endpoint: blockchainEndpoint, method: "getLatestBlockInfo", params: {} },
    { endpoint: contractsEndpoint, method: "find", params: baseQuery },
    { endpoint: contractsEndpoint, method: "find", params: quoteQuery },
    { endpoint: contractsEndpoint, method: "find", params: poolQuery },
    { endpoint: contractsEndpoint, method: "find", params: paramsQuery },
    { endpoint: blockchainEndpoint, method: "getLatestBlockInfo", params: {} },
  ];
  return normalizeEarningOpportunity({
    id: `hive-engine:marketpools:${pair}:${account}`,
    chain: "hive:mainnet/hive-engine",
    account,
    provider: "Hive Engine marketpools",
    mechanism: `constant-product liquidity provision earning the pool's ${feeFraction} gross swap fee`,
    underlyings: [baseSymbol, quoteSymbol],
    apy: {
      availability: "unavailable",
      value: null,
      denomination: `${pair} pool-share value`,
      method: `gross fee fraction ${feeFraction}; APY requires time-bounded volume and pool-share history`,
      reason: "the public contract table exposes cumulative volume, not a time-bounded fee series",
    },
    liquidity: {
      kind: "constant-product-pool-reserves",
      capacity: { [baseSymbol]: baseReserve, [quoteSymbol]: quoteReserve, totalShares: positive("pool shares", pool.totalShares) },
      accountAvailable: { [baseSymbol]: baseBalance, [quoteSymbol]: quoteBalance },
    },
    changedRisks: [
      "two-sided exposure replaces separate liquid holdings",
      "relative-price movement creates impermanent loss versus holding the two assets",
      "Hive Engine contract and sidechain availability become exit dependencies",
      "quoted reserves do not guarantee execution price for a later withdrawal or swap",
    ],
    exit: {
      operation: "Hive Engine marketpools removeLiquidity",
      receives: [baseSymbol, quoteSymbol],
      constraints: [
        "requires the account's active authority and a separately authorized transaction",
        "received quantities depend on the account's pool share and reserves at execution",
        "subsequent conversion of either underlying is a separate market action",
      ],
    },
    freshness: {
      observedAt: observedDate.toISOString(),
      chainBoundary: { blockNumber, blockHash },
      provenance,
    },
  });
}
