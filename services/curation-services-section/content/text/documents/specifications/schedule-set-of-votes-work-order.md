# schedule-set-of-votes
## Requirements
- `pure-transformation`: The operation performs no I/O (no network call, no file read, no clock beyond the injectable `request.now`); every input it needs (the yield readout, the account's mana, the vote policy, the candidate posts) arrives as plain data.
- `reads-account-mana-from-readout`: The operation reads `request.yieldReadout.accounts[request.account].votingManabar` (`maxManaRaw`, `currentManaRaw`, both raw integer strings) as the account's available voting-mana budget base; it refuses (throws `TypeError`) when `request.account` is not a key of `request.yieldReadout.accounts`.
- `applies-vote-policy`: The operation applies `request.policy` (defaults documented in its JSDoc): `dailyManaBudgetPercent` (percent of the account's current mana spendable today), `minWeight`/`maxWeight` (Hive vote-weight bounds, out of 10000), a dust rule (`dustPendingPayoutThresholdHbd`, `dustWeight`) for short-form/low-payout content per `task:dust-curation-micro-blogging`, `preferredTags` (tags whose posts get `maxWeight` instead of `minWeight` when not dust), `neverVoteAuthors`, and a curation window (`curationWindowSeconds` default 300 per `task:social-mev-predictive-curation`'s five-minute reverse-auction theory, `curationWindowToleranceSeconds` default 60).
- `schedules-within-window-and-budget`: For each of `request.candidatePosts` (`{tag,symbol,author,permlink,ageSeconds,pendingPayoutValueHbd,netRshares}`), the operation schedules a vote (post, weight, ISO `time`) only when the author is not excluded, `ageSeconds` falls inside the curation window (`curationWindowSeconds` +/- `curationWindowToleranceSeconds`), and the vote's estimated mana cost keeps cumulative spend at or under the daily mana budget; `time` is `request.now` plus however many seconds remain until `curationWindowSeconds` has elapsed since the post's creation (zero if already past it).
- `estimates-mana-cost`: The operation estimates one vote's mana cost as `maxManaRaw * weight / 500000` — the standard Hive design constant that a 100%-weight (10000) vote costs 1/50 (2%) of max mana, since voting mana fully regenerates over 5 days at a target of 50 full-power votes per day.
- `estimates-curation-return`: The operation reports `expectedCurationReturnHbd` per scheduled vote as an explicitly labeled order-of-magnitude estimate (the post's tag's `yieldHbdPerMillionRshares` from `request.yieldReadout.tags`, times the voter's own estimated rshares contribution scaled by `maxManaRaw` and `weight`) — never presented as the chain's exact curator-share formula.
- `reports-refusals`: The operation reports every refused candidate with exactly one reason: `author-excluded`, `outside-window`, or `mana-below-floor`.
- `exact-decimal-strings`: Every numeric quantity in the returned record is a decimal string or a plain integer, derived using `@red-cup-engineering/computer-ledger-system-services-section`'s BigInt-scaled decimal primitives (`parseDecimal`, `formatScaled`, `multiplyDecimalStrings`) plus this operation's own BigInt-scaled division helper — never a JavaScript float carried into a reported decimal.
## Prohibitions
- `no-second-decimal-arithmetic`: The operation must not re-implement decimal-string parsing, formatting, or multiplication that `@red-cup-engineering/computer-ledger-system-services-section`'s `decimal.mjs` already exports; it may add exactly one new BigInt-scaled decimal-division helper, because no house decimal-division-strings primitive exists yet (the same documented gap `observe-hive-internal-market` and `observe-tribe-curation-yield` already admit).
- `no-network-or-clock`: The operation must never call `fetch`, read a file, or call `Date.now()`/`new Date()` with no argument for anything other than the CLI's own stdin-line loop; every timestamp used in scheduling logic comes from `request.now`.
- `no-signing-or-broadcast`: The operation must never sign, broadcast, or accept a private key; it produces a schedule for `cast-set-of-votes` to execute, never executes anything itself.
## Laws
- `primitives-exist-once` | 561 Group working discipline | 2026-08-30 | CLAUDE.md | Applies to all decimal arithmetic in this operation. | The BigInt-scaled decimal primitives live once, in `@red-cup-engineering/computer-ledger-system-services-section`; this operation composes them by exact pin.
- `fabricate-do-not-hand-write` | 561 Group working discipline, dispatch-agents skill | 2026-09-04 | .claude/skills/dispatch-agents/SKILL.md | Applies to this whole operation source file. | The operation is born through the jsnode fabrication line from this work order, never hand-written.
- `frictions-are-duties` | 561 Group working discipline | 2026-09-04 | .claude/rules/working-discipline.md | Applies to the one new decimal-division helper this operation adds. | No house decimal-division-strings primitive exists yet; this gap is admitted as a friction rather than silently grown into a second decimal library.
- `voting-is-not-fenced` | Operating constraint | 2026-09-04 | .claude/rules/working-discipline.md | Applies to why this operation and its siblings exist at all. | The standing fence is no automated POSTING or commenting from the existing Hive accounts; voting was never fenced, so scheduling and casting votes are in scope.
## Standards
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation and its import.meta.main guard. | The package uses one executable ESM operation source file eligible for downstream staged package-birth assays.
- `hive-voting-mana-regeneration-design` | Hive/Steem blockchain design (voting power model) | 2026 revision | https://developers.hive.io/apidefinitions/ | Applies to the `estimates-mana-cost` requirement's 1/50-per-100%-vote constant. | Voting mana regenerates fully over 5 days (432000 seconds) by protocol design, targeting 50 full-power (weight 10000) votes per day; a 100%-weight vote therefore costs 1/50 (2%) of max mana, and a partial-weight vote costs that fraction proportionally.
## Open questions
- `curation-return-estimate-precision` [nonblocking]: `expectedCurationReturnHbd` is an order-of-magnitude proxy (tag yield times an estimated own-rshares contribution), not the chain's exact curator-share reverse-auction formula; a follow-on task may replace it with a reward-fund-aware calculation once `reward_fund`/`recent_claims` reads are added.
## Package
```json
{"packageName":"@red-cup-engineering/schedule-set-of-votes-service","packageVersion":"0.1.0","license":"UNLICENSED","dependencies":{"@red-cup-engineering/computer-ledger-system-services-section":"0.2.0","@red-cup-engineering/read-javascript-node-standard-input-text-service":"0.2.1"},"devDependencies":{}}
```
## Operation
```mjs path=scripts/schedule-set-of-votes.mjs
#!/usr/bin/env node
import { parseDecimal, formatScaled, multiplyDecimalStrings } from "@red-cup-engineering/computer-ledger-system-services-section/src/decimal.mjs";
import { readJavascriptNodeStandardInputText } from "@red-cup-engineering/read-javascript-node-standard-input-text-service";

const DEFAULT_POLICY = Object.freeze({
  dailyManaBudgetPercent: 20,
  minWeight: 100,
  maxWeight: 10000,
  dustPendingPayoutThresholdHbd: "0.02",
  dustWeight: 100,
  preferredTags: Object.freeze([]),
  neverVoteAuthors: Object.freeze([]),
  curationWindowSeconds: 300,
  curationWindowToleranceSeconds: 60,
});
const VOTE_MANA_COST_DIVISOR = 500000n;

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
  if (rightMagnitude === 0n) throw new RangeError(`schedule-set-of-votes: division by zero (${b})`);
  const numerator = leftMagnitude * 10n ** BigInt(right.frac.length + maxDecimals);
  const denominator = rightMagnitude * 10n ** BigInt(left.frac.length);
  const magnitude = numerator / denominator;
  const negative = left.negative !== right.negative;
  return formatScaled(negative ? -magnitude : magnitude, maxDecimals);
}

/**
 * Schedules a day's Hive curation votes for one account, weighting and budgeting candidate posts by policy.
 * @param {object} request
 * @param {object} request.yieldReadout A TribeCurationYieldObservationRecord naming this account's votingManabar and each tag's yieldHbdPerMillionRshares.
 * @param {string} request.account The account to schedule votes for; must be a key of request.yieldReadout.accounts.
 * @param {readonly object[]} request.candidatePosts Posts to consider: {tag,symbol,author,permlink,ageSeconds,pendingPayoutValueHbd,netRshares}.
 * @param {object} [request.policy] Vote policy; see DEFAULT_POLICY for every field and its default.
 * @param {string} [request.now] An injectable ISO instant for generatedAt and vote time scheduling (default the real current time).
 * @returns {object} A VoteScheduleRecord: {type,version,account,generatedAt,manaBudgetRaw,manaBudgetPercent,scheduled,refused}.
 * @throws {TypeError} When request.account is not a key of request.yieldReadout.accounts.
 */
export function scheduleSetOfVotes(request) {
  const { yieldReadout, account, candidatePosts } = request;
  const accountMana = yieldReadout?.accounts?.[account]?.votingManabar;
  if (!accountMana) throw new TypeError(`schedule-set-of-votes: request.account ${account} is not a key of request.yieldReadout.accounts`);
  const policy = { ...DEFAULT_POLICY, ...(request.policy ?? {}) };
  const nowMs = request.now ? new Date(request.now).getTime() : Date.now();
  const maxManaRaw = BigInt(accountMana.maxManaRaw);
  const currentManaRaw = BigInt(accountMana.currentManaRaw);
  const manaBudgetRaw = (currentManaRaw * BigInt(policy.dailyManaBudgetPercent)) / 100n;

  const tagYield = new Map((yieldReadout.tags ?? []).map((tag) => [tag.tag, tag]));
  const scheduled = [];
  const refused = [];
  let spentRaw = 0n;

  for (const post of candidatePosts) {
    if (policy.neverVoteAuthors.includes(post.author)) {
      refused.push({ post, reason: "author-excluded" });
      continue;
    }
    const lowerBound = policy.curationWindowSeconds - policy.curationWindowToleranceSeconds;
    const upperBound = policy.curationWindowSeconds + policy.curationWindowToleranceSeconds;
    if (post.ageSeconds < lowerBound || post.ageSeconds > upperBound) {
      refused.push({ post, reason: "outside-window" });
      continue;
    }
    const isDust = Number(post.pendingPayoutValueHbd) < Number(policy.dustPendingPayoutThresholdHbd);
    const weight = isDust ? policy.dustWeight : policy.preferredTags.includes(post.tag) ? policy.maxWeight : policy.minWeight;
    const costRaw = (maxManaRaw * BigInt(weight)) / VOTE_MANA_COST_DIVISOR;
    if (spentRaw + costRaw > manaBudgetRaw) {
      refused.push({ post, reason: "mana-below-floor" });
      continue;
    }
    spentRaw += costRaw;
    const tag = tagYield.get(post.tag);
    const estimatedOwnRshares = (maxManaRaw * BigInt(weight)) / 10000n;
    const expectedCurationReturnHbd = tag?.yieldHbdPerMillionRshares != null
      ? divideDecimalStrings(multiplyDecimalStrings(tag.yieldHbdPerMillionRshares, estimatedOwnRshares.toString(), 30), "1000000", 12)
      : null;
    const scheduledTime = new Date(nowMs + Math.max(0, policy.curationWindowSeconds - post.ageSeconds) * 1000).toISOString();
    scheduled.push({ tag: post.tag, author: post.author, permlink: post.permlink, weight, time: scheduledTime, expectedCurationReturnHbd });
  }

  return {
    type: "VoteScheduleRecord",
    version: 1,
    account,
    generatedAt: new Date(nowMs).toISOString(),
    manaBudgetRaw: manaBudgetRaw.toString(),
    manaBudgetPercent: policy.dailyManaBudgetPercent,
    scheduled,
    refused,
  };
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "scheduleSetOfVotes — Schedules a day's Hive curation votes for one account, weighting and budgeting candidate posts by policy.\n",
    );
  } else {
    const inputText = (await readJavascriptNodeStandardInputText({ type: "JavascriptNodeStandardInputTextReadRequest", version: 1 }, { standardInput: process.stdin })).text;
    for (const line of inputText.split("\n")) {
      if (line.length === 0) continue;
      try {
        process.stdout.write(`${JSON.stringify(scheduleSetOfVotes(JSON.parse(line)))}\n`);
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  }
}
```
## Tests
```mjs path=test/schedule-set-of-votes.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { scheduleSetOfVotes } from "../scripts/schedule-set-of-votes.mjs";

const NOW = "2026-09-05T00:10:00.000Z";
const YIELD_READOUT = {
  tags: [{ tag: "proofofbrain", yieldHbdPerMillionRshares: "0.1" }],
  accounts: { emsenn0: { votingManabar: { maxManaRaw: "1000000000000", currentManaRaw: "1000000000000" } } },
};

function post(overrides) {
  return { tag: "proofofbrain", symbol: "POB", author: "alice", permlink: "p1", ageSeconds: 300, pendingPayoutValueHbd: "0.500", netRshares: 1000000, ...overrides };
}

test("schedules a preferred-tag post at max weight inside the window and budget", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: YIELD_READOUT,
    account: "emsenn0",
    candidatePosts: [post({})],
    policy: { preferredTags: ["proofofbrain"] },
    now: NOW,
  });
  assert.equal(record.scheduled.length, 1);
  assert.equal(record.scheduled[0].weight, 10000);
  assert.equal(record.scheduled[0].author, "alice");
  assert.equal(record.refused.length, 0);
  assert.ok(Number(record.scheduled[0].expectedCurationReturnHbd) > 0);
});

test("applies the dust weight to a low-payout post regardless of tag preference", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: YIELD_READOUT,
    account: "emsenn0",
    candidatePosts: [post({ pendingPayoutValueHbd: "0.001" })],
    policy: { preferredTags: ["proofofbrain"] },
    now: NOW,
  });
  assert.equal(record.scheduled[0].weight, 100);
});

test("refuses an excluded author", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: YIELD_READOUT,
    account: "emsenn0",
    candidatePosts: [post({ author: "spammer" })],
    policy: { neverVoteAuthors: ["spammer"] },
    now: NOW,
  });
  assert.deepEqual(record.refused[0].reason, "author-excluded");
});

test("refuses a post outside the curation window", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: YIELD_READOUT,
    account: "emsenn0",
    candidatePosts: [post({ ageSeconds: 30 })],
    now: NOW,
  });
  assert.equal(record.refused[0].reason, "outside-window");
});

test("refuses once the daily mana budget is spent", () => {
  const record = scheduleSetOfVotes({
    yieldReadout: {
      tags: YIELD_READOUT.tags,
      accounts: { emsenn0: { votingManabar: { maxManaRaw: "1000000000000", currentManaRaw: "1000000000000" } } },
    },
    account: "emsenn0",
    candidatePosts: [post({ permlink: "p1" }), post({ permlink: "p2" }), post({ permlink: "p3" })],
    policy: { preferredTags: ["proofofbrain"], dailyManaBudgetPercent: 2 },
    now: NOW,
  });
  assert.equal(record.scheduled.length, 1);
  assert.equal(record.refused.length, 2);
  assert.equal(record.refused[0].reason, "mana-below-floor");
});

test("refuses when the account is not a key of yieldReadout.accounts", () => {
  assert.throws(
    () => scheduleSetOfVotes({ yieldReadout: YIELD_READOUT, account: "unknown561", candidatePosts: [], now: NOW }),
    /request\.account unknown561 is not a key/u,
  );
});
```
## Examples
```json name="schedules one preferred-tag post at max weight inside window and budget"
{"input":{"yieldReadout":{"tags":[{"tag":"proofofbrain","yieldHbdPerMillionRshares":"0.1"}],"accounts":{"emsenn0":{"votingManabar":{"maxManaRaw":"1000000000000","currentManaRaw":"1000000000000"}}}},"account":"emsenn0","candidatePosts":[{"tag":"proofofbrain","symbol":"POB","author":"alice","permlink":"p1","ageSeconds":300,"pendingPayoutValueHbd":"0.500","netRshares":1000000}],"policy":{"preferredTags":["proofofbrain"]},"now":"2026-09-05T00:10:00.000Z"},"output":{"type":"VoteScheduleRecord","version":1,"account":"emsenn0","generatedAt":"2026-09-05T00:10:00.000Z","manaBudgetRaw":"200000000000","manaBudgetPercent":20,"scheduled":[{"tag":"proofofbrain","author":"alice","permlink":"p1","weight":10000,"time":"2026-09-05T00:10:00.000Z","expectedCurationReturnHbd":"100000"}],"refused":[]}}
```
## Traceability
- `pure-transformation` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `reads-account-mana-from-readout` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-voting-mana-regeneration-design`
- `applies-vote-policy` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `voting-is-not-fenced`
- `schedules-within-window-and-budget` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-voting-mana-regeneration-design`
- `estimates-mana-cost` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-voting-mana-regeneration-design`
- `estimates-curation-return` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`, `frictions-are-duties`
- `reports-refusals` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `voting-is-not-fenced`
- `exact-decimal-strings` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`, `frictions-are-duties`
- `no-second-decimal-arithmetic` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`, `frictions-are-duties`
- `no-network-or-clock` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `no-signing-or-broadcast` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `voting-is-not-fenced`
