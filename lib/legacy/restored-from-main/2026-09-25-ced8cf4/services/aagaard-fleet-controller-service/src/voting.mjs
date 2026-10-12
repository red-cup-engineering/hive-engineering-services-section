// voting — the block-reward claim lane.
//
// Hive mints new HIVE every block and routes 65% of it to the content-reward
// pool; curation is the game of directing a share of that mint to the posts you
// upvote, earning curation rewards. The resource is finite, regenerating voting
// mana. The upstream `fetchCurationRun` already plays this as the exact
// max-alpha knapsack (docs/max-alpha.md, Layer 3): it values every candidate by
// curation fitness, prices each vote in mana, and draws the mana budget across
// them with @emsenn/animating's `decide()`, returning the funded votes as a
// complete, auditable allocation. Aagaard does NOT re-derive any of that.
//
// What this lane adds is the frontier overlay and the broadcast boundary:
//   • it reads the `alpha-radar` over the same field and re-orders the funded
//     votes so the deepest under-priced *sinks* are cast first (durable,
//     neighbourhood-relative alpha, beyond per-post fitness), and
//   • it broadcasts the funded votes through the one upstream signing client,
//     strictly gated — nothing leaves the process unless the fleet is armed and
//     the voting capability is enabled.

import { fetchCurationRun } from "@emsenn/computing-with-hive/scripts";
import { voteRshares, VOTE_DUST_THRESHOLD } from "@red-cup-engineering/hive-blockchain-client-service/rewards.mjs";

import { readAlphaRadar } from "./alpha-radar.mjs";
import { toPostSnapshot, captureActiveVotes } from "./substrate.mjs";
import { readVotingIntelligenceOf } from "@red-cup-engineering/hive-fleet-operations-service/analysis/intelligence";
import { feedSourcesFor, emphasisKeys, strategyAlpha } from "./strategy.mjs";

/** What this character watched and how it weighted the field — carried on the
 *  plan so the readout can show each wallet voting in character. */

  

  

  

  

/** How many top-sink posts to pay the bounded active_votes read on, for the
 *  timing/curvature/cartel reads. Small so the chain load stays gentle. */
const INTELLIGENCE_ACTIVE_VOTES_TOPK = 8;

/** Render a strategy's assembled sources as human-readable feed labels. */
function feedLabels(strategy) {
  const { feeds } = strategy;
  const out = [];
  if (feeds.mainFeed) out.push("main");
  if (feeds.ownFeed) out.push("own-feed");
  for (const c of feeds.communities ?? []) out.push(`community:${c}`);
  for (const t of feeds.tags ?? []) out.push(`#${t}`);
  for (const u of feeds.users ?? []) out.push(`blog:@${u}`);
  return Object.freeze(out.length > 0 ? out : ["main"]);
}

/**
 * Plan this account's votes IN CHARACTER: assemble the wallet's own feed slice
 * (main / own-feed / communities / tags / user blogs), run the upstream curation
 * knapsack over exactly that assemblage, read the alpha radar over the SAME
 * field, then order and size the funded votes by the wallet's objective —
 * underrecognition, community-fit, conversation, durability, bridges, quality,
 * cartel-aversion. Each character therefore casts a genuinely different ballot.
 * No broadcast happens here.
 */
export async function planVotes(member) {
  const { hive, account, policy } = member;
  const strategy = policy.strategy;
  const feeds = feedSourcesFor(strategy);

  // ONE field for both the knapsack and the radar: the upstream run assembles
  // the wallet's feed slice and hands back the candidate posts it valued. The
  // voting-power floor keeps the manabar from being drained in one pass.
  const run = await fetchCurationRun(hive, account, { feeds, votingPowerFloorBps: strategy.pacing.votingPowerFloorBps });
  const rawField = run.rawPosts;
  const radar = readAlphaRadar(rawField);
  const deficitByKey = new Map(radar.sinks.map((s) => [`${s.author}/${s.permlink}`, s.deficit]));

  // Build candidate snapshots and pay the bounded active_votes read on the
  // deepest sinks first — the substrate timing/curvature/cartel reads need them.
  const snaps = rawField.map(toPostSnapshot).filter((p) => p !== null);
  const sinkKeys = new Set(radar.sinks.map((s) => `${s.author}/${s.permlink}`));
  const prioritized = [...snaps].sort(
    (a, b) => (sinkKeys.has(`${b.author}/${b.permlink}`) ? 1 : 0) - (sinkKeys.has(`${a.author}/${a.permlink}`) ? 1 : 0),
  );
  const voteMap = await captureActiveVotes(hive, prioritized, INTELLIGENCE_ACTIVE_VOTES_TOPK);
  const postSnapshots = snaps.map((p) => {
    const v = voteMap.get(`${p.author}/${p.permlink}`);
    return v ? { ...p, votes: v } : p;
  });

  // The full Voting v2 composite over the cohort, then the character's objective
  // re-weighting on top — the same substrate, tilted toward this wallet's game.
  const intelligence = readVotingIntelligenceOf(postSnapshots, deficitByKey, Date.now());
  const intelByKey = new Map(intelligence.posts.map((pi) => [pi.key, pi]));
  const emphasis = emphasisKeys(strategy, postSnapshots);
  const selfVotedByKey = new Map(postSnapshots.map((p) => [`${p.author}/${p.permlink}`, (p.votes ?? []).some((v) => v.voter === account)]));

  // The eligible opportunity set: posts the upstream curation valuation admitted
  // (window open, allows curation, our vote is non-dust, social+content merit
  // positive). decide() abstains the rest as below-threshold; budget-exhausted
  // abstentions are still genuine opportunities (the manabar, not the post, ran
  // out), so both they and the funded acts count as opportunities here.

  const actionById = new Map(run.proposals.map((p) => [p.id, p.action]));
  const candidates = [];
  for (const decision of run.decisions) {
    const eligible = decision.kind === "computing.decision.act" || (decision.kind === "computing.decision.abstain" && decision.reason === "budget-exhausted");
    if (!eligible) continue;
    const action = decision.kind === "computing.decision.act" ? decision.action : actionById.get(decision.id);
    if (!action) continue;
    const { author, permlink } = action;
    const key = `${author}/${permlink}`;
    const pi = intelByKey.get(key);
    const sAlpha = pi ? strategyAlpha(pi, strategy.objective, emphasis.has(key)) : 0;
    candidates.push({ author, permlink, key, sAlpha, deficit: deficitByKey.get(key) ?? 0, pi });
  }
  candidates.sort((a, b) => b.sAlpha - a.sAlpha);

  // The idle-game move: mana is a scarce regenerating resource, so we spend it
  // only on genuine high-conviction opportunities — at most `maxVotesPerTick`
  // per tick — and otherwise WAIT, letting mana recover. "Doing nothing is a
  // valid action" (hive-as-game.md §4). Three gates, in order:
  const { maxVotesPerTick, conviction, votingPowerFloorBps } = strategy.pacing;
  const maxMana = run.maxMana > 0n ? run.maxMana : 1n;
  const votingPowerBps = Number((run.currentMana * 10_000n) / maxMana);
  // A full-weight vote at this power must clear the dust threshold to earn
  // anything at all — otherwise the wallet's Hive Power is simply too low to
  // matter this pass and it should wait.
  const fullWeight = policy.risk.maxVoteWeightBps;
  const dustClears = voteRshares({ currentMana: run.currentMana, weightBps: fullWeight }).rshares > VOTE_DUST_THRESHOLD / 4n;
  // The reservation bar: a candidate must out-score the field's TYPICAL candidate
  // by the wallet's conviction factor. When the field is mostly fairly-priced
  // (the median candidate has ~no capturable alpha) the bar falls to zero and a
  // single clear sink is worth a vote; when the field is rich with opportunity
  // the bar rises and only a real standout clears — pickier wallets (higher
  // conviction) wait for it. A field that clears nobody is exactly when the
  // corpus says to do nothing ("no high-confidence action found").
  const allAlphas = [...candidates.map((c) => c.sAlpha)].sort((a, b) => a - b);
  const median = allAlphas.length > 0 ? allAlphas[Math.floor((allAlphas.length - 1) / 2)] : 0;
  const bar = Math.max(0, median) * conviction;

  const items = [];
  let waitReason = "";
  if (votingPowerBps < votingPowerFloorBps) {
    waitReason = `power ${(votingPowerBps / 100).toFixed(0)}% below ${(votingPowerFloorBps / 100).toFixed(0)}% floor — husbanding mana`;
  } else if (!dustClears) {
    waitReason = `a full vote at ${(votingPowerBps / 100).toFixed(0)}% power is still dust — Hive Power too low to matter`;
  } else if (candidates.length === 0) {
    waitReason = "no eligible candidate in the field";
  } else {
    for (const c of candidates) {
      if (items.length >= maxVotesPerTick) break;
      if (selfVotedByKey.get(c.key)) continue; // already voted it — don't double-spend
      const pi = c.pi;
      const cartelTrap = pi?.likelyCartelTrail ?? false;
      // Spend only on genuine, capturable, authentic alpha that clears the bar.
      if (c.sAlpha <= 0 || cartelTrap || c.sAlpha < bar) continue;
      // One considered vote, at full character weight — big enough to earn,
      // HP-scaled by construction (rshares ∝ current mana × weight).
      items.push({
        author: c.author,
        permlink: c.permlink,
        weightBps: fullWeight,
        sinkDeficit: c.deficit,
        strategyAlpha: c.sAlpha,
        emphasis: emphasis.has(c.key),
        reason: `${strategy.archetype}: conviction vote α*=${c.sAlpha.toFixed(2)} ≥ bar ${bar.toFixed(2)}${emphasis.has(c.key) ? " in-community" : ""}${pi?.bridge ? " bridge" : ""}${c.deficit > 0 ? ` sink(${c.deficit})` : ""}`,
      });
    }
    if (items.length === 0) {
      const best = candidates.find((c) => !selfVotedByKey.get(c.key));
      waitReason = best
        ? `best α*=${best.sAlpha.toFixed(2)} below conviction bar ${bar.toFixed(2)} — waiting for a clearer opportunity`
        : "field already voted — nothing new to fund";
    }
  }

  const acted = items.length > 0;
  const decisionLine = acted
    ? `${strategy.archetype} cast ${items.length} vote${items.length === 1 ? "" : "s"} at ${(votingPowerBps / 100).toFixed(0)}% power: ${items.map((i) => `@${i.author}`).join(", ")}`
    : `${strategy.archetype} waited — ${waitReason}`;

  const strategyReadout = Object.freeze({
    account,
    archetype: strategy.archetype,
    disposition: strategy.disposition,
    feeds: feedLabels(strategy),
    fieldSize: postSnapshots.length,
    emphasisHits: emphasis.size,
    votingPowerBps,
    eligibleCount: candidates.length,
    acted,
    decision: decisionLine,
  });

  return Object.freeze({
    account,
    currentMana: String(run.currentMana),
    maxMana: String(run.maxMana),
    rewardHive: run.rewardHive,
    rewardHbd: run.rewardHbd,
    rewardVests: run.rewardVests,
    radar,
    votes: Object.freeze(items),
    strategy: strategyReadout,
    intelligence,
    rawPosts: rawField,
    postSnapshots: Object.freeze(postSnapshots),
  });
}

/**
 * Execute a voting plan through the upstream signing client — the broadcast
 * boundary. `armed` is the composed gate (fleet live AND voting enabled); when
 * false every vote is recorded dry-run and nothing is signed. A vote needs the
 * posting key; its absence skips the account rather than erroring the fleet.
 */
export async function executeVotes(
  member,
  plan,
  armed,
) {
  const results = [];
  let broadcast = 0;
  let dryRun = 0;
  let errors = 0;

  for (const vote of plan.votes) {
    if (!armed) {
      dryRun++;
      results.push({ author: vote.author, permlink: vote.permlink, weightBps: vote.weightBps, status: "dry-run" });
      continue;
    }
    if (!member.hasPosting) {
      results.push({ author: vote.author, permlink: vote.permlink, weightBps: vote.weightBps, status: "skipped", error: "no posting key" });
      continue;
    }
    try {
      const { id } = await member.hive.vote({ author: vote.author, permlink: vote.permlink, weight: vote.weightBps });
      broadcast++;
      results.push({ author: vote.author, permlink: vote.permlink, weightBps: vote.weightBps, status: "broadcast", txId: id });
    } catch (err) {
      errors++;
      results.push({ author: vote.author, permlink: vote.permlink, weightBps: vote.weightBps, status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  return Object.freeze({ account: plan.account, broadcast, dryRun, errors, results: Object.freeze(results) });
}
