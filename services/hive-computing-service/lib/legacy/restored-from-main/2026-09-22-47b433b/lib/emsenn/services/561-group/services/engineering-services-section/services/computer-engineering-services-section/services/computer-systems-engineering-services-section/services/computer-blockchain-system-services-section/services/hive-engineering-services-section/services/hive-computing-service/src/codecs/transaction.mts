// transaction — Hive transaction digest, signing, and id.
// Ties serialize.mts to keys.mts via the chain_id-prefixed SHA-256 digest.
import { sha256 } from "./hash.mjs";
import { serializeTransaction } from "./serialize.mjs";
import type { TransactionInput, Operation } from "./serialize.mjs";
import type { PrivateKey } from "./keys.mjs";

export type { TransactionInput, Operation };

// Hive mainnet chain id (HF24 "Eclipse"). 32 bytes when hex-decoded.
export const HIVE_MAINNET_CHAIN_ID =
  "beeab0de00000000000000000000000000000000000000000000000000000000";

export function transactionDigest(tx: TransactionInput, chainId = HIVE_MAINNET_CHAIN_ID): Buffer {
  const chainBuf = Buffer.from(chainId, "hex");
  const txBuf = serializeTransaction(tx);
  return sha256(Buffer.concat([chainBuf, txBuf]));
}

export type SignedTransaction = TransactionInput & { readonly signatures: readonly string[] };

export function signTransaction(
  tx: TransactionInput,
  keys: PrivateKey | readonly PrivateKey[],
  chainId = HIVE_MAINNET_CHAIN_ID,
): SignedTransaction {
  const digest = transactionDigest(tx, chainId);
  const list = Array.isArray(keys) ? keys : [keys as PrivateKey];
  const prev = (tx as Partial<SignedTransaction>).signatures ?? [];
  const signatures = [...prev];
  for (const key of list) signatures.push(key.sign(digest).toString("hex"));
  return { ...tx, signatures };
}

export function transactionId(tx: TransactionInput): string {
  const raw = sha256(serializeTransaction(tx));
  return raw.subarray(0, 20).toString("hex");
}

export function deriveReferenceBlock(
  headBlockNumber: number,
  headBlockId: string,
): { ref_block_num: number; ref_block_prefix: number } {
  const ref_block_num = headBlockNumber & 0xffff;
  const ref_block_prefix = Buffer.from(headBlockId, "hex").readUInt32LE(4);
  return { ref_block_num, ref_block_prefix };
}
