import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, chmodSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { PrivateKey } from "@red-cup-engineering/hive-blockchain-client-service/keys.mjs";
import { encryptSecret, decryptSecret } from "./crypto.mjs";
export const KEYSTORE_ROLES = [
    "owner",
    "active",
    "posting",
    "memo"
];
export function defaultKeystoreRoot() {
    return path.join(os.homedir(), ".config/blockchain/hive");
}
export function keystoreDir(account, root = defaultKeystoreRoot()) {
    return path.join(root, account);
}
function plaintextPath(account, role, root) {
    return path.join(keystoreDir(account, root), `${role}.wif`);
}
function encryptedPath(account, role, root) {
    return path.join(keystoreDir(account, root), `${role}.wif.enc`);
}
function validateWif(wif) {
    try {
        PrivateKey.from(wif);
    } catch (error) {
        throw new TypeError(`waggle: invalid WIF (${error instanceof Error ? error.message : String(error)})`);
    }
}
export function setKey(account, role, wif, opts = {}) {
    const root = opts.root ?? defaultKeystoreRoot();
    validateWif(wif);
    const plain = plaintextPath(account, role, root);
    const enc = encryptedPath(account, role, root);
    if (opts.encrypt) {
        if (!opts.passphrase) throw new TypeError("waggle: setKey with encrypt requires a passphrase");
        if (existsSync(plain)) throw new Error(`waggle: ${role}.wif (plaintext) already exists; remove it before storing encrypted`);
        mkdirSync(keystoreDir(account, root), {
            recursive: true,
            mode: 0o700
        });
        writeFileSync(enc, encryptSecret(wif, opts.passphrase), {
            mode: 0o600
        });
        chmodSync(enc, 0o600);
        return;
    }
    if (existsSync(enc)) throw new Error(`waggle: ${role}.wif.enc (encrypted) already exists; remove it before storing plaintext`);
    mkdirSync(keystoreDir(account, root), {
        recursive: true,
        mode: 0o700
    });
    writeFileSync(plain, `${wif}\n`, {
        mode: 0o600
    });
    chmodSync(plain, 0o600);
}
export function loadKey(account, role, opts = {}) {
    const root = opts.root ?? defaultKeystoreRoot();
    const plain = plaintextPath(account, role, root);
    if (existsSync(plain)) {
        return readFileSync(plain, "utf8").trim();
    }
    const enc = encryptedPath(account, role, root);
    if (existsSync(enc)) {
        if (!opts.passphrase) throw new Error(`waggle: ${role} key for @${account} is encrypted; a passphrase is required`);
        return decryptSecret(readFileSync(enc, "utf8"), opts.passphrase);
    }
    throw new Error(`waggle: no ${role} key for @${account} in the key store`);
}
export function listKeys(account, root = defaultKeystoreRoot()) {
    const dir = keystoreDir(account, root);
    if (!existsSync(dir)) return [];
    const files = new Set(readdirSync(dir));
    const out = [];
    for (const role of KEYSTORE_ROLES){
        if (files.has(`${role}.wif`)) out.push({
            role,
            form: "plaintext"
        });
        else if (files.has(`${role}.wif.enc`)) out.push({
            role,
            form: "encrypted"
        });
    }
    return out;
}
export function roleStatus(account, root = defaultKeystoreRoot()) {
    const dir = keystoreDir(account, root);
    const files = existsSync(dir) ? new Set(readdirSync(dir)) : new Set();
    const status = {};
    for (const role of KEYSTORE_ROLES){
        if (files.has(`${role}.wif`)) status[role] = "plaintext";
        else if (files.has(`${role}.wif.enc`)) status[role] = "encrypted";
        else status[role] = "absent";
    }
    return status;
}
