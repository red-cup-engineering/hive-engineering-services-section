#!/usr/bin/env node
import { observeTribeCurationYield } from "@red-cup-engineering/observe-tribe-curation-yield-service";
import { scheduleSetOfVotes } from "@red-cup-engineering/schedule-set-of-votes-service";
import { castSetOfVotes } from "@red-cup-engineering/cast-set-of-votes-service";
import { put } from "@red-cup-engineering/semiotic-eavt-services-section/store";
import { curationPolicy } from "@red-cup-engineering/hive-fleet-operations-service/strategy";
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-services-section/operation";

const DEFAULT_NODES = Object.freeze(["https://api.hive.blog", "https://api.openhive.network"]);

/**
 * Runs one Hive curation cycle for every policy account.  It only plans from two-node witnessed
 * candidate posts and price data, and only reports a vote as executed once two nodes read back its
 * exact chain operation.  Curation income remains the Hive ledger's later claim-derived fact.
 * @param {object} request
 * @param {object} [request.policy] The curation policy (default: the fleet strategy config's curation block, run for its curation-lane accounts).
 * @param {typeof fetch} [request.fetchImpl] Injectable fetch implementation, for tests.
 * @param {object} [request.fixtures] Literal pre-recorded read results, threaded into the two-node
 *   observation for deterministic replay.
 * @param {Function} [request.sign] Injectable signer submission, forwarded into castSetOfVotes, for tests.
 * @param {Function} [request.confirm] Injectable chain confirmation, forwarded into castSetOfVotes.
 * @param {string} [request.now] An injectable ISO instant, for deterministic replay (default the real current time).
 * @returns {Promise<object>} A HiveCurationCycleRunRecord: {type,version,runAt,yieldReadout,accounts}.
 */
export async function runHiveCurationCycle(request = {}) {
  const policy = request.policy ?? curationPolicy();
  const fetchImpl = request.fetchImpl ?? fetch;
  const nowIso = request.now ?? new Date().toISOString();
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

  const candidatePosts = yieldReadout.candidatePosts;
  const price = yieldReadout.curationPrice ?? undefined;
  const accounts = {};
  for (const account of policy.accounts) {
    const schedule = scheduleSetOfVotes({
      yieldReadout,
      account,
      candidatePosts,
      price,
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
    const cast = await castSetOfVotes({
      schedule,
      account,
      journalRoot: policy.journalRoot,
      maxDailyBudgetPercent: policy.maxDailyBudgetPercent,
      sign: request.sign,
      confirm: request.confirm,
      nodes,
      fetchImpl,
      now: nowIso,
    });
    put(policy.journalRoot, "hive-curation-cycle-account-result", { category: "cycle-account-result", ...{
        account,
        scheduledCount: schedule.scheduled.length,
        confirmedCount: cast.cast.length,
        unconfirmedSubmissionCount: cast.unconfirmed.length,
        refusalReason: cast.refusal?.reason ?? null,
      }, at: nowIso });
    accounts[account] = { schedule, cast };
  }

  return {
    type: "HiveCurationCycleRunRecord",
    version: 2,
    runAt: nowIso,
    // The cycle record names the posts it read; their bodies and vote lists stay on chain.
    yieldReadout: { ...yieldReadout, candidatePosts: candidatePosts.map(({ tag, symbol, post }) => ({ tag, symbol, author: post.author, permlink: post.permlink, created: post.created })) },
    accounts,
    accounting: {
      type: "HiveLedgerDerivationRequired",
      accounts: Object.keys(accounts),
      reason: "curation income is only settled and booked from chain history at claim_reward_balance",
    },
  };
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "run-hive-curation-cycle", description: "Runs one Hive curation cycle for every policy account, taking the founder's policy record as data, observing tribe curation yield, scheduling votes, and casting them.", operation: runHiveCurationCycle }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
