// wallet — the wallet stratum: classify key material, derive role keys from
// master passwords, walk the on-disk vault, identify what unlocks what
// against on-chain authorities, and sort a raw key dump into the vault.
//
// Vault layout (one directory per account; the directory NAME is the
// account name, since master-password derivation needs it):
//
//   ~/.config/blockchain/hive/<account>/*.txt
//
// Every non-empty, non-# line of every .txt file is one candidate,
// classified by shape:
//   - "STM…"                      → public key (matched directly)
//   - 51-char base58 WIF ("5…")   → private key → public key derived
//   - anything else               → candidate master password → the four
//     role keys (owner/active/posting/memo) derived per account
//
// Secrets are identified by file + line number only and never printed;
// public keys are printed in full.
import {
  readFileSync, readdirSync, statSync,
  mkdirSync, appendFileSync, writeFileSync, existsSync, chmodSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { PrivateKey, PublicKey, sha256 } from "./codecs/index.mjs";
import type { RpcClient } from "./rpc.mjs";
import { getAccounts, getKeyReferences } from "./chain.mjs";

export type WalletRole = "owner" | "active" | "posting" | "memo";
export const WALLET_ROLES: readonly WalletRole[] = ["owner", "active", "posting", "memo"];

export type Classified =
  | { readonly kind: "public-key"; readonly pubkey: string }
  | { readonly kind: "private-key"; readonly pubkey: string }
  | { readonly kind: "malformed-public-key"; readonly problem: string }
  | { readonly kind: "malformed-wif"; readonly problem: string }
  | { readonly kind: "password-candidate" };

type Log = (line: string) => void;

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// ---------- derivation ----------

/** Hive master-password key derivation: sha256(account + role + password). */
export function deriveRoleKey(account: string, role: string, password: string): PrivateKey {
  return new PrivateKey(sha256(Buffer.from(`${account}${role}${password}`, "utf8")));
}

export function classify(line: string): Classified {
  if (line.startsWith("STM")) {
    try { return { kind: "public-key", pubkey: PublicKey.from(line).toString() }; }
    catch (error) { return { kind: "malformed-public-key", problem: message(error) }; }
  }
  if (/^5[1-9A-HJ-NP-Za-km-z]{50}$/.test(line)) {
    try { return { kind: "private-key", pubkey: PrivateKey.from(line).createPublic().toString() }; }
    catch (error) { return { kind: "malformed-wif", problem: message(error) }; }
  }
  return { kind: "password-candidate" };
}

// ---------- chain ----------

interface AuthorityShape { readonly key_auths: readonly (readonly [string, number])[] }

/**
 * On-chain authorities for the named accounts, in one condenser_api
 * get_accounts call: account → (public key → role), roles owner/active/
 * posting from key_auths plus the memo key. Accounts that do not exist
 * on chain are simply absent from the result.
 */
export async function fetchAuthorities(
  rpc: RpcClient,
  accounts: readonly string[],
): Promise<Map<string, Map<string, WalletRole>>> {
  const found = new Map<string, Map<string, WalletRole>>();
  for (const acct of (await getAccounts(rpc, accounts)) ?? []) {
    const roleKeys = new Map<string, WalletRole>();
    for (const role of ["owner", "active", "posting"] as const) {
      const auth = acct[role] as AuthorityShape;
      for (const [key] of auth.key_auths) roleKeys.set(key, role);
    }
    roleKeys.set(acct["memo_key"] as string, "memo");
    found.set(acct.name, roleKeys);
  }
  return found;
}

// ---------- vault walk ----------

export function defaultVaultDir(): string {
  return path.join(os.homedir(), ".config/blockchain/hive");
}

export interface VaultEntry {
  readonly account: string;
  readonly file: string;
  readonly lineNo: number;
  readonly line: string;
}

export function readVault(vaultDir: string): { accounts: string[]; entries: VaultEntry[] } {
  const entries: VaultEntry[] = [];
  let accountDirs: string[] = [];
  try {
    accountDirs = readdirSync(vaultDir).filter((d) => statSync(path.join(vaultDir, d)).isDirectory());
  } catch {
    return { accounts: [], entries };
  }
  for (const account of accountDirs) {
    const dir = path.join(vaultDir, account);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".txt"))) {
      const lines = readFileSync(path.join(dir, file), "utf8").split("\n");
      lines.forEach((raw, i) => {
        const line = raw.trim();
        if (line === "" || line.startsWith("#")) return;
        entries.push({ account, file: path.join(account, file), lineNo: i + 1, line });
      });
    }
  }
  return { accounts: accountDirs, entries };
}

/** Account directories in the vault, excluding holding pens like `_unsorted`. */
export function vaultAccounts(vaultDir: string): string[] {
  try {
    return readdirSync(vaultDir).filter((d) => !d.startsWith("_") && statSync(path.join(vaultDir, d)).isDirectory());
  } catch {
    return [];
  }
}

// ---------- identify ----------

export interface IdentifyOptions {
  readonly rpc: RpcClient;
  readonly vaultDir?: string | undefined;
  /** Extra account names to match against, beyond the vault directories. */
  readonly accounts?: readonly string[] | undefined;
  readonly log?: Log | undefined;
  readonly error?: Log | undefined;
}

/**
 * Sort a pile of Hive key material into "what is it and which account/role
 * does it unlock," printing only public facts. Every derived/parsed public
 * key is matched against the ON-CHAIN authorities of EVERY account in the
 * vault (not just its own directory — misfiled keys are the whole problem
 * being solved). Master-password candidates are tried against every vault
 * account too. Returns a process exit code.
 */
export async function identifyKeys(options: IdentifyOptions): Promise<number> {
  const {
    rpc,
    vaultDir = defaultVaultDir(),
    accounts: extra = [],
    log = console.log,
    error = console.error,
  } = options;

  const { accounts: dirAccounts, entries } = readVault(vaultDir);
  const accounts = [...new Set([...dirAccounts, ...extra])];
  if (accounts.length === 0) {
    error(`no account directories under ${vaultDir} and no --accounts given`);
    return 1;
  }
  if (entries.length === 0) {
    error(`no key lines found under ${vaultDir}/<account>/*.txt`);
    return 1;
  }

  log(`vault: ${vaultDir}`);
  log(`accounts: ${accounts.join(", ")}`);
  const authorities = await fetchAuthorities(rpc, accounts);
  for (const name of accounts) {
    if (!authorities.has(name)) log(`  WARNING: @${name} does not exist on chain (typo in directory name?)`);
  }

  // pubkey -> [{account, role}] across the whole vault
  const lookup = new Map<string, { account: string; role: WalletRole }[]>();
  for (const [name, roleKeys] of authorities) {
    for (const [key, role] of roleKeys) {
      if (!lookup.has(key)) lookup.set(key, []);
      lookup.get(key)!.push({ account: name, role });
    }
  }

  const held = new Map<string, Map<string, string>>(accounts.map((a) => [a, new Map()])); // account -> role -> source desc
  const note = (acct: string, role: string, src: string, kind: string): void => {
    const roles = held.get(acct);
    if (roles && !roles.has(role)) roles.set(role, `${src} (${kind})`);
  };

  log("\n--- lines ---");
  for (const entry of entries) {
    const src = `${entry.file}:${entry.lineNo}`;
    const c = classify(entry.line);
    if (c.kind === "malformed-public-key" || c.kind === "malformed-wif") {
      log(`${src}  ${c.kind}: ${c.problem}`);
      continue;
    }
    if (c.kind === "public-key" || c.kind === "private-key") {
      const matches = lookup.get(c.pubkey) ?? [];
      const where = matches.length > 0
        ? matches.map((m) => `@${m.account} ${m.role.toUpperCase()}`).join(", ")
        : "no match among vault accounts";
      log(`${src}  ${c.kind} → ${c.pubkey}`);
      log(`        ${where}`);
      if (c.kind === "private-key") for (const m of matches) note(m.account, m.role, src, "wif");
      continue;
    }
    // password candidate: try as master password for every vault account
    const hits: string[] = [];
    for (const name of accounts) {
      for (const role of WALLET_ROLES) {
        try {
          const pub = deriveRoleKey(name, role, entry.line).createPublic().toString();
          for (const m of lookup.get(pub) ?? []) {
            hits.push(`@${m.account} ${m.role.toUpperCase()} (derived as ${name}/${role})`);
            note(m.account, m.role, src, "master password");
          }
        } catch { /* derived scalar out of range: not this password */ }
      }
    }
    log(`${src}  password-candidate`);
    log(`        ${hits.length > 0 ? hits.join(", ") : "derives no key matching any vault account"}`);
  }

  log("\n--- coverage ---");
  for (const name of accounts) {
    if (!authorities.has(name)) continue;
    const roles = held.get(name)!;
    log(`@${name}`);
    for (const r of WALLET_ROLES) log(`    ${roles.has(r) ? `${r} ✓ ${roles.get(r)}` : `${r} ✗`}`);
  }
  return 0;
}

// ---------- sort a dump into the vault ----------

export interface SortDumpOptions {
  readonly rpc: RpcClient;
  /** Path to the dump file: one item per line; `@accountname` lines set context hints. */
  readonly dump: string;
  readonly vaultDir?: string | undefined;
  /** Extra master-password candidate accounts, beyond @hints and vault directories. */
  readonly accounts?: readonly string[] | undefined;
  /** Apply the plan. Default false: dry run, print the plan only. */
  readonly write?: boolean | undefined;
  readonly log?: Log | undefined;
  readonly error?: Log | undefined;
}

type DumpItem = { readonly lineNo: number; readonly line: string; readonly context: string | null } & Classified;

/**
 * Take ONE file with all your Hive key material dumped in it (one item per
 * line) and sort it into the vault. WIF/STM lines are reverse-looked-up on
 * chain (account_by_key_api.get_key_references) — no hints needed; master
 * passwords are tried against every @hint, vault directory, and `accounts`
 * entry. An unverifiable line under an @hint still files to that account
 * (marked unverified); lines attributable nowhere go to `_unsorted`.
 * Appends dedupe against lines already in the vault. DRY RUN unless
 * `write`. After a successful write, DELETE THE DUMP (shred -u <file>).
 * Returns a process exit code.
 */
export async function sortDump(options: SortDumpOptions): Promise<number> {
  const {
    rpc,
    dump,
    vaultDir = defaultVaultDir(),
    accounts: extra = [],
    write = false,
    log = console.log,
    error = console.error,
  } = options;

  // ---- parse the dump: items + @context hints ----
  const items: DumpItem[] = [];
  const hinted = new Set<string>();
  let context: string | null = null;
  readFileSync(dump, "utf8").split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    if (/^@[a-z0-9.-]{3,16}$/.test(line)) {
      context = line.slice(1);
      hinted.add(context);
      return;
    }
    items.push({ lineNo: i + 1, line, context, ...classify(line) } as DumpItem);
  });
  if (items.length === 0) { error("dump contains no key lines"); return 1; }

  const candidates = [...new Set([...hinted, ...vaultAccounts(vaultDir), ...extra])];

  // ---- derive every public key we can, then one reverse lookup ----
  const passwordDerivations = new Map<DumpItem, { account: string; role: WalletRole; pubkey: string }[]>();
  for (const item of items) {
    if (item.kind !== "password-candidate") continue;
    const derived: { account: string; role: WalletRole; pubkey: string }[] = [];
    for (const account of candidates) {
      for (const role of WALLET_ROLES) {
        try { derived.push({ account, role, pubkey: deriveRoleKey(account, role, item.line).createPublic().toString() }); }
        catch { /* out-of-range scalar: skip */ }
      }
    }
    passwordDerivations.set(item, derived);
  }
  const allPubkeys = [...new Set([
    ...items.flatMap((it) => (it.kind === "public-key" || it.kind === "private-key" ? [it.pubkey] : [])),
    ...[...passwordDerivations.values()].flat().map((d) => d.pubkey),
  ])];
  const references = new Map<string, string[]>();
  if (allPubkeys.length > 0) {
    const refs = await getKeyReferences(rpc, allPubkeys);
    allPubkeys.forEach((key, i) => references.set(key, refs[i] ?? []));
  }

  // Role naming needs full authorities; candidates are fetched too because
  // the reverse index covers owner/active/posting but NOT memo keys.
  const referencedAccounts = [...new Set([...references.values()].flat())];
  const fetchNames = [...new Set([...referencedAccounts, ...candidates])];
  const authorities = fetchNames.length > 0 ? await fetchAuthorities(rpc, fetchNames) : new Map<string, Map<string, WalletRole>>();
  const roleOf = (account: string, pubkey: string): string => authorities.get(account)?.get(pubkey) ?? "unknown-role";
  const ownersOf = (pubkey: string): string[] => [...new Set([
    ...(references.get(pubkey) ?? []),
    ...[...authorities.entries()].filter(([, keys]) => keys.has(pubkey)).map(([name]) => name),
  ])];

  // ---- attribute ----
  const plan: { item: DumpItem; account: string; label: string; verified: boolean }[] = [];
  for (const item of items) {
    if (item.kind === "malformed-public-key" || item.kind === "malformed-wif") {
      plan.push({ item, account: "_unsorted", label: `${item.kind}: ${item.problem}`, verified: false });
      continue;
    }
    if (item.kind === "public-key" || item.kind === "private-key") {
      const owners = ownersOf(item.pubkey);
      if (owners.length > 0) {
        for (const account of owners) {
          plan.push({ item, account, label: `${item.kind} → ${item.pubkey} = ${roleOf(account, item.pubkey).toUpperCase()}`, verified: true });
        }
      } else if (item.context) {
        plan.push({ item, account: item.context, label: `${item.kind} → ${item.pubkey} — no chain reference; filed by @hint, UNVERIFIED`, verified: false });
      } else {
        plan.push({ item, account: "_unsorted", label: `${item.kind} → ${item.pubkey} — no chain reference, no @hint`, verified: false });
      }
      continue;
    }
    // password candidate
    const hits = (passwordDerivations.get(item) ?? []).filter((d) => ownersOf(d.pubkey).includes(d.account));
    if (hits.length > 0) {
      const accounts = [...new Set(hits.map((h) => h.account))];
      for (const account of accounts) {
        const roles = hits.filter((h) => h.account === account).map((h) => h.role.toUpperCase()).join("+");
        plan.push({ item, account, label: `master password → ${roles}`, verified: true });
      }
    } else if (item.context) {
      plan.push({ item, account: item.context, label: "password — derives nothing on chain for any candidate; filed by @hint, UNVERIFIED", verified: false });
    } else {
      plan.push({ item, account: "_unsorted", label: "password — derives nothing on chain for any candidate, no @hint", verified: false });
    }
  }

  // ---- report / write ----
  log(`${write ? "writing" : "DRY RUN (use --write to apply)"} — vault: ${vaultDir}`);
  log(`password candidates tried against: ${candidates.join(", ") || "(none — add @hints or --accounts)"}\n`);
  // law-allow: clockDefault — provenance date in the vault comment line, not ordering
  const today = new Date().toISOString().slice(0, 10);
  let written = 0;
  for (const step of plan) {
    log(`dump:${step.item.lineNo}  ${step.label}`);
    log(`        → hive/${step.account}/keys.txt`);
    if (!write) continue;
    const dir = path.join(vaultDir, step.account);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = path.join(dir, "keys.txt");
    const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (existing.split("\n").some((l) => l.trim() === step.item.line)) {
      log("        (already in vault, skipped)");
      continue;
    }
    if (!existsSync(file)) { writeFileSync(file, "", { mode: 0o600 }); }
    appendFileSync(file, `# ${step.label} — sorted ${today}\n${step.item.line}\n`);
    chmodSync(file, 0o600);
    written += 1;
  }
  if (write) {
    log(`\n${written} item(s) written. Now DELETE the dump: shred -u ${dump}`);
    log("Then run `hive-computer wallet identify` for the coverage table.");
  }
  return 0;
}

// ---------- self-test (synthetic material only, fully offline) ----------

export function walletSelfTest(log: Log = console.log): void {
  const priv = new PrivateKey(sha256(Buffer.from("identify-hive-keys self-test", "utf8")));
  const wif = priv.toWif();
  if (PrivateKey.from(wif).toWif() !== wif) throw new Error("WIF round-trip failed");
  const pub = priv.createPublic().toString();
  if (!pub.startsWith("STM") || PublicKey.from(pub).toString() !== pub) throw new Error("pubkey round-trip failed");
  const c1 = classify(wif);
  if (c1.kind !== "private-key" || c1.pubkey !== pub) throw new Error("WIF classification failed");
  if (classify(pub).kind !== "public-key") throw new Error("pubkey classification failed");
  if (classify("some master password").kind !== "password-candidate") throw new Error("password classification failed");
  const a = deriveRoleKey("alice", "posting", "hunter2").createPublic().toString();
  const b = deriveRoleKey("alice", "posting", "hunter2").createPublic().toString();
  const c = deriveRoleKey("alice", "active", "hunter2").createPublic().toString();
  if (a !== b || a === c) throw new Error("master-password derivation not deterministic/role-distinct");
  log("self-test OK: WIF round-trip, classification, role derivation");
}
