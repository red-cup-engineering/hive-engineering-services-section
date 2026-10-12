// client — the HiveComputer class: read/write Hive through a typed, signing-capable client.
import { RpcClient, DEFAULT_NODES, type RpcClientOptions } from "./rpc.mjs";
import * as chain from "./chain.mjs";
import type { HiveAccount } from "./chain.mjs";
import {
  PrivateKey,
  signTransaction, transactionId,
  HIVE_MAINNET_CHAIN_ID,
  type Operation, type SignedTransaction,
} from "./codecs/index.mjs";
import * as ops from "./codecs/index.mjs";

export type { Operation, SignedTransaction };
export { DEFAULT_NODES, PrivateKey, ops };

export interface HiveComputerKeys {
  readonly posting?: string | PrivateKey | undefined;
  readonly active?: string | PrivateKey | undefined;
  readonly owner?: string | PrivateKey | undefined;
  readonly memo?: string | PrivateKey | undefined;
}

export interface HiveComputerOptions {
  readonly nodes?: readonly string[] | undefined;
  readonly timeout?: number | undefined;
  readonly transport?: RpcClientOptions["transport"] | undefined;
  readonly account?: string | undefined;
  readonly keys?: HiveComputerKeys | undefined;
  readonly chainId?: string | undefined;
  readonly expirySeconds?: number | undefined;
}

export class HiveComputer {
  readonly rpc: RpcClient;
  readonly account: string | undefined;
  readonly chainId: string;
  readonly expirySeconds: number;
  private readonly keys: Partial<Record<string, PrivateKey>>;

  constructor({
    nodes = DEFAULT_NODES,
    timeout,
    transport,
    account,
    keys = {},
    chainId = HIVE_MAINNET_CHAIN_ID,
    expirySeconds = 60,
  }: HiveComputerOptions = {}) {
    this.rpc = new RpcClient({
      nodes,
      ...(timeout !== undefined ? { timeout } : {}),
      ...(transport !== undefined ? { transport } : {}),
    });
    this.account = account;
    this.chainId = chainId;
    this.expirySeconds = expirySeconds;
    const resolved: Partial<Record<string, PrivateKey>> = {};
    for (const [role, k] of Object.entries(keys)) {
      if (!k) continue;
      resolved[role] = typeof k === "string" ? PrivateKey.from(k) : k;
    }
    this.keys = resolved;
  }

  // ---------- reads (no keys required) ----------

  getDynamicGlobalProperties(): Promise<chain.DynamicGlobalProperties> {
    return chain.getDynamicGlobalProperties(this.rpc);
  }

  getReferenceBlockData(): ReturnType<typeof chain.getReferenceBlockData> {
    return chain.getReferenceBlockData(this.rpc);
  }

  getAccounts(names: readonly string[]): Promise<HiveAccount[]> {
    return chain.getAccounts(this.rpc, names);
  }

  async getAccount(name: string): Promise<HiveAccount | undefined> {
    const accounts = await chain.getAccounts(this.rpc, [name]);
    return accounts[0];
  }

  getContent(author: string, permlink: string): Promise<unknown> {
    return chain.getContent(this.rpc, author, permlink);
  }

  getPost(author: string, permlink: string): Promise<unknown> {
    return chain.getPost(this.rpc, { author, permlink, observer: this.account ?? "" });
  }

  getRankedPosts(opts: chain.RankedPostsOptions): Promise<unknown[]> {
    return chain.getRankedPosts(this.rpc, opts);
  }

  getAccountPosts(opts: chain.AccountPostsOptions): Promise<unknown[]> {
    return chain.getAccountPosts(this.rpc, opts);
  }

  getProfile(account: string, observer = this.account ?? ""): Promise<unknown> {
    return chain.getProfile(this.rpc, { account, observer });
  }

  getFollowCount(account: string): Promise<unknown> {
    return chain.getFollowCount(this.rpc, account);
  }

  getFollowers(account: string, start?: string, type?: string, limit?: number): Promise<unknown[]> {
    return chain.getFollowers(this.rpc, account, start, type, limit);
  }

  getFollowing(account: string, start?: string, type?: string, limit?: number): Promise<unknown[]> {
    return chain.getFollowing(this.rpc, account, start, type, limit);
  }

  getAccountHistory(account: string, start?: number, limit?: number): Promise<unknown[]> {
    return chain.getAccountHistory(this.rpc, account, start, limit);
  }

  // ---------- market & financial reads (no keys required) ----------

  getOrderBook(limit?: number): Promise<chain.OrderBook> {
    return chain.getOrderBook(this.rpc, limit);
  }

  getTicker(): Promise<chain.MarketTicker> {
    return chain.getTicker(this.rpc);
  }

  getVolume(): Promise<chain.MarketVolume> {
    return chain.getVolume(this.rpc);
  }

  getTradeHistory(start: string, end: string, limit?: number): Promise<chain.MarketTrade[]> {
    return chain.getTradeHistory(this.rpc, start, end, limit);
  }

  getMarketHistory(bucketSeconds: number, start: string, end: string): Promise<chain.MarketHistoryBucket[]> {
    return chain.getMarketHistory(this.rpc, bucketSeconds, start, end);
  }

  getOpenOrders(account: string): Promise<chain.OpenOrder[]> {
    return chain.getOpenOrders(this.rpc, account);
  }

  getConversionRequests(account: string): Promise<chain.ConversionRequest[]> {
    return chain.getConversionRequests(this.rpc, account);
  }

  getCollateralizedConversionRequests(account: string): Promise<chain.CollateralizedConversionRequest[]> {
    return chain.getCollateralizedConversionRequests(this.rpc, account);
  }

  getSavingsWithdrawFrom(account: string): Promise<chain.SavingsWithdraw[]> {
    return chain.getSavingsWithdrawFrom(this.rpc, account);
  }

  getVestingDelegations(account: string, from?: string, limit?: number): Promise<chain.VestingDelegation[]> {
    return chain.getVestingDelegations(this.rpc, account, from, limit);
  }

  getWithdrawRoutes(account: string, type?: string): Promise<chain.WithdrawRoute[]> {
    return chain.getWithdrawRoutes(this.rpc, account, type);
  }

  getCurrentMedianHistoryPrice(): Promise<chain.LegacyPrice> {
    return chain.getCurrentMedianHistoryPrice(this.rpc);
  }

  getFeedHistory(): Promise<chain.ChainFeedHistory> {
    return chain.getFeedHistory(this.rpc);
  }

  getRewardFund(name?: string): Promise<chain.ChainRewardFund> {
    return chain.getRewardFund(this.rpc, name);
  }

  // ---------- write pipeline ----------

  private requireKey(role: string): PrivateKey {
    const key = this.keys[role];
    if (!key) throw new Error(`hive-computer: no ${role} key configured`);
    return key;
  }

  async buildAndSign(operations: readonly Operation[], role = "posting"): Promise<SignedTransaction> {
    const key = this.requireKey(role);
    const { ref_block_num, ref_block_prefix, time } = await chain.getReferenceBlockData(this.rpc);
    const base = new Date(`${time}Z`).getTime();
    const expiration = new Date(base + this.expirySeconds * 1000).toISOString().slice(0, -5);
    const tx = { ref_block_num, ref_block_prefix, expiration, operations, extensions: [] as const };
    return signTransaction(tx, [key], this.chainId);
  }

  async broadcast(operations: readonly Operation[], role = "posting"): Promise<{ id: string; tx: SignedTransaction }> {
    const tx = await this.buildAndSign(operations, role);
    await chain.broadcastTransaction(this.rpc, tx);
    return { id: transactionId(tx), tx };
  }

  async broadcastSync(operations: readonly Operation[], role = "posting"): Promise<unknown> {
    const tx = await this.buildAndSign(operations, role);
    const result = await chain.broadcastTransactionSynchronous(this.rpc, tx);
    return { ...(result as object), tx };
  }

  // ---------- high-level writes ----------

  vote({
    author,
    permlink,
    weight = 10000,
    voter = this.account,
  }: {
    author: string;
    permlink: string;
    weight?: number;
    voter?: string;
  }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!voter) throw new Error("hive-computer: no account configured for vote");
    return this.broadcast([ops.vote({ voter, author, permlink, weight })]);
  }

  post({
    title,
    body,
    tags = ["hive"],
    permlink,
    author = this.account,
    beneficiaries = [],
    json_metadata,
  }: {
    title: string;
    body: string;
    tags?: readonly string[];
    permlink?: string;
    author?: string;
    beneficiaries?: readonly { account: string; weight: number }[];
    json_metadata?: unknown;
  }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!author) throw new Error("hive-computer: no account configured for post");
    // law-allow: clockDefault — expirySeconds is not ordering; Date.now() is for permlink uniqueness
    const slug = permlink ?? `${ops.slugify(title)}-${Date.now().toString(36)}`;
    const meta = json_metadata ?? { app: "hive-computer/0.0.0", format: "markdown", tags: [...tags] };
    const operations: Operation[] = [
      ops.comment({ parent_author: "", parent_permlink: tags[0] ?? "hive", author, permlink: slug, title, body, json_metadata: meta }),
    ];
    if (beneficiaries.length) {
      operations.push(ops.commentOptions({ author, permlink: slug, beneficiaries: [...beneficiaries] }));
    }
    return this.broadcast(operations);
  }

  reply({
    parentAuthor,
    parentPermlink,
    body,
    author = this.account,
    permlink,
    json_metadata,
  }: {
    parentAuthor: string;
    parentPermlink: string;
    body: string;
    author?: string;
    permlink?: string;
    json_metadata?: unknown;
  }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!author) throw new Error("hive-computer: no account configured for reply");
    // law-allow: clockDefault
    const slug = permlink ?? ops.commentPermlink(parentAuthor, parentPermlink, Date.now().toString(36));
    const meta = json_metadata ?? { app: "hive-computer/0.0.0", format: "markdown" };
    return this.broadcast([
      ops.comment({ parent_author: parentAuthor, parent_permlink: parentPermlink, author, permlink: slug, title: "", body, json_metadata: meta }),
    ]);
  }

  follow(following: string, follower = this.account): Promise<{ id: string; tx: SignedTransaction }> {
    if (!follower) throw new Error("hive-computer: no account configured for follow");
    return this.broadcast([ops.follow(follower, following)]);
  }

  unfollow(following: string, follower = this.account): Promise<{ id: string; tx: SignedTransaction }> {
    if (!follower) throw new Error("hive-computer: no account configured for unfollow");
    return this.broadcast([ops.unfollow(follower, following)]);
  }

  reblog({ author, permlink, account = this.account }: { author: string; permlink: string; account?: string }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!account) throw new Error("hive-computer: no account configured for reblog");
    return this.broadcast([ops.reblog(account, author, permlink)]);
  }

  // ---------- wallet writes (all of these sign with the ACTIVE key, keys.active) ----------

  /** Transfer liquid HIVE/HBD. Requires the ACTIVE key. `amount` like "1.000 HIVE". */
  transfer({ to, amount, memo = "", from = this.account }: { to: string; amount: string; memo?: string | undefined; from?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!from) throw new Error("hive-computer: no account configured for transfer");
    return this.broadcast([ops.transfer({ from, to, amount, memo })], "active");
  }

  /** Power up: transfer_to_vesting. Requires the ACTIVE key. `amount` like "1.000 HIVE"; `to` defaults to `from` (self power-up). */
  powerUp({ amount, to, from = this.account }: { amount: string; to?: string | undefined; from?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!from) throw new Error("hive-computer: no account configured for powerUp");
    return this.broadcast([ops.transferToVesting({ from, to: to ?? from, amount })], "active");
  }

  /** Power down: withdraw_vesting. Requires the ACTIVE key. `vestingShares` like "1000.000000 VESTS". Pays out over 13 weekly installments. */
  powerDown({ vestingShares, account = this.account }: { vestingShares: string; account?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!account) throw new Error("hive-computer: no account configured for powerDown");
    return this.broadcast([ops.withdrawVesting({ account, vesting_shares: vestingShares })], "active");
  }

  /** Cancel an in-progress power down: withdraw_vesting with 0 VESTS. Requires the ACTIVE key. */
  cancelPowerDown(account = this.account): Promise<{ id: string; tx: SignedTransaction }> {
    if (!account) throw new Error("hive-computer: no account configured for cancelPowerDown");
    return this.broadcast([ops.withdrawVesting({ account, vesting_shares: "0.000000 VESTS" })], "active");
  }

  /** Move liquid HIVE/HBD into savings. Requires the ACTIVE key. */
  transferToSavings({ to, amount, memo = "", from = this.account }: { to?: string | undefined; amount: string; memo?: string | undefined; from?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!from) throw new Error("hive-computer: no account configured for transferToSavings");
    return this.broadcast([ops.transferToSavings({ from, to: to ?? from, amount, memo })], "active");
  }

  /** Withdraw from savings (3-day delay). Requires the ACTIVE key. `requestId` must be unique per pending withdrawal; defaults to epoch seconds. */
  transferFromSavings({ to, amount, memo = "", requestId, from = this.account }: { to?: string | undefined; amount: string; memo?: string | undefined; requestId?: number | undefined; from?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!from) throw new Error("hive-computer: no account configured for transferFromSavings");
    // law-allow: clockDefault — request_id only needs per-account uniqueness
    const request_id = requestId ?? Math.floor(Date.now() / 1000);
    return this.broadcast([ops.transferFromSavings({ from, request_id, to: to ?? from, amount, memo })], "active");
  }

  /** Cancel a pending savings withdrawal by its request id. Requires the ACTIVE key. */
  cancelTransferFromSavings({ requestId, from = this.account }: { requestId: number; from?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!from) throw new Error("hive-computer: no account configured for cancelTransferFromSavings");
    return this.broadcast([ops.cancelTransferFromSavings({ from, request_id: requestId })], "active");
  }

  /** Convert HBD → HIVE at the median feed price after a 3.5-day delay. Requires the ACTIVE key. `amount` like "10.000 HBD". */
  convertHbd({ amount, requestId, owner = this.account }: { amount: string; requestId?: number | undefined; owner?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!owner) throw new Error("hive-computer: no account configured for convertHbd");
    // law-allow: clockDefault — requestid only needs per-account uniqueness
    const requestid = requestId ?? Math.floor(Date.now() / 1000);
    return this.broadcast([ops.convert({ owner, requestid, amount })], "active");
  }

  /** Collateralized convert HIVE → HBD (immediate HBD, collateral returned after 3.5 days). Requires the ACTIVE key. `amount` like "10.000 HIVE". */
  collateralizedConvert({ amount, requestId, owner = this.account }: { amount: string; requestId?: number | undefined; owner?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!owner) throw new Error("hive-computer: no account configured for collateralizedConvert");
    // law-allow: clockDefault — requestid only needs per-account uniqueness
    const requestid = requestId ?? Math.floor(Date.now() / 1000);
    return this.broadcast([ops.collateralizedConvert({ owner, requestid, amount })], "active");
  }

  /** Delegate vesting shares (HP) to another account. Requires the ACTIVE key. `vestingShares` like "1000.000000 VESTS". */
  delegate({ delegatee, vestingShares, delegator = this.account }: { delegatee: string; vestingShares: string; delegator?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!delegator) throw new Error("hive-computer: no account configured for delegate");
    return this.broadcast([ops.delegateVestingShares({ delegator, delegatee, vesting_shares: vestingShares })], "active");
  }

  /** Remove a delegation: delegate_vesting_shares with 0 VESTS. Requires the ACTIVE key. */
  undelegate({ delegatee, delegator = this.account }: { delegatee: string; delegator?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!delegator) throw new Error("hive-computer: no account configured for undelegate");
    return this.broadcast([ops.delegateVestingShares({ delegator, delegatee, vesting_shares: "0.000000 VESTS" })], "active");
  }

  /** Route future power-down payouts to another account. Requires the ACTIVE key. `percent` in basis points (10000 = 100%); `autoVest` re-vests at the destination. */
  setWithdrawRoute({ to, percent = 10000, autoVest = false, from = this.account }: { to: string; percent?: number | undefined; autoVest?: boolean | undefined; from?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!from) throw new Error("hive-computer: no account configured for setWithdrawRoute");
    return this.broadcast([ops.setWithdrawVestingRoute({ from_account: from, to_account: to, percent, auto_vest: autoVest })], "active");
  }

  /** Place an internal-market limit order. Requires the ACTIVE key. `orderId` defaults to epoch seconds; `expiration` defaults to 27 days out. */
  limitOrderCreate({ amountToSell, minToReceive, orderId, fillOrKill = false, expiration, owner = this.account }: { amountToSell: string; minToReceive: string; orderId?: number | undefined; fillOrKill?: boolean | undefined; expiration?: number | string | undefined; owner?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!owner) throw new Error("hive-computer: no account configured for limitOrderCreate");
    // law-allow: clockDefault — orderid uniqueness and a far-future default expiration
    const orderid = orderId ?? Math.floor(Date.now() / 1000);
    // law-allow: clockDefault
    const expiry = expiration ?? new Date(Date.now() + 27 * 24 * 3600 * 1000).toISOString().slice(0, -5);
    return this.broadcast([ops.limitOrderCreate({ owner, orderid, amount_to_sell: amountToSell, min_to_receive: minToReceive, fill_or_kill: fillOrKill, expiration: expiry })], "active");
  }

  /** Cancel an open internal-market limit order by its order id. Requires the ACTIVE key. */
  limitOrderCancel({ orderId, owner = this.account }: { orderId: number; owner?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!owner) throw new Error("hive-computer: no account configured for limitOrderCancel");
    return this.broadcast([ops.limitOrderCancel({ owner, orderid: orderId })], "active");
  }

  /** Schedule a recurring transfer. Requires the ACTIVE key. `recurrence` in hours (chain minimum 24); `executions` total runs. */
  recurrentTransfer({ to, amount, memo = "", recurrence, executions, from = this.account }: { to: string; amount: string; memo?: string | undefined; recurrence: number; executions: number; from?: string | undefined }): Promise<{ id: string; tx: SignedTransaction }> {
    if (!from) throw new Error("hive-computer: no account configured for recurrentTransfer");
    return this.broadcast([ops.recurrentTransfer({ from, to, amount, memo, recurrence, executions })], "active");
  }

  /**
   * Broadcast a custom_json operation. `role` selects signing key: "posting" (default) for
   * social ops, "active" for Hive Engine token/market/LP actions.
   * Build the payload with ops.customJson (posting) or engineCustomJson from
   * @emsenn/computing-with-hive/codecs/engine (active). Pass the already-constructed Operation.
   */
  broadcastCustomJson(
    { id, json, requiredAuths = [], requiredPostingAuths = [] }: {
      id: string;
      json: unknown;
      requiredAuths?: readonly string[];
      requiredPostingAuths?: readonly string[];
    },
    role: "posting" | "active" = "posting",
  ): Promise<{ id: string; tx: SignedTransaction }> {
    return this.broadcast([ops.customJson({ id, json, required_auths: requiredAuths, required_posting_auths: requiredPostingAuths })], role);
  }

  async claimRewards(account = this.account): Promise<{ id: string; tx: SignedTransaction }> {
    if (!account) throw new Error("hive-computer: no account configured for claimRewards");
    const acc = await this.getAccount(account);
    if (!acc) throw new Error(`hive-computer: account ${account} not found`);
    return this.broadcast([
      ops.claimRewardBalance({
        account,
        reward_hive: acc.reward_hive_balance,
        reward_hbd: acc.reward_hbd_balance,
        reward_vests: acc.reward_vesting_balance,
      }),
    ]);
  }

  publicKeys(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [role, key] of Object.entries(this.keys)) {
      if (key) out[role] = key.createPublic().toString();
    }
    return out;
  }
}
