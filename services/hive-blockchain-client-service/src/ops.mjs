// ops — high-level operation builders. Each returns a `[name, payload]` pair ready to drop into
// a transaction's `operations` array. Pure: no network, no signing. Field shapes follow
// docs/dev/notes/02-serialization-spec.md §7.

import { slugify } from "@red-cup-engineering/computer-text-content-engineering-services-section/slugify-text";

// A vote. weight is in basis points: 10000 = 100% up, -10000 = 100% down, 0 = unvote.
export const vote = ({ voter, author, permlink, weight = 10000 }) => [
  "vote",
  { voter, author, permlink, weight },
];

// A comment. A top-level post is a comment with empty parent_author and the first tag as
// parent_permlink (see `post`). json_metadata is stringified if given as an object.
export const comment = ({
  parent_author = "",
  parent_permlink,
  author,
  permlink,
  title = "",
  body,
  json_metadata = {},
}) => [
  "comment",
  {
    parent_author,
    parent_permlink,
    author,
    permlink,
    title,
    body,
    json_metadata:
      typeof json_metadata === "string" ? json_metadata : JSON.stringify(json_metadata),
  },
];

// comment_options. beneficiaries is [{ account, weight }] (weight in basis points); when present
// it is encoded as the beneficiaries extension (variant id 0).
export const commentOptions = ({
  author,
  permlink,
  max_accepted_payout = "1000000.000 HBD",
  percent_hbd = 10000,
  allow_votes = true,
  allow_curation_rewards = true,
  beneficiaries = [],
}) => {
  const extensions = beneficiaries.length
    ? [[0, { beneficiaries: beneficiaries.map((b) => ({ account: b.account, weight: b.weight })) }]]
    : [];
  return [
    "comment_options",
    { author, permlink, max_accepted_payout, percent_hbd, allow_votes, allow_curation_rewards, extensions },
  ];
};

export const transfer = ({ from, to, amount, memo = "" }) => [
  "transfer",
  { from, to, amount, memo },
];

export const transferToVesting = ({ from, to, amount }) => [
  "transfer_to_vesting",
  { from, to, amount },
];

// Power down: pays vesting_shares out over 13 weekly installments; "0.000000 VESTS" cancels.
export const withdrawVesting = ({ account, vesting_shares }) => [
  "withdraw_vesting",
  { account, vesting_shares },
];

// HBD -> HIVE at the median feed price after 3.5 days. requestid unique per owner.
export const convert = ({ owner, requestid, amount }) => [
  "convert",
  { owner, requestid, amount },
];

// HIVE -> HBD immediately, collateral returned after 3.5 days. requestid unique per owner.
export const collateralizedConvert = ({ owner, requestid, amount }) => [
  "collateralized_convert",
  { owner, requestid, amount },
];

// Route future power-down payouts. percent in basis points.
export const setWithdrawVestingRoute = ({ from_account, to_account, percent = 10000, auto_vest = false }) => [
  "set_withdraw_vesting_route",
  { from_account, to_account, percent, auto_vest },
];

export const transferToSavings = ({ from, to = from, amount, memo = "" }) => [
  "transfer_to_savings",
  { from, to, amount, memo },
];

// Withdraw from savings after the 3-day delay. request_id unique per pending withdrawal.
export const transferFromSavings = ({ from, request_id, to = from, amount, memo = "" }) => [
  "transfer_from_savings",
  { from, request_id, to, amount, memo },
];

export const cancelTransferFromSavings = ({ from, request_id }) => [
  "cancel_transfer_from_savings",
  { from, request_id },
];

// Delegate HP as VESTS; "0.000000 VESTS" removes the delegation.
export const delegateVestingShares = ({ delegator, delegatee, vesting_shares }) => [
  "delegate_vesting_shares",
  { delegator, delegatee, vesting_shares },
];

// recurrence in hours (chain minimum 24); executions is the total number of runs. pair_id
// distinguishes several recurrent transfers between the same two accounts.
export const recurrentTransfer = ({ from, to, amount, memo = "", recurrence, executions, pair_id }) => [
  "recurrent_transfer",
  { from, to, amount, memo, recurrence, executions, extensions: pair_id === undefined ? [] : [[1, { pair_id }]] },
];

// A limit order on the internal HIVE:HBD (or any two-asset) market. orderid is a caller-chosen
// uint32, unique per open order for owner (never reused while an order with that id is open).
// expiration is a time_point_sec (epoch seconds or an ISO string without trailing 'Z'/offset).
export const limitOrderCreate = ({
  owner,
  orderid,
  amount_to_sell,
  min_to_receive,
  fill_or_kill = false,
  expiration,
}) => [
  "limit_order_create",
  { owner, orderid, amount_to_sell, min_to_receive, fill_or_kill, expiration },
];

// Cancels owner's open order with this orderid; a no-op refunding the unfilled balance if the
// order no longer exists.
export const limitOrderCancel = ({ owner, orderid }) => [
  "limit_order_cancel",
  { owner, orderid },
];

export const deleteComment = ({ author, permlink }) => [
  "delete_comment",
  { author, permlink },
];

export const claimRewardBalance = ({ account, reward_hive, reward_hbd, reward_vests }) => [
  "claim_reward_balance",
  { account, reward_hive, reward_hbd, reward_vests },
];

// custom_json. `json` may be an object/array (stringified) or a pre-stringified string.
export const customJson = ({
  id,
  json,
  required_auths = [],
  required_posting_auths = [],
}) => [
  "custom_json",
  {
    required_auths,
    required_posting_auths,
    id,
    json: typeof json === "string" ? json : JSON.stringify(json),
  },
];

// follow / unfollow / reblog are custom_json with id "follow", authorized by the posting key.
export const follow = (follower, following) =>
  customJson({
    id: "follow",
    required_posting_auths: [follower],
    json: ["follow", { follower, following, what: ["blog"] }],
  });

export const unfollow = (follower, following) =>
  customJson({
    id: "follow",
    required_posting_auths: [follower],
    json: ["follow", { follower, following, what: [] }],
  });

export const reblog = (account, author, permlink) =>
  customJson({
    id: "follow",
    required_posting_auths: [account],
    json: ["reblog", { account, author, permlink }],
  });

// A single-key authority: one key at weight 1, threshold 1 — what every Hive signup creates.
export const keyAuthority = (publicKey) => ({ weight_threshold: 1, account_auths: [], key_auths: [[publicKey, 1]] });

// account_create, paying `fee` (the chain's account_creation_fee) from the creator, who becomes
// the new account's recovery account. `keys` holds the four role public keys ("STM..." strings).
export const accountCreate = ({ fee, creator, new_account_name, keys, json_metadata = "" }) => [
  "account_create",
  {
    fee,
    creator,
    new_account_name,
    owner: keyAuthority(keys.owner),
    active: keyAuthority(keys.active),
    posting: keyAuthority(keys.posting),
    memo_key: keys.memo,
    json_metadata: typeof json_metadata === "string" ? json_metadata : JSON.stringify(json_metadata),
  },
];

// account_update2 that changes only the profile metadata, so the posting key suffices.
export const postingProfileUpdate = ({ account, posting_json_metadata }) => [
  "account_update2",
  {
    account,
    json_metadata: "",
    posting_json_metadata:
      typeof posting_json_metadata === "string" ? posting_json_metadata : JSON.stringify(posting_json_metadata),
    extensions: [],
  },
];

// --- permlink helpers (see 03-rpc-read-spec.md §5) ---

// Slugify a title into a permlink-safe string: lowercase, [a-z0-9-], runs collapsed, trimmed.
// A permlink from a title: the house slug, capped at Hive's 256 characters.
export const titlePermlink = (title) => slugify(String(title)).slice(0, 256);

// A unique reply permlink: re-<parentAuthor>-<parentPermlink>-<timestamp-ish>. Caller supplies a
// uniquifier (e.g. a date string or random token) so this stays pure/deterministic for tests.
export const commentPermlink = (parentAuthor, parentPermlink, uniq) =>
  titlePermlink(`re-${parentAuthor}-${parentPermlink}-${uniq}`);

// Direct RC delegation (HF26): lend resource credits from `from` to each delegatee, up to max_rc
// each (0 removes the delegation). A custom_json with id "rc", signed by the posting key.
export const delegateRc = ({ from, delegatees, max_rc }) =>
  customJson({
    id: "rc",
    required_posting_auths: [from],
    json: { type: "delegate_rc_operation", value: { from, delegatees: [...delegatees], max_rc: Number(max_rc), extensions: [] } },
  });

// The NAI a legacy asset symbol is written as in appbase results.
const ASSET_NAI = { HBD: "@@000000013", HIVE: "@@000000021", VESTS: "@@000000037" };

// Whether a chain-returned operation (appbase `{ type, value }` or legacy `[name, value]`) is
// `expected` field for field. An appbase NAI amount equals the legacy asset string it encodes.
export function sameOperation(actual, [expectedName, expectedValue]) {
  const name = actual?.type?.replace(/_operation$/, "") ?? actual?.[0];
  return name === expectedName && sameValue(actual?.value ?? actual?.[1], expectedValue);
}

function sameValue(actual, expected) {
  if (actual === expected) return true;
  if (typeof expected === "string" && actual && typeof actual === "object" && typeof actual.nai === "string") {
    const match = /^(0|[1-9][0-9]*)\.([0-9]+) ([A-Z]+)$/.exec(expected);
    return Boolean(match) && match[2].length === actual.precision && ASSET_NAI[match[3]] === actual.nai
      && BigInt(actual.amount) === BigInt(match[1] + match[2]);
  }
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((v, i) => sameValue(actual[i], v));
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
    const keys = Object.keys(expected).sort();
    return JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(keys) && keys.every((k) => sameValue(actual[k], expected[k]));
  }
  return false;
}
