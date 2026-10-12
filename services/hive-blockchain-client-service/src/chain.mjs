// chain — Hive read methods + the TaPoS ref_block derivation (spec docs/dev/notes/03-rpc-read-spec.md §4).
// Every read function takes an RpcClient as its first arg and just calls `rpc.call(method, params)`.
// param STYLES follow spec §1: condenser_api = positional array, bridge/*_api = named object.

// deriveReferenceBlock — PURE, no rpc (spec §4.1).
// ref_block_num    = head_block_number & 0xffff
// ref_block_prefix = Buffer.from(head_block_id, 'hex').readUInt32LE(4)
// The head_block_id first 4 bytes are the block number big-endian; the next 4 bytes are read LE.
export function deriveReferenceBlock(head_block_number, head_block_id) {
  const ref_block_num = head_block_number & 0xffff;
  const ref_block_prefix = Buffer.from(head_block_id, "hex").readUInt32LE(4);
  return { ref_block_num, ref_block_prefix };
}

// 4.1 — condenser_api.get_dynamic_global_properties; params [] (no-arg condenser → empty array).
export async function getDynamicGlobalProperties(rpc) {
  return rpc.call("condenser_api.get_dynamic_global_properties", []);
}

// Read DGP then derive the TaPoS reference fields. `time` is the chain head time ISO string.
export async function getReferenceBlockData(rpc) {
  const dgp = await getDynamicGlobalProperties(rpc);
  const { ref_block_num, ref_block_prefix } = deriveReferenceBlock(
    dgp.head_block_number,
    dgp.head_block_id,
  );
  return {
    ref_block_num,
    ref_block_prefix,
    time: dgp.time,
    head_block_number: dgp.head_block_number,
  };
}

// 4.2 — condenser_api.get_accounts; params [[...names]] (double-bracket, positional).
export async function getAccounts(rpc, names) {
  return rpc.call("condenser_api.get_accounts", [[...names]]);
}

// 4.5 — condenser_api.get_content; params [author, permlink] (positional). The post, or null when the chain
// holds none: current nodes answer a missing post with an assert ("... does not exist"), not an empty object.
export async function getContent(rpc, author, permlink) {
  try {
    return await rpc.call("condenser_api.get_content", [author, permlink]);
  } catch (error) {
    if (/does not exist/u.test(error.rpcError?.message ?? error.message)) return null;
    throw error;
  }
}

// 4.5 — bridge.get_post; named object.
export async function getPost(rpc, { author, permlink, observer }) {
  return rpc.call("bridge.get_post", { author, permlink, observer });
}

// 4.6 — bridge.get_ranked_posts; named object.
export async function getRankedPosts(
  rpc,
  { sort, tag = "", observer = "", limit, start_author, start_permlink },
) {
  return rpc.call("bridge.get_ranked_posts", {
    sort,
    tag,
    observer,
    limit,
    start_author,
    start_permlink,
  });
}

// 4.7 — bridge.get_account_posts; named object.
export async function getAccountPosts(
  rpc,
  { sort, account, observer = "", limit, start_author, start_permlink },
) {
  return rpc.call("bridge.get_account_posts", {
    sort,
    account,
    observer,
    limit,
    start_author,
    start_permlink,
  });
}

// 4.8 — bridge.get_profile; named object.
export async function getProfile(rpc, { account, observer = "" }) {
  return rpc.call("bridge.get_profile", { account, observer });
}

// 4.9 — condenser_api.get_follow_count; params [account] (positional).
export async function getFollowCount(rpc, account) {
  return rpc.call("condenser_api.get_follow_count", [account]);
}

// 4.10 — condenser_api.get_followers; params [account, start, type, limit] (positional).
export async function getFollowers(rpc, account, start = null, type = "blog", limit = 100) {
  return rpc.call("condenser_api.get_followers", [account, start, type, limit]);
}

// 4.10 — condenser_api.get_following; params [account, start, type, limit] (positional).
export async function getFollowing(rpc, account, start = null, type = "blog", limit = 100) {
  return rpc.call("condenser_api.get_following", [account, start, type, limit]);
}

// bridge.account_notifications; named object. Hivemind's notifications for an account, newest
// first: replies, mentions, follows, reblogs, votes ({ id, type, msg, url, date, score }).
// `last_id` pages back from that id. Hivemind answers null for an account with none.
export async function getAccountNotifications(rpc, { account, last_id, limit = 100 }) {
  return (await rpc.call("bridge.account_notifications", { account, limit, ...(last_id ? { last_id } : {}) })) ?? [];
}

// 4.3 — condenser_api.get_account_history; params [account, start, limit] (positional).
export async function getAccountHistory(rpc, account, start = -1, limit = 100) {
  return rpc.call("condenser_api.get_account_history", [account, start, limit]);
}

// 4.11 — condenser_api.get_open_orders; params [account] (positional). Result: the account's
// currently resting limit orders (`{orderid, created, expiration, seller, ..., sell_price, ...}`).
export async function getOpenOrders(rpc, account) {
  return rpc.call("condenser_api.get_open_orders", [account]);
}

// 4.4 — condenser_api.broadcast_transaction; params [tx]. Result {} on mempool accept.
export async function broadcastTransaction(rpc, tx) {
  return rpc.call("condenser_api.broadcast_transaction", [tx]);
}

// 4.4 — condenser_api.broadcast_transaction_synchronous; params [tx]. Result { id, block_num, ... }.
export async function broadcastTransactionSynchronous(rpc, tx) {
  return rpc.call("condenser_api.broadcast_transaction_synchronous", [tx]);
}

/**
 * Reverse key index: for each public key, which accounts list it in an
 * authority. Covers owner/active/posting (NOT memo keys — those are not
 * indexed; match memo keys against get_accounts authorities instead).
 */
export async function getKeyReferences(rpc, keys) {
    if (keys.length === 0)
        return [];
    const result = await rpc.call("account_by_key_api.get_key_references", { keys: [...keys] });
    return result.accounts;
}
export async function getOrderBook(rpc, limit) {
    return rpc.call("condenser_api.get_order_book", [limit ?? 500]);
}
export async function getTicker(rpc) {
    return rpc.call("condenser_api.get_ticker", []);
}
export async function getVolume(rpc) {
    return rpc.call("condenser_api.get_volume", []);
}
export async function getTradeHistory(rpc, start, end, limit) {
    return rpc.call("condenser_api.get_trade_history", [start, end, limit ?? 1000]);
}
export async function getMarketHistory(rpc, bucketSeconds, start, end) {
    const result = await rpc.call("market_history_api.get_market_history", {
        bucket_seconds: bucketSeconds,
        start,
        end,
    });
    return result.buckets;
}
export async function getConversionRequests(rpc, account) {
    return rpc.call("condenser_api.get_conversion_requests", [account]);
}
export async function getCollateralizedConversionRequests(rpc, account) {
    return rpc.call("condenser_api.get_collateralized_conversion_requests", [account]);
}
export async function getSavingsWithdrawFrom(rpc, account) {
    return rpc.call("condenser_api.get_savings_withdraw_from", [account]);
}
export async function getVestingDelegations(rpc, account, from, limit) {
    return rpc.call("condenser_api.get_vesting_delegations", [account, from ?? "", limit ?? 1000]);
}
export async function getWithdrawRoutes(rpc, account, type) {
    return rpc.call("condenser_api.get_withdraw_routes", [account, type ?? "all"]);
}
export async function getCurrentMedianHistoryPrice(rpc) {
    return rpc.call("condenser_api.get_current_median_history_price", []);
}
export async function getFeedHistory(rpc) {
    return rpc.call("condenser_api.get_feed_history", []);
}
export async function getRewardFund(rpc, name) {
    return rpc.call("condenser_api.get_reward_fund", [name ?? "post"]);
}

// On-chain authorities for the named accounts in one get_accounts call: account -> (public key
// -> role), roles owner/active/posting from key_auths plus the memo key. Accounts that do not
// exist on chain are absent from the result.
export async function getAccountAuthorities(rpc, accounts) {
  const found = new Map();
  for (const acct of (await getAccounts(rpc, accounts)) ?? []) {
    const roleKeys = new Map();
    for (const role of ["owner", "active", "posting"]) {
      for (const [key] of acct[role].key_auths) roleKeys.set(key, role);
    }
    roleKeys.set(acct.memo_key, "memo");
    found.set(acct.name, roleKeys);
  }
  return found;
}
