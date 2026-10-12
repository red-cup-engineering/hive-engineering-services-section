// curate — wire hive-computer + hive-curation-topology + decision-topology.
import { HiveComputer } from "@emsenn/computing-with-hive/client";
import {
  curationProposals, admittedProposals,
  type CurationProposal, type CurationInputs, type PostObservation,
  type WitnessingThresholds,
} from "@emsenn/computing-with-hive/computing/curation";
import {
  contentObservation, contentFitnessValuation,
  type ContentFitnessValuation, type RawHiveContent,
} from "@emsenn/computing-with-hive/computing/content";
import { decide, actionsOf, type Decision, type Acted, type Abstained } from "@emsenn/animating/becoming/doing/working/governing/deciding";
import { maxManaFromVests, regeneratedMana, parseLegacyAsset, formatLegacyAsset } from "@emsenn/computing-with-hive/computing/topology/rewards";
import { add, sub, cmp, zero, type Amount } from "@emsenn/animating/becoming/doing/working/accounting";
import { toPostObservation } from "./observe.mjs";

export type { CurationProposal, PostObservation, Decision, Acted, Abstained, WitnessingThresholds };
export type { VoteAction } from "@emsenn/computing-with-hive/computing/curation";

export interface CurationResult {
  currentMana: bigint;
  maxMana: bigint;
  /** Mana the run was allowed to spend this pass (current minus the voting-power
   *  floor). Equals currentMana when no floor is set. */
  spendableMana: bigint;
  hive: string;
  hbd: string;
  vests: string;
  rewardHive: string;
  rewardHbd: string;
  rewardVests: string;
  proposals: readonly CurationProposal[];
  decisions: readonly Decision<import("@emsenn/computing-with-hive/computing/curation").VoteAction>[];
  /** Posts skipped because the agent already voted on them (from history). */
  excludedCount: number;
  /** Posts sourced from the account's following feed (vs trending). */
  feedPostCount: number;
  /** The assembled candidate field the knapsack valued — the deduplicated union
   *  of every configured feed source. Returned so a caller can run a frontier
   *  overlay (e.g. an alpha radar) over the SAME field, without a second fetch. */
  rawPosts: readonly Record<string, unknown>[];
}

type HiveAccountRaw = {
  vesting_shares?: string;
  received_vesting_shares?: string;
  delegated_vesting_shares?: string;
  balance?: string;
  hbd_balance?: string;
  voting_manabar?: { current_mana: string | number | bigint; last_update_time?: number };
  [key: string]: unknown;
};

function effectiveVests(account: HiveAccountRaw): string {
  const parse = (s: string | undefined): Amount => {
    try { return parseLegacyAsset(s ?? "0.000000 VESTS"); } catch { return zero("VESTS"); }
  };
  const effective = sub(
    add(parse(account.vesting_shares), parse(account.received_vesting_shares)),
    parse(account.delegated_vesting_shares),
  );
  return formatLegacyAsset(cmp(effective, zero("VESTS")) > 0 ? effective : zero("VESTS"));
}

function currentVotingMana(account: HiveAccountRaw, maxMana: bigint): bigint {
  const bar = account.voting_manabar;
  if (!bar) return maxMana;
  const stored = BigInt(String(bar.current_mana ?? "0"));
  const lastUpdate = bar.last_update_time ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(0, nowSec - lastUpdate);
  return regeneratedMana({ currentMana: stored, maxMana, elapsedSeconds: elapsed });
}

function postHasTag(post: Record<string, unknown>, allowedTags: readonly string[]): boolean {
  if (typeof post["category"] === "string" && allowedTags.includes(post["category"])) return true;
  if (typeof post["json_metadata"] === "string") {
    try {
      const meta = JSON.parse(post["json_metadata"]) as { tags?: unknown };
      if (Array.isArray(meta.tags)) {
        return (meta.tags as unknown[]).some((t) => typeof t === "string" && allowedTags.includes(t));
      }
    } catch {
      // malformed metadata: tag check fails, post excluded
    }
  }
  return false;
}

export interface CurationRunOptions {
  readonly sort?: string;
  readonly limit?: number;
  readonly tagFilter?: readonly string[];
  /** Keys (author/permlink) to exclude — prevents re-voting on posts from prior cycles. */
  readonly excludeKeys?: ReadonlySet<string>;
  /** When true, merge account's following feed into the candidate set. */
  readonly includeFollowingFeed?: boolean;
  /** An explicit feed assemblage: the candidate set is the deduplicated union of
   *  these sources (main/tag/community ranked feeds, the own following feed, and
   *  named user blogs). When given it REPLACES the default trending/tagFilter/
   *  includeFollowingFeed candidate assembly — the strategy owns the field. */
  readonly feeds?: readonly FeedSource[];
  /** Override default witnessing thresholds for this agent. */
  readonly thresholds?: WitnessingThresholds;
  /** Keep the account's voting power at or above this floor (basis points of max
   *  mana). The run spends only the mana ABOVE the floor, so votes stay full and
   *  HP-meaningful and the manabar is never drained in one pass — it self-paces
   *  to roughly the chain's sustainable rate (vote_power_reserve_rate ⇒ ~10 full
   *  votes per day). 0 or undefined spends down to empty (the old behaviour). */
  readonly votingPowerFloorBps?: number;
}

function mergePosts(
  sources: Record<string, unknown>[][],
  excludeKeys?: ReadonlySet<string>,
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const merged: Record<string, unknown>[] = [];
  for (const batch of sources) {
    for (const p of batch) {
      const key = `${String(p["author"] ?? "")}/${String(p["permlink"] ?? "")}`;
      if (seen.has(key)) continue;
      if (excludeKeys?.has(key)) continue;
      seen.add(key);
      merged.push(p);
    }
  }
  return merged;
}

async function fetchPostsForTags(
  hive: HiveComputer,
  account: string,
  sort: string,
  tags: readonly string[],
): Promise<Record<string, unknown>[]> {
  const results = await Promise.allSettled(
    tags.map((tag) =>
      hive.getRankedPosts({ sort, tag, observer: account, limit: 20 }),
    ),
  );
  const batches: Record<string, unknown>[][] = [];
  for (const r of results) {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
    batches.push(r.value.filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null));
  }
  return mergePosts(batches);
}

async function fetchFollowingFeed(
  hive: HiveComputer,
  account: string,
  limit = 20,
): Promise<Record<string, unknown>[]> {
  try {
    const raw = await hive.rpc.call<unknown[]>("bridge.get_account_feed", {
      account,
      observer: account,
      limit,
    });
    return (raw ?? []).filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null);
  } catch {
    return [];
  }
}

async function fetchAccountBlog(
  hive: HiveComputer,
  observer: string,
  blogAccount: string,
  sort: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  try {
    const raw = await hive.getAccountPosts({ sort, account: blogAccount, observer, limit });
    return (raw ?? []).filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null);
  } catch {
    return [];
  }
}

/**
 * A single candidate source in a feed assemblage. The strategy layer composes
 * these — the main trending feed, a tag/community ranked feed, the account's own
 * following feed, or a named user's blog — into one deduplicated candidate set
 * the knapsack then values. Each source is just a thin projection of an existing
 * `HiveComputer` read; the assemblage adds no new data model.
 */
export type FeedSource =
  | { readonly kind: "ranked"; readonly sort?: string; readonly tag?: string; readonly limit?: number }
  | { readonly kind: "following"; readonly limit?: number }
  | { readonly kind: "blog"; readonly account: string; readonly sort?: string; readonly limit?: number };

async function fetchFeedSource(
  hive: HiveComputer,
  account: string,
  source: FeedSource,
  defaultSort: string,
  defaultLimit: number,
): Promise<Record<string, unknown>[]> {
  switch (source.kind) {
    case "ranked":
      return hive
        .getRankedPosts({ sort: source.sort ?? defaultSort, tag: source.tag ?? "", observer: account, limit: source.limit ?? defaultLimit })
        .then((r) => r.filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null))
        .catch(() => []);
    case "following":
      return fetchFollowingFeed(hive, account, source.limit ?? defaultLimit);
    case "blog":
      return fetchAccountBlog(hive, account, source.account, source.sort ?? "blog", source.limit ?? defaultLimit);
  }
}

async function assembleFeeds(
  hive: HiveComputer,
  account: string,
  feeds: readonly FeedSource[],
  defaultSort: string,
  defaultLimit: number,
): Promise<Record<string, unknown>[]> {
  const batches = await Promise.all(feeds.map((src) => fetchFeedSource(hive, account, src, defaultSort, defaultLimit)));
  return mergePosts(batches);
}

export async function fetchCurationRun(
  hive: HiveComputer,
  account: string,
  options: CurationRunOptions = {},
): Promise<CurationResult> {
  const { sort = "created", limit = 20, tagFilter, excludeKeys, includeFollowingFeed, feeds, thresholds, votingPowerFloorBps } = options;

  // The candidate field. When the caller hands an explicit feed assemblage, that
  // assemblage IS the field (the strategy layer owns it); otherwise we fall back
  // to the historical trending/tagFilter + optional following-feed assembly.
  let accountsRaw: unknown[];
  let rawPosts: Record<string, unknown>[];
  let feedPostCount: number;
  let preExcludeCount: number;
  if (feeds !== undefined) {
    const [acc, assembled] = await Promise.all([
      hive.getAccounts([account]),
      assembleFeeds(hive, account, feeds, sort, limit),
    ]);
    accountsRaw = acc;
    feedPostCount = assembled.length;
    preExcludeCount = assembled.length;
    rawPosts = excludeKeys ? assembled.filter((p) => !excludeKeys.has(`${String(p["author"] ?? "")}/${String(p["permlink"] ?? "")}`)) : assembled;
  } else {
    const [acc, trendingPosts, feedPosts] = await Promise.all([
      hive.getAccounts([account]),
      tagFilter !== undefined
        ? fetchPostsForTags(hive, account, sort, tagFilter)
        : hive.getRankedPosts({ sort, tag: "", observer: account, limit })
            .then((r) => r.filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)),
      includeFollowingFeed ? fetchFollowingFeed(hive, account) : Promise.resolve([]),
    ]);
    accountsRaw = acc;
    feedPostCount = feedPosts.length;
    const trendingKeys = new Set(trendingPosts.map((p) => `${String(p["author"] ?? "")}/${String(p["permlink"] ?? "")}`));
    const trulyNewFeedPosts = feedPosts.filter((p) => {
      const key = `${String(p["author"] ?? "")}/${String(p["permlink"] ?? "")}`;
      return !trendingKeys.has(key);
    });
    rawPosts = mergePosts([trendingPosts, trulyNewFeedPosts], excludeKeys);
    preExcludeCount = trendingPosts.length + trulyNewFeedPosts.length;
  }
  const excludedCount = preExcludeCount - rawPosts.length;

  const accRaw = (accountsRaw[0] ?? {}) as HiveAccountRaw;
  const vests = effectiveVests(accRaw);
  const maxMana = maxManaFromVests(vests);
  const currentMana = currentVotingMana(accRaw, maxMana);

  const observations: PostObservation[] = rawPosts
    .map((p) => toPostObservation(p as Parameters<typeof toPostObservation>[0]));

  const contentFitnessEntries = await Promise.all(
    observations.map(async (obs): Promise<[string, ContentFitnessValuation] | null> => {
      try {
        const raw = (await hive.getContent(obs.author, obs.permlink)) as RawHiveContent;
        if (!raw?.body) return null;
        return [`${obs.author}/${obs.permlink}`, contentFitnessValuation(contentObservation(raw))];
      } catch {
        return null;
      }
    }),
  );

  const contentFitnessMap = new Map<string, ContentFitnessValuation>(
    contentFitnessEntries.filter((e): e is [string, ContentFitnessValuation] => e !== null),
  );

  const inputs: CurationInputs = {
    observations,
    mana: { currentMana },
    contentFitnessMap,
    ...(thresholds !== undefined ? { thresholds } : {}),
  };

  const proposals = curationProposals(inputs);
  const admitted = admittedProposals(proposals);
  // Spend only the voting mana ABOVE the floor, so the manabar is never drained
  // in one pass and votes stay full and HP-meaningful. Clamp the floor to
  // [0, 10000]; a floor of 0 (or unset) preserves the spend-to-empty behaviour.
  const floorBps = votingPowerFloorBps === undefined ? 0 : Math.max(0, Math.min(10_000, Math.trunc(votingPowerFloorBps)));
  const floorMana = (maxMana * BigInt(floorBps)) / 10_000n;
  const spendable = currentMana > floorMana ? currentMana - floorMana : 0n;
  const run = decide(admitted, { resource: "voting-mana", available: spendable });

  return {
    currentMana,
    maxMana,
    spendableMana: spendable,
    hive: accRaw.balance ?? "0.000 HIVE",
    hbd: accRaw.hbd_balance ?? "0.000 HBD",
    vests,
    rewardHive: (accRaw.reward_hive_balance as string | undefined) ?? "0.000 HIVE",
    rewardHbd: (accRaw.reward_hbd_balance as string | undefined) ?? "0.000 HBD",
    rewardVests: (accRaw.reward_vesting_balance as string | undefined) ?? "0.000000 VESTS",
    proposals,
    decisions: run.decisions,
    excludedCount,
    feedPostCount,
    rawPosts,
  };
}
