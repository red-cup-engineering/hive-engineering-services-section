import { execFile } from "node:child_process";
import { access, chmod, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { openWithPassphrase, sealWithPassphrase } from "@red-cup-engineering/cryptographic-computer-data-engineering-services-section/seal";

/**
 * The Hive key vault: one 0700 directory per account, secret files 0600, never
 * inside a repository (the vault README at its root says what each file is).
 * `HIVE_KEY_VAULT` names it: a local directory, or `ssh:<host>` for the vault
 * at `~/.config/blockchain/hive` on another host, so keys held there move over
 * ssh and never touch this machine's disk.
 *
 * The vault only adds files. Writing a file that already exists is refused, so
 * a key that has been used is never replaced by accident.
 *
 * The vault's home is one host, so it also keeps a replica on another
 * (`openReplica`): the same layout with every file sealed under a passphrase,
 * `<account>/<file>.enc`, the sealed form key-management's hive-keystore
 * reads. `HIVE_KEY_REPLICA` names the replica's root, `KEY_PASSPHRASE` (or the
 * node's ~/.config/561-group/key-passphrase.env) the passphrase.
 */
export const DEFAULT_VAULT = "~/.config/blockchain/hive";
export const DEFAULT_REPLICA = "~/.config/561-group/keys-backup/hive";
const PASSPHRASE_FILE = "~/.config/561-group/key-passphrase.env";
const ACCOUNT = /^[a-z][a-z0-9.-]{2,15}$/u;
const FILE = /^[a-z][a-z0-9.-]*$/u;

function checked(account, file) {
  if (!ACCOUNT.test(account)) throw new TypeError(`not a Hive account name: ${account}`);
  if (file !== undefined && !FILE.test(file)) throw new TypeError(`not a vault file name: ${file}`);
}

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { maxBuffer: 1 << 20 }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stderr }));
      else resolve(stdout);
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

function localVault(root) {
  const dir = (account) => join(root, account);
  return {
    describe: root,
    async accounts() {
      try { return (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory() && ACCOUNT.test(entry.name)).map(({ name }) => name).sort(); } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
      }
    },
    async read(account, file) {
      checked(account, file);
      try { return (await readFile(join(dir(account), file), "utf8")).trim(); } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async write(account, files) {
      for (const file of Object.keys(files)) checked(account, file);
      await mkdir(dir(account), { recursive: true, mode: 0o700 });
      await chmod(dir(account), 0o700);
      for (const [file, value] of Object.entries(files)) {
        await writeFile(join(dir(account), file), `${value}\n`, { mode: 0o600, flag: "wx" });
      }
    },
  };
}

function sshVault(host) {
  const path = (account, file) => `"$HOME/.config/blockchain/hive/${account}/${file}"`;
  return {
    describe: `ssh:${host}:${DEFAULT_VAULT}`,
    async accounts() {
      const out = await run("ssh", ["-o", "BatchMode=yes", host, `cd "$HOME/.config/blockchain/hive" 2>/dev/null && for d in */; do echo "\${d%/}"; done || true`]);
      return out.split("\n").filter((name) => ACCOUNT.test(name)).sort();
    },
    async read(account, file) {
      checked(account, file);
      const out = await run("ssh", ["-o", "BatchMode=yes", host, `test -f ${path(account, file)} && cat ${path(account, file)} || true`]);
      return out.trim() || null;
    },
    async write(account, files) {
      for (const [file, value] of Object.entries(files)) {
        checked(account, file);
        const dir = `"$HOME/.config/blockchain/hive/${account}"`;
        await run("ssh", ["-o", "BatchMode=yes", host, `umask 077 && mkdir -p ${dir} && chmod 700 ${dir} && set -o noclobber && cat > ${path(account, file)}`], `${value}\n`);
      }
    },
  };
}

const expand = (spec, home) => (spec.startsWith("~/") ? join(home, spec.slice(2)) : spec);

export function openVault(spec = process.env.HIVE_KEY_VAULT ?? DEFAULT_VAULT, { home = homedir() } = {}) {
  if (spec.startsWith("ssh:")) return sshVault(spec.slice(4));
  return localVault(expand(spec, home));
}

/** The vault's sealed replica: reads open `<file>.enc` under the passphrase, writes seal and never overwrite. */
export function sealedVault(root, passphrase) {
  if (typeof passphrase !== "string" || !passphrase) throw new TypeError("a sealed vault needs a passphrase");
  const path = (account, file) => join(root, account, `${file}.enc`);
  return {
    describe: `sealed:${root}`,
    async has(account, file) {
      checked(account, file);
      try { await access(path(account, file)); return true; } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    },
    async read(account, file) {
      checked(account, file);
      let sealed;
      try { sealed = await readFile(path(account, file), "utf8"); } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
      return openWithPassphrase(sealed, passphrase).trim();
    },
    async write(account, files) {
      for (const file of Object.keys(files)) checked(account, file);
      await mkdir(join(root, account), { recursive: true, mode: 0o700 });
      await chmod(join(root, account), 0o700);
      for (const [file, value] of Object.entries(files)) {
        await writeFile(path(account, file), sealWithPassphrase(String(value).trim(), passphrase), { mode: 0o600, flag: "wx" });
      }
    },
  };
}

async function nodePassphrase(home) {
  try {
    const line = (await readFile(expand(PASSPHRASE_FILE, home), "utf8")).split("\n").find((row) => row.startsWith("KEY_PASSPHRASE="));
    return line ? line.slice("KEY_PASSPHRASE=".length).trim().replace(/^(["'])(.*)\1$/u, "$2") : null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

/** The replica on this host, sealed under the node's key passphrase; refused when the node holds none. */
export async function openReplica(spec = process.env.HIVE_KEY_REPLICA ?? DEFAULT_REPLICA, { home = homedir(), passphrase = process.env.KEY_PASSPHRASE } = {}) {
  const secret = passphrase || await nodePassphrase(home);
  if (!secret) throw new Error(`the Hive key vault's replica needs KEY_PASSPHRASE (or ${PASSPHRASE_FILE}); none is set`);
  return sealedVault(expand(spec, home), secret);
}
