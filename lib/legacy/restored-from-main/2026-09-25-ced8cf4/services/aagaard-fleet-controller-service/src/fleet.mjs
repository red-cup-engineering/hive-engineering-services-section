// fleet — the signing-capable client per account.
//
// The whole platform reads and writes Hive through ONE upstream boundary: the
// `HiveClient` from @red-cup-engineering/hive-blockchain-client-service. It carries
// every read (accounts, posts, order books, reward fund, history) and every
// write (vote, transfer, limit orders, Hive-Engine custom_json, claim) with
// transaction building and signing. Aagaard never rolls its own RPC, codec, or
// signer — it constructs one client per account over the on-disk key vault
// and hands it to the lanes. Keys enter the process here and only here.

import { loadHiveKey } from "@red-cup-engineering/key-management-services-section/hive-keystore";

import { HiveClient } from "@red-cup-engineering/hive-blockchain-client-service";

function readWif(keyRoot, account, role) {
  return loadHiveKey(account, role, { root: keyRoot });
}

/** Build the fleet: one signing-capable HiveClient per configured account,
 *  keyed by whichever role WIFs are present in the vault. */
export function buildFleet(config) {
  const members = new Map();
  for (const policy of config.accounts) {
    const posting = readWif(config.keyRoot, policy.account, "posting");
    const active = readWif(config.keyRoot, policy.account, "active");
    const keys = {};
    if (posting) keys["posting"] = posting;
    if (active) keys["active"] = active;
    const hive = new HiveClient({
      account: policy.account,
      ...(config.nodes ? { nodes: config.nodes } : {}),
      ...(Object.keys(keys).length > 0 ? { keys } : {}),
    });
    members.set(policy.account, Object.freeze({
      account: policy.account,
      policy,
      hive,
      hasPosting: posting !== undefined,
      hasActive: active !== undefined,
    }));
  }
  return members;
}
