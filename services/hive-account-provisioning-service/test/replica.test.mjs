import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deriveRoleKey } from "@red-cup-engineering/hive-blockchain-client-service/keys.mjs";
import { newMasterPassword } from "../src/provision.mjs";
import { drillReplica, replicateAccount, replicateVault } from "../src/replica.mjs";
import { openReplica, openVault, sealedVault } from "../src/vault.mjs";

const PASSPHRASE = "a passphrase only the node knows";

async function homeWith(account) {
  const vault = openVault(await mkdtemp(join(tmpdir(), "hive-home-")));
  const password = newMasterPassword(() => Buffer.alloc(32, 3));
  await vault.write(account, { "master-password": password, "posting.wif": deriveRoleKey(account, "posting", password).toString() });
  return { vault, password };
}

const chainWith = (account, password) => ({
  getAccounts: async (names) => (names.includes(account) ? [{ name: account, posting: { weight_threshold: 1, key_auths: [[deriveRoleKey(account, "posting", password).createPublic().toString(), 1]] } }] : []),
});

test("the replica holds every secret the home holds, sealed, and a second pass seals nothing", async () => {
  const { vault, password } = await homeWith("sigridsong");
  const root = await mkdtemp(join(tmpdir(), "hive-replica-"));
  const replica = sealedVault(root, PASSPHRASE);

  assert.deepEqual(await replicateAccount(vault, replica, "sigridsong", { dryRun: true }), { state: "would-seal", replica: `sealed:${root}`, sealed: ["master-password", "posting.wif"] });
  assert.deepEqual(await readdir(root), []);
  assert.deepEqual(await replicateAccount(vault, replica, "sigridsong"), { state: "sealed", replica: `sealed:${root}`, sealed: ["master-password", "posting.wif"] });
  assert.deepEqual((await readdir(join(root, "sigridsong"))).sort(), ["master-password.enc", "posting.wif.enc"]);
  assert.equal((await stat(join(root, "sigridsong"))).mode & 0o777, 0o700);
  assert.equal((await stat(join(root, "sigridsong", "master-password.enc"))).mode & 0o777, 0o600);
  // Sealed at rest: the replica's bytes never hold the secret.
  assert.ok(!(await readFile(join(root, "sigridsong", "master-password.enc"), "utf8")).includes(password));
  assert.equal(await replica.read("sigridsong", "master-password"), password);
  await assert.rejects(sealedVault(root, "another passphrase").read("sigridsong", "master-password"), /wrong passphrase/u);

  assert.deepEqual(await replicateVault(vault, replica), [{ account: "sigridsong", state: "current", replica: `sealed:${root}` }]);
});

test("a restore drill opens the account from the replica alone, and fails a replica whose key the chain does not know", async () => {
  const { vault, password } = await homeWith("sigridsong");
  const replica = sealedVault(await mkdtemp(join(tmpdir(), "hive-replica-")), PASSPHRASE);
  await replicateAccount(vault, replica, "sigridsong");
  const hive = chainWith("sigridsong", password);
  const drill = await drillReplica({ account: "sigridsong", replica, hive: () => hive });
  assert.equal(drill.opens, true);
  assert.equal(drill.masterPassword, "derives-posting");
  assert.ok(!JSON.stringify(drill).includes(password));

  const other = chainWith("sigridsong", newMasterPassword(() => Buffer.alloc(32, 9)));
  assert.equal((await drillReplica({ account: "sigridsong", replica, hive: () => other })).opens, false);
});

test("the replica opens under the node's passphrase file, and refuses to open without one", async () => {
  const home = await mkdtemp(join(tmpdir(), "hive-node-"));
  await assert.rejects(openReplica("~/replica", { home, passphrase: undefined }), /needs KEY_PASSPHRASE/u);
  await mkdir(join(home, ".config", "561-group"), { recursive: true });
  await writeFile(join(home, ".config", "561-group", "key-passphrase.env"), `KEY_PASSPHRASE="${PASSPHRASE}"\n`);
  const replica = await openReplica("~/replica", { home, passphrase: undefined });
  assert.equal(replica.describe, `sealed:${join(home, "replica")}`);
  await replica.write("sigridsong", { "posting.wif": "secret" });
  assert.equal(await sealedVault(join(home, "replica"), PASSPHRASE).read("sigridsong", "posting.wif"), "secret");
});
