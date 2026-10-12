#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { HiveClient } from "@red-cup-engineering/hive-blockchain-client-service";
import { provisionHiveAccount } from "../src/provision.mjs";
import { drillReplica, replicateVault } from "../src/replica.mjs";
import { openReplica, openVault } from "../src/vault.mjs";

const USAGE = "usage: hive-account <account> [--creator <account>] [--profile <profile.json>] [--vault <dir|ssh:host>] [--replica <dir>] [--dry-run]\n"
  + "       hive-account <account> --drill [--replica <dir>]\n"
  + "       hive-account --replicate [--vault <dir|ssh:host>] [--replica <dir>] [--dry-run]\n"
  + "  Makes <account> a Hive account the house holds: creates it (paid by --creator) when the name is free,\n"
  + "  keeping its master password and role keys in the vault (HIVE_KEY_VAULT, default ~/.config/blockchain/hive)\n"
  + "  and sealed in its replica (HIVE_KEY_REPLICA, default ~/.config/561-group/keys-backup/hive), then keeps its\n"
  + "  public profile equal to --profile. Safe to run again.\n"
  + "  --drill proves the replica alone opens <account> on chain. --replicate seals every account the vault holds.";

export async function main(argv, { output = process.stdout } = {}) {
  const { values, positionals } = parseArgs({
    args: argv, allowPositionals: true,
    options: {
      creator: { type: "string" }, profile: { type: "string" }, vault: { type: "string" }, replica: { type: "string" },
      drill: { type: "boolean" }, replicate: { type: "boolean" }, "dry-run": { type: "boolean" },
    },
  });
  const replica = await openReplica(values.replica);
  let result;
  if (values.replicate) {
    if (positionals.length !== 0) throw new Error(USAGE);
    result = await replicateVault(openVault(values.vault), replica, { dryRun: values["dry-run"] });
  } else {
    if (positionals.length !== 1) throw new Error(USAGE);
    if (values.drill) {
      result = await drillReplica({ account: positionals[0], replica, hive: (options) => new HiveClient(options) });
      if (!result.opens) process.exitCode = 1;
    } else {
      const profile = values.profile ? JSON.parse(await readFile(values.profile, "utf8")) : undefined;
      result = await provisionHiveAccount({
        account: positionals[0], creator: values.creator, profile, dryRun: values["dry-run"],
        vault: openVault(values.vault), replica, notify: (message) => process.stderr.write(`${message}\n`),
      });
    }
  }
  output.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); } catch (error) { console.error(error.message ?? error); process.exitCode = 1; }
}
