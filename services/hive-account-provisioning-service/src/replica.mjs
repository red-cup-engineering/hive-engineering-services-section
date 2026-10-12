import { KEY_ROLES, PrivateKey, deriveRoleKey } from "@red-cup-engineering/hive-blockchain-client-service/keys.mjs";

/**
 * The vault on two hosts. Its home holds every account's secrets in plaintext; the replica (vault.mjs
 * `sealedVault`) holds the same files sealed. Replicating is a reconcile: each secret the home holds and the
 * replica lacks is sealed into the replica, and nothing the replica holds is rewritten. A restore drill proves
 * the replica alone opens the account: its posting key (and the master password's derivation of it) must meet
 * the account's posting authority on chain.
 */

/** The files of an account that are secrets: its master password and each role key. */
export const SECRET_FILES = Object.freeze(["master-password", ...KEY_ROLES.map((role) => `${role}.wif`)]);

/** Seal into the replica what the home holds of one account and the replica lacks. `{ state, sealed }`. */
export async function replicateAccount(vault, replica, account, { dryRun = false } = {}) {
  const sealed = [];
  for (const file of SECRET_FILES) {
    if (await replica.has(account, file)) continue;
    const value = await vault.read(account, file);
    if (!value) continue;
    if (!dryRun) await replica.write(account, { [file]: value });
    sealed.push(file);
  }
  const state = !sealed.length ? "current" : dryRun ? "would-seal" : "sealed";
  return { state, replica: replica.describe, ...(sealed.length ? { sealed } : {}) };
}

/** Every account the home holds, replicated. */
export async function replicateVault(vault, replica, options = {}) {
  const rows = [];
  for (const account of await vault.accounts()) rows.push({ account, ...(await replicateAccount(vault, replica, account, options)) });
  return rows;
}

const publicOf = (wif) => PrivateKey.from(wif).createPublic().toString();

/**
 * Whether the replica alone opens `account` on chain: its posting key, or the posting key its master password
 * derives, meets the account's posting authority. Public facts only in the result.
 */
export async function drillReplica({ account, replica, hive }) {
  const [onChain] = await hive({}).getAccounts([account]);
  if (!onChain) throw new Error(`${account} is not a Hive account`);
  const password = await replica.read(account, "master-password");
  const stored = await replica.read(account, "posting.wif");
  const posting = stored ?? (password ? deriveRoleKey(account, "posting", password).toString() : null);
  if (!posting) throw new Error(`the replica at ${replica.describe} holds no posting key or master password for ${account}`);
  const key = publicOf(posting);
  const weight = Number(onChain.posting.key_auths.find(([candidate]) => candidate === key)?.[1] ?? 0);
  return {
    account, replica: replica.describe, posting: key, opens: weight >= Number(onChain.posting.weight_threshold ?? 1),
    masterPassword: password ? (deriveRoleKey(account, "posting", password).createPublic().toString() === key ? "derives-posting" : "derives-another-key") : "absent",
  };
}
