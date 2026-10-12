# observe-tribe-curation-yield
## Requirements
- `reads-tag-posts`: The operation reads `bridge.get_ranked_posts` (sort `created`, `limit` from `request.postsPerTag`, default 20) for each entry of `request.tags` (a `{name,tag,symbol}` list; default LEO/`leofinance`, POB/`proofofbrain`, CENT/`cent`, WAIV/`waivio`, plus a `symbol:null` base-layer row `{name:"BASE",tag:"hive",symbol:null}`) from two public Hive condenser/bridge JSON-RPC nodes (`request.nodes`, default `["https://api.hive.blog","https://api.openhive.network"]`).
- `witnesses-two-nodes`: The operation also reads `condenser_api.get_dynamic_global_properties` from both nodes and returns a `witnesses` array naming each node and its `head_block_number`.
- `refuses-node-disagreement`: The operation refuses (throws, message prefixed `CURATION_YIELD_NODE_DISAGREEMENT`) when the two nodes' `head_block_number` values differ by more than `request.maxBlockGap` (default 3), when a tag's two nodes' summed `pending_payout_value` (HBD) differ by more than `request.toleranceBasisPoints` (default 200, wider than a single order-book price because an aggregated multi-post sum is a noisier live signal) basis points, or when an account's two nodes' effective-vesting-shares or `voting_manabar.current_mana` differ by more than that same tolerance.
- `computes-tag-yield`: For each tag, the operation sums the primary node's returned posts' `pending_payout_value` (exact decimal) and `net_rshares` (exact integer), and reports `postCount`, `pendingPayoutSumHbd`, `netRshareSum`, and `yieldHbdPerMillionRshares` (the pending-payout sum per million net-rshares of accumulated vote weight — an inverse-competition curation-yield proxy, honestly documented as that and not the chain's own curator-share formula; `null` when `netRshareSum` is zero), plus `oldestPostAgeSeconds`/`newestPostAgeSeconds` computed against `request.now`.
- `reads-hive-engine-token-supply`: For each tag whose `symbol` is non-null, the operation reads Hive-Engine's `tokens` contract `tokens` table (`find`, query `{symbol}`) from `request.hiveEngineNode` (default `https://api.hive-engine.com/rpc/contracts`) and reports `circulatingSupply`, `totalStaked`, `precision` — single-witness (see Open questions), never cross-checked against a second Hive-Engine node.
- `reads-account-manabar`: For each of `request.accounts` (default `["emsenn0","michael561"]`), the operation reads `condenser_api.get_accounts` from both nodes, computes effective vesting shares (`vesting_shares + received_vesting_shares - delegated_vesting_shares`, in the same raw integer units as `voting_manabar.current_mana`), and projects current voting mana to `request.now` using the Hive manabar regeneration model (linear regen to `maxMana` over 432000 seconds, capped at `maxMana`), reporting `currentManaRaw`, `maxManaRaw`, `currentManaPercent`, `lastUpdateTime`.
- `exact-decimal-strings`: Every numeric quantity in the returned record is a decimal string: chain-native strings passed through unchanged, or values derived using `@red-cup-engineering/computer-ledger-system-services-section`'s BigInt-scaled decimal primitives (`parseDecimal`, `formatScaled`, `addDecimalStrings`, `multiplyDecimalStrings`, `stripUnitSuffix`) plus this operation's own BigInt-scaled division helper — never a JavaScript float carried into the record.
- `read-only`: The operation calls only read (`condenser_api`/`bridge`/Hive-Engine `find`) JSON-RPC methods; it never broadcasts a transaction, never signs anything, and accepts no private key.
- `supports-deterministic-replay`: The operation accepts an optional `request.fixtures` (literal, JSON-serializable pre-recorded node/Hive-Engine results keyed as documented in its JSDoc) and `request.now`; when both are given for every read the request would otherwise make, the operation makes no network call at all and returns a fully deterministic record.
## Prohibitions
- `no-second-decimal-arithmetic`: The operation must not re-implement decimal-string parsing, formatting, addition, or multiplication that `@red-cup-engineering/computer-ledger-system-services-section`'s `decimal.mjs` already exports; it may add exactly one new BigInt-scaled decimal-division helper, because no house decimal-division-strings primitive exists yet (the same documented gap `observe-hive-internal-market` already admits).
- `no-order-placement`: The operation must never call a broadcast/write JSON-RPC method (base-layer or Hive-Engine) and must never accept, read, or require a private key.
- `no-silent-disagreement`: The operation must never average, arbitrarily pick one, or otherwise silently reconcile the two nodes' block-number, tag-payout, or account-mana/vesting readings when they disagree beyond the declared tolerance; it throws instead, naming the disagreeing values in the refusal message.
- `no-scot-api-dependency`: The operation must not call `scot-api.hive-engine.com` or assume any of its routes; live probing 2026-09-05 found every plausible pool-config route (`/leo`, `/LEO`, `/leo/pool`, `/pools/leo`, `/leo/config`, `/api/leo`, `/tribes/leo`) 404s and `/@<account>` returns only tokens that account has personally earned, not tribe-level pool state — the on-chain Hive-Engine `tokens` table is the only verified-live source for tribe token supply/stake.
## Laws
- `primitives-exist-once` | 561 Group working discipline | 2026-08-30 | CLAUDE.md | Applies to all decimal arithmetic in this operation. | The BigInt-scaled decimal parse/format/add/multiply primitives live once, in `@red-cup-engineering/computer-ledger-system-services-section`; this operation composes them by exact pin rather than reimplementing any of them.
- `fabricate-do-not-hand-write` | 561 Group working discipline, dispatch-agents skill | 2026-09-04 | .claude/skills/dispatch-agents/SKILL.md | Applies to this whole operation source file. | The operation is born through the jsnode fabrication line from this work order, never hand-written.
- `liquidity-stays-liquid` | Operating constraint | 2026-09-04 | lib/emsenn/services/561-group/services/561-group-services-section/content/text/glossary/terms/fintech-friday.md | Applies to the operation's read-only scope. | This operation is the read-only yield measurement `schedule-set-of-votes` needs before any vote is scheduled; it never stakes, delegates, or locks anything.
- `frictions-are-duties` | 561 Group working discipline | 2026-09-04 | .claude/rules/working-discipline.md | Applies to the one new decimal-division helper this operation adds. | No house decimal-division-strings primitive exists yet; this gap is admitted as a friction against `@red-cup-engineering/computer-ledger-system-services-section` rather than silently grown into a second decimal library.
- `voting-is-not-fenced` | Operating constraint | 2026-09-04 | .claude/rules/working-discipline.md | Applies to why this operation and its siblings exist at all. | The standing fence is no automated POSTING or commenting from the existing Hive accounts; voting was never fenced, so a curation-yield read and the vote schedule/cast it feeds are in scope.
## Standards
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation and its import.meta.main guard. | The package uses one executable ESM operation source file eligible for downstream staged package-birth assays.
- `hive-condenser-and-bridge-api` | Hive blockchain developer portal | 2026 revision | https://developers.hive.io/apidefinitions/ | Applies to every `condenser_api`/`bridge` JSON-RPC method this operation calls. | The operation calls exactly the read methods this reference names (`get_dynamic_global_properties`, `get_accounts`, `bridge.get_ranked_posts`) with the parameter shapes it documents; `bridge.get_ranked_posts` and the accounts' `voting_manabar`/`vesting_shares` fields were confirmed live 2026-09-05 against `api.hive.blog`.
- `hive-engine-rpc-contracts` | Hive-Engine / Steem Smart Contracts | public RPC | https://api.hive-engine.com/rpc/contracts | Applies to the `find` call against the `tokens` contract's `tokens` table. | The operation calls exactly the JSON-RPC 2.0 `find` method this public sidechain node exposes, confirmed live 2026-09-05 for symbols LEO/POB/CENT/WAIV.
- `hive-voting-manabar-model` | Hive blockchain developer portal (condenser `get_accounts` `voting_manabar`) | 2026 revision | https://developers.hive.io/apidefinitions/ | Applies to the mana projection. | Voting mana regenerates linearly from `current_mana` at `last_update_time` to `maxMana` (effective vesting shares) over 432000 seconds (5 days), capped at `maxMana`; confirmed live 2026-09-05 that `effective_vesting_shares` in raw units equals the account's own `voting_manabar` scale.
## Open questions
- `single-hive-engine-witness` [nonblocking]: Only one public Hive-Engine node is cross-checked (no second public HE RPC node's agreement was verified live as of 2026-09-05); a second-node cross-check for the Hive-Engine read is left to a follow-on task.
## Package
```json
{"packageName":"@red-cup-engineering/observe-tribe-curation-yield-service","packageVersion":"0.1.0","license":"UNLICENSED","dependencies":{"@red-cup-engineering/computer-ledger-system-services-section":"0.2.0","@red-cup-engineering/read-javascript-node-standard-input-text-service":"0.2.1"},"devDependencies":{}}
```
## Operation
```mjs path=scripts/observe-tribe-curation-yield.mjs
#!/usr/bin/env node
import {
  parseDecimal,
  formatScaled,
  addDecimalStrings,
  multiplyDecimalStrings,
  stripUnitSuffix,
} from "@red-cup-engineering/computer-ledger-system-services-section/src/decimal.mjs";
import { readJavascriptNodeStandardInputText } from "@red-cup-engineering/read-javascript-node-standard-input-text-service";

const DEFAULT_NODES = Object.freeze(["https://api.hive.blog", "https://api.openhive.network"]);
const DEFAULT_HIVE_ENGINE_NODE = "https://api.hive-engine.com/rpc/contracts";
const DEFAULT_TAGS = Object.freeze([
  Object.freeze({ name: "LEO", tag: "leofinance", symbol: "LEO" }),
  Object.freeze({ name: "POB", tag: "proofofbrain", symbol: "POB" }),
  Object.freeze({ name: "CENT", tag: "cent", symbol: "CENT" }),
  Object.freeze({ name: "WAIV", tag: "waivio", symbol: "WAIV" }),
  Object.freeze({ name: "BASE", tag: "hive", symbol: null }),
]);
const DEFAULT_ACCOUNTS = Object.freeze(["emsenn0", "michael561"]);
const MANA_REGENERATION_SECONDS = 432000;

/**
 * Divide two plain decimal strings exactly via BigInt-scaled integer division, truncated (never
 * rounded up) to `maxDecimals` fractional digits. No house decimal-division primitive exists yet
 * (per `frictions-are-duties`); this is the one arithmetic primitive this operation adds.
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
  if (rightMagnitude === 0n) throw new RangeError(`observe-tribe-curation-yield: division by zero (${b})`);
  const numerator = leftMagnitude * 10n ** BigInt(right.frac.length + maxDecimals);
  const denominator = rightMagnitude * 10n ** BigInt(left.frac.length);
  const magnitude = numerator / denominator;
  const negative = left.negative !== right.negative;
  return formatScaled(negative ? -magnitude : magnitude, maxDecimals);
}

/** Relative gap between two decimal-string quantities, in basis points of their mean; 0 when equal, Infinity when one side is zero and they disagree. */
function relativeBpsGap(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity;
  const mid = (x + y) / 2;
  if (mid === 0) return x === y ? 0 : Infinity;
  return (Math.abs(x - y) / mid) * 10000;
}

/** POST one JSON-RPC 2.0 request (condenser/bridge/Hive-Engine share this envelope) and return its `result`, throwing on an HTTP or RPC error. */
async function callNode(node, method, params, fetchImpl) {
  const response = await fetchImpl(node, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`observe-tribe-curation-yield: HTTP ${response.status} from ${node} calling ${method}`);
  const body = await response.json();
  if (body?.error) throw new Error(`observe-tribe-curation-yield: RPC error from ${node} calling ${method}: ${JSON.stringify(body.error)}`);
  return body?.result;
}

/** `fixtureValue` when given (a literal pre-recorded result), else the awaited live call. */
async function resolveOrCall(fixtureValue, liveCall) {
  return fixtureValue !== undefined ? fixtureValue : liveCall();
}

/** Seconds between a Hive-returned ISO instant (no trailing 'Z') and `nowMs`. */
function ageSeconds(createdIso, nowMs) {
  return Math.max(0, Math.round((nowMs - new Date(`${createdIso}Z`).getTime()) / 1000));
}

/** Sum one node's ranked-posts page into postCount / pendingPayoutSumHbd / netRshareSum. */
function summarizePosts(posts) {
  const pendingPayoutSumHbd = posts.length === 0 ? "0" : addDecimalStrings(posts.map((post) => stripUnitSuffix(post.pending_payout_value)));
  const netRshareSum = posts.reduce((total, post) => total + BigInt(post.net_rshares ?? 0), 0n);
  return { postCount: posts.length, pendingPayoutSumHbd, netRshareSum: netRshareSum.toString() };
}

/** HBD pending payout per million net-rshares of accumulated vote weight — an inverse-competition curation-yield proxy, not the chain's own curator-share formula. Null when netRshareSum is zero (no signal). */
function yieldHbdPerMillionRshares(pendingPayoutSumHbd, netRshareSumString) {
  if (BigInt(netRshareSumString) === 0n) return null;
  return divideDecimalStrings(multiplyDecimalStrings(pendingPayoutSumHbd, "1000000", 30), netRshareSumString, 12);
}

/** Parse a chain VESTS amount string to its raw integer units (6-decimal fixed scale, matching voting_manabar). */
function parseVestsRaw(text) {
  const { negative, whole, frac } = parseDecimal(stripUnitSuffix(text));
  const magnitude = BigInt(`${whole}${frac.padEnd(6, "0").slice(0, 6)}`);
  return negative ? -magnitude : magnitude;
}

/** Effective vesting shares (raw units) = vesting_shares + received_vesting_shares - delegated_vesting_shares. */
function effectiveVestingSharesRaw(account) {
  return parseVestsRaw(account.vesting_shares) + parseVestsRaw(account.received_vesting_shares) - parseVestsRaw(account.delegated_vesting_shares);
}

/** Voting mana at `nowMs`, per the Hive manabar model: linear regen from current_mana at last_update_time to maxManaRaw over MANA_REGENERATION_SECONDS, capped at maxManaRaw. */
function projectedMana(account, maxManaRaw, nowMs) {
  const currentAtUpdate = BigInt(account.voting_manabar.current_mana);
  const elapsed = Math.max(0, Math.floor(nowMs / 1000) - account.voting_manabar.last_update_time);
  const regenerated = currentAtUpdate + (maxManaRaw * BigInt(elapsed)) / BigInt(MANA_REGENERATION_SECONDS);
  const currentManaRaw = regenerated > maxManaRaw ? maxManaRaw : regenerated;
  const currentManaPercent = maxManaRaw === 0n ? "0" : divideDecimalStrings(multiplyDecimalStrings(currentManaRaw.toString(), "100", 10), maxManaRaw.toString(), 6);
  return { currentManaRaw: currentManaRaw.toString(), maxManaRaw: maxManaRaw.toString(), currentManaPercent, lastUpdateTime: account.voting_manabar.last_update_time };
}

/** One Hive-Engine `tokens` contract `tokens`-table row for `symbol`, or null when not found. */
async function findHiveEngineToken(node, symbol, fetchImpl) {
  const rows = await callNode(node, "find", { contract: "tokens", table: "tokens", query: { symbol } }, fetchImpl);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

/**
 * Observes the current curation-yield signal per Hive-Engine tribe tag (and the base layer), and the requested accounts' voting mana, read-only.
 * @param {object} [request]
 * @param {readonly string[]} [request.nodes] Two public Hive condenser/bridge JSON-RPC node base
 *   URLs to cross-check (default `["https://api.hive.blog","https://api.openhive.network"]`).
 * @param {string} [request.hiveEngineNode] One public Hive-Engine sidechain RPC base URL for tribe
 *   token supply/stake (default `"https://api.hive-engine.com/rpc/contracts"`).
 * @param {readonly {name:string,tag:string,symbol:(string|null)}[]} [request.tags] Tribe tags to
 *   observe (default LEO/POB/CENT/WAIV plus a `symbol:null` base-layer `"hive"` row).
 * @param {number} [request.postsPerTag] `bridge.get_ranked_posts` limit per tag (default 20).
 * @param {readonly string[]} [request.accounts] Accounts whose voting mana to project (default
 *   `["emsenn0","michael561"]`).
 * @param {number} [request.toleranceBasisPoints] Max allowed disagreement between the two nodes'
 *   per-tag pending-payout sums and per-account mana/vesting readings, in basis points, before
 *   refusal (default 200).
 * @param {number} [request.maxBlockGap] Max allowed head-block-number disagreement between the two
 *   nodes before refusal (default 3).
 * @param {typeof fetch} [request.fetchImpl] Injectable fetch implementation, for tests.
 * @param {object} [request.fixtures] Literal pre-recorded results (`dynamicGlobalProperties` keyed
 *   by node; `rankedPosts` keyed by `` `${node}|${tag}` ``; `hiveEngineTokens` keyed by symbol;
 *   `accounts` keyed by `` `${node}|${account}` ``) standing in for the live reads they name.
 * @param {string} [request.now] An injectable ISO instant for `observedAt` and mana/post-age
 *   projection, for deterministic replay (default the real current time).
 * @returns {Promise<object>} A `TribeCurationYieldObservationRecord`:
 *   `{type,version,observedAt,witnesses,tags,accounts}`.
 * @throws {TypeError} When `request.nodes` names fewer than two nodes.
 * @throws {Error} `CURATION_YIELD_NODE_DISAGREEMENT` when the two nodes' head-block-number, a tag's
 *   pending-payout sum, or an account's mana/vesting reading disagree beyond the declared tolerance.
 */
export async function observeTribeCurationYield(request = {}) {
  const nodes = request.nodes ?? DEFAULT_NODES;
  if (!Array.isArray(nodes) || nodes.length < 2) throw new TypeError("observe-tribe-curation-yield: request.nodes must name at least two nodes");
  const hiveEngineNode = request.hiveEngineNode ?? DEFAULT_HIVE_ENGINE_NODE;
  const tags = request.tags ?? DEFAULT_TAGS;
  const postsPerTag = request.postsPerTag ?? 20;
  const accounts = request.accounts ?? DEFAULT_ACCOUNTS;
  const toleranceBasisPoints = request.toleranceBasisPoints ?? 200;
  const maxBlockGap = request.maxBlockGap ?? 3;
  const fetchImpl = request.fetchImpl ?? fetch;
  const fixtures = request.fixtures;
  const nowMs = request.now ? new Date(request.now).getTime() : Date.now();
  const [primary, secondary] = nodes;

  const [primaryDgp, secondaryDgp] = await Promise.all([
    resolveOrCall(fixtures?.dynamicGlobalProperties?.[primary], () => callNode(primary, "condenser_api.get_dynamic_global_properties", [], fetchImpl)),
    resolveOrCall(fixtures?.dynamicGlobalProperties?.[secondary], () => callNode(secondary, "condenser_api.get_dynamic_global_properties", [], fetchImpl)),
  ]);
  const blockGap = Math.abs(primaryDgp.head_block_number - secondaryDgp.head_block_number);
  if (blockGap > maxBlockGap) {
    throw new Error(
      `CURATION_YIELD_NODE_DISAGREEMENT: head_block_number gap ${blockGap} exceeds maxBlockGap ${maxBlockGap} (${primary}=${primaryDgp.head_block_number}, ${secondary}=${secondaryDgp.head_block_number})`,
    );
  }

  const tagResults = [];
  for (const tagSpec of tags) {
    const [primaryPosts, secondaryPosts] = await Promise.all([
      resolveOrCall(fixtures?.rankedPosts?.[`${primary}|${tagSpec.tag}`], () => callNode(primary, "bridge.get_ranked_posts", { sort: "created", tag: tagSpec.tag, limit: postsPerTag, observer: "" }, fetchImpl)),
      resolveOrCall(fixtures?.rankedPosts?.[`${secondary}|${tagSpec.tag}`], () => callNode(secondary, "bridge.get_ranked_posts", { sort: "created", tag: tagSpec.tag, limit: postsPerTag, observer: "" }, fetchImpl)),
    ]);
    const primarySummary = summarizePosts(primaryPosts ?? []);
    const secondarySummary = summarizePosts(secondaryPosts ?? []);
    const payoutGapBps = relativeBpsGap(primarySummary.pendingPayoutSumHbd, secondarySummary.pendingPayoutSumHbd);
    if (payoutGapBps > toleranceBasisPoints) {
      throw new Error(
        `CURATION_YIELD_NODE_DISAGREEMENT: tag ${tagSpec.tag} pending-payout-sum gap ${payoutGapBps.toFixed(4)}bps exceeds toleranceBasisPoints ${toleranceBasisPoints} (${primary}=${primarySummary.pendingPayoutSumHbd}, ${secondary}=${secondarySummary.pendingPayoutSumHbd})`,
      );
    }
    let hiveEngine = null;
    if (tagSpec.symbol) {
      const token = await resolveOrCall(fixtures?.hiveEngineTokens?.[tagSpec.symbol], () => findHiveEngineToken(hiveEngineNode, tagSpec.symbol, fetchImpl));
      hiveEngine = token ? { node: hiveEngineNode, circulatingSupply: token.circulatingSupply, totalStaked: token.totalStaked, precision: token.precision } : null;
    }
    const ages = (primaryPosts ?? []).map((post) => ageSeconds(post.created, nowMs));
    tagResults.push({
      name: tagSpec.name,
      tag: tagSpec.tag,
      symbol: tagSpec.symbol,
      postCount: primarySummary.postCount,
      pendingPayoutSumHbd: primarySummary.pendingPayoutSumHbd,
      netRshareSum: primarySummary.netRshareSum,
      yieldHbdPerMillionRshares: yieldHbdPerMillionRshares(primarySummary.pendingPayoutSumHbd, primarySummary.netRshareSum),
      oldestPostAgeSeconds: ages.length ? Math.max(...ages) : null,
      newestPostAgeSeconds: ages.length ? Math.min(...ages) : null,
      hiveEngine,
    });
  }

  const accountResults = {};
  for (const account of accounts) {
    const [primaryAccount, secondaryAccount] = await Promise.all([
      resolveOrCall(fixtures?.accounts?.[`${primary}|${account}`], async () => (await callNode(primary, "condenser_api.get_accounts", [[account]], fetchImpl))[0]),
      resolveOrCall(fixtures?.accounts?.[`${secondary}|${account}`], async () => (await callNode(secondary, "condenser_api.get_accounts", [[account]], fetchImpl))[0]),
    ]);
    const primaryEffective = effectiveVestingSharesRaw(primaryAccount).toString();
    const secondaryEffective = effectiveVestingSharesRaw(secondaryAccount).toString();
    const vestingGapBps = relativeBpsGap(primaryEffective, secondaryEffective);
    const manaGapBps = relativeBpsGap(String(primaryAccount.voting_manabar.current_mana), String(secondaryAccount.voting_manabar.current_mana));
    if (vestingGapBps > toleranceBasisPoints || manaGapBps > toleranceBasisPoints) {
      throw new Error(
        `CURATION_YIELD_NODE_DISAGREEMENT: account ${account} vesting/mana gap (vesting ${vestingGapBps.toFixed(4)}bps, mana ${manaGapBps.toFixed(4)}bps) exceeds toleranceBasisPoints ${toleranceBasisPoints}`,
      );
    }
    accountResults[account] = { votingManabar: projectedMana(primaryAccount, effectiveVestingSharesRaw(primaryAccount), nowMs) };
  }

  return {
    type: "TribeCurationYieldObservationRecord",
    version: 1,
    observedAt: new Date(nowMs).toISOString(),
    witnesses: [
      { node: primary, headBlockNumber: primaryDgp.head_block_number },
      { node: secondary, headBlockNumber: secondaryDgp.head_block_number },
    ],
    tags: tagResults,
    accounts: accountResults,
  };
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "observeTribeCurationYield — Observes the current curation-yield signal per Hive-Engine tribe tag (and the base layer), and the requested accounts' voting mana, read-only.\n",
    );
  } else {
    const inputText = (await readJavascriptNodeStandardInputText({ type: "JavascriptNodeStandardInputTextReadRequest", version: 1 }, { standardInput: process.stdin })).text;
    for (const line of inputText.split("\n")) {
      if (line.length === 0) continue;
      try {
        process.stdout.write(`${JSON.stringify(await observeTribeCurationYield(JSON.parse(line)))}\n`);
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  }
}
```
## Tests
```mjs path=test/observe-tribe-curation-yield.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { observeTribeCurationYield } from "../scripts/observe-tribe-curation-yield.mjs";

const PRIMARY = "https://mock-primary.example";
const SECONDARY = "https://mock-secondary.example";
const NOW = "2026-09-05T00:10:00.000Z";

function post({ author, permlink, payout, rshares, createdSecondsAgo }) {
  const created = new Date(new Date(NOW).getTime() - createdSecondsAgo * 1000).toISOString().slice(0, -5);
  return { author, permlink, created, pending_payout_value: `${payout} HBD`, net_rshares: rshares };
}

function makeMockFetch({ primaryBlock, secondaryBlock, leoPosts, hiveEngineLeo, accountsByNode }) {
  return async (input, init) => {
    const node = String(input);
    const body = JSON.parse(init.body);
    if (body.method === "condenser_api.get_dynamic_global_properties") {
      return { ok: true, status: 200, json: async () => ({ result: { head_block_number: node === PRIMARY ? primaryBlock : secondaryBlock } }) };
    }
    if (body.method === "bridge.get_ranked_posts") {
      const posts = body.params.tag === "leofinance" ? leoPosts : [];
      return { ok: true, status: 200, json: async () => ({ result: posts }) };
    }
    if (body.method === "find") {
      return { ok: true, status: 200, json: async () => ({ result: body.params.query.symbol === "LEO" ? [hiveEngineLeo] : [] }) };
    }
    if (body.method === "condenser_api.get_accounts") {
      const account = body.params[0][0];
      return { ok: true, status: 200, json: async () => ({ result: [accountsByNode[node][account]] }) };
    }
    throw new Error(`unmocked method ${body.method}`);
  };
}

function account({ vesting, delegated, mana, lastUpdate }) {
  return {
    voting_manabar: { current_mana: mana, last_update_time: lastUpdate },
    vesting_shares: `${vesting} VESTS`,
    delegated_vesting_shares: `${delegated} VESTS`,
    received_vesting_shares: "0.000000 VESTS",
  };
}

test("observes tag yield, hive-engine supply, and projected account mana", async () => {
  const leoPosts = [
    post({ author: "a", permlink: "p1", payout: "1.000", rshares: 10_000_000, createdSecondsAgo: 60 }),
    post({ author: "b", permlink: "p2", payout: "0.500", rshares: 5_000_000, createdSecondsAgo: 600 }),
  ];
  const hiveEngineLeo = { symbol: "LEO", circulatingSupply: "29632400.359", totalStaked: "14170916.645", precision: 3 };
  const acct = account({ vesting: "1000000.000000", delegated: "0.000000", mana: 500_000_000_000, lastUpdate: Math.floor(new Date(NOW).getTime() / 1000) - 216000 });
  const fetchImpl = makeMockFetch({
    primaryBlock: 100000,
    secondaryBlock: 100001,
    leoPosts,
    hiveEngineLeo,
    accountsByNode: { [PRIMARY]: { emsenn0: acct }, [SECONDARY]: { emsenn0: acct } },
  });

  const record = await observeTribeCurationYield({ nodes: [PRIMARY, SECONDARY], accounts: ["emsenn0"], tags: [{ name: "LEO", tag: "leofinance", symbol: "LEO" }], now: NOW, fetchImpl });

  assert.equal(record.type, "TribeCurationYieldObservationRecord");
  assert.deepEqual(record.witnesses, [
    { node: PRIMARY, headBlockNumber: 100000 },
    { node: SECONDARY, headBlockNumber: 100001 },
  ]);
  const leo = record.tags[0];
  assert.equal(leo.postCount, 2);
  assert.equal(leo.pendingPayoutSumHbd, "1.5");
  assert.equal(leo.netRshareSum, "15000000");
  assert.equal(leo.yieldHbdPerMillionRshares, "0.1");
  assert.equal(leo.newestPostAgeSeconds, 60);
  assert.equal(leo.oldestPostAgeSeconds, 600);
  assert.equal(leo.hiveEngine.circulatingSupply, "29632400.359");
  const mana = record.accounts.emsenn0.votingManabar;
  assert.equal(mana.maxManaRaw, "1000000000000");
  assert.equal(mana.currentManaRaw, "1000000000000");
  assert.equal(mana.currentManaPercent, "100");
});

test("refuses when the two nodes' head_block_number disagrees beyond maxBlockGap", async () => {
  const acct = account({ vesting: "1.000000", delegated: "0.000000", mana: 1, lastUpdate: 1 });
  const fetchImpl = makeMockFetch({
    primaryBlock: 100000,
    secondaryBlock: 100010,
    leoPosts: [],
    hiveEngineLeo: { symbol: "LEO", circulatingSupply: "0", totalStaked: "0", precision: 3 },
    accountsByNode: { [PRIMARY]: { emsenn0: acct }, [SECONDARY]: { emsenn0: acct } },
  });
  await assert.rejects(
    observeTribeCurationYield({ nodes: [PRIMARY, SECONDARY], accounts: ["emsenn0"], tags: [], now: NOW, fetchImpl }),
    /CURATION_YIELD_NODE_DISAGREEMENT: head_block_number gap/u,
  );
});

test("refuses when the two nodes' account vesting disagrees beyond toleranceBasisPoints", async () => {
  const fetchImpl = makeMockFetch({
    primaryBlock: 100000,
    secondaryBlock: 100000,
    leoPosts: [],
    hiveEngineLeo: { symbol: "LEO", circulatingSupply: "0", totalStaked: "0", precision: 3 },
    accountsByNode: {
      [PRIMARY]: { emsenn0: account({ vesting: "1000000.000000", delegated: "0.000000", mana: 1, lastUpdate: 1 }) },
      [SECONDARY]: { emsenn0: account({ vesting: "10.000000", delegated: "0.000000", mana: 1, lastUpdate: 1 }) },
    },
  });
  await assert.rejects(
    observeTribeCurationYield({ nodes: [PRIMARY, SECONDARY], accounts: ["emsenn0"], tags: [], now: NOW, fetchImpl }),
    /CURATION_YIELD_NODE_DISAGREEMENT: account emsenn0 vesting\/mana gap/u,
  );
});

test("refuses a request naming fewer than two nodes", async () => {
  await assert.rejects(observeTribeCurationYield({ nodes: [PRIMARY] }), /request\.nodes must name at least two nodes/u);
});
```
## Examples
```json name="observes LEO tag yield and hive-engine supply from two agreeing fixture nodes"
{"input":{"nodes":["https://api.hive.blog","https://api.openhive.network"],"tags":[{"name":"LEO","tag":"leofinance","symbol":"LEO"}],"accounts":[],"now":"2026-09-05T00:10:00.000Z","fixtures":{"dynamicGlobalProperties":{"https://api.hive.blog":{"head_block_number":100000},"https://api.openhive.network":{"head_block_number":100000}},"rankedPosts":{"https://api.hive.blog|leofinance":[{"author":"a","permlink":"p1","created":"2026-09-05T00:09:00","pending_payout_value":"1.000 HBD","net_rshares":10000000}],"https://api.openhive.network|leofinance":[{"author":"a","permlink":"p1","created":"2026-09-05T00:09:00","pending_payout_value":"1.000 HBD","net_rshares":10000000}]},"hiveEngineTokens":{"LEO":{"symbol":"LEO","circulatingSupply":"29632400.359","totalStaked":"14170916.645","precision":3}},"accounts":{}}},"output":{"type":"TribeCurationYieldObservationRecord","version":1,"observedAt":"2026-09-05T00:10:00.000Z","witnesses":[{"node":"https://api.hive.blog","headBlockNumber":100000},{"node":"https://api.openhive.network","headBlockNumber":100000}],"tags":[{"name":"LEO","tag":"leofinance","symbol":"LEO","postCount":1,"pendingPayoutSumHbd":"1","netRshareSum":"10000000","yieldHbdPerMillionRshares":"0.1","oldestPostAgeSeconds":60,"newestPostAgeSeconds":60,"hiveEngine":{"node":"https://api.hive-engine.com/rpc/contracts","circulatingSupply":"29632400.359","totalStaked":"14170916.645","precision":3}}],"accounts":{}}}
```
## Traceability
- `reads-tag-posts` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-and-bridge-api`
- `witnesses-two-nodes` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-and-bridge-api`
- `refuses-node-disagreement` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-and-bridge-api`
- `computes-tag-yield` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`, `frictions-are-duties`
- `reads-hive-engine-token-supply` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-engine-rpc-contracts`
- `reads-account-manabar` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-voting-manabar-model`
- `exact-decimal-strings` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`, `frictions-are-duties`
- `read-only` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `liquidity-stays-liquid`, `voting-is-not-fenced`
- `supports-deterministic-replay` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `no-second-decimal-arithmetic` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`, `frictions-are-duties`
- `no-order-placement` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `liquidity-stays-liquid`
- `no-silent-disagreement` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-and-bridge-api`
- `no-scot-api-dependency` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-engine-rpc-contracts`
