# cast-set-of-votes
## Requirements
- `matches-schedule-account`: The operation refuses (throws `TypeError`) when `request.account` does not equal `request.schedule.account`.
- `enforces-budget-ceiling`: The operation refuses to cast anything, returning a `refusal` datum `{reason:"budget-exceeds-ceiling",scheduleManaBudgetPercent,maxDailyBudgetPercent}`, when `request.schedule.manaBudgetPercent` exceeds `request.maxDailyBudgetPercent` (default 20).
- `reads-posting-key-from-host`: The operation reads exactly the account's posting WIF as UTF-8 text from `request.postingKeyPath` on this host, through `@red-cup-engineering/computer-file-engineering-services-section`'s own `readFileText`, never a hand-rolled `node:fs` read; the raw key text is held only in a local variable and never appears in the returned record or the journaled record.
- `refuses-missing-key`: The operation refuses, returning a `refusal` datum `{reason:"no-posting-key",account,postingKeyPath}`, when reading `request.postingKeyPath` fails for any reason (no file at that path on this host).
- `casts-through-the-host-signer`: For each entry of `request.schedule.scheduled`, the operation casts one vote (`{voter:account,author,permlink,weight}`) by composing `@red-cup-engineering/hive-blockchain-client-service`'s `Waggle.vote`, constructed with the account and the posting key just read — never a second signing/broadcast implementation.
- `journals-every-vote`: For each cast vote, the operation journals `{account,author,permlink,weight,transactionId,tag,expectedCurationReturnHbd}` through `@red-cup-engineering/semantic-record-journal-service`'s `createSemanticRecordJournal({root:request.journalRoot,objectKind}).record(...)`, category `"vote-cast"`, `charge:{support:true,refutation:false}`.
- `never-posts-or-comments`: The operation must never call any Waggle write method other than `vote` (no `post`, `comment`, `reblog`, `follow`, `transfer`, `claimRewards`).
- `supports-injectable-signer`: The operation accepts an optional `request.castVote` factory (`{account,keys}=>{vote(op)=>Promise<{id}>}`) that stands in for the real `Waggle` construction, for deterministic tests that never touch the network or a real key file.
## Prohibitions
- `no-direct-fs-import`: The operation must not import `node:fs`/`node:fs/promises` directly for reading the posting key; it must compose `@red-cup-engineering/computer-file-engineering-services-section`'s `readFileText`, the house file-read primitive.
- `no-second-signing-implementation`: The operation must not hand-roll secp256k1 signing, graphene serialization, or a JSON-RPC broadcast call; every such act composes `@red-cup-engineering/hive-blockchain-client-service`, the revived house Hive client.
- `no-key-in-output-or-journal`: The operation must never place the posting WIF, or any substring of it, into its returned record, a thrown error message, a journaled record, or stdout/stderr.
- `no-post-comment-follow-reblog-transfer`: The operation must never broadcast a `comment` (top-level post or reply), `custom_json` follow/reblog, or `transfer` operation; its one broadcastable operation is `vote`.
## Laws
- `fabricate-do-not-hand-write` | 561 Group working discipline, dispatch-agents skill | 2026-09-04 | .claude/skills/dispatch-agents/SKILL.md | Applies to this whole operation source file. | The operation is born through the jsnode fabrication line from this work order, never hand-written.
- `no-automated-posting-fence` | Founder standing fence | 2026-09-04 | .claude/rules/working-discipline.md | Applies to the entire scope of this operation. | No automated posting or commenting from the founder's existing Hive accounts, ever; voting was never fenced, so this operation casts votes only.
- `primitives-exist-once` | 561 Group working discipline | 2026-08-30 | CLAUDE.md | Applies to file reads, signing, and the journal. | The file-read, Hive signing/broadcast, and semantic-record-journal primitives each live once, in their own house packages; this operation composes them by exact pin rather than reimplementing any of them.
- `session-bootstrap-journal` | 561 Group working discipline | 2026-09-04 | .claude/rules/session-bootstrap.md | Applies to the `journals-every-vote` requirement. | Receipts and durable records are written through `@red-cup-engineering/semantic-record-journal-service`, never hand-written JSON, except when that journal is itself broken.
## Standards
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation and its import.meta.main guard. | The package uses one executable ESM operation source file eligible for downstream staged package-birth assays.
- `hive-vote-broadcast-operation` | Hive blockchain developer portal (vote operation) | 2026 revision | https://developers.hive.io/apidefinitions/ | Applies to the `casts-through-the-host-signer` requirement. | The operation broadcasts exactly one `vote` operation per scheduled entry (`voter`,`author`,`permlink`,`weight`), the chain's own vote-operation shape, through the revived client's `Waggle.vote`.
## Open questions
- `key-path-expansion` [nonblocking]: `request.postingKeyPath` must be an absolute path; the operation does not expand a leading `~`, so a caller reading from `~/.config/blockchain/hive/<account>/posting.wif` must resolve the home directory itself before calling.
## Package
```json
{"packageName":"@red-cup-engineering/cast-set-of-votes-service","packageVersion":"0.1.0","license":"UNLICENSED","dependencies":{"@red-cup-engineering/hive-blockchain-client-service":"0.1.0","@red-cup-engineering/computer-file-engineering-services-section":"0.2.1","@red-cup-engineering/semantic-record-journal-service":"0.1.11","@red-cup-engineering/read-javascript-node-standard-input-text-service":"0.2.1"},"devDependencies":{}}
```
## Operation
```mjs path=scripts/cast-set-of-votes.mjs
#!/usr/bin/env node
import { readFileText } from "@red-cup-engineering/computer-file-engineering-services-section/read-file";
import { Waggle } from "@red-cup-engineering/hive-blockchain-client-service";
import { createSemanticRecordJournal } from "@red-cup-engineering/semantic-record-journal-service";
import { readJavascriptNodeStandardInputText } from "@red-cup-engineering/read-javascript-node-standard-input-text-service";

/**
 * Casts a day's scheduled Hive curation votes for one account through the host's posting key, capped by a hard daily budget ceiling and journaled per vote with its transaction id.
 * @param {object} request
 * @param {object} request.schedule A VoteScheduleRecord from schedule-set-of-votes.
 * @param {string} request.account The Hive account to sign votes as; must equal request.schedule.account.
 * @param {string} request.postingKeyPath Absolute filesystem path to a file holding exactly the account's posting WIF, read on this host and never returned or journaled.
 * @param {string} request.journalRoot Filesystem root of the owning services-section passed to createSemanticRecordJournal for the per-vote journal.
 * @param {number} [request.maxDailyBudgetPercent] Hard ceiling on the schedule's declared manaBudgetPercent (default 20); the whole cast is refused when the schedule exceeds it.
 * @param {Function} [request.castVote] Injectable ({account,keys})=>{vote(op)=>Promise<{id}>} factory, for tests; default constructs a real Waggle and broadcasts.
 * @param {string} [request.now] An injectable ISO instant for castAt, for deterministic replay (default the real current time).
 * @returns {Promise<object>} A CastSetOfVotesRecord: {type,version,account,castAt,cast,refusal}.
 * @throws {TypeError} When request.account does not equal request.schedule.account.
 */
export async function castSetOfVotes(request) {
  const { schedule, account, postingKeyPath, journalRoot } = request;
  if (account !== schedule.account) throw new TypeError(`cast-set-of-votes: request.account ${account} does not match request.schedule.account ${schedule.account}`);
  const maxDailyBudgetPercent = request.maxDailyBudgetPercent ?? 20;
  const castAt = request.now ? new Date(request.now).toISOString() : new Date().toISOString();
  const journal = createSemanticRecordJournal({ root: journalRoot, objectKind: "red-cup-engineering.hive-curation-vote-cast-record" });

  if (schedule.manaBudgetPercent > maxDailyBudgetPercent) {
    return {
      type: "CastSetOfVotesRecord",
      version: 1,
      account,
      castAt,
      cast: [],
      refusal: { reason: "budget-exceeds-ceiling", scheduleManaBudgetPercent: schedule.manaBudgetPercent, maxDailyBudgetPercent },
    };
  }

  let postingWif;
  try {
    postingWif = (await readFileText(postingKeyPath)).trim();
  } catch {
    return {
      type: "CastSetOfVotesRecord",
      version: 1,
      account,
      castAt,
      cast: [],
      refusal: { reason: "no-posting-key", account, postingKeyPath },
    };
  }

  const makeVoter = request.castVote ?? (({ account: voterAccount, keys }) => {
    const hive = new Waggle({ account: voterAccount, keys });
    return { vote: (op) => hive.vote(op) };
  });
  const voter = makeVoter({ account, keys: { posting: postingWif } });

  const cast = [];
  for (const entry of schedule.scheduled) {
    const result = await voter.vote({ voter: account, author: entry.author, permlink: entry.permlink, weight: entry.weight });
    cast.push({ author: entry.author, permlink: entry.permlink, weight: entry.weight, transactionId: result.id });
    journal.record({
      category: "vote-cast",
      record: {
        account,
        author: entry.author,
        permlink: entry.permlink,
        weight: entry.weight,
        transactionId: result.id,
        tag: entry.tag,
        expectedCurationReturnHbd: entry.expectedCurationReturnHbd,
      },
      recordedAt: new Date().toISOString(),
      charge: { support: true, refutation: false },
    });
  }

  return { type: "CastSetOfVotesRecord", version: 1, account, castAt, cast, refusal: null };
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "castSetOfVotes — Casts a day's scheduled Hive curation votes for one account through the host's posting key, capped by a hard daily budget ceiling and journaled per vote with its transaction id.\n",
    );
  } else {
    const inputText = (await readJavascriptNodeStandardInputText({ type: "JavascriptNodeStandardInputTextReadRequest", version: 1 }, { standardInput: process.stdin })).text;
    for (const line of inputText.split("\n")) {
      if (line.length === 0) continue;
      try {
        process.stdout.write(`${JSON.stringify(await castSetOfVotes(JSON.parse(line)))}\n`);
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  }
}
```
## Tests
```mjs path=test/cast-set-of-votes.test.mjs
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { castSetOfVotes } from "../scripts/cast-set-of-votes.mjs";

function schedule(overrides) {
  return {
    type: "VoteScheduleRecord",
    version: 1,
    account: "emsenn0",
    generatedAt: "2026-09-05T00:10:00.000Z",
    manaBudgetRaw: "200000000000",
    manaBudgetPercent: 20,
    scheduled: [{ tag: "proofofbrain", author: "alice", permlink: "p1", weight: 10000, time: "2026-09-05T00:10:00.000Z", expectedCurationReturnHbd: "100000" }],
    refused: [],
    ...overrides,
  };
}

test("casts a scheduled vote through the injected signer and journals it", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "cast-set-of-votes-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const keyPath = join(root, "posting.wif");
  writeFileSync(keyPath, "5Jtestwifvalue\n");
  chmodSync(keyPath, 0o600);
  const calls = [];
  const record = await castSetOfVotes({
    schedule: schedule({}),
    account: "emsenn0",
    postingKeyPath: keyPath,
    journalRoot: root,
    castVote: ({ account, keys }) => {
      calls.push({ account, keys });
      return { vote: async (op) => ({ id: "a".repeat(40) }) };
    },
  });
  assert.equal(record.refusal, null);
  assert.equal(record.cast.length, 1);
  assert.equal(record.cast[0].transactionId, "a".repeat(40));
  assert.equal(calls[0].keys.posting, "5Jtestwifvalue");
  assert.equal(JSON.stringify(record).includes("5Jtestwifvalue"), false);
});

test("refuses without casting when the schedule's budget exceeds the ceiling", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "cast-set-of-votes-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const record = await castSetOfVotes({
    schedule: schedule({ manaBudgetPercent: 50 }),
    account: "emsenn0",
    postingKeyPath: join(root, "posting.wif"),
    journalRoot: root,
    maxDailyBudgetPercent: 20,
    castVote: () => ({ vote: async () => { throw new Error("must not be called"); } }),
  });
  assert.equal(record.cast.length, 0);
  assert.equal(record.refusal.reason, "budget-exceeds-ceiling");
});

test("refuses when the posting key file is absent on this host", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "cast-set-of-votes-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const record = await castSetOfVotes({
    schedule: schedule({}),
    account: "emsenn0",
    postingKeyPath: join(root, "no-such-file.wif"),
    journalRoot: root,
    castVote: () => ({ vote: async () => { throw new Error("must not be called"); } }),
  });
  assert.equal(record.cast.length, 0);
  assert.equal(record.refusal.reason, "no-posting-key");
});

test("refuses when the account does not match the schedule's account", async () => {
  await assert.rejects(
    castSetOfVotes({ schedule: schedule({}), account: "michael561", postingKeyPath: "/nonexistent", journalRoot: "/nonexistent" }),
    /request\.account michael561 does not match request\.schedule\.account emsenn0/u,
  );
});
```
## Examples
```json name="refuses without casting when the schedule's budget exceeds a 20 percent ceiling"
{"input":{"schedule":{"type":"VoteScheduleRecord","version":1,"account":"emsenn0","generatedAt":"2026-09-05T00:10:00.000Z","manaBudgetRaw":"500000000000","manaBudgetPercent":50,"scheduled":[],"refused":[]},"account":"emsenn0","postingKeyPath":"/nonexistent/posting.wif","journalRoot":"/nonexistent","maxDailyBudgetPercent":20,"now":"2026-09-05T00:10:00.000Z"},"output":{"type":"CastSetOfVotesRecord","version":1,"account":"emsenn0","castAt":"2026-09-05T00:10:00.000Z","cast":[],"refusal":{"reason":"budget-exceeds-ceiling","scheduleManaBudgetPercent":50,"maxDailyBudgetPercent":20}}}
```
## Traceability
- `matches-schedule-account` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `enforces-budget-ceiling` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `no-automated-posting-fence`
- `reads-posting-key-from-host` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`
- `refuses-missing-key` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`
- `casts-through-the-host-signer` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-vote-broadcast-operation`, `primitives-exist-once`
- `journals-every-vote` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `session-bootstrap-journal`
- `never-posts-or-comments` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `no-automated-posting-fence`
- `supports-injectable-signer` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `no-direct-fs-import` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`
- `no-second-signing-implementation` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`
- `no-key-in-output-or-journal` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `no-automated-posting-fence`
- `no-post-comment-follow-reblog-transfer` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `no-automated-posting-fence`, `hive-vote-broadcast-operation`
