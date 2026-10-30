// keys — WIF private keys and STM-prefixed public keys for Hive/graphene.
// PrivateKey: 32-byte secret, WIF encode/decode, secp256k1 signing.
// PublicKey: 33-byte compressed point, PREFIX+base58 encode/decode.
import { encode, decode } from "./base58.mjs";
import { sha256d, ripemd160 } from "./hash.mjs";
import { N, getPublicKey, sign } from "./secp256k1.mjs";
import { bytesToBigInt } from "./bigint.mjs";

const WIF_VERSION_BYTE = 0x80;

export class PrivateKey {
  readonly secret: Buffer;

  constructor(secret: Buffer) {
    if (!Buffer.isBuffer(secret) || secret.length !== 32) {
      throw new TypeError("secret must be a 32-byte Buffer");
    }
    const d = bytesToBigInt(secret);
    if (d <= 0n || d >= N) throw new RangeError("private key out of range (1 <= d < n)");
    this.secret = secret;
    Object.freeze(this);
  }

  static from(wif: string): PrivateKey {
    const buffer = decode(wif);
    if (buffer.length !== 37) throw new Error("invalid WIF length");
    if (buffer[0] !== WIF_VERSION_BYTE) throw new Error("private key network id mismatch");
    const checksum = buffer.subarray(buffer.length - 4);
    const body = buffer.subarray(0, buffer.length - 4);
    const checksumVerify = sha256d(body).subarray(0, 4);
    if (!checksum.equals(checksumVerify)) throw new Error("checksum mismatch");
    return new PrivateKey(Buffer.from(body.subarray(1)));
  }

  createPublic(prefix = "STM"): PublicKey {
    return PublicKey.fromBuffer(getPublicKey(this.secret), prefix);
  }

  // 65-byte compact signature: headerByte = recovery + 31, then R(32), then S(32).
  sign(digest32: Buffer): Buffer {
    const { signature, recovery } = sign(digest32, this.secret);
    return Buffer.concat([Buffer.from([recovery + 31]), signature]);
  }

  toWif(): string {
    const body = Buffer.concat([Buffer.from([WIF_VERSION_BYTE]), this.secret]);
    const checksum = sha256d(body).subarray(0, 4);
    return encode(Buffer.concat([body, checksum]));
  }

  toString(): string {
    return this.toWif();
  }
}

export class PublicKey {
  readonly key: Buffer;
  readonly prefix: string;

  constructor(key: Buffer, prefix = "STM") {
    if (!Buffer.isBuffer(key) || key.length !== 33) {
      throw new TypeError("public key must be a 33-byte compressed Buffer");
    }
    if (key[0] !== 0x02 && key[0] !== 0x03) throw new Error("invalid compression prefix");
    this.key = key;
    this.prefix = prefix;
    Object.freeze(this);
  }

  static fromBuffer(buf33: Buffer, prefix = "STM"): PublicKey {
    return new PublicKey(Buffer.from(buf33), prefix);
  }

  static from(str: string, prefix = "STM"): PublicKey {
    if (!str.startsWith(prefix)) throw new Error(`public key prefix mismatch (expected ${prefix})`);
    const body = decode(str.slice(prefix.length));
    const key = body.subarray(0, body.length - 4);
    const checksum = body.subarray(body.length - 4);
    const checksumVerify = ripemd160(key).subarray(0, 4);
    if (!checksum.equals(checksumVerify)) throw new Error("public key checksum mismatch");
    return new PublicKey(Buffer.from(key), prefix);
  }

  toBuffer(): Buffer {
    return this.key;
  }

  toString(prefix = this.prefix): string {
    const checksum = ripemd160(this.key).subarray(0, 4);
    return prefix + encode(Buffer.concat([this.key, checksum]));
  }
}
