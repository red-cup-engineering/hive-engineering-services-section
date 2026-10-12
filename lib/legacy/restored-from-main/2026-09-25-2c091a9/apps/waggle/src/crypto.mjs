import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;
const MAXMEM = 128 * 1024 * 1024;
function deriveKey(passphrase, salt, n, r, p) {
    return scryptSync(passphrase, salt, KEY_LEN, {
        N: n,
        r,
        p,
        maxmem: MAXMEM
    });
}
export function encryptSecret(plaintext, passphrase) {
    if (passphrase.length === 0) throw new TypeError("waggle: empty passphrase");
    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const key = deriveKey(passphrase, salt, N, R, P);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    const envelope = {
        v: 1,
        kdf: "scrypt",
        N,
        r: R,
        p: P,
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        ct: ct.toString("base64")
    };
    return JSON.stringify(envelope);
}
export function decryptSecret(envelope, passphrase) {
    let env;
    try {
        env = JSON.parse(envelope);
    } catch  {
        throw new Error("waggle: corrupt key file (not a valid envelope)");
    }
    if (env.v !== 1 || env.kdf !== "scrypt") {
        throw new Error(`waggle: unsupported key envelope (v=${String(env.v)}, kdf=${String(env.kdf)})`);
    }
    const salt = Buffer.from(env.salt, "base64");
    const iv = Buffer.from(env.iv, "base64");
    const tag = Buffer.from(env.tag, "base64");
    const ct = Buffer.from(env.ct, "base64");
    const key = deriveKey(passphrase, salt, env.N, env.r, env.p);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    try {
        return Buffer.concat([
            decipher.update(ct),
            decipher.final()
        ]).toString("utf8");
    } catch  {
        throw new Error("waggle: wrong passphrase or corrupt key file");
    }
}
export function cryptoSelfTest() {
    const secret = "5JtestWIFvalueForSelfTestOnly0000000000000000000000";
    const env = encryptSecret(secret, "correct horse battery staple");
    const back = decryptSecret(env, "correct horse battery staple");
    if (back !== secret) throw new Error("waggle: crypto self-test round-trip failed");
    let threw = false;
    try {
        decryptSecret(env, "wrong passphrase");
    } catch  {
        threw = true;
    }
    if (!threw) throw new Error("waggle: crypto self-test wrong-passphrase did not throw");
}
