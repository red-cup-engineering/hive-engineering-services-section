import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PrivateKey } from "@red-cup-engineering/hive-blockchain-client-service/keys.mjs";
import { assertAccountName, provisionHiveAccount } from "../src/provision.mjs";
import { openVault, sealedVault } from "../src/vault.mjs";

const CREATOR_ACTIVE = new PrivateKey(Buffer.alloc(32, 7)).toString();

/** A chain of accounts; createAccount and updatePostingProfile change it as the real chain would. */
function fakeChain({ creatorBalance = "5.000 HIVE" } = {}) {
  const accounts = new Map([["group561", { name: "group561", balance: creatorBalance, posting: { key_auths: [] }, posting_json_metadata: "" }]]);
  const broadcasts = [];
  const hive = ({ account, keys = {} } = {}) => ({
    rpc: { call: async () => ({ account_creation_fee: "3.000 HIVE" }) },
    getAccounts: async (names) => names.map((name) => accounts.get(name)).filter(Boolean),
    createAccount: async ({ name, keys: publicKeys, json_metadata }) => {
      assert.equal(keys.active, CREATOR_ACTIVE);
      broadcasts.push(["account_create", account, name]);
      accounts.set(name, { name, balance: "0.000 HIVE", posting: { key_auths: [[publicKeys.posting, 1]] }, json_metadata: JSON.stringify(json_metadata), posting_json_metadata: "" });
      return { id: "tx-create" };
    },
    updatePostingProfile: async (metadata) => {
      assert.ok(keys.posting);
      broadcasts.push(["account_update2", account]);
      accounts.get(account).posting_json_metadata = JSON.stringify(metadata);
      return { id: "tx-profile" };
    },
  });
  return { hive, accounts, broadcasts };
}

async function vaultWithCreator() {
  const root = await mkdtemp(join(tmpdir(), "hive-vault-"));
  const vault = openVault(root);
  await vault.write("group561", { "active.wif": CREATOR_ACTIVE });
  return { root, vault };
}

test("account names follow the protocol rules", () => {
  assert.equal(assertAccountName("sigridsong"), "sigridsong");
  assert.equal(assertAccountName("sigrid.song"), "sigrid.song");
  for (const bad of ["si", "sigrid-", "1sigrid", "Sigrid", "sigrid..song", "ab.cdef", "a-very-long-name-x"]) assert.throws(() => assertAccountName(bad));
});

test("a free name is created with keys vaulted first, then the profile is set; a rerun changes nothing", async () => {
  const chain = fakeChain();
  const { root, vault } = await vaultWithCreator();
  const profile = { name: "Sigrid Song", website: "https://sigridsong.neocities.org" };
  const first = await provisionHiveAccount({ account: "sigridsong", creator: "group561", profile, vault, hive: chain.hive });
  assert.equal(first.state, "created");
  assert.equal(first.transaction, "tx-create");
  assert.deepEqual(first.profile, { updated: "tx-profile" });
  assert.equal((await stat(join(root, "sigridsong", "owner.wif"))).mode & 0o777, 0o600);
  assert.equal((await stat(join(root, "sigridsong"))).mode & 0o777, 0o700);
  assert.match(await readFile(join(root, "sigridsong", "master-password"), "utf8"), /^P5/u);
  assert.ok(!JSON.stringify(first).includes(await vault.read("sigridsong", "posting.wif")));

  const again = await provisionHiveAccount({ account: "sigridsong", creator: "group561", profile, vault, hive: chain.hive });
  assert.equal(again.state, "held");
  assert.equal(again.profile, "current");
  assert.equal(chain.broadcasts.length, 2);
});

test("a taken name the vault cannot open is refused", async () => {
  const chain = fakeChain();
  chain.accounts.set("sigridsong", { name: "sigridsong", posting: { key_auths: [["STM-someone-else", 1]] } });
  const { vault } = await vaultWithCreator();
  await assert.rejects(provisionHiveAccount({ account: "sigridsong", creator: "group561", vault, hive: chain.hive }), /holds no key that opens it/u);
});

test("an underfunded creator broadcasts nothing and writes no keys", async () => {
  const chain = fakeChain({ creatorBalance: "1.818 HIVE" });
  const { vault } = await vaultWithCreator();
  await assert.rejects(provisionHiveAccount({ account: "sigridsong", creator: "group561", vault, hive: chain.hive }), /costs 3.000 HIVE/u);
  assert.equal(await vault.read("sigridsong", "master-password"), null);
  assert.equal(chain.broadcasts.length, 0);
});

test("a new account's secrets are sealed into the replica before anything is broadcast; a held account's are kept there", async () => {
  const chain = fakeChain();
  const { vault } = await vaultWithCreator();
  const replica = sealedVault(await mkdtemp(join(tmpdir(), "hive-replica-")), "passphrase");
  const broadcastsAtSeal = [];
  const watched = { ...replica, write: async (account, files) => { broadcastsAtSeal.push(chain.broadcasts.length); return replica.write(account, files); } };
  const first = await provisionHiveAccount({ account: "sigridsong", creator: "group561", vault, replica: watched, hive: chain.hive });
  assert.equal(first.replica.state, "sealed");
  assert.deepEqual(first.replica.sealed, ["master-password", "owner.wif", "active.wif", "posting.wif", "memo.wif"]);
  assert.ok(broadcastsAtSeal.every((count) => count === 0));
  assert.equal(await replica.read("sigridsong", "master-password"), await vault.read("sigridsong", "master-password"));
  assert.equal((await provisionHiveAccount({ account: "sigridsong", vault, replica, hive: chain.hive })).replica.state, "current");
});

test("a dry run reports and touches nothing", async () => {
  const chain = fakeChain();
  const { vault } = await vaultWithCreator();
  const result = await provisionHiveAccount({ account: "sigridsong", creator: "group561", vault, hive: chain.hive, dryRun: true });
  assert.equal(result.state, "would-create");
  assert.equal(await vault.read("sigridsong", "master-password"), null);
});

test("the vault never replaces a file", async () => {
  const { vault } = await vaultWithCreator();
  await assert.rejects(vault.write("group561", { "active.wif": "other" }), /EEXIST/u);
});
