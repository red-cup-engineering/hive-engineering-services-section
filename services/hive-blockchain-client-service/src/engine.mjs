// engine — the Hive-Engine sidechain: its JSON-RPC reads and its contract actions.
//
// Reads go to a node's /contracts endpoint (find, findOne, getContract) or /blockchain endpoint
// (getTransactionInfo, getLatestBlockInfo, getBlockInfo), with the same failover as the L1
// RpcClient; `each` sends one request to every node so a caller can cross-check them.
//
// Writes are contract actions `{ contractName, contractAction, contractPayload }` riding an L1
// custom_json with id "ssc-mainnet-hive", signed by the ACTIVE key (every token, market, pool
// and nft action asserts isSignedWithActiveKey). One custom_json may carry several actions,
// executed in order. Payloads follow github.com/hive-engine/hivesmartcontracts contracts/*.js.
import { RpcClient } from "./rpc.mjs";
import { customJson } from "./ops.mjs";
import { formatUnits } from "@red-cup-engineering/exact-number-data-service/decimal-string";

export const ENGINE_NODES = [
  "https://api.hive-engine.com/rpc",
  "https://herpc.dtools.dev",
  "https://herpc.liotes.com",
  "https://api2.hive-engine.com/rpc",
];

export class EngineClient {
  constructor({ nodes = ENGINE_NODES, timeout = 8000, transport, fetch, serial = false } = {}) {
    this.nodes = [...nodes];
    this.contracts = new RpcClient({ nodes: this.nodes.map((n) => `${n}/contracts`), timeout, transport, fetch });
    this.blockchain = new RpcClient({ nodes: this.nodes.map((n) => `${n}/blockchain`), timeout, transport: this.contracts.transport });
    // serial: one request in flight at a time, for callers that must stay under node rate limits.
    this.serial = serial;
    this._tail = Promise.resolve();
  }

  _slot(read) {
    if (!this.serial) return read();
    const run = this._tail.then(read, read);
    this._tail = run.catch(() => {});
    return run;
  }

  call(endpoint, method, params) {
    return this._slot(() => this[endpoint].call(method, params));
  }

  // The same request to every node, and a read a quorum of nodes answers identically.
  each(endpoint, method, params) { return this._slot(() => this[endpoint].each(method, params)); }
  consensus(endpoint, method, params, options) { return this._slot(() => this[endpoint].consensus(method, params, options)); }

  find(contract, table, query = {}, { limit = 1000, offset = 0, indexes } = {}) {
    return this.call("contracts", "find", { contract, table, query, limit, offset, ...(indexes ? { indexes } : {}) });
  }

  findOne(contract, table, query = {}) {
    return this.call("contracts", "findOne", { contract, table, query });
  }

  getContract(name) {
    return this.call("contracts", "getContract", { name });
  }

  getLatestBlockInfo() {
    return this.call("blockchain", "getLatestBlockInfo", {});
  }

  getBlockInfo(blockNumber) {
    return this.call("blockchain", "getBlockInfo", { blockNumber });
  }

  // The sidechain transaction for an id, or null. The n-th action of a multi-action L1
  // custom_json is recorded as `<l1 txid>-<n>`; `action` selects it.
  async getTransactionInfo(txid, action) {
    return this.call("blockchain", "getTransactionInfo", { txid: action === undefined ? txid : `${txid}-${action}` });
  }

  // --- common tables ---
  // Fungible balances (liquid `balance`, `stake`, delegations) for one account or several.
  getBalances(accounts, symbols) {
    const account = Array.isArray(accounts) ? { $in: [...accounts] } : accounts;
    return this.find("tokens", "balances", symbols ? { account, symbol: { $in: [...symbols] } } : { account });
  }
  getToken(symbol) { return this.findOne("tokens", "tokens", { symbol }); }
  getTokens(symbols) { return this.find("tokens", "tokens", { symbol: { $in: [...symbols] } }, { limit: symbols.length }); }
  getBuyBook(symbol, limit = 100) {
    return this.find("market", "buyBook", { symbol }, { limit, indexes: [{ index: "priceDec", descending: true }] });
  }
  getSellBook(symbol, limit = 100) {
    return this.find("market", "sellBook", { symbol }, { limit, indexes: [{ index: "priceDec", descending: false }] });
  }
  getOpenOrders(account, side) {
    return this.find("market", side === "buy" ? "buyBook" : "sellBook", { account });
  }
  // A token market's metrics (lastPrice, volume, highestBid, lowestAsk) in SWAP.HIVE, or null.
  getMetrics(symbol) { return this.findOne("market", "metrics", { symbol }); }
  getTradesHistory(symbol, limit = 50) {
    return this.find("market", "tradesHistory", { symbol }, { limit, indexes: [{ index: "timestamp", descending: true }] });
  }
  getPool(tokenPair) { return this.findOne("marketpools", "pools", { tokenPair }); }
  getPools(limit = 1000) { return this.find("marketpools", "pools", {}, { limit }); }
  getLiquidityPositions(account) { return this.find("marketpools", "liquidityPositions", { account }); }
  getNfts(symbol, query, options) { return this.find("nft", `${symbol}instances`, query, options); }
}

// --- writes ---

export const SSC_MAINNET_HIVE = "ssc-mainnet-hive";

const action = (contractName, contractAction, contractPayload) => ({ contractName, contractAction, contractPayload });
const withOptional = (payload, optional) =>
  Object.fromEntries(Object.entries({ ...payload, ...optional }).filter(([, v]) => v !== undefined));

// The custom_json operation carrying one action or an array of actions, active authority.
export function engineCustomJson(account, actions) {
  return customJson({ id: SSC_MAINNET_HIVE, required_auths: [account], json: actions });
}

export const tokens = {
  transfer: ({ symbol, to, quantity, memo }) => action("tokens", "transfer", withOptional({ symbol, to, quantity }, { memo })),
  issue: ({ symbol, to, quantity, memo }) => action("tokens", "issue", withOptional({ symbol, to, quantity }, { memo })),
  stake: ({ symbol, to, quantity }) => action("tokens", "stake", { symbol, to, quantity }),
  unstake: ({ symbol, quantity }) => action("tokens", "unstake", { symbol, quantity }),
  cancelUnstake: ({ txID }) => action("tokens", "cancelUnstake", { txID }),
  delegate: ({ symbol, to, quantity }) => action("tokens", "delegate", { symbol, to, quantity }),
  // Returns stake delegated to `from` back to the caller after the token's cooldown.
  undelegate: ({ symbol, from, quantity }) => action("tokens", "undelegate", { symbol, from, quantity }),
};

export const market = {
  // Limit orders: price is a hard ceiling (buy) or floor (sell); expiration in seconds.
  buy: ({ symbol, quantity, price, expiration }) => action("market", "buy", withOptional({ symbol, quantity, price }, { expiration })),
  sell: ({ symbol, quantity, price, expiration }) => action("market", "sell", withOptional({ symbol, quantity, price }, { expiration })),
  // Market orders: marketBuy spends `quantity` SWAP.HIVE; marketSell sells `quantity` tokens.
  marketBuy: ({ symbol, quantity }) => action("market", "marketBuy", { symbol, quantity }),
  marketSell: ({ symbol, quantity }) => action("market", "marketSell", { symbol, quantity }),
  cancel: ({ type, id }) => action("market", "cancel", { type, id }),
};

export const pools = {
  addLiquidity: ({ tokenPair, baseQuantity, quoteQuantity }) =>
    action("marketpools", "addLiquidity", { tokenPair, baseQuantity, quoteQuantity }),
  // sharesOut: the percentage (0 < x <= 100, at most 3 decimals) of the position to withdraw.
  removeLiquidity: ({ tokenPair, sharesOut }) => action("marketpools", "removeLiquidity", { tokenPair, sharesOut }),
  // tradeType "exactInput" bounds with minAmountOut; "exactOutput" bounds with maxAmountIn.
  swapTokens: ({ tokenPair, tokenSymbol, tokenAmount, tradeType, minAmountOut, maxAmountIn }) => {
    if (tradeType !== "exactInput" && tradeType !== "exactOutput") {
      throw new Error(`swapTokens: tradeType must be 'exactInput' or 'exactOutput', got '${tradeType}'`);
    }
    return action("marketpools", "swapTokens", withOptional({ tokenPair, tokenSymbol, tokenAmount, tradeType }, { minAmountOut, maxAmountIn }));
  },
};

export const nft = {
  transfer: ({ to, nfts }) => action("nft", "transfer", { to, nfts: nfts.map(({ symbol, ids }) => ({ symbol, ids: [...ids] })) }),
  issue: ({ symbol, to, feeSymbol, lockTokens, properties }) =>
    action("nft", "issue", withOptional({ symbol, to, feeSymbol }, { lockTokens, properties })),
  sell: ({ symbol, nfts, price, priceSymbol, fee }) => action("nftmarket", "sell", { symbol, nfts: [...nfts], price, priceSymbol, fee }),
  cancel: ({ symbol, nfts }) => action("nftmarket", "cancel", { symbol, nfts: [...nfts] }),
  buy: ({ symbol, nfts, marketAccount, expPrice, expPriceSymbol }) =>
    action("nftmarket", "buy", withOptional({ symbol, nfts: [...nfts], marketAccount }, { expPrice, expPriceSymbol })),
};

// HIVE <-> SWAP.HIVE runs through the hivepegged contract, owned by honey-swap. Wrapping is a
// native L1 transfer with this exact memo (active key); the sidechain credits SWAP.HIVE minus
// a 0.75% fee (minimum 0.001). Unwrapping is a contract action; quantity at most 3 decimals,
// minimum 0.002.
export const HONEY_SWAP_ACCOUNT = "honey-swap";
export const WRAP_MEMO = JSON.stringify({ id: SSC_MAINNET_HIVE, json: action("hivepegged", "buy", {}) });

export const peg = {
  wrap: ({ account, quantity }) => ["transfer", { from: account, to: HONEY_SWAP_ACCOUNT, amount: `${quantity} HIVE`, memo: WRAP_MEMO }],
  unwrap: ({ quantity }) => action("hivepegged", "withdraw", { quantity }),
};

// A token quantity as an exact decimal string with `precision` (0..8) fractional digits.
// Bigint arithmetic, rounding half away from zero; strings and bigints are exact at any size.
export function formatAmount(amount, precision) {
  if (!Number.isInteger(precision) || precision < 0 || precision > 8) {
    throw new RangeError(`precision must be an integer in [0, 8], got ${String(precision)}`);
  }
  let text;
  if (typeof amount === "bigint") text = amount.toString();
  else if (typeof amount === "number") {
    if (!Number.isFinite(amount)) throw new RangeError(`amount must be finite, got ${String(amount)}`);
    text = String(amount);
  } else text = amount.trim();
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  const intDigits = match?.[2] ?? "";
  const fracDigits = match?.[3] ?? "";
  if (match === null || (intDigits === "" && fracDigits === "")) {
    throw new RangeError(`amount is not a decimal number: ${JSON.stringify(text)}`);
  }
  const negative = match[1] === "-";
  const exponent = match[4] === undefined ? 0 : Number.parseInt(match[4], 10);
  const digits = BigInt(intDigits + fracDigits);
  const shift = exponent - fracDigits.length + precision;
  let scaled;
  if (shift >= 0) scaled = digits * 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    const quotient = digits / divisor;
    scaled = (digits % divisor) * 2n >= divisor ? quotient + 1n : quotient;
  }
  const abs = scaled.toString().padStart(precision + 1, "0");
  const intPart = abs.slice(0, abs.length - precision);
  const out = precision === 0 ? intPart : `${intPart}.${abs.slice(abs.length - precision)}`;
  return negative && scaled !== 0n ? `-${out}` : out;
}

// --- pool and transaction reading ---

// A pool reserve ("123.45678") as the exact fraction { numerator, denominator }.
export function reserveFraction(text) {
  const match = /^(?:0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(String(text ?? ""));
  if (!match) throw new RangeError(`pool reserve is not a canonical decimal: ${JSON.stringify(text)}`);
  return { numerator: BigInt(String(text).replace(".", "")), denominator: 10n ** BigInt(match[1]?.length ?? 0) };
}

// A pool's trade fee in basis points: 1 - tradeFeeMultiplier, the contract default 25 when unset.
export function poolFeeBps(pool) {
  if (pool?.tradeFeeMultiplier === undefined) return 25;
  const multiplier = Number(pool.tradeFeeMultiplier);
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 1) throw new RangeError("pool tradeFeeMultiplier is malformed");
  return Math.round((1 - multiplier) * 10000);
}

// The largest deposit at a pool's reserve ratio that the balances on hand cover: all of one side
// and the matching amount of the other, both rounded down to `precision` places. Null when a
// reserve is empty or either side rounds to nothing.
export function poolRatioDeposit({ baseReserve, quoteReserve, baseBalance, quoteBalance, precision }) {
  const [rb, rq, bb, bq] = [baseReserve, quoteReserve, baseBalance, quoteBalance].map(reserveFraction);
  if (rb.numerator === 0n || rq.numerator === 0n) return null;
  const scale = 10n ** BigInt(precision);
  const allBase = bb.numerator * rq.numerator * rb.denominator * bq.denominator <= bq.numerator * bb.denominator * rq.denominator * rb.numerator;
  const base = allBase ? bb.numerator * scale / bb.denominator
    : bq.numerator * rb.numerator * rq.denominator * scale / (bq.denominator * rb.denominator * rq.numerator);
  const quote = allBase ? bb.numerator * rq.numerator * rb.denominator * scale / (bb.denominator * rq.denominator * rb.numerator)
    : bq.numerator * scale / bq.denominator;
  if (base <= 0n || quote <= 0n) return null;
  return { baseQuantity: formatUnits(base, precision), quoteQuantity: formatUnits(quote, precision) };
}

// The input a constant-product pool charges to pay out exactly `quantity` (tokenScale units),
// in inputScale units, rounded up: Rin·q / ((Rout − q)·(1 − fee)). Null when Rout ≤ q.
export function exactOutputSwapInput({ reserveIn, reserveOut, quantity, tokenScale, inputScale, feeBps }) {
  const reserveDifference = reserveOut.numerator * tokenScale - quantity * reserveOut.denominator;
  if (quantity <= 0n || reserveDifference <= 0n) return null;
  const numerator = reserveIn.numerator * quantity * reserveOut.denominator * inputScale * 10000n;
  const denominator = reserveIn.denominator * reserveDifference * BigInt(10000 - feeBps);
  return (numerator + denominator - 1n) / denominator;
}

// The output a constant-product pool pays for exactly `quantity` input (inputScale units), in
// outputScale units, rounded down: Rout·q(1 − fee) / (Rin + q(1 − fee)).
export function exactInputSwapOutput({ reserveIn, reserveOut, quantity, inputScale, outputScale, feeBps }) {
  if (quantity <= 0n) return 0n;
  const kept = BigInt(10000 - feeBps);
  const numerator = reserveOut.numerator * reserveIn.denominator * quantity * kept * outputScale;
  const denominator = reserveIn.numerator * inputScale * 10000n * reserveOut.denominator + quantity * kept * reserveIn.denominator * reserveOut.denominator;
  return numerator / denominator;
}

// A sidechain transaction row's logs as { events, errors }; unparseable logs read as empty.
// A getTransactionInfo answer as one receipt: a single call's row or a batched custom_json's
// child rows, their ids, their one block and their events together. Throws when the logs are
// malformed, report errors, or the rows disagree on the block or carry non-canonical ids.
export function engineTransactionReceipt(result, node = "provider", candidate = "unknown") {
  const rows = Array.isArray(result) ? result : [result];
  if (rows.length === 0) throw new Error(`${node} returned an empty Hive-Engine transaction`);
  const events = []; const transactionIds = []; const blocks = new Set();
  for (const row of rows) {
    let logs;
    try { logs = typeof row?.logs === "string" ? JSON.parse(row.logs) : row?.logs; } catch { logs = null; }
    if (!logs || typeof logs !== "object" || Array.isArray(logs)) throw new Error(`${node} returned malformed Hive-Engine logs`);
    if (Array.isArray(logs.errors) && logs.errors.length > 0) throw new Error(`${node} reports a Hive-Engine error: ${logs.errors.join("; ")}`);
    if (Array.isArray(logs.events)) events.push(...logs.events);
    transactionIds.push(String(row?.transactionId ?? candidate));
    blocks.add(Number(row?.blockNumber));
  }
  if (blocks.size !== 1 || ![...blocks][0] || transactionIds.some((id) => !/^[0-9a-f]{40}(?:-[0-9]+)?$/.test(id))) throw new Error(`${node} returned inconsistent Hive-Engine child identities`);
  return Object.freeze({ node, transactionId: transactionIds[0], transactionIds: Object.freeze(transactionIds), blockNumber: [...blocks][0], logs: Object.freeze({ events: Object.freeze(events) }) });
}

export function transactionLogs(row) {
  let logs;
  try { logs = typeof row?.logs === "string" ? JSON.parse(row.logs) : row?.logs; } catch { logs = null; }
  const record = logs && typeof logs === "object" && !Array.isArray(logs) ? logs : {};
  return {
    events: Array.isArray(record.events) ? record.events.filter((e) => e && typeof e === "object") : [],
    errors: Array.isArray(record.errors) ? record.errors : [],
  };
}
