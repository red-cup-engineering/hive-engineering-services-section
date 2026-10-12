# Hive account provisioning

`hive-account <account> --creator <payer> [--profile p.json] [--vault dir|ssh:host] [--replica dir] [--dry-run]` makes a Hive account the house holds, and is safe to run again.

- **Account exists and the vault's posting key opens it:** held. Only the profile is kept in line.
- **Account exists and the vault can't open it:** refused. It belongs to someone else.
- **Name is free:** a Hive-convention master password and the owner, active, posting and memo keys derived from it are written to the vault and sealed into its replica **before** anything is broadcast. Then `account_create` goes out, signed with the creator's active key. The creator pays the chain's fee (3.000 HIVE as of 2026-10-02) and becomes the recovery account.

The vault follows `~/.config/blockchain/hive/<account>/` (dir 0700, files 0600, never overwritten). `ssh:<host>` keeps it on another machine. The house's vault is `ssh:cold-red-gate`, so private keys never touch the laptop's disk in plaintext. Results carry only public keys and transaction ids.

## Two hosts

The vault's home is one host, so every secret it holds is also kept on a second: the replica, `~/.config/561-group/keys-backup/hive/<account>/<file>.enc` on the laptop (`HIVE_KEY_REPLICA` or `--replica` names another root). Each file there is sealed with scrypt and AES-256-GCM under the node's `KEY_PASSPHRASE` (from the environment, else `~/.config/561-group/key-passphrase.env`). It is the sealed form of key-management's `hive-keystore`, so if cold-red-gate is lost, the house signers run unchanged with `HIVE_KEY_ROOT` set to the replica and `HIVE_KEY_PASSPHRASE` set to the passphrase.

- Provisioning keeps each account it touches in the replica. Nothing the replica holds is rewritten.
- `hive-account --replicate --vault ssh:cold-red-gate` seals every account in the vault, including ones made before the replica existed.
- `hive-account <account> --drill` is the restore drill. It opens the account from the replica alone, then checks on chain that the replica's posting key, and the one its master password derives, meet the posting authority. It exits nonzero when they don't.

## Resource credits

A new account has little Resource Credit: enough for about one comment a day, since RC regenerates over five days. Given `rc: { comments, ceiling, from }`, provisioning keeps the account able to afford `comments` comments, posts and replies alike, priced at the chain's average `comment_operation` cost.

- When its mana falls short, `from` delegates the difference. `from` is the creator unless one is named, and it signs `delegate_rc` with its posting key.
- A delegation is never larger than `ceiling`, nor larger than the RC `from` holds of its own, since received RC cannot be lent on.
- A delegation only grows here.

## Recovery and custody

Recovered from the Bare Cedar Fog machine snapshot at c677e9999ea05bf577f9355660687e56dffd3da9 into the Red Cup Hive engineering source. Provisioning, resource-credit delegation, sealed vaults, replicas and recovery drills are retained distinct capabilities. Verification here uses disposable local vaults and injected chain fixtures; no live account creation, delegation or credential migration is claimed. Deployment custody and Actor association remain host/operations responsibilities; Board-funded hiring is not established by importing this package. Existing node consumers remain migration material.
