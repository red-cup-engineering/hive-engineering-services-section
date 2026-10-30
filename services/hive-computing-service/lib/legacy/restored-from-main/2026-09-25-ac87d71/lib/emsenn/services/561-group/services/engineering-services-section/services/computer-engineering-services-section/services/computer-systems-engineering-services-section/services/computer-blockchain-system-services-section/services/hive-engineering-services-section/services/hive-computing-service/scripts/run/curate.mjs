import { selectCurationVotes } from "../../src/computing/curation/index.mjs";
import { contentObservation, contentFitnessValuation, } from "../../src/computing/content/index.mjs";
import { currentVotingMana } from "@red-cup-engineering/hive-blockchain-client-service/rewards.mjs";
import { toPostObservation } from "../../src/computing/curation/index.mjs";
function postHasTag(post, allowedTags) {
    if (typeof post["category"] === "string" && allowedTags.includes(post["category"]))
        return true;
    if (typeof post["json_metadata"] === "string") {
        try {
            const meta = JSON.parse(post["json_metadata"]);
            if (Array.isArray(meta.tags)) {
                return meta.tags.some((t) => typeof t === "string" && allowedTags.includes(t));
            }
        }
        catch {
            // malformed metadata: tag check fails, post excluded
        }
    }
    return false;
}
function mergePosts(sources, excludeKeys) {
    const seen = new Set();
    const merged = [];
    for (const batch of sources) {
        for (const p of batch) {
            const key = `${String(p["author"] ?? "")}/${String(p["permlink"] ?? "")}`;
            if (seen.has(key))
                continue;
            if (excludeKeys?.has(key))
                continue;
            seen.add(key);
            merged.push(p);
        }
    }
    return merged;
}
async function fetchPostsForTags(hive, account, sort, tags) {
    const results = await Promise.allSettled(tags.map((tag) => hive.getRankedPosts({ sort, tag, observer: account, limit: 20 })));
    const batches = [];
    for (const r of results) {
        if (r.status !== "fulfilled" || !Array.isArray(r.value))
            continue;
        batches.push(r.value.filter((p) => typeof p === "object" && p !== null));
    }
    return mergePosts(batches);
}
async function fetchFollowingFeed(hive, account, limit = 20) {
    try {
        const raw = await hive.rpc.call("bridge.get_account_feed", {
            account,
            observer: account,
            limit,
        });
        return (raw ?? []).filter((p) => typeof p === "object" && p !== null);
    }
    catch {
        return [];
    }
}
async function fetchAccountBlog(hive, observer, blogAccount, sort, limit) {
    try {
        const raw = await hive.getAccountPosts({ sort, account: blogAccount, observer, limit });
        return (raw ?? []).filter((p) => typeof p === "object" && p !== null);
    }
    catch {
        return [];
    }
}
async function fetchFeedSource(hive, account, source, defaultSort, defaultLimit) {
    switch (source.kind) {
        case "ranked":
            return hive
                .getRankedPosts({ sort: source.sort ?? defaultSort, tag: source.tag ?? "", observer: account, limit: source.limit ?? defaultLimit })
                .then((r) => r.filter((p) => typeof p === "object" && p !== null))
                .catch(() => []);
        case "following":
            return fetchFollowingFeed(hive, account, source.limit ?? defaultLimit);
        case "blog":
            return fetchAccountBlog(hive, account, source.account, source.sort ?? "blog", source.limit ?? defaultLimit);
    }
}
async function assembleFeeds(hive, account, feeds, defaultSort, defaultLimit) {
    const batches = await Promise.all(feeds.map((src) => fetchFeedSource(hive, account, src, defaultSort, defaultLimit)));
    return mergePosts(batches);
}
export async function fetchCurationRun(hive, account, options = {}) {
    const { sort = "created", limit = 20, tagFilter, excludeKeys, includeFollowingFeed, feeds, thresholds, votingPowerFloorBps } = options;
    // The candidate field. When the caller hands an explicit feed assemblage, that
    // assemblage IS the field (the strategy layer owns it); otherwise we fall back
    // to the historical trending/tagFilter + optional following-feed assembly.
    let accountsRaw;
    let rawPosts;
    let feedPostCount;
    let preExcludeCount;
    if (feeds !== undefined) {
        const [acc, assembled] = await Promise.all([
            hive.getAccounts([account]),
            assembleFeeds(hive, account, feeds, sort, limit),
        ]);
        accountsRaw = acc;
        feedPostCount = assembled.length;
        preExcludeCount = assembled.length;
        rawPosts = excludeKeys ? assembled.filter((p) => !excludeKeys.has(`${String(p["author"] ?? "")}/${String(p["permlink"] ?? "")}`)) : assembled;
    }
    else {
        const [acc, trendingPosts, feedPosts] = await Promise.all([
            hive.getAccounts([account]),
            tagFilter !== undefined
                ? fetchPostsForTags(hive, account, sort, tagFilter)
                : hive.getRankedPosts({ sort, tag: "", observer: account, limit })
                    .then((r) => r.filter((p) => typeof p === "object" && p !== null)),
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
    const accRaw = (accountsRaw[0] ?? {});
    const { currentMana, maxMana } = currentVotingMana(accRaw, Date.now() / 1000);
    const price = await hive.getCurationPrice();
    const observations = rawPosts.map((p) => toPostObservation(p));
    const contentFitnessEntries = await Promise.all(observations.map(async (obs) => {
        try {
            const raw = (await hive.getContent(obs.author, obs.permlink));
            if (!raw?.body)
                return null;
            return [`${obs.author}/${obs.permlink}`, contentFitnessValuation(contentObservation(raw))];
        }
        catch {
            return null;
        }
    }));
    const selection = selectCurationVotes({
        account,
        observations,
        mana: { currentMana, maxMana },
        price,
        ...(options.priceOf === undefined ? {} : { priceOf: options.priceOf }),
        contentFitnessMap: new Map(contentFitnessEntries.filter((e) => e !== null)),
        ...(thresholds !== undefined ? { thresholds } : {}),
        policy: { ...(votingPowerFloorBps === undefined ? {} : { manaFloorBps: votingPowerFloorBps }) },
    });
    return {
        currentMana,
        maxMana,
        remainingMana: selection.remainingMana,
        hive: accRaw.balance ?? "0.000 HIVE",
        hbd: accRaw.hbd_balance ?? "0.000 HBD",
        vests: accRaw.vesting_shares ?? "0.000000 VESTS",
        rewardHive: accRaw.reward_hive_balance ?? "0.000 HIVE",
        rewardHbd: accRaw.reward_hbd_balance ?? "0.000 HBD",
        rewardVests: accRaw.reward_vesting_balance ?? "0.000000 VESTS",
        proposals: selection.proposals,
        decisions: selection.decisions,
        excludedCount,
        feedPostCount,
        rawPosts,
    };
}
