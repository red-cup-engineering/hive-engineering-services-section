// transaction — build the signing digest, sign, and id a Hive transaction. Ties the pure
// serializer (lib/serialize.mjs) to the keys (lib/keys.mjs) via the chain_id-prefixed sha256
// digest. See docs/dev/notes/01-crypto-signing-spec.md §4 and 02-serialization-spec.md §5.
import { sha256 } from "@red-cup-engineering/cryptographic-computer-data-engineering-services-section/hash";
import { PublicKey } from "./keys.mjs";
import { serializeTransaction } from "./serialize.mjs";

// Operations carry public keys as "STM..." strings, the form the broadcast JSON needs; the
// serializer takes 33-byte points. Convert the key fields (authority key_auths, memo_key) for
// the signing bytes only, leaving the transaction as it will be broadcast.
const point = (key) => (typeof key === "string" ? PublicKey.from(key).toBuffer() : key);
const authorityPoints = (auth) => auth && { ...auth, key_auths: (auth.key_auths || []).map(([key, weight]) => [point(key), weight]) };
function wireOperation([name, payload]) {
  if (!payload || typeof payload !== "object") return [name, payload];
  const wire = { ...payload };
  for (const role of ["owner", "active", "posting"]) if (role in wire) wire[role] = authorityPoints(wire[role]);
  if ("memo_key" in wire && wire.memo_key != null) wire.memo_key = point(wire.memo_key);
  return [name, wire];
}
export const wireTransaction = (tx) => ({ ...tx, operations: (tx.operations || []).map(wireOperation) });

// Hive mainnet chain id (HF24 "Eclipse"). 32 bytes when hex-decoded.
export const CHAIN_ID =
  "beeab0de00000000000000000000000000000000000000000000000000000000";

// digest = sha256( chain_id(32 bytes) || serialized_transaction ). The chain_id is prepended
// ONLY for the signing digest; it is never part of the broadcast JSON.
export function transactionDigest(tx, chainId = CHAIN_ID) {
  const chainBuf = Buffer.from(chainId, "hex");
  const txBuf = serializeTransaction(wireTransaction(tx));
  return sha256(Buffer.concat([chainBuf, txBuf]));
}

// signTransaction(tx, keys, chainId) -> tx with `signatures` appended (lowercase hex, 130 chars
// each). `keys` is a PrivateKey or an array of them; each signs the same digest.
export function signTransaction(tx, keys, chainId = CHAIN_ID) {
  const digest = transactionDigest(tx, chainId);
  const list = Array.isArray(keys) ? keys : [keys];
  const signatures = (tx.signatures || []).slice();
  for (const key of list) signatures.push(key.sign(digest).toString("hex"));
  return { ...tx, signatures };
}

// transactionId = first 20 bytes (40 hex chars) of sha256(serialized_transaction), WITHOUT
// the chain_id prefix.
export function transactionId(tx) {
  return sha256(serializeTransaction(wireTransaction(tx))).toString("hex").slice(0, 40);
}
