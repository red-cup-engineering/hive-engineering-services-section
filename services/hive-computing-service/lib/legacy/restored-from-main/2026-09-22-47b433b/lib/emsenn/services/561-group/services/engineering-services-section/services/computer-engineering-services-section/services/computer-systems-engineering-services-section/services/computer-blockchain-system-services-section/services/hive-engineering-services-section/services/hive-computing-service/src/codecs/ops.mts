// ops — high-level Hive operation builders. Each returns an Operation tuple ready for
// a transaction's `operations` array. Pure: no network, no signing.
import type { Operation } from "./serialize.mjs";
export type { Operation };

export interface VoteInput {
  readonly voter: string;
  readonly author: string;
  readonly permlink: string;
  readonly weight?: number;
}

export function vote({ voter, author, permlink, weight = 10000 }: VoteInput): Operation {
  return ["vote", { voter, author, permlink, weight }];
}

export interface CommentInput {
  readonly parent_author?: string;
  readonly parent_permlink: string;
  readonly author: string;
  readonly permlink: string;
  readonly title?: string;
  readonly body: string;
  readonly json_metadata?: unknown;
}

export function comment({
  parent_author = "",
  parent_permlink,
  author,
  permlink,
  title = "",
  body,
  json_metadata = {},
}: CommentInput): Operation {
  return [
    "comment",
    {
      parent_author,
      parent_permlink,
      author,
      permlink,
      title,
      body,
      // law-allow: stringifyIdentity
      json_metadata: typeof json_metadata === "string" ? json_metadata : JSON.stringify(json_metadata),
    },
  ];
}

export interface PostInput {
  readonly author: string;
  readonly permlink: string;
  readonly title: string;
  readonly body: string;
  readonly tags?: readonly string[];
  readonly json_metadata?: unknown;
}

export function post({ author, permlink, title, body, tags = [], json_metadata = {} }: PostInput): Operation {
  const tag = tags[0] ?? "";
  const meta = typeof json_metadata === "object" && json_metadata !== null
    ? { tags: [...tags], ...json_metadata as Record<string, unknown> }
    : {};
  return comment({ parent_author: "", parent_permlink: tag, author, permlink, title, body, json_metadata: meta });
}

export interface CommentOptionsInput {
  readonly author: string;
  readonly permlink: string;
  readonly max_accepted_payout?: string;
  readonly percent_hbd?: number;
  readonly allow_votes?: boolean;
  readonly allow_curation_rewards?: boolean;
  readonly beneficiaries?: readonly { readonly account: string; readonly weight: number }[];
}

export function commentOptions({
  author,
  permlink,
  max_accepted_payout = "1000000.000 HBD",
  percent_hbd = 10000,
  allow_votes = true,
  allow_curation_rewards = true,
  beneficiaries = [],
}: CommentOptionsInput): Operation {
  const extensions = beneficiaries.length
    ? [[0, { beneficiaries: beneficiaries.map((b) => ({ account: b.account, weight: b.weight })) }]]
    : [];
  return ["comment_options", { author, permlink, max_accepted_payout, percent_hbd, allow_votes, allow_curation_rewards, extensions }];
}

export interface TransferInput {
  readonly from: string;
  readonly to: string;
  readonly amount: string;
  readonly memo?: string;
}

export function transfer({ from, to, amount, memo = "" }: TransferInput): Operation {
  return ["transfer", { from, to, amount, memo }];
}

export function transferToVesting({ from, to, amount }: { from: string; to: string; amount: string }): Operation {
  return ["transfer_to_vesting", { from, to, amount }];
}

export interface WithdrawVestingInput {
  readonly account: string;
  readonly vesting_shares: string;
}

export function withdrawVesting({ account, vesting_shares }: WithdrawVestingInput): Operation {
  return ["withdraw_vesting", { account, vesting_shares }];
}

export interface LimitOrderCreateInput {
  readonly owner: string;
  readonly orderid: number;
  readonly amount_to_sell: string;
  readonly min_to_receive: string;
  readonly fill_or_kill?: boolean;
  /** time_point_sec: epoch seconds or ISO string like "2026-01-01T00:00:00". */
  readonly expiration: number | string;
}

export function limitOrderCreate({
  owner,
  orderid,
  amount_to_sell,
  min_to_receive,
  fill_or_kill = false,
  expiration,
}: LimitOrderCreateInput): Operation {
  return ["limit_order_create", { owner, orderid, amount_to_sell, min_to_receive, fill_or_kill, expiration }];
}

export interface LimitOrderCancelInput {
  readonly owner: string;
  readonly orderid: number;
}

export function limitOrderCancel({ owner, orderid }: LimitOrderCancelInput): Operation {
  return ["limit_order_cancel", { owner, orderid }];
}

export interface ConvertInput {
  readonly owner: string;
  readonly requestid: number;
  readonly amount: string;
}

export function convert({ owner, requestid, amount }: ConvertInput): Operation {
  return ["convert", { owner, requestid, amount }];
}

export function collateralizedConvert({ owner, requestid, amount }: ConvertInput): Operation {
  return ["collateralized_convert", { owner, requestid, amount }];
}

export interface SetWithdrawVestingRouteInput {
  readonly from_account: string;
  readonly to_account: string;
  readonly percent?: number;
  readonly auto_vest?: boolean;
}

export function setWithdrawVestingRoute({
  from_account,
  to_account,
  percent = 10000,
  auto_vest = false,
}: SetWithdrawVestingRouteInput): Operation {
  return ["set_withdraw_vesting_route", { from_account, to_account, percent, auto_vest }];
}

export interface TransferToSavingsInput {
  readonly from: string;
  readonly to: string;
  readonly amount: string;
  readonly memo?: string;
}

export function transferToSavings({ from, to, amount, memo = "" }: TransferToSavingsInput): Operation {
  return ["transfer_to_savings", { from, to, amount, memo }];
}

export interface TransferFromSavingsInput {
  readonly from: string;
  readonly request_id: number;
  readonly to: string;
  readonly amount: string;
  readonly memo?: string;
}

export function transferFromSavings({ from, request_id, to, amount, memo = "" }: TransferFromSavingsInput): Operation {
  return ["transfer_from_savings", { from, request_id, to, amount, memo }];
}

export interface CancelTransferFromSavingsInput {
  readonly from: string;
  readonly request_id: number;
}

export function cancelTransferFromSavings({ from, request_id }: CancelTransferFromSavingsInput): Operation {
  return ["cancel_transfer_from_savings", { from, request_id }];
}

export interface DelegateVestingSharesInput {
  readonly delegator: string;
  readonly delegatee: string;
  readonly vesting_shares: string;
}

export function delegateVestingShares({ delegator, delegatee, vesting_shares }: DelegateVestingSharesInput): Operation {
  return ["delegate_vesting_shares", { delegator, delegatee, vesting_shares }];
}

export interface RecurrentTransferInput {
  readonly from: string;
  readonly to: string;
  readonly amount: string;
  readonly memo?: string;
  /** Hours between executions (chain minimum is 24). */
  readonly recurrence: number;
  readonly executions: number;
}

export function recurrentTransfer({ from, to, amount, memo = "", recurrence, executions }: RecurrentTransferInput): Operation {
  return ["recurrent_transfer", { from, to, amount, memo, recurrence, executions, extensions: [] }];
}

export function deleteComment({ author, permlink }: { author: string; permlink: string }): Operation {
  return ["delete_comment", { author, permlink }];
}

export interface ClaimRewardInput {
  readonly account: string;
  readonly reward_hive: string;
  readonly reward_hbd: string;
  readonly reward_vests: string;
}

export function claimRewardBalance(input: ClaimRewardInput): Operation {
  return ["claim_reward_balance", { ...input }];
}

export interface CustomJsonInput {
  readonly id: string;
  readonly json: unknown;
  readonly required_auths?: readonly string[];
  readonly required_posting_auths?: readonly string[];
}

export function customJson({ id, json, required_auths = [], required_posting_auths = [] }: CustomJsonInput): Operation {
  return [
    "custom_json",
    {
      required_auths: [...required_auths],
      required_posting_auths: [...required_posting_auths],
      id,
      // law-allow: stringifyIdentity
      json: typeof json === "string" ? json : JSON.stringify(json),
    },
  ];
}

export function follow(follower: string, following: string): Operation {
  return customJson({
    id: "follow",
    required_posting_auths: [follower],
    json: ["follow", { follower, following, what: ["blog"] }],
  });
}

export function unfollow(follower: string, following: string): Operation {
  return customJson({
    id: "follow",
    required_posting_auths: [follower],
    json: ["follow", { follower, following, what: [] }],
  });
}

export function reblog(account: string, author: string, permlink: string): Operation {
  return customJson({
    id: "follow",
    required_posting_auths: [account],
    json: ["reblog", { account, author, permlink }],
  });
}

export function slugify(title: string): string {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 256);
}

export function commentPermlink(parentAuthor: string, parentPermlink: string, uniq: string): string {
  return slugify(`re-${parentAuthor}-${parentPermlink}-${uniq}`);
}
