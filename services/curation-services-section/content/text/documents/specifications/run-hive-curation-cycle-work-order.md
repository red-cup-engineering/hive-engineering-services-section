# run-hive-curation-cycle
## Requirements
- `takes-founder-policy-as-data`: The operation takes `request.policy` (a plain `HiveCurationPolicyRecord` object, never a file path — file I/O stays in the CLI entry point, never inside the pure operation) naming `accounts`, `tags`, `nodes`, `hiveEngineNode`, `postsPerTag`, the vote policy fields (`dailyManaBudgetPercent`,`minWeight`,`maxWeight`,`dustPendingPayoutThresholdHbd`,`dustWeight`,`preferredTags`,`neverVoteAuthors`,`curationWindowSeconds`,`curationWindowToleranceSeconds`,`maxDailyBudgetPercent`), `postingKeyPathTemplate` (containing the literal substring `{account}`), and `journalRoot`.
- `observes-then-schedules-then-casts`: For the policy's accounts and tags, the operation composes, in order and by exact pin, `@red-cup-engineering/observe-tribe-curation-yield-service`'s `observeTribeCurationYield`, then `@red-cup-engineering/schedule-set-of-votes-service`'s `scheduleSetOfVotes` per account, then `@red-cup-engineering/cast-set-of-votes-service`'s `castSetOfVotes` per account — never a fourth reimplementation of any of the three.
- `gathers-candidate-posts`: For each policy tag, the operation reads `bridge.get_ranked_posts` (sort `created`, limit `request.postsPerTag`) from the policy's primary node and maps each post to `{tag,symbol,author,permlink,ageSeconds,pendingPayoutValueHbd,netRshares}` for `scheduleSetOfVotes`'s `candidatePosts`.
- `resolves-key-path-per-account`: The operation resolves each account's posting-key path by substituting the literal account name for `{account}` in `policy.postingKeyPathTemplate`, never printing or returning the resolved path's file contents.
- `returns-and-implicitly-journals`: The operation returns a `HiveCurationCycleRunRecord` `{type,version,runAt,yieldReadout,accounts:{[account]:{schedule,cast}}}`; the per-vote journal entries are written by the composed `castSetOfVotes` call, never duplicated here.
- `supports-deterministic-replay`: The operation accepts optional `request.fetchImpl` and `request.castVote` (forwarded into the composed calls) and `request.now`, so a fully-injected request never touches the network or a real key file.
- `holds-accounts-pending-founder-policy`: For each of `policy.heldAccounts` (default `[]`), the operation never calls `scheduleSetOfVotes` or `castSetOfVotes` for that account; it journals one `{account,held:true,reason}` record (category `cycle-account-result`) through `@red-cup-engineering/semantic-record-journal-service` and returns `accounts[account] = {held:true, schedule:null, cast:null}`. Every non-held account also gets one `{account,held:false,scheduledCount,castCount,refusalReason}` journal record in the same category, so one cycle always produces exactly one journal line per policy account naming its held/run outcome.
## Prohibitions
- `no-second-observe-schedule-cast`: The operation must not reimplement any behavior of `observeTribeCurationYield`, `scheduleSetOfVotes`, or `castSetOfVotes`; it only composes them.
- `no-policy-file-read-in-operation`: The operation (including its CLI entry point) must never open the policy file itself (no `readFileText`, no `node:fs`); reading the founder's policy file from disk and composing it into the one JSON request line is the deploying timer's job (a shell `cat`/`jq` step in its `ExecStart`), never this package's, so every call to this operation stays a pure, example-testable transformation of its input object.
- `no-signing-or-key-read`: The operation must never read a posting-key file itself or construct a signer; that stays inside the composed `castSetOfVotes` call.
- `no-post-comment-follow-reblog-transfer`: The operation must never call any Hive write operation beyond what `castSetOfVotes` already casts (`vote` only).
## Laws
- `fabricate-do-not-hand-write` | 561 Group working discipline, dispatch-agents skill | 2026-09-04 | .claude/skills/dispatch-agents/SKILL.md | Applies to this whole operation source file. | The operation is born through the jsnode fabrication line from this work order, never hand-written.
- `no-automated-posting-fence` | Founder standing fence | 2026-09-04 | .claude/rules/working-discipline.md | Applies to the entire scope of this operation. | No automated posting or commenting from the founder's existing Hive accounts, ever; voting was never fenced, so this cycle observes, schedules, and casts votes only.
- `vote-budget-capped-until-policy-says-otherwise` | Operating constraint | 2026-09-05 | curation-services-section/data/state/hive-curation-policy-state/hive-curation-policy.json | Applies to `request.policyPath`'s `maxDailyBudgetPercent` and `maxWeight` defaults. | The vote budget is capped at 20 percent of mana until the policy record changes. The default vote weight is lowered and can be raised through that policy record; the created record encodes both constraints.
## Standards
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation and its import.meta.main guard. | The package uses one executable ESM operation source file eligible for downstream staged package-birth assays.
- `hive-bridge-get-ranked-posts` | Hive blockchain developer portal (bridge API) | 2026 revision | https://developers.hive.io/apidefinitions/ | Applies to the `gathers-candidate-posts` requirement. | The operation calls exactly `bridge.get_ranked_posts` with the parameter shape this reference documents, the same call `observe-tribe-curation-yield-service` already makes per tag.
## Open questions
- `duplicate-post-fetch` [nonblocking]: This operation makes its own `bridge.get_ranked_posts` read per tag rather than receiving posts from `observeTribeCurationYield` (which does not yet return individual posts, only aggregates); a follow-on additive version of `observe-tribe-curation-yield-service` that also returns each tag's posts would let this operation drop its own duplicate read.
## Package
```json
{"packageName":"@red-cup-engineering/run-hive-curation-cycle-service","packageVersion":"0.1.1","license":"UNLICENSED","dependencies":{"@red-cup-engineering/observe-tribe-curation-yield-service":"0.1.0","@red-cup-engineering/schedule-set-of-votes-service":"0.1.0","@red-cup-engineering/cast-set-of-votes-service":"0.1.0","@red-cup-engineering/semantic-record-journal-service":"0.1.11","@red-cup-engineering/read-javascript-node-standard-input-text-service":"0.2.1"},"devDependencies":{}}
```
## Operation
```mjs path=scripts/run-hive-curation-cycle.mjs
#!/usr/bin/env node
import { observeTribeCurationYield } from "@red-cup-engineering/observe-tribe-curation-yield-service";
import { scheduleSetOfVotes } from "@red-cup-engineering/schedule-set-of-votes-service";
import { castSetOfVotes } from "@red-cup-engineering/cast-set-of-votes-service";
import { createSemanticRecordJournal } from "@red-cup-engineering/semantic-record-journal-service";
import { readJavascriptNodeStandardInputText } from "@red-cup-engineering/read-javascript-node-standard-input-text-service";

const DEFAULT_NODES = Object.freeze(["https://api.hive.blog", "https://api.openhive.network"]);

/** POST one JSON-RPC 2.0 request and return its result, throwing on an HTTP or RPC error. */
async function callNode(node, method, params, fetchImpl) {
  const response = await fetchImpl(node, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`run-hive-curation-cycle: HTTP ${response.status} from ${node} calling ${method}`);
  const body = await response.json();
  if (body?.error) throw new Error(`run-hive-curation-cycle: RPC error from ${node} calling ${method}: ${JSON.stringify(body.error)}`);
  return body?.result;
}

/** Seconds between a Hive-returned ISO instant (no trailing 'Z') and nowMs. */
function ageSeconds(createdIso, nowMs) {
  return Math.max(0, Math.round((nowMs - new Date(`${createdIso}Z`).getTime()) / 1000));
}

/**
 * Runs one Hive curation cycle for every policy account, taking the founder's policy record as data, observing tribe curation yield, scheduling votes, and casting them.
 * @param {object} request
 * @param {object} request.policy A HiveCurationPolicyRecord object (never a path; the CLI entry point reads the file and merges it in).
 * @param {typeof fetch} [request.fetchImpl] Injectable fetch implementation, for tests.
 * @param {object} [request.fixtures] Literal pre-recorded results, threaded into observeTribeCurationYield's own fixtures and keyed the same way (`` `${node}|${tag}` ``) for this operation's own bridge.get_ranked_posts read, for deterministic replay.
 * @param {Function} [request.castVote] Injectable castVote factory, forwarded into castSetOfVotes, for tests.
 * @param {string} [request.now] An injectable ISO instant, for deterministic replay (default the real current time).
 * @returns {Promise<object>} A HiveCurationCycleRunRecord: {type,version,runAt,yieldReadout,accounts}.
 */
export async function runHiveCurationCycle(request) {
  const policy = request.policy;
  const fetchImpl = request.fetchImpl ?? fetch;
  const nowIso = request.now ?? new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();
  const nodes = policy.nodes ?? DEFAULT_NODES;

  const yieldReadout = await observeTribeCurationYield({
    nodes,
    hiveEngineNode: policy.hiveEngineNode,
    tags: policy.tags,
    postsPerTag: policy.postsPerTag,
    accounts: policy.accounts,
    now: nowIso,
    fetchImpl,
    fixtures: request.fixtures,
  });

  const tagSpecs = policy.tags ?? yieldReadout.tags.map((tag) => ({ name: tag.name, tag: tag.tag, symbol: tag.symbol }));
  const candidatePosts = [];
  for (const tagSpec of tagSpecs) {
    const fixtureKey = `${nodes[0]}|${tagSpec.tag}`;
    const fixturePosts = request.fixtures?.rankedPosts?.[fixtureKey];
    const posts = fixturePosts !== undefined ? fixturePosts : await callNode(nodes[0], "bridge.get_ranked_posts", { sort: "created", tag: tagSpec.tag, limit: policy.postsPerTag ?? 20, observer: "" }, fetchImpl);
    for (const post of posts ?? []) {
      candidatePosts.push({
        tag: tagSpec.tag,
        symbol: tagSpec.symbol,
        author: post.author,
        permlink: post.permlink,
        ageSeconds: ageSeconds(post.created, nowMs),
        pendingPayoutValueHbd: String(post.pending_payout_value).split(" ")[0],
        netRshares: post.net_rshares,
      });
    }
  }

  const journal = createSemanticRecordJournal({ root: policy.journalRoot, objectKind: "red-cup-engineering.hive-curation-cycle-account-result" });
  const heldAccounts = policy.heldAccounts ?? [];
  const accounts = {};
  for (const account of policy.accounts) {
    if (heldAccounts.includes(account)) {
      journal.record({
        category: "cycle-account-result",
        record: { account, held: true, reason: "account-held: awaiting founder policy (preferredTags, neverVoteAuthors, weight)" },
        recordedAt: nowIso,
        charge: { support: true, refutation: false },
      });
      accounts[account] = { held: true, schedule: null, cast: null };
      continue;
    }
    const schedule = scheduleSetOfVotes({
      yieldReadout,
      account,
      candidatePosts,
      policy: {
        dailyManaBudgetPercent: policy.dailyManaBudgetPercent,
        minWeight: policy.minWeight,
        maxWeight: policy.maxWeight,
        dustPendingPayoutThresholdHbd: policy.dustPendingPayoutThresholdHbd,
        dustWeight: policy.dustWeight,
        preferredTags: policy.preferredTags,
        neverVoteAuthors: policy.neverVoteAuthors,
        curationWindowSeconds: policy.curationWindowSeconds,
        curationWindowToleranceSeconds: policy.curationWindowToleranceSeconds,
      },
      now: nowIso,
    });
    const postingKeyPath = policy.postingKeyPathTemplate.replaceAll("{account}", account);
    const cast = await castSetOfVotes({
      schedule,
      account,
      postingKeyPath,
      journalRoot: policy.journalRoot,
      maxDailyBudgetPercent: policy.maxDailyBudgetPercent,
      castVote: request.castVote,
      now: nowIso,
    });
    journal.record({
      category: "cycle-account-result",
      record: { account, held: false, scheduledCount: schedule.scheduled.length, castCount: cast.cast.length, refusalReason: cast.refusal?.reason ?? null },
      recordedAt: nowIso,
      charge: { support: true, refutation: false },
    });
    accounts[account] = { held: false, schedule, cast };
  }

  return { type: "HiveCurationCycleRunRecord", version: 1, runAt: nowIso, yieldReadout, accounts };
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "runHiveCurationCycle — Runs one Hive curation cycle for every policy account, taking the founder's policy record as data, observing tribe curation yield, scheduling votes, and casting them.\n",
    );
  } else {
    const inputText = (await readJavascriptNodeStandardInputText({ type: "JavascriptNodeStandardInputTextReadRequest", version: 1 }, { standardInput: process.stdin })).text;
    for (const line of inputText.split("\n")) {
      if (line.length === 0) continue;
      try {
        process.stdout.write(`${JSON.stringify(await runHiveCurationCycle(JSON.parse(line)))}\n`);
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  }
}
```
## Tests
```mjs path=test/run-hive-curation-cycle.test.mjs
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runHiveCurationCycle } from "../scripts/run-hive-curation-cycle.mjs";

const NOW = "2026-09-05T00:10:00.000Z";

function makeMockFetch({ postAgeSeconds }) {
  const created = new Date(new Date(NOW).getTime() - postAgeSeconds * 1000).toISOString().slice(0, -5);
  return async (input, init) => {
    const body = JSON.parse(init.body);
    if (body.method === "condenser_api.get_dynamic_global_properties") return { ok: true, status: 200, json: async () => ({ result: { head_block_number: 100000 } }) };
    if (body.method === "bridge.get_ranked_posts") {
      return { ok: true, status: 200, json: async () => ({ result: [{ author: "alice", permlink: "p1", created, pending_payout_value: "0.500 HBD", net_rshares: 1000000 }] }) };
    }
    if (body.method === "find") return { ok: true, status: 200, json: async () => ({ result: [] }) };
    if (body.method === "condenser_api.get_accounts") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: [{ voting_manabar: { current_mana: 1000000000000, last_update_time: Math.floor(new Date(NOW).getTime() / 1000) }, vesting_shares: "1000000.000000 VESTS", delegated_vesting_shares: "0.000000 VESTS", received_vesting_shares: "0.000000 VESTS" }],
        }),
      };
    }
    throw new Error(`unmocked method ${body.method}`);
  };
}

function policy(overrides) {
  return {
    accounts: ["emsenn0"],
    tags: [{ name: "POB", tag: "proofofbrain", symbol: "POB" }],
    postsPerTag: 5,
    dailyManaBudgetPercent: 20,
    minWeight: 100,
    maxWeight: 3000,
    dustPendingPayoutThresholdHbd: "0.02",
    dustWeight: 100,
    preferredTags: ["proofofbrain"],
    neverVoteAuthors: [],
    curationWindowSeconds: 300,
    curationWindowToleranceSeconds: 60,
    maxDailyBudgetPercent: 20,
    ...overrides,
  };
}

test("runs observe, schedule, and cast in one composed cycle and casts the one in-window candidate", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "run-hive-curation-cycle-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "emsenn0.wif"), "5Jtestwifvalue\n");

  const record = await runHiveCurationCycle({
    policy: policy({ postingKeyPathTemplate: join(root, "{account}.wif"), journalRoot: root }),
    now: NOW,
    fetchImpl: makeMockFetch({ postAgeSeconds: 300 }),
    castVote: () => ({ vote: async () => ({ id: "a".repeat(40) }) }),
  });

  assert.equal(record.type, "HiveCurationCycleRunRecord");
  assert.equal(record.accounts.emsenn0.schedule.scheduled.length, 1);
  assert.equal(record.accounts.emsenn0.schedule.scheduled[0].weight, 3000);
  assert.equal(record.accounts.emsenn0.cast.cast.length, 1);
  assert.equal(record.accounts.emsenn0.cast.cast[0].transactionId, "a".repeat(40));
});

test("refuses to cast (but still schedules) when the posting key file is absent", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "run-hive-curation-cycle-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const record = await runHiveCurationCycle({
    policy: policy({ postingKeyPathTemplate: join(root, "{account}.wif"), journalRoot: root }),
    now: NOW,
    fetchImpl: makeMockFetch({ postAgeSeconds: 300 }),
    castVote: () => ({ vote: async () => { throw new Error("must not be called"); } }),
  });

  assert.equal(record.accounts.emsenn0.cast.refusal.reason, "no-posting-key");
});

test("holds a policy.heldAccounts account: no schedule/cast call, one held journal line; a non-held account still runs", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "run-hive-curation-cycle-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "michael561.wif"), "5Jtestwifvalue\n");

  const record = await runHiveCurationCycle({
    policy: policy({ accounts: ["emsenn0", "michael561"], heldAccounts: ["emsenn0"], postingKeyPathTemplate: join(root, "{account}.wif"), journalRoot: root }),
    now: NOW,
    fetchImpl: makeMockFetch({ postAgeSeconds: 300 }),
    castVote: () => ({ vote: async () => ({ id: "a".repeat(40) }) }),
  });

  assert.equal(record.accounts.emsenn0.held, true);
  assert.equal(record.accounts.emsenn0.schedule, null);
  assert.equal(record.accounts.emsenn0.cast, null);
  assert.equal(record.accounts.michael561.held, false);
  assert.equal(record.accounts.michael561.cast.cast.length, 1);
});
```
## Examples
```json name="runs an empty-policy cycle (no tags, no accounts) and returns the empty-collections record shape"
{"input":{"policy":{"accounts":[],"tags":[],"nodes":["https://api.hive.blog","https://api.openhive.network"],"postingKeyPathTemplate":"/nonexistent/{account}.wif","journalRoot":"/nonexistent","dailyManaBudgetPercent":20,"minWeight":100,"maxWeight":3000,"dustPendingPayoutThresholdHbd":"0.02","dustWeight":100,"preferredTags":[],"neverVoteAuthors":[],"curationWindowSeconds":300,"curationWindowToleranceSeconds":60,"maxDailyBudgetPercent":20},"now":"2026-09-05T00:10:00.000Z","fixtures":{"dynamicGlobalProperties":{"https://api.hive.blog":{"head_block_number":100000},"https://api.openhive.network":{"head_block_number":100000}}}},"output":{"type":"HiveCurationCycleRunRecord","version":1,"runAt":"2026-09-05T00:10:00.000Z","yieldReadout":{"type":"TribeCurationYieldObservationRecord","version":1,"observedAt":"2026-09-05T00:10:00.000Z","witnesses":[{"node":"https://api.hive.blog","headBlockNumber":100000},{"node":"https://api.openhive.network","headBlockNumber":100000}],"tags":[],"accounts":{}},"accounts":{}}}
```
## Traceability
- `takes-founder-policy-as-data` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `vote-budget-capped-until-policy-says-otherwise`
- `observes-then-schedules-then-casts` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `no-automated-posting-fence`
- `gathers-candidate-posts` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-bridge-get-ranked-posts`
- `resolves-key-path-per-account` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `no-automated-posting-fence`
- `returns-and-implicitly-journals` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `no-automated-posting-fence`
- `supports-deterministic-replay` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `holds-accounts-pending-founder-policy` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `vote-budget-capped-until-policy-says-otherwise`
- `no-second-observe-schedule-cast` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-bridge-get-ranked-posts`
- `no-policy-file-read-in-operation` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `no-signing-or-key-read` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `no-automated-posting-fence`
- `no-post-comment-follow-reblog-transfer` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `no-automated-posting-fence`
