/**
 * observation — the on-chain facts a curation decision reads about one post.
 *
 * This is the boundary between the impure world (chain reads) and this pure
 * library: an app fills a `PostObservation` from condenser/bridge calls, and
 * everything downstream — valuation, pricing, allocation — is a pure function
 * of these observations. No field here requires human judgement about *who* an
 * author is or *what* a tag means; the valuation is derived, never hand-fed.
 */

// ---------- PostObservation ----------

export interface PostObservation {
  readonly author: string;
  readonly permlink: string;
  /** Seconds between the post's creation and the moment of observation. */
  readonly ageSeconds: number;
  /** net_rshares: signed sum over all votes (downvotes pull it down). */
  readonly netRshares: bigint;
  /** abs_rshares: sum of |rshares| over all votes (magnitude of attention). */
  readonly absRshares: bigint;
  /** pending_payout_value in HBD micro-units (1 HBD = 1_000_000). */
  readonly pendingPayoutHbdMicro: bigint;
  /** Number of distinct voters (active_votes length). */
  readonly distinctVoters: number;
  /** Largest single voter's |rshares| — a stake-concentration probe. */
  readonly topVoterRshares: bigint;
  /** Number of replies (children) — a discussion-volume probe. */
  readonly children: number;
  /** Raw author reputation (the chain's signed integer, pre-score). */
  readonly authorReputationRaw: bigint;
  /** True iff the post is filed in a community (category begins "hive-"). */
  readonly inCommunity: boolean;
  /** allow_curation_rewards: curation cannot be earned when false. */
  readonly allowsCurationRewards: boolean;
  /** percent_curation_rewards in basis points (default 5000 = 50%). */
  readonly percentCurationRewards?: number;
  /** True iff the post's metadata carries source links (a provenance probe).
   *  Undefined when metadata couldn't be read — absence is not evidence. */
  readonly hasSourceLinks?: boolean;
}

/**
 * The Hive reputation score (the human-facing "25–75" number) from a raw
 * reputation integer, via the standard log10 formula. Pure; doubles suffice —
 * this feeds thresholds, not ledger arithmetic.
 */
export function reputationScore(raw: bigint): number {
  if (raw === 0n) return 25;
  const negative = raw < 0n;
  const magnitude = negative ? -raw : raw;
  let log = Math.log10(Number(magnitude));
  log = Math.max(log - 9, 0);
  const signed = (negative ? -1 : 1) * log;
  return signed * 9 + 25;
}

/** rshares attributable to downvotes: abs_rshares = net + 2·downvotes, so
 *  downvote magnitude is (abs − net)/2, floored at 0. */
export function downvoteRshares(observation: PostObservation): bigint {
  const gap = observation.absRshares - observation.netRshares;
  const half = gap / 2n;
  return half > 0n ? half : 0n;
}

// ---------- BridgePost → PostObservation ----------

type ActiveVote = Readonly<{ rshares?: string | number | bigint; [key: string]: unknown }>;

export type BridgePost = Readonly<{
  author: string;
  permlink: string;
  created?: string;
  net_rshares?: string | number | bigint;
  abs_rshares?: string | number | bigint;
  pending_payout_value?: string;
  active_votes?: readonly ActiveVote[];
  children?: number;
  author_reputation?: string | number | bigint;
  category?: string;
  allow_curation_rewards?: boolean;
  percent_curation_rewards?: number;
  json_metadata?: string;
  [key: string]: unknown;
}>;

function toBigInt(v: string | number | bigint | undefined): bigint {
  if (v === undefined || v === null) return 0n;
  if (typeof v === "bigint") return v;
  const s = String(v).trim();
  if (s === "" || s === "0") return 0n;
  try { return BigInt(s); } catch { return 0n; }
}

function hbdMicro(assetString: string | undefined): bigint {
  if (!assetString) return 0n;
  const m = assetString.match(/^([\d.]+)\s+HBD$/i);
  if (!m) return 0n;
  const [whole, frac = ""] = (m[1] ?? "0").split(".");
  const paddedFrac = frac.padEnd(6, "0").slice(0, 6);
  return BigInt(whole ?? "0") * 1_000_000n + BigInt(paddedFrac);
}

function bridgePostAgeSeconds(created: string | undefined): number {
  if (!created) return 0;
  const ms = Date.now() - new Date(created + "Z").getTime();
  return Math.max(0, Math.floor(ms / 1000));
}

function topVoterRshares(votes: readonly ActiveVote[] | undefined): bigint {
  if (!votes || votes.length === 0) return 0n;
  let top = 0n;
  for (const vote of votes) {
    const r = toBigInt(vote.rshares);
    const abs = r < 0n ? -r : r;
    if (abs > top) top = abs;
  }
  return top;
}

function hasSourceLinks(jsonMeta: string | undefined): boolean | undefined {
  if (!jsonMeta) return undefined;
  try {
    const parsed = JSON.parse(jsonMeta) as unknown;
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const links = (parsed as Record<string, unknown>)["links"];
    return Array.isArray(links) && links.length > 0;
  } catch {
    return undefined;
  }
}

/** Convert a bridge.get_ranked_posts record to a PostObservation. Pure. */
export function toPostObservation(post: BridgePost): PostObservation {
  const votes = post.active_votes;
  return {
    author: post.author,
    permlink: post.permlink,
    ageSeconds: bridgePostAgeSeconds(post.created),
    netRshares: toBigInt(post.net_rshares),
    absRshares: toBigInt(post.abs_rshares),
    pendingPayoutHbdMicro: hbdMicro(post.pending_payout_value),
    distinctVoters: votes?.length ?? 0,
    topVoterRshares: topVoterRshares(votes),
    children: post.children ?? 0,
    authorReputationRaw: toBigInt(post.author_reputation),
    inCommunity: typeof post.category === "string" && post.category.startsWith("hive-"),
    allowsCurationRewards: post.allow_curation_rewards !== false,
    ...(post.percent_curation_rewards !== undefined ? { percentCurationRewards: post.percent_curation_rewards } : {}),
    ...(() => {
      const sl = hasSourceLinks(post.json_metadata);
      return sl !== undefined ? { hasSourceLinks: sl } : {};
    })(),
  };
}
