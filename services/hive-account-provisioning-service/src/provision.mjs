import { randomBytes } from "node:crypto";
import { HiveClient } from "@red-cup-engineering/hive-blockchain-client-service";
import { KEY_ROLES, PrivateKey, deriveRoleKey } from "@red-cup-engineering/hive-blockchain-client-service/keys.mjs";
import { replicateAccount } from "./replica.mjs";
import { ensureResourceCredits } from "./resource-credits.mjs";
import { openVault } from "./vault.mjs";

/**
 * A Hive account the house holds. Provisioning is a reconcile: it observes the
 * chain and the vault, then does only what is missing.
 *
 * - The name is taken on chain and the vault's posting key opens it: held.
 * - The name is taken and the vault cannot open it: someone else's; refused.
 * - The name is free: the master password (an earlier attempt's, else a new
 *   one) and the role keys derived from it go into the vault first, then the
 *   creator pays the chain's account creation fee and becomes the recovery
 *   account. Keys are never broadcast into an account the vault does not hold.
 *
 * Given a `replica` (vault.mjs `openReplica`), the account's secrets are
 * sealed into it too, before anything is broadcast for a new account, so the
 * vault's home is never the only host that holds them.
 *
 * The public profile (posting_json_metadata.profile) is then kept equal to the
 * one asked for, and given `rc` (`{ comments, ceiling, from }`, `from` the
 * creator unless named), its resource credits are kept able to cover a day's
 * comments (resource-credits.mjs). Every result is public facts only: names,
 * public keys, transaction ids.
 */

/** Hive account name rules (protocol `is_valid_account_name`). */
export function assertAccountName(name) {
  const segments = String(name).split(".");
  const ok = name.length >= 3 && name.length <= 16
    && segments.every((s) => /^[a-z][a-z0-9-]*[a-z0-9]$/u.test(s) && s.length >= 3 && !s.includes("--"));
  if (!ok) throw new TypeError(`not a valid Hive account name: ${name}`);
  return name;
}

/** A Hive-convention master password: "P" + the WIF of a fresh random key. */
export const newMasterPassword = (random = randomBytes) => `P${new PrivateKey(random(32)).toString()}`;

const derive = (account, password) => Object.fromEntries(KEY_ROLES.map((role) => [role, deriveRoleKey(account, role, password)]));
const publicOf = (keys) => Object.fromEntries(Object.entries(keys).map(([role, key]) => [role, key.createPublic().toString()]));
const amount = (asset) => Number(String(asset).split(" ")[0]);
const metadata = (value) => { try { return JSON.parse(value || "{}"); } catch { return {}; } };
const sameProfile = (a = {}, b = {}) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

async function readAccount(client, name) {
  return (await client.getAccounts([name]))?.[0] ?? null;
}

async function untilOnChain(client, name, { attempts = 20, intervalMs = 1500 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const found = await readAccount(client, name);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`${name} was broadcast but is not on chain after ${attempts} reads; run again to observe it`);
}

export async function provisionHiveAccount({
  account,
  creator,
  profile,
  dryRun = false,
  vault = openVault(),
  replica = null,
  rc = null,
  hive = (options) => new HiveClient(options),
  random = randomBytes,
  notify = () => {},
} = {}) {
  assertAccountName(account);
  const reader = hive({});
  const result = { platform: "hive", account, url: `https://peakd.com/@${account}`, vault: vault.describe };
  let onChain = await readAccount(reader, account);

  if (onChain) {
    const posting = await vault.read(account, "posting.wif");
    const held = posting && onChain.posting.key_auths.some(([key]) => key === PrivateKey.from(posting).createPublic().toString());
    if (!held) throw new Error(`Hive account ${account} exists and the vault at ${vault.describe} holds no key that opens it`);
    result.state = "held";
    if (replica) result.replica = await replicateAccount(vault, replica, account, { dryRun });
  } else {
    if (!creator) throw new Error(`Hive account ${account} does not exist and no creator is named to pay for it`);
    assertAccountName(creator);
    const [payer] = await reader.getAccounts([creator]);
    const { account_creation_fee: fee } = await reader.rpc.call("condenser_api.get_chain_properties", []);
    if (!payer) throw new Error(`creator ${creator} is not a Hive account`);
    if (amount(payer.balance) < amount(fee)) {
      throw new Error(`creator ${creator} holds ${payer.balance}; creating ${account} costs ${fee}`);
    }
    if (dryRun) return { ...result, state: "would-create", creator, fee };

    const activeWif = await vault.read(creator, "active.wif");
    if (!activeWif) throw new Error(`the vault at ${vault.describe} holds no active key for creator ${creator}`);
    let password = await vault.read(account, "master-password");
    if (!password) {
      password = newMasterPassword(random);
      const keys = derive(account, password);
      await vault.write(account, {
        "master-password": password,
        ...Object.fromEntries(Object.entries(keys).map(([role, key]) => [`${role}.wif`, key.toString()])),
      });
      notify(`hive: keys for ${account} are in ${vault.describe}`);
    }
    if (replica) result.replica = await replicateAccount(vault, replica, account);
    const publicKeys = publicOf(derive(account, password));
    const creating = hive({ account: creator, keys: { active: activeWif } });
    const { id } = await creating.createAccount({ name: account, keys: publicKeys, json_metadata: profile ? { profile } : "" });
    notify(`hive: ${creator} created ${account} (transaction ${id})`);
    onChain = await untilOnChain(reader, account);
    Object.assign(result, { state: "created", creator, fee, transaction: id, publicKeys });
  }

  if (profile && !sameProfile(metadata(onChain.posting_json_metadata).profile, profile)) {
    if (dryRun) result.profile = "would-update";
    else {
      const posting = await vault.read(account, "posting.wif");
      const { id } = await hive({ account, keys: { posting } }).updatePostingProfile({ ...metadata(onChain.posting_json_metadata), profile });
      result.profile = { updated: id };
    }
  } else {
    result.profile = profile ? "current" : "none-asked";
  }
  if (rc) result.rc = await ensureResourceCredits({ account, rc: { from: creator, ...rc }, vault, hive, dryRun, notify });
  return result;
}
