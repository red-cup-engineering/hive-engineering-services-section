import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} stateDir
 * @returns {string}
 */
export function hiveLoginNoncesFilePath(stateDir) {
  return join(stateDir, "hive-login-nonces.json");
}

/**
 * Read the hive-login-nonces.json carrier. Missing file reads as no
 * outstanding challenges.
 *
 * @param {string} stateDir
 * @returns {Record<string, number>} nonce -> expiresAt (epoch ms)
 */
export function readHiveLoginNonces(stateDir) {
  try {
    const parsed = JSON.parse(readFileSync(hiveLoginNoncesFilePath(stateDir), "utf-8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

/**
 * @param {string} stateDir
 * @param {Record<string, number>} nonces
 */
export function writeHiveLoginNonces(stateDir, nonces) {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  writeFileSync(hiveLoginNoncesFilePath(stateDir), `${JSON.stringify(nonces, null, 2)}\n`, { mode: 0o600 });
}

/**
 * Mint a fresh one-time Hive login nonce, persisted under `stateDir`
 * alongside `principals.json`. Every already-expired nonce found there is
 * pruned in the same write.
 *
 * @param {{ stateDir: string, ttlMs?: number, now?: () => number, token?: () => string }} params
 * @returns {{ nonce: string, expiresAt: number }}
 */
export function mintHiveLoginNonce({ stateDir, ttlMs = 300_000, now = Date.now, token = () => randomBytes(24).toString("base64url") }) {
  const timestamp = now();
  const nonces = readHiveLoginNonces(stateDir);
  for (const [existing, expiresAt] of Object.entries(nonces)) {
    if (expiresAt <= timestamp) delete nonces[existing];
  }
  const nonce = token();
  const expiresAt = timestamp + ttlMs;
  nonces[nonce] = expiresAt;
  writeHiveLoginNonces(stateDir, nonces);
  return { nonce, expiresAt };
}

/**
 * Consume a one-time Hive login nonce: present and unexpired -> removed and
 * `true`; anything else (unknown, expired, already consumed) -> `false`,
 * with an expired entry pruned either way.
 *
 * @param {{ stateDir: string, nonce: string, now?: () => number }} params
 * @returns {boolean}
 */
export function consumeHiveLoginNonce({ stateDir, nonce, now = Date.now }) {
  if (typeof nonce !== "string" || nonce.length === 0) return false;
  const nonces = readHiveLoginNonces(stateDir);
  const expiresAt = nonces[nonce];
  const valid = typeof expiresAt === "number" && expiresAt > now();
  if (nonce in nonces) {
    delete nonces[nonce];
    writeHiveLoginNonces(stateDir, nonces);
  }
  return valid;
}
