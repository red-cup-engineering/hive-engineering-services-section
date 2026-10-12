/**
 * @emsenn/computing-with-hive-codecs — zero-dependency Hive blockchain codecs.
 *
 * Three groups: cryptography (hash, secp256k1, keys), binary serialization
 * (ByteWriter, serializeTransaction, serializeAsset), and operation builders
 * (vote, comment, follow, transfer, …). The transaction subpath ties them:
 * build operations → serialize → sign digest → broadcast. No network here.
 */

// ---------- hash ----------
export { sha256, sha256d, hmacSha256, ripemd160 } from "./hash.mjs";

// ---------- keys ----------
export { PrivateKey, PublicKey } from "./keys.mjs";

// ---------- secp256k1 (low-level; prefer PrivateKey.sign) ----------
export { P, N, getPublicKey, sign, verify, recover, hashMessage } from "./secp256k1.mjs";

// ---------- serialization ----------
export { ByteWriter, serializeAsset, serializeOperation, serializeTransaction } from "./serialize.mjs";
export type { AssetInput, Operation, TransactionInput } from "./serialize.mjs";

// ---------- operations ----------
export {
  vote, comment, post, commentOptions,
  transfer, transferToVesting, deleteComment, claimRewardBalance,
  withdrawVesting, limitOrderCreate, limitOrderCancel, convert, collateralizedConvert,
  setWithdrawVestingRoute, transferToSavings, transferFromSavings, cancelTransferFromSavings,
  delegateVestingShares, recurrentTransfer,
  customJson, follow, unfollow, reblog,
  slugify, commentPermlink,
} from "./ops.mjs";
export type {
  VoteInput, CommentInput, PostInput, CommentOptionsInput,
  TransferInput, ClaimRewardInput, CustomJsonInput,
  WithdrawVestingInput, LimitOrderCreateInput, LimitOrderCancelInput, ConvertInput,
  SetWithdrawVestingRouteInput, TransferToSavingsInput, TransferFromSavingsInput,
  CancelTransferFromSavingsInput, DelegateVestingSharesInput, RecurrentTransferInput,
} from "./ops.mjs";

// ---------- transaction ----------
export {
  HIVE_MAINNET_CHAIN_ID,
  transactionDigest, signTransaction, transactionId, deriveReferenceBlock,
} from "./transaction.mjs";
export type { SignedTransaction } from "./transaction.mjs";
