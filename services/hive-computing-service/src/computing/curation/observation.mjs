/**
 * observation — the on-chain facts a curation decision reads about one post.
 *
 * This is the boundary between the impure world (chain reads) and this pure
 * library: an app fills a `PostObservation` from condenser/bridge calls, and
 * everything downstream — valuation, pricing, allocation — is a pure function
 * of these observations. No field here requires human judgement about *who* an
 * author is or *what* a tag means; the valuation is derived, never hand-fed.
 */
import { contentFitnessValuation, contentObservation } from "../content/content.mjs";
/**
 * The Hive reputation score (the human-facing "25–75" number) from a raw
 * reputation integer, via the standard log10 formula. Pure; doubles suffice —
 * this feeds thresholds, not ledger arithmetic.
 */
export function reputationScore(raw) {
    if (raw === 0n)
        return 25;
    const negative = raw < 0n;
    const magnitude = negative ? -raw : raw;
    let log = Math.log10(Number(magnitude));
    log = Math.max(log - 9, 0);
    const signed = (negative ? -1 : 1) * log;
    return signed * 9 + 25;
}
/** rshares attributable to downvotes: abs_rshares = net + 2·downvotes, so
 *  downvote magnitude is (abs − net)/2, floored at 0. */
export function downvoteRshares(observation) {
    const gap = observation.absRshares - observation.netRshares;
    const half = gap / 2n;
    return half > 0n ? half : 0n;
}
function toBigInt(v) {
    if (v === undefined || v === null)
        return 0n;
    if (typeof v === "bigint")
        return v;
    const s = String(v).trim();
    if (s === "" || s === "0")
        return 0n;
    try {
        return BigInt(s);
    }
    catch {
        return 0n;
    }
}
function hbdMicro(assetString) {
    if (!assetString)
        return 0n;
    const m = assetString.match(/^([\d.]+)\s+HBD$/i);
    if (!m)
        return 0n;
    const [whole, frac = ""] = (m[1] ?? "0").split(".");
    const paddedFrac = frac.padEnd(6, "0").slice(0, 6);
    return BigInt(whole ?? "0") * 1000000n + BigInt(paddedFrac);
}
function bridgePostAgeSeconds(created, nowMs) {
    if (!created)
        return 0;
    const ms = nowMs - new Date(String(created).replace(/Z?$/, "Z")).getTime();
    return Math.max(0, Math.floor(ms / 1000));
}
function topVoterRshares(votes) {
    if (!votes || votes.length === 0)
        return 0n;
    let top = 0n;
    for (const vote of votes) {
        const r = toBigInt(vote.rshares);
        const abs = r < 0n ? -r : r;
        if (abs > top)
            top = abs;
    }
    return top;
}
function tagsOf(post) {
    const tags = [];
    if (typeof post.category === "string" && post.category !== "") tags.push(post.category);
    try {
        const meta = typeof post.json_metadata === "string" ? JSON.parse(post.json_metadata) : post.json_metadata;
        if (Array.isArray(meta?.tags)) for (const tag of meta.tags) if (typeof tag === "string" && !tags.includes(tag)) tags.push(tag);
    }
    catch {
        // malformed metadata: the category alone
    }
    return tags;
}
function hasSourceLinks(jsonMeta) {
    if (!jsonMeta)
        return undefined;
    try {
        const parsed = JSON.parse(jsonMeta);
        if (typeof parsed !== "object" || parsed === null)
            return undefined;
        const links = parsed["links"];
        return Array.isArray(links) && links.length > 0;
    }
    catch {
        return undefined;
    }
}
/** Convert a bridge.get_ranked_posts record to a PostObservation, aged at `nowMs`. Pure. */
export function toPostObservation(post, nowMs = Date.now()) {
    const votes = post.active_votes;
    return {
        author: post.author,
        permlink: post.permlink,
        ageSeconds: bridgePostAgeSeconds(post.created, nowMs),
        netRshares: toBigInt(post.net_rshares),
        absRshares: toBigInt(post.abs_rshares),
        pendingPayoutHbdMicro: hbdMicro(post.pending_payout_value),
        distinctVoters: votes?.length ?? 0,
        voters: Object.freeze((votes ?? []).map((vote) => String(vote.voter))),
        tags: Object.freeze(tagsOf(post)),
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
        ...(typeof post.body === "string" && post.body !== "" ? { contentFitness: contentFitnessValuation(contentObservation(post)) } : {}),
    };
}
