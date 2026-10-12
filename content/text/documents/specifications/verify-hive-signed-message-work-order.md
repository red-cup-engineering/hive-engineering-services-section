# verify-hive-signed-message
## Requirements
- `recovers-or-verifies-the-signature`: The operation computes the SHA-256 digest of the UTF-8 `message`, then either verifies the 65-byte compact `signature` directly against a supplied `publicKey` or recovers the signing public key from the signature's recovery header byte, using `@red-cup-engineering/hive-blockchain-client-service`'s own secp256k1 `verify`/`recover` and `PublicKey` encode/decode — it never reimplements curve arithmetic, base58, or RIPEMD-160.
- `cross-reads-account-authority-from-two-nodes`: The operation reads the named account's current `posting` and `active` `key_auths` independently from two Hive JSON-RPC node base URLs (`condenser_api.get_accounts`), defaulting to two curated public nodes when the request names none.
- `names-the-authorized-role`: When the recovered or verified public key is present in the two nodes' agreed `posting` key set, the operation returns `role: "posting"`; when present only in the agreed `active` key set, it returns `role: "active"`.
- `injectable-network-call`: The operation accepts an injectable JSON-RPC transport (`options.transport`, matching `RpcClient`'s own `(url, bodyObject) => Promise<{status, body}>` shape) defaulting to real HTTPS, so callers and tests can supply fixtures instead of live network access.
- `json-in-json-out`: The operation is one function taking one JSON request object and resolving one JSON response object — never throwing — either `{verified: true, account, publicKey, role}` or `{verified: false, reason}`.
## Prohibitions
- `refuses-node-disagreement`: The operation must resolve `{verified: false}` (never `{verified: true}`) when the two nodes report different `posting` or `active` key sets for the account.
- `no-second-crypto-implementation`: The operation must never reimplement secp256k1 point arithmetic, base58 encoding, or RIPEMD-160; it composes `@red-cup-engineering/hive-blockchain-client-service`'s exports exclusively.
- `no-credential-use`: The operation must perform only public, unauthenticated JSON-RPC reads; it must never accept, read, or transmit a private key, WIF, or write operation.
## Laws
- `primitives-exist-once` | 561 Group working discipline | 2026-08-30 | CLAUDE.md | Applies to this operation's whole crypto and RPC composition. | secp256k1 signing math, graphene key encoding, and Hive JSON-RPC transport live once in `@red-cup-engineering/hive-blockchain-client-service`; this operation composes those exports by exact pin rather than reimplementing them.
- `fabricate-do-not-hand-write` | 561 Group working discipline, dispatch-agents skill | 2026-09-04 | .claude/skills/dispatch-agents/SKILL.md | Applies to this whole operation source file. | The operation is born through the jsnode fabrication line from this work order, never hand-written.
## Standards
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation and its import.meta.main guard. | The package uses one executable ESM operation source file eligible for downstream staged package-birth assays.
- `hive-condenser-api-get-accounts` | Hive developer portal | current | https://developers.hive.io/apidefinitions/#condenser_api.get_accounts | Applies to the account-authority read this operation performs against each node. | `condenser_api.get_accounts` is the documented unauthenticated read returning an account's `posting`/`active` authorities as `key_auths` pairs; this operation reads only that method, from two nodes, and never writes.
- `hive-keychain-signbuffer-sha256-digest` | mahdiyari/hive-tx (the library the Hive Keychain extension itself calls for `signBuffer`, per its own source at `src/popup/hive/utils/hive.utils.ts`: `signature.Signature.signBuffer(buf, privateKey).toHex()`) | docs/keys.html, observed 2026-09-05 via `gh api repos/mahdiyari/hive-tx/contents/docs/keys.html` | https://github.com/mahdiyari/hive-tx/blob/master/docs/keys.html | Applies to the digest this operation computes before verifying or recovering. | hive-tx's own recovery recipe states plainly: "Create a SHA-256 hash of the UTF-8 message" then treat the signature as recovery-header-byte + 64-byte R\|\|S; this operation applies exactly that digest and layout.
## Open questions
none
## Package
```json
{"packageName":"@red-cup-engineering/verify-hive-signed-message-service","packageVersion":"0.1.0","license":"MIT","dependencies":{"@red-cup-engineering/hive-blockchain-client-service":"0.1.2"},"devDependencies":{}}
```
## Operation
```mjs path=scripts/verify-hive-signed-message.mjs
#!/usr/bin/env node
// Recovers or verifies a Hive Keychain `signBuffer` compact signature over a
// UTF-8 message (SHA-256 digest, per hive-tx's documented Keychain recovery
// recipe: https://github.com/mahdiyari/hive-tx/blob/master/docs/keys.html,
// observed 2026-09-05), then confirms the signing key is a live posting or
// active authority for the named Hive account by reading condenser_api's
// get_accounts independently from two public JSON-RPC nodes and refusing
// when they disagree. All secp256k1 point arithmetic, base58, and
// RIPEMD-160 are @red-cup-engineering/hive-blockchain-client-service's own
// exports — this operation never reimplements them.
import { sha256 } from "@red-cup-engineering/hive-blockchain-client-service/src/hash.mjs";
import { verify, recover } from "@red-cup-engineering/hive-blockchain-client-service/src/secp256k1.mjs";
import { PublicKey } from "@red-cup-engineering/hive-blockchain-client-service/src/keys.mjs";
import { RpcClient, DEFAULT_NODES } from "@red-cup-engineering/hive-blockchain-client-service/src/rpc.mjs";

const SIGNATURE_PATTERN = /^(0x)?[0-9a-fA-F]{130}$/;

function parseCompactSignature(signature) {
  if (typeof signature !== "string" || !SIGNATURE_PATTERN.test(signature)) {
    throw new Error("signature must be a 130-character hex compact Hive signature");
  }
  const hex = signature.startsWith("0x") || signature.startsWith("0X") ? signature.slice(2) : signature;
  const buffer = Buffer.from(hex, "hex");
  const header = buffer[0];
  const recovery = header >= 31 && header <= 34 ? header - 31 : header - 27;
  if (recovery < 0 || recovery > 3) throw new Error("signature header byte does not encode a valid recovery id");
  return { recovery, body: buffer.subarray(1) };
}

async function readAccountKeyAuths(rpc, account) {
  const [record] = await rpc.call("condenser_api.get_accounts", [[account]]);
  if (!record) throw new Error(`account "${account}" was not found`);
  return {
    posting: (record.posting?.key_auths ?? []).map(([key]) => key),
    active: (record.active?.key_auths ?? []).map(([key]) => key),
  };
}

function sameKeySet(left, right) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((key, index) => key === b[index]);
}

/**
 * Recovers or verifies a Hive Keychain `signBuffer` compact signature over
 * `message`, then confirms the signing public key is a live posting or
 * active authority for `account`, cross-read from two public Hive JSON-RPC
 * nodes.
 * @param {object} request A HiveSignedMessageVerificationRequest.
 * @param {string} request.account Hive account name the signature claims to speak for.
 * @param {string} request.message The exact UTF-8 text that was signed (the pre-digest challenge).
 * @param {string} request.signature 130-character hex compact secp256k1 signature (Keychain `signBuffer` wire format: 1-byte recovery header + 64-byte R||S).
 * @param {string} [request.publicKey] An `STM...` Hive public key the caller expects the signature to belong to; when given, the signature is verified directly against it instead of recovered.
 * @param {string[]} [request.nodes] At least two Hive JSON-RPC node base URLs to cross-read the account from; defaults to two curated public nodes.
 * @param {{transport?: (url: string, body: object) => Promise<{status: number, body: string}>}} [options] `transport` overrides the underlying JSON-RPC HTTP call for tests; defaults to real HTTPS.
 * @returns {Promise<{verified: true, account: string, publicKey: string, role: "posting"|"active"} | {verified: false, reason: string}>}
 */
export async function verifyHiveSignedMessage(request, options = {}) {
  try {
    if (request === null || typeof request !== "object" || Array.isArray(request)) {
      return { verified: false, reason: "request must be a JSON object" };
    }
    const { account, message, signature, publicKey, nodes } = request;
    if (typeof account !== "string" || account.length === 0) {
      return { verified: false, reason: "account must be a non-empty string" };
    }
    if (typeof message !== "string" || message.length === 0) {
      return { verified: false, reason: "message must be a non-empty string" };
    }
    const nodeList = Array.isArray(nodes) && nodes.length >= 2 ? nodes.slice(0, 2) : DEFAULT_NODES.slice(0, 2);

    let recoveryParse;
    try {
      recoveryParse = parseCompactSignature(signature);
    } catch (error) {
      return { verified: false, reason: error.message };
    }
    const digest = sha256(Buffer.from(message, "utf8"));

    let recoveredPublicKey;
    if (typeof publicKey === "string" && publicKey.length > 0) {
      let pub;
      try {
        pub = PublicKey.from(publicKey);
      } catch (error) {
        return { verified: false, reason: `publicKey is not a valid Hive public key: ${error.message}` };
      }
      if (!verify(digest, recoveryParse.body, pub.toBuffer())) {
        return { verified: false, reason: "signature does not verify against the provided publicKey" };
      }
      recoveredPublicKey = pub.toString();
    } else {
      let pub33;
      try {
        pub33 = recover(digest, recoveryParse.body, recoveryParse.recovery);
      } catch (error) {
        return { verified: false, reason: `could not recover a public key from the signature: ${error.message}` };
      }
      recoveredPublicKey = PublicKey.fromBuffer(pub33).toString();
    }

    let authorities;
    try {
      const [first, second] = await Promise.all(
        nodeList.map((node) => readAccountKeyAuths(new RpcClient({ nodes: [node], transport: options.transport }), account)),
      );
      if (!sameKeySet(first.posting, second.posting) || !sameKeySet(first.active, second.active)) {
        return { verified: false, reason: "the two Hive nodes disagree on the account's key authorities" };
      }
      authorities = first;
    } catch (error) {
      return { verified: false, reason: `could not read account authorities from Hive nodes: ${error.message}` };
    }

    if (authorities.posting.includes(recoveredPublicKey)) {
      return { verified: true, account, publicKey: recoveredPublicKey, role: "posting" };
    }
    if (authorities.active.includes(recoveredPublicKey)) {
      return { verified: true, account, publicKey: recoveredPublicKey, role: "active" };
    }
    return { verified: false, reason: "public key is not an authorized posting or active key for the account" };
  } catch (error) {
    return { verified: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "verifyHiveSignedMessage — Recovers or verifies a Hive Keychain `signBuffer` compact signature over `message`, then confirms the signing public key is a live posting or active authority for `account`, cross-read from two public Hive JSON-RPC nodes.\n",
    );
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\n")) {
      if (line.length > 0) process.stdout.write(`${JSON.stringify(await verifyHiveSignedMessage(JSON.parse(line)))}\n`);
    }
  }
}
```
## Tests
```mjs path=test/verify-hive-signed-message.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { PrivateKey } from "@red-cup-engineering/hive-blockchain-client-service/src/keys.mjs";
import { sha256 } from "@red-cup-engineering/hive-blockchain-client-service/src/hash.mjs";
import { verifyHiveSignedMessage } from "../scripts/verify-hive-signed-message.mjs";

// A throwaway key generated fresh for this test run via the house client's
// own PrivateKey/sign primitives — never a real WIF.
function throwawayKey() {
  while (true) {
    try {
      return new PrivateKey(randomBytes(32));
    } catch {
      // out-of-range scalar; try again.
    }
  }
}

function signMessage(key, message) {
  const digest = sha256(Buffer.from(message, "utf8"));
  return key.sign(digest).toString("hex");
}

function accountFixture(publicKeyString, { postingOverride, activeOverride } = {}) {
  return {
    posting: { key_auths: postingOverride ?? [[publicKeyString, 1]] },
    active: { key_auths: activeOverride ?? [[publicKeyString, 1]] },
  };
}

function transportFor(accountsByNode) {
  return async (url, envelope) => {
    const record = accountsByNode[url];
    const [[account]] = envelope.params;
    const found = record ? record[account] : undefined;
    return {
      status: 200,
      body: JSON.stringify({ jsonrpc: "2.0", id: envelope.id, result: [found ?? null] }),
    };
  };
}

const NODE_A = "https://node-a.example";
const NODE_B = "https://node-b.example";

test("verifies a posting-authority signature by recovering the public key", async () => {
  const key = throwawayKey();
  const pub = key.createPublic().toString();
  const message = JSON.stringify({ username: "emsenn0", type: "login", app: "ops.561.group", expiry: 1893456000, nonce: "abc" });
  const signature = signMessage(key, message);
  const transport = transportFor({
    [NODE_A]: { emsenn0: accountFixture(pub) },
    [NODE_B]: { emsenn0: accountFixture(pub) },
  });
  const result = await verifyHiveSignedMessage(
    { account: "emsenn0", message, signature, nodes: [NODE_A, NODE_B] },
    { transport },
  );
  assert.deepEqual(result, { verified: true, account: "emsenn0", publicKey: pub, role: "posting" });
});

test("verifies directly against a supplied publicKey without recovery", async () => {
  const key = throwawayKey();
  const pub = key.createPublic().toString();
  const message = "hello ops";
  const signature = signMessage(key, message);
  const transport = transportFor({
    [NODE_A]: { emsenn0: accountFixture(pub) },
    [NODE_B]: { emsenn0: accountFixture(pub) },
  });
  const result = await verifyHiveSignedMessage(
    { account: "emsenn0", message, signature, publicKey: pub, nodes: [NODE_A, NODE_B] },
    { transport },
  );
  assert.equal(result.verified, true);
  assert.equal(result.publicKey, pub);
});

test("names the active role when the key is only an active authority", async () => {
  const key = throwawayKey();
  const pub = key.createPublic().toString();
  const message = "active-role message";
  const signature = signMessage(key, message);
  const transport = transportFor({
    [NODE_A]: { emsenn0: accountFixture(pub, { postingOverride: [["STMotherposting", 1]], activeOverride: [[pub, 1]] }) },
    [NODE_B]: { emsenn0: accountFixture(pub, { postingOverride: [["STMotherposting", 1]], activeOverride: [[pub, 1]] }) },
  });
  const result = await verifyHiveSignedMessage(
    { account: "emsenn0", message, signature, nodes: [NODE_A, NODE_B] },
    { transport },
  );
  assert.equal(result.verified, true);
  assert.equal(result.role, "active");
});

test("refuses when the two nodes disagree on key_auths", async () => {
  const key = throwawayKey();
  const pub = key.createPublic().toString();
  const message = "disagreement message";
  const signature = signMessage(key, message);
  const transport = transportFor({
    [NODE_A]: { emsenn0: accountFixture(pub) },
    [NODE_B]: { emsenn0: accountFixture("STMdifferentkeyentirely00000000000000000000000000") },
  });
  const result = await verifyHiveSignedMessage(
    { account: "emsenn0", message, signature, nodes: [NODE_A, NODE_B] },
    { transport },
  );
  assert.equal(result.verified, false);
  assert.match(result.reason, /disagree/);
});

test("refuses a key that is not an authorized posting or active key", async () => {
  const key = throwawayKey();
  const otherKey = throwawayKey();
  const message = "unauthorized message";
  const signature = signMessage(key, message);
  const otherPub = otherKey.createPublic().toString();
  const transport = transportFor({
    [NODE_A]: { emsenn0: accountFixture(otherPub) },
    [NODE_B]: { emsenn0: accountFixture(otherPub) },
  });
  const result = await verifyHiveSignedMessage(
    { account: "emsenn0", message, signature, nodes: [NODE_A, NODE_B] },
    { transport },
  );
  assert.equal(result.verified, false);
  assert.match(result.reason, /not an authorized/);
});

test("refuses signature verification against the wrong supplied publicKey", async () => {
  const key = throwawayKey();
  const otherKey = throwawayKey();
  const message = "wrong key message";
  const signature = signMessage(key, message);
  const otherPub = otherKey.createPublic().toString();
  const result = await verifyHiveSignedMessage(
    { account: "emsenn0", message, signature, publicKey: otherPub, nodes: [NODE_A, NODE_B] },
    { transport: transportFor({}) },
  );
  assert.equal(result.verified, false);
  assert.match(result.reason, /does not verify/);
});

test("refuses a malformed signature string", async () => {
  const result = await verifyHiveSignedMessage(
    { account: "emsenn0", message: "hi", signature: "not-hex", nodes: [NODE_A, NODE_B] },
    { transport: transportFor({}) },
  );
  assert.equal(result.verified, false);
  assert.match(result.reason, /130-character hex/);
});

test("refuses a missing account", async () => {
  const result = await verifyHiveSignedMessage({ message: "hi", signature: "00".repeat(65) }, { transport: transportFor({}) });
  assert.equal(result.verified, false);
  assert.match(result.reason, /account must be/);
});

test("refuses when the account is not found on the nodes", async () => {
  const key = throwawayKey();
  const message = "no such account";
  const signature = signMessage(key, message);
  const result = await verifyHiveSignedMessage(
    { account: "no-such-account", message, signature, nodes: [NODE_A, NODE_B] },
    { transport: transportFor({ [NODE_A]: {}, [NODE_B]: {} }) },
  );
  assert.equal(result.verified, false);
  assert.match(result.reason, /could not read account authorities/);
});
```
## Examples
```json name="a malformed signature is refused before any network read"
{"input":{"account":"emsenn0","message":"hello ops","signature":"not-hex"},"output":{"verified":false,"reason":"signature must be a 130-character hex compact Hive signature"}}
```
```json name="a missing account is refused before any signature or network work"
{"input":{"message":"hello ops","signature":"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"},"output":{"verified":false,"reason":"account must be a non-empty string"}}
```
## Traceability
- `recovers-or-verifies-the-signature` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-keychain-signbuffer-sha256-digest`, `primitives-exist-once`
- `cross-reads-account-authority-from-two-nodes` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-api-get-accounts`
- `names-the-authorized-role` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-api-get-accounts`
- `injectable-network-call` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `json-in-json-out` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `refuses-node-disagreement` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `hive-condenser-api-get-accounts`
- `no-second-crypto-implementation` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `primitives-exist-once`
- `no-credential-use` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `fabricate-do-not-hand-write`
