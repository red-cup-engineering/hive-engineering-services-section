// client — HiveClient wraps RPC transport, reads, keys, and build/sign/broadcast behind one
// object. Reads need no keys; writes need the role key (posting for social ops, active for
// value ops). High-level writes take the operation's wire fields, defaulting the signer to the
// configured account.
import { RpcClient, DEFAULT_NODES } from "./rpc.mjs";
import * as chain from "./chain.mjs";
import { PrivateKey } from "./keys.mjs";
import { signTransaction, CHAIN_ID, transactionId } from "./transaction.mjs";
import * as ops from "./ops.mjs";
import * as rewards from "./rewards.mjs";

// Unix seconds: a per-account unique id for order, conversion and savings request ids.
const epochSeconds = () => Math.floor(Date.now() / 1000);

export class HiveClient {
  constructor({
    nodes = DEFAULT_NODES,
    timeout,
    transport,
    fetch,
    account,
    keys = {},
    chainId = CHAIN_ID,
    expirySeconds = 60,
  } = {}) {
    this.rpc = new RpcClient({ nodes, timeout, transport, fetch });
    this.account = account;
    this.chainId = chainId;
    this.expirySeconds = expirySeconds;
    this.keys = {};
    for (const [role, k] of Object.entries(keys)) {
      if (!k) continue;
      this.keys[role] = typeof k === "string" ? PrivateKey.from(k) : k;
    }
  }

  // --- reads (no keys required) ---
  getDynamicGlobalProperties() { return chain.getDynamicGlobalProperties(this.rpc); }
  getReferenceBlockData() { return chain.getReferenceBlockData(this.rpc); }
  getAccounts(names) { return chain.getAccounts(this.rpc, names); }
  async getAccount(name) { return (await chain.getAccounts(this.rpc, [name]))[0]; }

  // A broadcast transaction, confirmed: at least `quorum` of `nodes` return it in one block with
  // `operation` as its first operation, field for field. Polls `attempts` times; a node that
  // returns a different operation throws. Resolves [{ node, block }].
  async confirmTransaction(txid, operation, { nodes = this.rpc.nodes.slice(0, 3), quorum = 2, attempts = 12, intervalMs = 1200 } = {}) {
    const seen = new Map();
    for (let attempt = 0; attempt < attempts && seen.size < quorum; attempt += 1) {
      await Promise.all(nodes.filter((node) => !seen.has(node)).map(async (node) => {
        const tx = await new RpcClient({ nodes: [node], timeout: this.rpc.timeout, transport: this.rpc.transport })
          .call("account_history_api.get_transaction", { id: txid, include_reversible: true }).catch(() => null);
        if (!tx) return;
        if (!ops.sameOperation(tx.operations?.[0], operation)) throw new Error(`${node} returned ${txid} with a different operation`);
        seen.set(node, Object.freeze({ node, block: Number(tx.block_num) }));
      }));
      if (seen.size < quorum && attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    const rows = [...seen.values()];
    if (rows.length < quorum) throw new Error(`only ${rows.length} of ${quorum} required nodes confirmed ${txid}`);
    if (new Set(rows.map((row) => row.block)).size !== 1) throw new Error(`nodes disagree on the block of ${txid}`);
    return Object.freeze(rows);
  }
  getContent(author, permlink) { return chain.getContent(this.rpc, author, permlink); }
  getPost(author, permlink, observer = this.account || "") {
    return chain.getPost(this.rpc, { author, permlink, observer });
  }
  getRankedPosts(opts) { return chain.getRankedPosts(this.rpc, opts); }
  getAccountPosts(opts) { return chain.getAccountPosts(this.rpc, opts); }
  getProfile(account, observer = this.account || "") {
    return chain.getProfile(this.rpc, { account, observer });
  }
  getFollowCount(account) { return chain.getFollowCount(this.rpc, account); }
  getFollowers(account, start, type, limit) { return chain.getFollowers(this.rpc, account, start, type, limit); }
  getFollowing(account, start, type, limit) { return chain.getFollowing(this.rpc, account, start, type, limit); }
  getAccountHistory(account, start, limit) { return chain.getAccountHistory(this.rpc, account, start, limit); }
  getAccountNotifications(opts) { return chain.getAccountNotifications(this.rpc, opts); }
  getKeyReferences(keys) { return chain.getKeyReferences(this.rpc, keys); }
  /** account -> (public key -> role) for the named accounts. */
  getAccountAuthorities(accounts) { return chain.getAccountAuthorities(this.rpc, accounts); }

  // --- market and financial reads ---
  getOrderBook(limit) { return chain.getOrderBook(this.rpc, limit); }
  getTicker() { return chain.getTicker(this.rpc); }
  getVolume() { return chain.getVolume(this.rpc); }
  getTradeHistory(start, end, limit) { return chain.getTradeHistory(this.rpc, start, end, limit); }
  getMarketHistory(bucketSeconds, start, end) { return chain.getMarketHistory(this.rpc, bucketSeconds, start, end); }
  /** The account's currently resting limit orders. */
  getOpenOrders(account = this.account) { return chain.getOpenOrders(this.rpc, account); }
  getConversionRequests(account = this.account) { return chain.getConversionRequests(this.rpc, account); }
  getCollateralizedConversionRequests(account = this.account) {
    return chain.getCollateralizedConversionRequests(this.rpc, account);
  }
  getSavingsWithdrawFrom(account = this.account) { return chain.getSavingsWithdrawFrom(this.rpc, account); }
  getVestingDelegations(account = this.account, from, limit) {
    return chain.getVestingDelegations(this.rpc, account, from, limit);
  }
  getWithdrawRoutes(account = this.account, type) { return chain.getWithdrawRoutes(this.rpc, account, type); }
  getCurrentMedianHistoryPrice() { return chain.getCurrentMedianHistoryPrice(this.rpc); }
  getFeedHistory() { return chain.getFeedHistory(this.rpc); }
  getRewardFund(name) { return chain.getRewardFund(this.rpc, name); }
  // The price a curation vote is valued at (rewards.curationPriceOf over the post reward fund).
  async getCurationPrice() {
    const [rewardFund, dynamicGlobalProperties, medianPrice] = await Promise.all([
      chain.getRewardFund(this.rpc, "post"), chain.getDynamicGlobalProperties(this.rpc),
      chain.getCurrentMedianHistoryPrice(this.rpc),
    ]);
    return rewards.curationPriceOf({ rewardFund, dynamicGlobalProperties, medianPrice });
  }

  // --- write pipeline ---
  requireKey(role) {
    const key = this.keys[role];
    if (!key) throw new Error(`hive: no ${role} key configured`);
    return key;
  }

  requireAccount(account, action) {
    if (!account) throw new Error(`hive: no account configured for ${action}`);
    return account;
  }

  // Build a transaction from operations using fresh TaPoS + expiration, sign it with the given
  // role key, and return the signed tx (ready to broadcast). `time` from the chain is ISO without
  // a 'Z'; expiration is that time + expirySeconds, ISO without milliseconds/'Z'.
  async buildAndSign(operations, role = "posting") {
    const key = this.requireKey(role);
    const { ref_block_num, ref_block_prefix, time } = await chain.getReferenceBlockData(this.rpc);
    const base = new Date(`${time}Z`).getTime();
    const expiration = new Date(base + this.expirySeconds * 1000).toISOString().slice(0, -5);
    const tx = { ref_block_num, ref_block_prefix, expiration, operations, extensions: [] };
    return signTransaction(tx, [key], this.chainId);
  }

  async broadcast(operations, role = "posting") {
    const tx = await this.buildAndSign(operations, role);
    await chain.broadcastTransaction(this.rpc, tx);
    return { id: transactionId(tx), tx };
  }

  async broadcastSync(operations, role = "posting") {
    const tx = await this.buildAndSign(operations, role);
    const result = await chain.broadcastTransactionSynchronous(this.rpc, tx);
    return { ...result, tx };
  }

  // --- social writes (posting key) ---
  vote({ author, permlink, weight = 10000, voter = this.account } = {}) {
    this.requireAccount(voter, "vote");
    return this.broadcast([ops.vote({ voter, author, permlink, weight })]);
  }

  // post a top-level article. tags[0] becomes the category (parent_permlink). permlink defaults
  // to a slug of the title plus a uniquifier so re-posts don't collide.
  post({ title, body, tags = ["hive"], permlink, author = this.account, beneficiaries = [], json_metadata } = {}) {
    this.requireAccount(author, "post");
    const slug = permlink || `${ops.titlePermlink(title)}-${Date.now().toString(36)}`;
    const meta = json_metadata || { app: "hive-blockchain-client", format: "markdown", tags };
    const operations = [
      ops.comment({ parent_author: "", parent_permlink: tags[0] ?? "hive", author, permlink: slug, title, body, json_metadata: meta }),
    ];
    if (beneficiaries.length) operations.push(ops.commentOptions({ author, permlink: slug, beneficiaries }));
    return this.broadcast(operations);
  }

  // reply to a post/comment. permlink defaults to the conventional re-... slug.
  comment({ parentAuthor, parentPermlink, body, author = this.account, permlink, json_metadata } = {}) {
    this.requireAccount(author, "comment");
    const slug = permlink || ops.commentPermlink(parentAuthor, parentPermlink, Date.now().toString(36));
    const meta = json_metadata || { app: "hive-blockchain-client", format: "markdown" };
    return this.broadcast([
      ops.comment({ parent_author: parentAuthor, parent_permlink: parentPermlink, author, permlink: slug, title: "", body, json_metadata: meta }),
    ]);
  }

  delegateRc({ delegatees, max_rc, from = this.account } = {}) {
    this.requireAccount(from, "delegateRc");
    return this.broadcast([ops.delegateRc({ from, delegatees, max_rc })]);
  }

  follow(following, follower = this.account) {
    this.requireAccount(follower, "follow");
    return this.broadcast([ops.follow(follower, following)]);
  }
  unfollow(following, follower = this.account) {
    this.requireAccount(follower, "unfollow");
    return this.broadcast([ops.unfollow(follower, following)]);
  }
  reblog({ author, permlink, account = this.account } = {}) {
    this.requireAccount(account, "reblog");
    return this.broadcast([ops.reblog(account, author, permlink)]);
  }

  // custom_json; role "posting" for social payloads, "active" for Hive-Engine actions.
  customJson({ id, json, required_auths = [], required_posting_auths = [] }, role = "posting") {
    return this.broadcast([ops.customJson({ id, json, required_auths, required_posting_auths })], role);
  }

  // claim all pending rewards for the account (reads the balances, then claims them).
  async claimRewards(account = this.account) {
    this.requireAccount(account, "claimRewards");
    const acc = await this.getAccount(account);
    if (!acc) throw new Error(`hive: account ${account} not found`);
    return this.broadcast([
      ops.claimRewardBalance({
        account,
        reward_hive: acc.reward_hive_balance,
        reward_hbd: acc.reward_hbd_balance,
        reward_vests: acc.reward_vesting_balance,
      }),
    ]);
  }

  // --- value writes (active key) ---
  transfer({ to, amount, memo = "", from = this.account } = {}) {
    this.requireAccount(from, "transfer");
    return this.broadcast([ops.transfer({ from, to, amount, memo })], "active");
  }

  recurrentTransfer({ to, amount, memo = "", recurrence, executions, pair_id, from = this.account } = {}) {
    this.requireAccount(from, "recurrentTransfer");
    return this.broadcast([ops.recurrentTransfer({ from, to, amount, memo, recurrence, executions, pair_id })], "active");
  }

  // Power up; `to` defaults to the sender.
  transferToVesting({ amount, to, from = this.account } = {}) {
    this.requireAccount(from, "transferToVesting");
    return this.broadcast([ops.transferToVesting({ from, to: to ?? from, amount })], "active");
  }

  // Power down over 13 weeks; vesting_shares "0.000000 VESTS" cancels.
  withdrawVesting({ vesting_shares, account = this.account } = {}) {
    this.requireAccount(account, "withdrawVesting");
    return this.broadcast([ops.withdrawVesting({ account, vesting_shares })], "active");
  }

  setWithdrawVestingRoute({ to_account, percent = 10000, auto_vest = false, from_account = this.account } = {}) {
    this.requireAccount(from_account, "setWithdrawVestingRoute");
    return this.broadcast([ops.setWithdrawVestingRoute({ from_account, to_account, percent, auto_vest })], "active");
  }

  // vesting_shares "0.000000 VESTS" removes the delegation.
  delegateVestingShares({ delegatee, vesting_shares, delegator = this.account } = {}) {
    this.requireAccount(delegator, "delegateVestingShares");
    return this.broadcast([ops.delegateVestingShares({ delegator, delegatee, vesting_shares })], "active");
  }

  transferToSavings({ to, amount, memo = "", from = this.account } = {}) {
    this.requireAccount(from, "transferToSavings");
    return this.broadcast([ops.transferToSavings({ from, to: to ?? from, amount, memo })], "active");
  }

  transferFromSavings({ to, amount, memo = "", request_id = epochSeconds(), from = this.account } = {}) {
    this.requireAccount(from, "transferFromSavings");
    return this.broadcast([ops.transferFromSavings({ from, request_id, to: to ?? from, amount, memo })], "active");
  }

  cancelTransferFromSavings({ request_id, from = this.account } = {}) {
    this.requireAccount(from, "cancelTransferFromSavings");
    return this.broadcast([ops.cancelTransferFromSavings({ from, request_id })], "active");
  }

  // HBD -> HIVE at the median feed after 3.5 days.
  convert({ amount, requestid = epochSeconds(), owner = this.account } = {}) {
    this.requireAccount(owner, "convert");
    return this.broadcast([ops.convert({ owner, requestid, amount })], "active");
  }

  // HIVE -> HBD now, collateral returned after 3.5 days.
  collateralizedConvert({ amount, requestid = epochSeconds(), owner = this.account } = {}) {
    this.requireAccount(owner, "collateralizedConvert");
    return this.broadcast([ops.collateralizedConvert({ owner, requestid, amount })], "active");
  }

  // Internal-market limit order; orderid defaults to epoch seconds, expiration to 27 days out.
  limitOrderCreate({
    orderid = epochSeconds(),
    amount_to_sell,
    min_to_receive,
    fill_or_kill = false,
    expiration = new Date(Date.now() + 27 * 24 * 3600 * 1000).toISOString().slice(0, -5),
    owner = this.account,
  } = {}) {
    this.requireAccount(owner, "limitOrderCreate");
    return this.broadcast(
      [ops.limitOrderCreate({ owner, orderid, amount_to_sell, min_to_receive, fill_or_kill, expiration })],
      "active",
    );
  }

  limitOrderCancel({ orderid, owner = this.account } = {}) {
    this.requireAccount(owner, "limitOrderCancel");
    return this.broadcast([ops.limitOrderCancel({ owner, orderid })], "active");
  }

  // --- account creation (active key of the creator) ---

  // Create `name` with the given role public keys, paying the chain's current account creation
  // fee from this client's account; that account becomes the new account's recovery account.
  async createAccount({ name, keys, json_metadata = "", creator = this.account } = {}) {
    this.requireAccount(creator, "createAccount");
    const { account_creation_fee: fee } = await this.rpc.call("condenser_api.get_chain_properties", []);
    return this.broadcast([ops.accountCreate({ fee, creator, new_account_name: name, keys, json_metadata })], "active");
  }

  // Replace the account's public profile (posting_json_metadata); the posting key suffices.
  updatePostingProfile(posting_json_metadata, account = this.account) {
    this.requireAccount(account, "updatePostingProfile");
    return this.broadcast([ops.postingProfileUpdate({ account, posting_json_metadata })]);
  }

  // derive the public key for each configured role's private key (for confirming that they
  // match what's registered on-chain for the account).
  publicKeys() {
    const out = {};
    for (const [role, key] of Object.entries(this.keys)) out[role] = key.createPublic().toString();
    return out;
  }
}

export { DEFAULT_NODES, CHAIN_ID, ops, PrivateKey };
