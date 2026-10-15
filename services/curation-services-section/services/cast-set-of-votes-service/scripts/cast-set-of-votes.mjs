#!/usr/bin/env node
import { submitToSigner } from "@red-cup-engineering/hive-fleet-operations-service/signer";
import { put } from "@red-cup-engineering/semiotic-eavt-services-section/store";
import { HiveClient } from "@red-cup-engineering/hive-blockchain-client-service";
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-operation-engineering-services-section/operation";

const DEFAULT_NODES = Object.freeze(["https://api.hive.blog", "https://api.openhive.network"]);

/**
 * Casts a day's scheduled Hive curation votes for one account through the Hive fleet signer (its voting lane holds the
 * posting key and has two public nodes read back the exact vote operation).  A signer response is
 * a submitted transaction, not evidence that the vote executed.  Only confirmed chain operations
 * are placed in `cast`; uncertain broadcasts remain explicit in `unconfirmed` and are never
 * represented as earnings or settled curation income.
 * @param {object} request
 * @param {object} request.schedule A VoteScheduleRecord from schedule-set-of-votes.
 * @param {string} request.account The Hive account to sign votes as; must equal request.schedule.account.
 * @param {string} request.journalRoot Filesystem root of the store holding the per-vote records.
 * @param {number} [request.maxDailyBudgetPercent] Hard ceiling on the schedule's declared manaBudgetPercent (default 20); the whole cast is refused when the schedule exceeds it.
 * @param {Function} [request.sign] Injectable signer submission (request) => Promise<{id}>, for tests; default the fleet signer.
 * @param {Function} [request.confirm] Injectable confirmation `(transactionId, operation, options) => Promise<witnesses>`; default two-node HiveClient confirmation.
 * @param {readonly string[]} [request.nodes] Independent public Hive RPC nodes used by the default confirmation.
 * @param {typeof fetch} [request.fetchImpl] Injectable fetch used by the default confirmation.
 * @param {string} [request.now] An injectable ISO instant for castAt, for deterministic replay (default the real current time).
 * @returns {Promise<object>} A CastSetOfVotesRecord: {type,version,account,castAt,cast,unconfirmed,refused,refusal}.
 * @throws {TypeError} When request.account does not equal request.schedule.account.
 */
export async function castSetOfVotes(request) {
  const { schedule, account, journalRoot } = request;
  if (account !== schedule.account) throw new TypeError(`cast-set-of-votes: request.account ${account} does not match request.schedule.account ${schedule.account}`);
  const maxDailyBudgetPercent = request.maxDailyBudgetPercent ?? 20;
  const castAt = request.now ? new Date(request.now).toISOString() : new Date().toISOString();

  if (schedule.manaBudgetPercent > maxDailyBudgetPercent) {
    return {
      type: "CastSetOfVotesRecord",
      version: 2,
      account,
      castAt,
      cast: [],
      unconfirmed: [],
      refused: [],
      refusal: { reason: "budget-exceeds-ceiling", scheduleManaBudgetPercent: schedule.manaBudgetPercent, maxDailyBudgetPercent },
    };
  }

  const sign = request.sign ?? submitToSigner;
  const nodes = request.nodes ?? DEFAULT_NODES;
  if (!Array.isArray(nodes) || nodes.length < 2) throw new TypeError("cast-set-of-votes: request.nodes must name at least two independent nodes");
  const confirm = request.confirm ?? ((transactionId, operation) => new HiveClient({ nodes, fetch: request.fetchImpl }).confirmTransaction(
    transactionId,
    operation,
    { nodes: nodes.slice(0, 3), quorum: 2 },
  ));

  const cast = [];
  const unconfirmed = [];
  const refused = [];
  for (const entry of schedule.scheduled) {
    const operation = ["vote", { voter: account, author: entry.author, permlink: entry.permlink, weight: entry.weight }];
    let result;
    try {
      result = await sign({ account, role: "posting", lane: "voting", target: `${entry.author}/${entry.permlink}`,
        operation });
    } catch (error) {
      if (!error?.refusal) throw error;
      refused.push({ author: entry.author, permlink: entry.permlink, weight: entry.weight, reason: error.refusal.datum, detail: error.refusal.reason });
      continue;
    }
    let witnesses;
    try {
      witnesses = await confirm(result.id, operation, { nodes: nodes.slice(0, 3), quorum: 2 });
    } catch (error) {
      const submission = {
        author: entry.author,
        permlink: entry.permlink,
        weight: entry.weight,
        transactionId: result.id,
        reason: "chain-confirmation-unavailable",
        detail: error instanceof Error ? error.message : String(error),
      };
      unconfirmed.push(submission);
      put(journalRoot, "hive-curation-vote-cast", { category: "vote-submitted-unconfirmed", ...submission, tag: entry.tag, expectedCurationReturnHbd: entry.expectedCurationReturnHbd, at: new Date().toISOString(), told: { for: false, against: true } });
      continue;
    }
    cast.push({ author: entry.author, permlink: entry.permlink, weight: entry.weight, transactionId: result.id, witnesses });
    put(journalRoot, "hive-curation-vote-cast", { category: "vote-chain-confirmed", ...{
        account,
        author: entry.author,
        permlink: entry.permlink,
        weight: entry.weight,
        transactionId: result.id,
        tag: entry.tag,
        expectedCurationReturnHbd: entry.expectedCurationReturnHbd,
        witnesses,
      }, at: new Date().toISOString() });
  }

  return { type: "CastSetOfVotesRecord", version: 2, account, castAt, cast, unconfirmed, refused, refusal: null };
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "cast-set-of-votes", description: "Casts a day's scheduled Hive curation votes for one account through the Hive fleet signer, capped by a hard daily budget ceiling and journaled per vote with its transaction id.", operation: castSetOfVotes }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
