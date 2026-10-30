// secp256k1 — hand-rolled BigInt curve math for Hive/graphene signing.
// RFC6979 deterministic-k, low-S, graphene canonical-loop, recovery id.
import { hmacSha256, sha256 } from "./hash.mjs";
import { bytesToBigInt } from "./bigint.mjs";

export const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
export const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const B = 7n;
const Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;
const G = { x: Gx, y: Gy };

type Point = { x: bigint; y: bigint } | null;

function mod(x: bigint, m: bigint = P): bigint {
  const r = x % m;
  return r >= 0n ? r : r + m;
}

function inv(x: bigint, m: bigint = P): bigint {
  let [old_r, r] = [mod(x, m), m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) throw new Error("not invertible");
  return mod(old_s, m);
}

function pointAdd(a: Point, b: Point): Point {
  if (a === null) return b;
  if (b === null) return a;
  if (a.x === b.x) {
    if (a.y !== b.y) return null;
    const lam = mod(3n * a.x * a.x * inv(2n * a.y));
    const x3 = mod(lam * lam - 2n * a.x);
    return { x: x3, y: mod(lam * (a.x - x3) - a.y) };
  }
  const lam = mod((b.y - a.y) * inv(b.x - a.x));
  const x3 = mod(lam * lam - a.x - b.x);
  return { x: x3, y: mod(lam * (a.x - x3) - a.y) };
}

function scalarMul(k: bigint, point: { x: bigint; y: bigint } | null): Point {
  if (point === null) return null;
  let result: Point = null;
  let addend: Point = point;
  let scalar = mod(k, N);
  while (scalar > 0n) {
    if (scalar & 1n) result = pointAdd(result, addend);
    addend = pointAdd(addend, addend);
    scalar >>= 1n;
  }
  return result;
}

function compress(p: { x: bigint; y: bigint }): Buffer {
  const prefix = (p.y & 1n) === 0n ? 0x02 : 0x03;
  const xBuf = bigTo32(p.x);
  return Buffer.concat([Buffer.from([prefix]), xBuf]);
}

function decompress(pub33: Buffer): { x: bigint; y: bigint } {
  const x = bytesToBigInt(pub33.subarray(1));
  const ySquared = mod(x * x * x + B);
  let y = modPow(ySquared, (P + 1n) / 4n, P);
  if ((y & 1n) !== (pub33[0] === 0x02 ? 0n : 1n)) y = P - y;
  return { x, y };
}

function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  let result = 1n;
  let b = mod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = mod(result * b, m);
    b = mod(b * b, m);
    e >>= 1n;
  }
  return result;
}

function pointFromX(isYOdd: boolean, x: bigint): { x: bigint; y: bigint } | null {
  if (x >= P) return null;
  const ySquared = mod(x * x * x + B);
  let y = modPow(ySquared, (P + 1n) / 4n, P);
  if (mod(y * y) !== ySquared) return null;
  if (((y & 1n) === 1n) !== isYOdd) y = P - y;
  return { x, y };
}

function bigTo32(n: bigint): Buffer {
  const buf = Buffer.alloc(32, 0);
  let v = n;
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

// RFC6979 deterministic-k per HMAC-DRBG. Calls onK with each candidate T until it returns true.
function rfc6979K(digest32: Buffer, d: bigint, extra: number, onK: (k: bigint) => boolean): void {
  const dBuf = bigTo32(d);
  const extraBuf: Buffer = Buffer.alloc(32, 0) as unknown as Buffer;
  extraBuf[31] = extra & 0xff;
  const V: Buffer = Buffer.alloc(32, 0x01) as unknown as Buffer;
  let K: Buffer = Buffer.alloc(32, 0x00) as unknown as Buffer;
  K = hmacSha256(K, Buffer.concat([V, Buffer.from([0x00]), dBuf, digest32, extraBuf]));
  const v1 = hmacSha256(K, V);
  K = hmacSha256(K, Buffer.concat([v1, Buffer.from([0x01]), dBuf, digest32, extraBuf]));
  let V2 = hmacSha256(K, v1);
  while (true) {
    V2 = hmacSha256(K, V2);
    const T = bytesToBigInt(V2);
    if (T > 0n && T < N && onK(T)) return;
    K = hmacSha256(K, Buffer.concat([V2, Buffer.from([0x00])]));
    V2 = hmacSha256(K, V2);
  }
}

function rawSign(e: bigint, d: bigint, k: bigint): { r: bigint; s: bigint } | null {
  const R = scalarMul(k, G);
  if (R === null) return null;
  const r = mod(R.x, N);
  if (r === 0n) return null;
  let s = mod(inv(k, N) * (e + r * d), N);
  if (s === 0n) return null;
  if (s > N / 2n) s = N - s;
  return { r, s };
}

function isCanonical(sig64: Buffer): boolean {
  const d1 = sig64[0]! & 0x80;
  const d2 = (sig64[0]! & 0x7f) === 0 ? sig64[1]! & 0x80 : 0;
  const d3 = sig64[32]! & 0x80;
  const d4 = (sig64[32]! & 0x7f) === 0 ? sig64[33]! & 0x80 : 0;
  return (d1 | d2 | d3 | d4) === 0;
}

function recoverPoint(e: bigint, r: bigint, s: bigint, i: number): { x: bigint; y: bigint } | null {
  const isYOdd = (i & 1) === 1;
  const isSecondKey = (i >> 1) === 1;
  const x = isSecondKey ? r + N : r;
  if (x >= P) return null;
  const R = pointFromX(isYOdd, x);
  if (R === null) return null;
  const eNeg = mod(-e, N);
  const rInv = inv(r, N);
  const sR = scalarMul(s, R);
  const eNegG = scalarMul(eNeg, G);
  const combined = pointAdd(sR, eNegG);
  if (combined === null) return null;
  return scalarMul(rInv, combined);
}

function recoveryId(e: bigint, r: bigint, s: bigint, Qpub: { x: bigint; y: bigint }): number {
  for (let i = 0; i < 4; i++) {
    const Qp = recoverPoint(e, r, s, i);
    if (Qp !== null && Qp.x === Qpub.x && Qp.y === Qpub.y) return i;
  }
  throw new Error("unable to find valid recovery factor");
}

export function getPublicKey(secret: Buffer): Buffer {
  const d = bytesToBigInt(secret);
  const Q = scalarMul(d, G);
  if (Q === null) throw new Error("invalid private key scalar");
  return compress(Q);
}

export function sign(digest32: Buffer, secret32: Buffer): { signature: Buffer; recovery: number } {
  const e = bytesToBigInt(digest32);
  const d = bytesToBigInt(secret32);
  if (d <= 0n || d >= N) throw new Error("invalid private key scalar");
  const Qpub = scalarMul(d, G);
  if (Qpub === null) throw new Error("invalid private key scalar");

  let nonce = 0;
  while (true) {
    let candidate: { r: bigint; s: bigint } | null = null;
    rfc6979K(digest32, d, nonce, (T) => {
      const sig = rawSign(e, d, T);
      if (sig === null) return false;
      candidate = sig;
      return true;
    });
    nonce++;
    if (candidate === null) continue;
    const sig = candidate as { r: bigint; s: bigint };
    const rBuf = bigTo32(sig.r);
    const sBuf = bigTo32(sig.s);
    const rs64 = Buffer.concat([rBuf, sBuf]);
    if (!isCanonical(rs64)) continue;
    const recovery = recoveryId(e, sig.r, sig.s, Qpub);
    return { signature: rs64, recovery };
  }
}

export function verify(digest32: Buffer, signature64: Buffer, pub33: Buffer): boolean {
  const e = bytesToBigInt(digest32);
  const r = bytesToBigInt(signature64.subarray(0, 32));
  const s = bytesToBigInt(signature64.subarray(32, 64));
  if (r <= 0n || r >= N || s <= 0n || s >= N) return false;
  const Q = decompress(pub33);
  const w = inv(s, N);
  const u1 = mod(e * w, N);
  const u2 = mod(r * w, N);
  const point = pointAdd(scalarMul(u1, G), scalarMul(u2, Q));
  if (point === null) return false;
  return mod(point.x, N) === r;
}

export function recover(digest32: Buffer, signature64: Buffer, recoveryId_: number): Buffer {
  const e = bytesToBigInt(digest32);
  const r = bytesToBigInt(signature64.subarray(0, 32));
  const s = bytesToBigInt(signature64.subarray(32, 64));
  const Q = recoverPoint(e, r, s, recoveryId_);
  if (Q === null) throw new Error("could not recover point");
  return compress(Q);
}

export function hashMessage(msg: Buffer): Buffer {
  return sha256(Buffer.concat([
    Buffer.from(`\x19Hive Signed Message:\n${msg.length}`, "utf8"),
    msg,
  ]));
}
