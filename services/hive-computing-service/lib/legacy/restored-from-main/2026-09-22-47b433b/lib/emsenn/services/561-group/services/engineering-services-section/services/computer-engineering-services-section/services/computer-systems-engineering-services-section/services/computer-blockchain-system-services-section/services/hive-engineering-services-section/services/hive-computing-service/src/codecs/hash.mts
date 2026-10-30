// hash — SHA-256, RIPEMD-160, HMAC-SHA-256 using node:crypto. RIPEMD-160 gracefully
// falls back to a hand-rolled implementation when the OpenSSL 3 default provider omits it.
import crypto from "node:crypto";

export function sha256(buf: Uint8Array): Buffer {
  return crypto.createHash("sha256").update(buf).digest();
}

export function sha256d(buf: Uint8Array): Buffer {
  return sha256(sha256(buf));
}

export function hmacSha256(key: Uint8Array, msg: Uint8Array): Buffer {
  return crypto.createHmac("sha256", key).update(msg).digest();
}

const NATIVE_RIPEMD160 = (() => {
  try {
    if (!crypto.getHashes().includes("ripemd160")) return false;
    crypto.createHash("ripemd160").update(Buffer.alloc(0)).digest();
    return true;
  } catch {
    return false;
  }
})();

// Hand-rolled RIPEMD-160 for environments where OpenSSL 3 omits it.
function ripemd160Pure(input: Uint8Array): Buffer {
  const msg = Buffer.from(input);
  const KL = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
  const KR = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];
  const SL = [
    11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
    7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
    11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
    11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
    9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
  ];
  const SR = [
    8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
    9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
    9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
    15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
    8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
  ];
  const XL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
    3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
    1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
    4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13];
  const XR = [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
    6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
    15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
    8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
    12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11];

  const byteLen = msg.length;
  const bitLen = byteLen * 8;
  const padLen = ((byteLen % 64) < 56 ? 56 : 120) - (byteLen % 64);
  const total = byteLen + padLen + 8;
  const padded = Buffer.alloc(total, 0);
  msg.copy(padded, 0);
  padded[byteLen] = 0x80;
  padded.writeUInt32LE(bitLen & 0xffffffff, total - 8);
  padded.writeUInt32LE(Math.floor(bitLen / 0x100000000), total - 4);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

  const rol = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  const f = (j: number, x: number, y: number, z: number): number => {
    if (j < 16) return x ^ y ^ z;
    if (j < 32) return (x & y) | (~x & z);
    if (j < 48) return (x | ~y) ^ z;
    if (j < 64) return (x & z) | (y & ~z);
    return x ^ (y | ~z);
  };

  for (let i = 0; i < total; i += 64) {
    const X: number[] = [];
    for (let j = 0; j < 16; j++) X.push(padded.readInt32LE(i + j * 4));

    let al = h0, bl = h1, cl = h2, dl = h3, el = h4;
    let ar = h0, br = h1, cr = h2, dr = h3, er = h4;

    for (let j = 0; j < 80; j++) {
      const xl = XL[j] as number;
      const xr = XR[j] as number;
      const sl = SL[j] as number;
      const sr = SR[j] as number;
      const kl = KL[Math.floor(j / 16)] as number;
      const kr = KR[Math.floor(j / 16)] as number;
      const tl = rol((al + f(j, bl, cl, dl) + (X[xl] as number) + kl) | 0, sl) + el;
      al = el; el = dl; dl = rol(cl, 10); cl = bl; bl = tl | 0;
      const tr = rol((ar + f(79 - j, br, cr, dr) + (X[xr] as number) + kr) | 0, sr) + er;
      ar = er; er = dr; dr = rol(cr, 10); cr = br; br = tr | 0;
    }

    const t = (h1 + cl + dr) | 0;
    h1 = (h2 + dl + er) | 0;
    h2 = (h3 + el + ar) | 0;
    h3 = (h4 + al + br) | 0;
    h4 = (h0 + bl + cr) | 0;
    h0 = t;
  }

  const out = Buffer.allocUnsafe(20);
  out.writeInt32LE(h0, 0);
  out.writeInt32LE(h1, 4);
  out.writeInt32LE(h2, 8);
  out.writeInt32LE(h3, 12);
  out.writeInt32LE(h4, 16);
  return out;
}

export function ripemd160(buf: Uint8Array): Buffer {
  if (NATIVE_RIPEMD160) {
    return crypto.createHash("ripemd160").update(buf).digest();
  }
  return ripemd160Pure(buf);
}
