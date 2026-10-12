#!/usr/bin/env node
import { rationalOfBigInts, rationalParts } from "@red-cup-engineering/computer-data-engineering-services-section/number/exact-number";
import { formatUnits, rationalUnits } from "@red-cup-engineering/computer-data-engineering-services-section/number/decimal-string";
import { gradedValue, parseDecimalAmount } from "@red-cup-engineering/computer-data-engineering-services-section/number/graded";
import { selectCurationVotes, toPostObservation } from "@red-cup-engineering/hive-computing-service/computing/curation";
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-services-section/operation";

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

/**
 * Formats a Date as an RFC 5545 basic UTC date-time ("YYYYMMDDTHHMMSSZ"), the DTSTART form expand-recurrence-rule-service requires.
 * @param {Date} date
 * @returns {string}
 */
function toBasicUtcDateTime(date) {
  return date.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}

/**
 * Schedules a day's Hive curation votes for one account: the one curation selection
 * (@red-cup-engineering/hive-computing-service's selectCurationVotes) over the candidates' post observations,
 * each priced at its tag's observed HBD per rshare (else the chain's `request.price`), weighted by
 * policy (preferred tags at maxWeight, dust at dustWeight, else minWeight), refused outside the
 * curation window, and budgeted at dailyManaBudgetPercent of current mana; each chosen vote is
 * scheduled for when its post reaches the window.
 * @param {object} request
 * @param {object} request.yieldReadout A TribeCurationYieldObservationRecord naming this account's votingManabar and each tag's yieldHbdPerMillionRshares.
 * @param {string} request.account The account to schedule votes for; must be a key of request.yieldReadout.accounts.
 * @param {readonly object[]} request.candidatePosts Posts to consider: {tag, symbol, post}, post a bridge.get_ranked_posts record.
 * @param {object} [request.price] The chain's curation price (hbdPerRshare, percentCurationRewards, votePowerReserveRate), for tags with no observed price.
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
  const currentManaRaw = BigInt(accountMana.currentManaRaw);
  const manaBudgetRaw = (currentManaRaw * BigInt(policy.dailyManaBudgetPercent)) / 100n;
  // Each tag's price per rshare as its recent posts realize it (pending payout per million net rshares).
  const tagPrice = new Map((yieldReadout.tags ?? []).map((tag) => {
    const perMillion = tag.yieldHbdPerMillionRshares == null ? null : parseDecimalAmount(String(tag.yieldHbdPerMillionRshares));
    return [tag.tag, perMillion ? rationalOfBigInts(rationalParts(perMillion.value)[0], rationalParts(perMillion.value)[1] * 1_000_000n) : null];
  }));
  const key = (observation) => `${observation.author}/${observation.permlink}`;
  // A post listed under several tags is one candidate, under the first tag that listed it: the
  // chain refuses a second identical vote on the same post.
  const candidates = [];
  for (const entry of candidatePosts) {
    const observation = toPostObservation(entry.post, nowMs);
    if (!candidates.some((kept) => key(kept.observation) === key(observation))) candidates.push({ ...entry, observation });
  }
  const tagOf = new Map(candidates.map((entry) => [key(entry.observation), entry.tag]));
  const lower = policy.curationWindowSeconds - policy.curationWindowToleranceSeconds;
  const upper = policy.curationWindowSeconds + policy.curationWindowToleranceSeconds;
  const [dustNum, dustDen] = rationalParts(parseDecimalAmount(policy.dustPendingPayoutThresholdHbd).value);
  const isDust = (observation) => observation.pendingPayoutHbdMicro * dustDen < dustNum * 1_000_000n;
  const priceOf = (observation) => tagPrice.get(tagOf.get(key(observation))) ?? null;
  const unpriced = request.price === undefined;
  const price = unpriced ? { hbdPerRshare: rationalOfBigInts(0n, 1n) } : {
    ...request.price,
    hbdPerRshare: rationalOfBigInts(BigInt(request.price.hbdPerRshare.num), BigInt(request.price.hbdPerRshare.den)),
  };
  const selection = selectCurationVotes({
    account,
    observations: candidates.map((entry) => entry.observation),
    mana: { currentMana: currentManaRaw, maxMana: BigInt(accountMana.maxManaRaw) },
    price,
    priceOf,
    policy: {
      budgetBps: policy.dailyManaBudgetPercent * 100,
      neverVoteAuthors: policy.neverVoteAuthors,
      weightOf: (observation) => isDust(observation) ? policy.dustWeight
        : policy.preferredTags.includes(tagOf.get(key(observation))) ? policy.maxWeight : policy.minWeight,
      exclude: (observation) => observation.ageSeconds < lower || observation.ageSeconds > upper ? "outside-window"
        : unpriced && priceOf(observation) === null ? "unpriced" : null,
    },
  });
  const scheduled = selection.votes.map((proposal) => {
    const observation = candidates.find((entry) => key(entry.observation) === proposal.id).observation;
    const scheduledDate = new Date(nowMs + Math.max(0, policy.curationWindowSeconds - observation.ageSeconds) * 1000);
    // A vote's scheduled moment is a VEVENT with no RRULE: it occurs exactly once, at DTSTART (RFC 5545 §3.8.5.2).
    return {
      tag: tagOf.get(proposal.id), author: proposal.action.author, permlink: proposal.action.permlink, weight: proposal.action.weightBps,
      dtstart: toBasicUtcDateTime(scheduledDate), time: scheduledDate.toISOString(),
      expectedCurationReturnHbd: formatUnits(rationalUnits(gradedValue(proposal.expectedHbd), 12, { rounding: "toward-zero" }), 12),
    };
  });
  // A refusal names the post it refused; the post itself stays in the readout it was read from.
  const refused = selection.decisions.filter((decision) => !decision.accepted).map((decision) => {
    const { tag, post } = candidates.find((entry) => key(entry.observation) === decision.proposal.id);
    return { tag, author: post.author, permlink: post.permlink, reason: decision.reason };
  });
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
  const result = await runJavascriptNodeOperation({ name: "schedule-set-of-votes", description: "Schedules a day's Hive curation votes for one account through the one curation selection, priced at each tag's observed rate.", operation: scheduleSetOfVotes }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
