// client — the HiveComputer class: read/write Hive through a typed, signing-capable client.
import { RpcClient, DEFAULT_NODES } from "@red-cup-engineering/hive-blockchain-client-service/rpc.mjs";
import * as chain from "@red-cup-engineering/hive-blockchain-client-service/chain.mjs";
import { PrivateKey, } from "@red-cup-engineering/hive-blockchain-client-service/keys.mjs";
import { signTransaction, transactionId, CHAIN_ID as HIVE_MAINNET_CHAIN_ID, } from "@red-cup-engineering/hive-blockchain-client-service/transaction.mjs";
import * as ops from "@red-cup-engineering/hive-blockchain-client-service/ops.mjs";
export { DEFAULT_NODES, PrivateKey, ops };
export class HiveComputer {
    rpc;
    account;
    chainId;
    expirySeconds;
    keys;
    constructor({ nodes = DEFAULT_NODES, timeout, transport, account, keys = {}, chainId = HIVE_MAINNET_CHAIN_ID, expirySeconds = 60, } = {}) {
        this.rpc = new RpcClient({
            nodes,
            ...(timeout !== undefined ? { timeout } : {}),
            ...(transport !== undefined ? { transport } : {}),
        });
        this.account = account;
        this.chainId = chainId;
        this.expirySeconds = expirySeconds;
        const resolved = {};
        for (const [role, k] of Object.entries(keys)) {
            if (!k)
                continue;
            resolved[role] = typeof k === "string" ? PrivateKey.from(k) : k;
        }
        this.keys = resolved;
    }
    // ---------- reads (no keys required) ----------
    getDynamicGlobalProperties() {
        return chain.getDynamicGlobalProperties(this.rpc);
    }
    getReferenceBlockData() {
        return chain.getReferenceBlockData(this.rpc);
    }
    getAccounts(names) {
        return chain.getAccounts(this.rpc, names);
    }
    async getAccount(name) {
        const accounts = await chain.getAccounts(this.rpc, [name]);
        return accounts[0];
    }
    getContent(author, permlink) {
        return chain.getContent(this.rpc, author, permlink);
    }
    getPost(author, permlink) {
        return chain.getPost(this.rpc, { author, permlink, observer: this.account ?? "" });
    }
    getRankedPosts(opts) {
        return chain.getRankedPosts(this.rpc, opts);
    }
    getAccountPosts(opts) {
        return chain.getAccountPosts(this.rpc, opts);
    }
    getProfile(account, observer = this.account ?? "") {
        return chain.getProfile(this.rpc, { account, observer });
    }
    getFollowCount(account) {
        return chain.getFollowCount(this.rpc, account);
    }
    getFollowers(account, start, type, limit) {
        return chain.getFollowers(this.rpc, account, start, type, limit);
    }
    getFollowing(account, start, type, limit) {
        return chain.getFollowing(this.rpc, account, start, type, limit);
    }
    getAccountHistory(account, start, limit) {
        return chain.getAccountHistory(this.rpc, account, start, limit);
    }
    // ---------- market & financial reads (no keys required) ----------
    getOrderBook(limit) {
        return chain.getOrderBook(this.rpc, limit);
    }
    getTicker() {
        return chain.getTicker(this.rpc);
    }
    getVolume() {
        return chain.getVolume(this.rpc);
    }
    getTradeHistory(start, end, limit) {
        return chain.getTradeHistory(this.rpc, start, end, limit);
    }
    getMarketHistory(bucketSeconds, start, end) {
        return chain.getMarketHistory(this.rpc, bucketSeconds, start, end);
    }
    getOpenOrders(account) {
        return chain.getOpenOrders(this.rpc, account);
    }
    getConversionRequests(account) {
        return chain.getConversionRequests(this.rpc, account);
    }
    getCollateralizedConversionRequests(account) {
        return chain.getCollateralizedConversionRequests(this.rpc, account);
    }
    getSavingsWithdrawFrom(account) {
        return chain.getSavingsWithdrawFrom(this.rpc, account);
    }
    getVestingDelegations(account, from, limit) {
        return chain.getVestingDelegations(this.rpc, account, from, limit);
    }
    getWithdrawRoutes(account, type) {
        return chain.getWithdrawRoutes(this.rpc, account, type);
    }
    getCurrentMedianHistoryPrice() {
        return chain.getCurrentMedianHistoryPrice(this.rpc);
    }
    getFeedHistory() {
        return chain.getFeedHistory(this.rpc);
    }
    getRewardFund(name) {
        return chain.getRewardFund(this.rpc, name);
    }
    // ---------- write pipeline ----------
    requireKey(role) {
        const key = this.keys[role];
        if (!key)
            throw new Error(`hive-computer: no ${role} key configured`);
        return key;
    }
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
    // ---------- high-level writes ----------
    vote({ author, permlink, weight = 10000, voter = this.account, }) {
        if (!voter)
            throw new Error("hive-computer: no account configured for vote");
        return this.broadcast([ops.vote({ voter, author, permlink, weight })]);
    }
    post({ title, body, tags = ["hive"], permlink, author = this.account, beneficiaries = [], json_metadata, }) {
        if (!author)
            throw new Error("hive-computer: no account configured for post");
        // law-allow: clockDefault — expirySeconds is not ordering; Date.now() is for permlink uniqueness
        const slug = permlink ?? `${ops.slugify(title)}-${Date.now().toString(36)}`;
        const meta = json_metadata ?? { app: "hive-computer/0.0.0", format: "markdown", tags: [...tags] };
        const operations = [
            ops.comment({ parent_author: "", parent_permlink: tags[0] ?? "hive", author, permlink: slug, title, body, json_metadata: meta }),
        ];
        if (beneficiaries.length) {
            operations.push(ops.commentOptions({ author, permlink: slug, beneficiaries: [...beneficiaries] }));
        }
        return this.broadcast(operations);
    }
    reply({ parentAuthor, parentPermlink, body, author = this.account, permlink, json_metadata, }) {
        if (!author)
            throw new Error("hive-computer: no account configured for reply");
        // law-allow: clockDefault
        const slug = permlink ?? ops.commentPermlink(parentAuthor, parentPermlink, Date.now().toString(36));
        const meta = json_metadata ?? { app: "hive-computer/0.0.0", format: "markdown" };
        return this.broadcast([
            ops.comment({ parent_author: parentAuthor, parent_permlink: parentPermlink, author, permlink: slug, title: "", body, json_metadata: meta }),
        ]);
    }
    follow(following, follower = this.account) {
        if (!follower)
            throw new Error("hive-computer: no account configured for follow");
        return this.broadcast([ops.follow(follower, following)]);
    }
    unfollow(following, follower = this.account) {
        if (!follower)
            throw new Error("hive-computer: no account configured for unfollow");
        return this.broadcast([ops.unfollow(follower, following)]);
    }
    reblog({ author, permlink, account = this.account }) {
        if (!account)
            throw new Error("hive-computer: no account configured for reblog");
        return this.broadcast([ops.reblog(account, author, permlink)]);
    }
    // ---------- wallet writes (all of these sign with the ACTIVE key, keys.active) ----------
    /** Transfer liquid HIVE/HBD. Requires the ACTIVE key. `amount` like "1.000 HIVE". */
    transfer({ to, amount, memo = "", from = this.account }) {
        if (!from)
            throw new Error("hive-computer: no account configured for transfer");
        return this.broadcast([ops.transfer({ from, to, amount, memo })], "active");
    }
    /** Power up: transfer_to_vesting. Requires the ACTIVE key. `amount` like "1.000 HIVE"; `to` defaults to `from` (self power-up). */
    powerUp({ amount, to, from = this.account }) {
        if (!from)
            throw new Error("hive-computer: no account configured for powerUp");
        return this.broadcast([ops.transferToVesting({ from, to: to ?? from, amount })], "active");
    }
    /** Power down: withdraw_vesting. Requires the ACTIVE key. `vestingShares` like "1000.000000 VESTS". Pays out over 13 weekly installments. */
    powerDown({ vestingShares, account = this.account }) {
        if (!account)
            throw new Error("hive-computer: no account configured for powerDown");
        return this.broadcast([ops.withdrawVesting({ account, vesting_shares: vestingShares })], "active");
    }
    /** Cancel an in-progress power down: withdraw_vesting with 0 VESTS. Requires the ACTIVE key. */
    cancelPowerDown(account = this.account) {
        if (!account)
            throw new Error("hive-computer: no account configured for cancelPowerDown");
        return this.broadcast([ops.withdrawVesting({ account, vesting_shares: "0.000000 VESTS" })], "active");
    }
    /** Move liquid HIVE/HBD into savings. Requires the ACTIVE key. */
    transferToSavings({ to, amount, memo = "", from = this.account }) {
        if (!from)
            throw new Error("hive-computer: no account configured for transferToSavings");
        return this.broadcast([ops.transferToSavings({ from, to: to ?? from, amount, memo })], "active");
    }
    /** Withdraw from savings (3-day delay). Requires the ACTIVE key. `requestId` must be unique per pending withdrawal; defaults to epoch seconds. */
    transferFromSavings({ to, amount, memo = "", requestId, from = this.account }) {
        if (!from)
            throw new Error("hive-computer: no account configured for transferFromSavings");
        // law-allow: clockDefault — request_id only needs per-account uniqueness
        const request_id = requestId ?? Math.floor(Date.now() / 1000);
        return this.broadcast([ops.transferFromSavings({ from, request_id, to: to ?? from, amount, memo })], "active");
    }
    /** Cancel a pending savings withdrawal by its request id. Requires the ACTIVE key. */
    cancelTransferFromSavings({ requestId, from = this.account }) {
        if (!from)
            throw new Error("hive-computer: no account configured for cancelTransferFromSavings");
        return this.broadcast([ops.cancelTransferFromSavings({ from, request_id: requestId })], "active");
    }
    /** Convert HBD → HIVE at the median feed price after a 3.5-day delay. Requires the ACTIVE key. `amount` like "10.000 HBD". */
    convertHbd({ amount, requestId, owner = this.account }) {
        if (!owner)
            throw new Error("hive-computer: no account configured for convertHbd");
        // law-allow: clockDefault — requestid only needs per-account uniqueness
        const requestid = requestId ?? Math.floor(Date.now() / 1000);
        return this.broadcast([ops.convert({ owner, requestid, amount })], "active");
    }
    /** Collateralized convert HIVE → HBD (immediate HBD, collateral returned after 3.5 days). Requires the ACTIVE key. `amount` like "10.000 HIVE". */
    collateralizedConvert({ amount, requestId, owner = this.account }) {
        if (!owner)
            throw new Error("hive-computer: no account configured for collateralizedConvert");
        // law-allow: clockDefault — requestid only needs per-account uniqueness
        const requestid = requestId ?? Math.floor(Date.now() / 1000);
        return this.broadcast([ops.collateralizedConvert({ owner, requestid, amount })], "active");
    }
    /** Delegate vesting shares (HP) to another account. Requires the ACTIVE key. `vestingShares` like "1000.000000 VESTS". */
    delegate({ delegatee, vestingShares, delegator = this.account }) {
        if (!delegator)
            throw new Error("hive-computer: no account configured for delegate");
        return this.broadcast([ops.delegateVestingShares({ delegator, delegatee, vesting_shares: vestingShares })], "active");
    }
    /** Remove a delegation: delegate_vesting_shares with 0 VESTS. Requires the ACTIVE key. */
    undelegate({ delegatee, delegator = this.account }) {
        if (!delegator)
            throw new Error("hive-computer: no account configured for undelegate");
        return this.broadcast([ops.delegateVestingShares({ delegator, delegatee, vesting_shares: "0.000000 VESTS" })], "active");
    }
    /** Route future power-down payouts to another account. Requires the ACTIVE key. `percent` in basis points (10000 = 100%); `autoVest` re-vests at the destination. */
    setWithdrawRoute({ to, percent = 10000, autoVest = false, from = this.account }) {
        if (!from)
            throw new Error("hive-computer: no account configured for setWithdrawRoute");
        return this.broadcast([ops.setWithdrawVestingRoute({ from_account: from, to_account: to, percent, auto_vest: autoVest })], "active");
    }
    /** Place an internal-market limit order. Requires the ACTIVE key. `orderId` defaults to epoch seconds; `expiration` defaults to 27 days out. */
    limitOrderCreate({ amountToSell, minToReceive, orderId, fillOrKill = false, expiration, owner = this.account }) {
        if (!owner)
            throw new Error("hive-computer: no account configured for limitOrderCreate");
        // law-allow: clockDefault — orderid uniqueness and a far-future default expiration
        const orderid = orderId ?? Math.floor(Date.now() / 1000);
        // law-allow: clockDefault
        const expiry = expiration ?? new Date(Date.now() + 27 * 24 * 3600 * 1000).toISOString().slice(0, -5);
        return this.broadcast([ops.limitOrderCreate({ owner, orderid, amount_to_sell: amountToSell, min_to_receive: minToReceive, fill_or_kill: fillOrKill, expiration: expiry })], "active");
    }
    /** Cancel an open internal-market limit order by its order id. Requires the ACTIVE key. */
    limitOrderCancel({ orderId, owner = this.account }) {
        if (!owner)
            throw new Error("hive-computer: no account configured for limitOrderCancel");
        return this.broadcast([ops.limitOrderCancel({ owner, orderid: orderId })], "active");
    }
    /** Schedule a recurring transfer. Requires the ACTIVE key. `recurrence` in hours (chain minimum 24); `executions` total runs. */
    recurrentTransfer({ to, amount, memo = "", recurrence, executions, from = this.account }) {
        if (!from)
            throw new Error("hive-computer: no account configured for recurrentTransfer");
        return this.broadcast([ops.recurrentTransfer({ from, to, amount, memo, recurrence, executions })], "active");
    }
    /**
     * Broadcast a custom_json operation. `role` selects signing key: "posting" (default) for
     * social ops, "active" for Hive Engine token/market/LP actions.
     * Build the payload with ops.customJson (posting) or engineCustomJson from
     * @red-cup-engineering/hive-blockchain-client-service/engine (active). Pass the already-constructed Operation.
     */
    broadcastCustomJson({ id, json, requiredAuths = [], requiredPostingAuths = [] }, role = "posting") {
        return this.broadcast([ops.customJson({ id, json, required_auths: requiredAuths, required_posting_auths: requiredPostingAuths })], role);
    }
    async claimRewards(account = this.account) {
        if (!account)
            throw new Error("hive-computer: no account configured for claimRewards");
        const acc = await this.getAccount(account);
        if (!acc)
            throw new Error(`hive-computer: account ${account} not found`);
        return this.broadcast([
            ops.claimRewardBalance({
                account,
                reward_hive: acc.reward_hive_balance,
                reward_hbd: acc.reward_hbd_balance,
                reward_vests: acc.reward_vesting_balance,
            }),
        ]);
    }
    publicKeys() {
        const out = {};
        for (const [role, key] of Object.entries(this.keys)) {
            if (key)
                out[role] = key.createPublic().toString();
        }
        return out;
    }
}
