// serialize — graphene/Hive binary serialization. Little-endian, LEB128 varints,
// STEEM/SBD symbol remapping. No imports from other hive-codecs modules.
export class ByteWriter {
  private _chunks: Buffer[] = [];

  private _push(buf: Buffer): this { this._chunks.push(buf); return this; }

  uint8(v: number): this { const b = Buffer.allocUnsafe(1); b.writeUInt8(v & 0xff, 0); return this._push(b); }
  int8(v: number): this { const b = Buffer.allocUnsafe(1); b.writeInt8(v, 0); return this._push(b); }
  uint16(v: number): this { const b = Buffer.allocUnsafe(2); b.writeUInt16LE(v & 0xffff, 0); return this._push(b); }
  int16(v: number): this { const b = Buffer.allocUnsafe(2); b.writeInt16LE(v, 0); return this._push(b); }
  uint32(v: number): this { const b = Buffer.allocUnsafe(4); b.writeUInt32LE(v >>> 0, 0); return this._push(b); }
  int32(v: number): this { const b = Buffer.allocUnsafe(4); b.writeInt32LE(v | 0, 0); return this._push(b); }

  int64(v: bigint | number): this {
    const b = Buffer.allocUnsafe(8);
    b.writeBigInt64LE(BigInt(v), 0);
    return this._push(b);
  }

  varint(value: number): this {
    let v = value >>> 0;
    do {
      let byte = v & 0x7f;
      v >>>= 7;
      if (v !== 0) byte |= 0x80;
      this.uint8(byte);
    } while (v !== 0);
    return this;
  }

  boolean(v: boolean): this { return this.uint8(v ? 0x01 : 0x00); }

  string(s: string | null | undefined): this {
    const buf = Buffer.from(s == null ? "" : String(s), "utf8");
    this.varint(buf.length);
    return this._push(buf);
  }

  bytes(buf: Uint8Array): this { return this._push(Buffer.from(buf)); }

  toBuffer(): Buffer { return Buffer.concat(this._chunks); }
}

const SYMBOL_MAP: Record<string, string> = { HIVE: "STEEM", HBD: "SBD" };
const SYMBOL_PRECISION: Record<string, number> = { HIVE: 3, HBD: 3, STEEM: 3, SBD: 3, VESTS: 6, TESTS: 3, TBD: 3 };

function wireSymbol(sym: string): string {
  return Object.prototype.hasOwnProperty.call(SYMBOL_MAP, sym) ? (SYMBOL_MAP[sym] as string) : sym;
}

export type AssetInput = string | { symbol: string; amount: number | string; precision?: number };

export function serializeAsset(asset: AssetInput): Buffer {
  let amountStr: string;
  let precision: number;
  let symbol: string;

  if (typeof asset === "string") {
    const parts = asset.trim().split(/\s+/);
    if (parts.length !== 2) throw new Error(`invalid asset string: ${JSON.stringify(asset)}`);
    amountStr = parts[0]!;
    symbol = parts[1]!;
    const dot = amountStr.indexOf(".");
    if (dot >= 0) {
      precision = amountStr.length - dot - 1;
    } else if (Object.prototype.hasOwnProperty.call(SYMBOL_PRECISION, symbol)) {
      precision = SYMBOL_PRECISION[symbol] as number;
    } else {
      precision = 0;
    }
  } else {
    symbol = asset.symbol;
    if (asset.precision != null) {
      precision = asset.precision;
    } else if (Object.prototype.hasOwnProperty.call(SYMBOL_PRECISION, symbol)) {
      precision = SYMBOL_PRECISION[symbol] as number;
    } else {
      precision = 0;
    }
    amountStr = String(asset.amount);
  }

  const intAmount = scaleDecimal(amountStr, precision);
  const w = new ByteWriter();
  w.int64(intAmount);
  w.uint8(precision);
  const symBuf = Buffer.alloc(7, 0);
  Buffer.from(wireSymbol(symbol), "ascii").copy(symBuf, 0, 0, 7);
  w.bytes(symBuf);
  return w.toBuffer();
}

function scaleDecimal(amountStr: string, precision: number): bigint {
  let s = amountStr.trim();
  let neg = false;
  if (s.startsWith("-")) { neg = true; s = s.slice(1); }
  else if (s.startsWith("+")) { s = s.slice(1); }

  const dotIdx = s.indexOf(".");
  let intPart = dotIdx >= 0 ? s.slice(0, dotIdx) : s;
  let fracPart = dotIdx >= 0 ? s.slice(dotIdx + 1) : "";
  if (intPart === "") intPart = "0";

  let scaled: bigint;
  if (fracPart.length <= precision) {
    const padded = fracPart.padEnd(precision, "0");
    scaled = BigInt(intPart + padded);
  } else {
    const keep = fracPart.slice(0, precision);
    const roundDigit = fracPart.charCodeAt(precision) - 48;
    scaled = BigInt(intPart + keep) + (roundDigit >= 5 ? 1n : 0n);
  }
  return neg ? -scaled : scaled;
}

const OPERATION_IDS: Record<string, number> = {
  vote: 0,
  comment: 1,
  transfer: 2,
  transfer_to_vesting: 3,
  withdraw_vesting: 4,
  limit_order_create: 5,
  limit_order_cancel: 6,
  feed_publish: 7,
  convert: 8,
  account_create: 9,
  account_update: 10,
  witness_update: 11,
  account_witness_vote: 12,
  account_witness_proxy: 13,
  pow: 14,
  custom: 15,
  report_over_production: 16,
  delete_comment: 17,
  custom_json: 18,
  comment_options: 19,
  set_withdraw_vesting_route: 20,
  limit_order_create2: 21,
  claim_account: 22,
  create_claimed_account: 23,
  request_account_recovery: 24,
  recover_account: 25,
  change_recovery_account: 26,
  escrow_transfer: 27,
  escrow_dispute: 28,
  escrow_release: 29,
  pow2: 30,
  escrow_approve: 31,
  transfer_to_savings: 32,
  transfer_from_savings: 33,
  cancel_transfer_from_savings: 34,
  custom_binary: 35,
  decline_voting_rights: 36,
  reset_account: 37,
  set_reset_account: 38,
  claim_reward_balance: 39,
  delegate_vesting_shares: 40,
  account_create_with_delegation: 41,
  witness_set_properties: 42,
  account_update2: 43,
  create_proposal: 44,
  update_proposal_votes: 45,
  remove_proposal: 46,
  update_proposal: 47,
  collateralized_convert: 48,
  recurrent_transfer: 49,
};

export type Operation = readonly [string, Record<string, unknown>];

type OpSerializer = (w: ByteWriter, p: Record<string, unknown>) => void;

function writePubkey(w: ByteWriter, key: unknown): void {
  if (key == null) {
    w.bytes(Buffer.alloc(33, 0));
  } else if (Buffer.isBuffer(key)) {
    w.bytes(key);
  } else {
    throw new Error(`invalid pubkey: ${JSON.stringify(key)}`);
  }
}

function serializeAuthority(w: ByteWriter, auth: Record<string, unknown>): void {
  w.uint32(Number(auth["weight_threshold"]) >>> 0);
  const accs = (auth["account_auths"] as Array<[string, number]>) ?? [];
  w.varint(accs.length);
  for (const [acc, wt] of accs) { w.string(acc); w.uint16(wt); }
  const keys = (auth["key_auths"] as Array<[unknown, number]>) ?? [];
  w.varint(keys.length);
  for (const [k, wt] of keys) { writePubkey(w, k); w.uint16(wt); }
}

function serializeOptional(w: ByteWriter, val: unknown, fn: (w: ByteWriter, v: Record<string, unknown>) => void): void {
  if (val == null) {
    w.boolean(false);
  } else {
    w.boolean(true);
    fn(w, val as Record<string, unknown>);
  }
}

function serializeCommentOptionsExtension(w: ByteWriter, ext: unknown): void {
  let variantId: number;
  let body: Record<string, unknown>;

  if (Array.isArray(ext)) {
    const [id, b] = ext as [unknown, unknown];
    variantId = id === "comment_payout_beneficiaries" ? 0 : Number(id);
    body = b as Record<string, unknown>;
  } else if (ext && typeof ext === "object" && "beneficiaries" in ext) {
    variantId = 0;
    body = ext as Record<string, unknown>;
  } else {
    throw new Error(`unsupported comment_options extension: ${JSON.stringify(ext)}`);
  }

  w.varint(variantId);
  if (variantId === 0) {
    const bens = (body["beneficiaries"] as Array<{ account: string; weight: number }>) ?? [];
    w.varint(bens.length);
    for (const ben of bens) { w.string(ben.account); w.uint16(ben.weight); }
  } else {
    throw new Error(`unsupported comment_options extension variant id ${variantId}`);
  }
}

// time_point_sec: uint32 epoch seconds. Accepts a number or an ISO string
// (same handling as serializeTransaction's expiration field).
function toEpochSeconds(v: number | string): number {
  if (typeof v === "number") return v;
  return Math.floor(new Date(v + "Z").getTime() / 1000);
}

const OP_BODY: Record<string, OpSerializer> = {
  vote(w, p) {
    w.string(p["voter"] as string);
    w.string(p["author"] as string);
    w.string(p["permlink"] as string);
    w.int16(Number(p["weight"]));
  },
  comment(w, p) {
    w.string(p["parent_author"] as string);
    w.string(p["parent_permlink"] as string);
    w.string(p["author"] as string);
    w.string(p["permlink"] as string);
    w.string(p["title"] as string);
    w.string(p["body"] as string);
    w.string(p["json_metadata"] as string);
  },
  transfer(w, p) {
    w.string(p["from"] as string);
    w.string(p["to"] as string);
    w.bytes(serializeAsset(p["amount"] as AssetInput));
    w.string(p["memo"] as string);
  },
  transfer_to_vesting(w, p) {
    w.string(p["from"] as string);
    w.string(p["to"] as string);
    w.bytes(serializeAsset(p["amount"] as AssetInput));
  },
  delete_comment(w, p) {
    w.string(p["author"] as string);
    w.string(p["permlink"] as string);
  },
  custom_json(w, p) {
    const reqAuths = (p["required_auths"] as string[]) ?? [];
    w.varint(reqAuths.length);
    for (const a of reqAuths) w.string(a);
    const reqPosting = (p["required_posting_auths"] as string[]) ?? [];
    w.varint(reqPosting.length);
    for (const a of reqPosting) w.string(a);
    w.string(p["id"] as string);
    w.string(p["json"] as string);
  },
  comment_options(w, p) {
    w.string(p["author"] as string);
    w.string(p["permlink"] as string);
    w.bytes(serializeAsset(p["max_accepted_payout"] as AssetInput));
    w.uint16(Number(p["percent_hbd"]));
    w.boolean(Boolean(p["allow_votes"]));
    w.boolean(Boolean(p["allow_curation_rewards"]));
    const extensions = (p["extensions"] as unknown[]) ?? [];
    w.varint(extensions.length);
    for (const ext of extensions) serializeCommentOptionsExtension(w, ext);
  },
  claim_reward_balance(w, p) {
    w.string(p["account"] as string);
    w.bytes(serializeAsset(p["reward_hive"] as AssetInput));
    w.bytes(serializeAsset(p["reward_hbd"] as AssetInput));
    w.bytes(serializeAsset(p["reward_vests"] as AssetInput));
  },
  withdraw_vesting(w, p) {
    w.string(p["account"] as string);
    w.bytes(serializeAsset(p["vesting_shares"] as AssetInput));
  },
  limit_order_create(w, p) {
    w.string(p["owner"] as string);
    w.uint32(Number(p["orderid"]));
    w.bytes(serializeAsset(p["amount_to_sell"] as AssetInput));
    w.bytes(serializeAsset(p["min_to_receive"] as AssetInput));
    w.boolean(Boolean(p["fill_or_kill"]));
    w.uint32(toEpochSeconds(p["expiration"] as number | string));
  },
  limit_order_cancel(w, p) {
    w.string(p["owner"] as string);
    w.uint32(Number(p["orderid"]));
  },
  convert(w, p) {
    w.string(p["owner"] as string);
    w.uint32(Number(p["requestid"]));
    w.bytes(serializeAsset(p["amount"] as AssetInput));
  },
  set_withdraw_vesting_route(w, p) {
    w.string(p["from_account"] as string);
    w.string(p["to_account"] as string);
    w.uint16(Number(p["percent"]));
    w.boolean(Boolean(p["auto_vest"]));
  },
  transfer_to_savings(w, p) {
    w.string(p["from"] as string);
    w.string(p["to"] as string);
    w.bytes(serializeAsset(p["amount"] as AssetInput));
    w.string(p["memo"] as string);
  },
  transfer_from_savings(w, p) {
    w.string(p["from"] as string);
    w.uint32(Number(p["request_id"]));
    w.string(p["to"] as string);
    w.bytes(serializeAsset(p["amount"] as AssetInput));
    w.string(p["memo"] as string);
  },
  cancel_transfer_from_savings(w, p) {
    w.string(p["from"] as string);
    w.uint32(Number(p["request_id"]));
  },
  delegate_vesting_shares(w, p) {
    w.string(p["delegator"] as string);
    w.string(p["delegatee"] as string);
    w.bytes(serializeAsset(p["vesting_shares"] as AssetInput));
  },
  collateralized_convert(w, p) {
    w.string(p["owner"] as string);
    w.uint32(Number(p["requestid"]));
    w.bytes(serializeAsset(p["amount"] as AssetInput));
  },
  recurrent_transfer(w, p) {
    w.string(p["from"] as string);
    w.string(p["to"] as string);
    w.bytes(serializeAsset(p["amount"] as AssetInput));
    w.string(p["memo"] as string);
    w.uint16(Number(p["recurrence"]));
    w.uint16(Number(p["executions"]));
    const extensions = (p["extensions"] as unknown[]) ?? [];
    if (extensions.length !== 0) {
      throw new Error("recurrent_transfer extensions not supported");
    }
    w.varint(0);
  },
  account_update2(w, p) {
    w.string(p["account"] as string);
    serializeOptional(w, p["owner"], serializeAuthority);
    serializeOptional(w, p["active"], serializeAuthority);
    serializeOptional(w, p["posting"], serializeAuthority);
    serializeOptional(w, p["memo_key"] ?? null, writePubkey);
    w.string(p["json_metadata"] as string);
    w.string(p["posting_json_metadata"] as string);
    w.varint(0);
  },
};

export function serializeOperation(op: Operation): Buffer {
  const [name, payload] = op;
  if (!Object.prototype.hasOwnProperty.call(OPERATION_IDS, name)) {
    throw new Error(`unknown operation: ${name}`);
  }
  const serializer = OP_BODY[name];
  if (!serializer) throw new Error(`operation not implemented: ${name}`);
  const w = new ByteWriter();
  w.varint(OPERATION_IDS[name] as number);
  serializer(w, payload ?? {});
  return w.toBuffer();
}

export interface TransactionInput {
  readonly ref_block_num: number;
  readonly ref_block_prefix: number;
  readonly expiration: number | string;
  readonly operations: readonly Operation[];
  readonly extensions?: readonly unknown[];
}

export function serializeTransaction(tx: TransactionInput): Buffer {
  const w = new ByteWriter();
  w.uint16(tx.ref_block_num & 0xffff);
  w.uint32(tx.ref_block_prefix >>> 0);

  w.uint32(toEpochSeconds(tx.expiration) >>> 0);

  const operations = tx.operations ?? [];
  w.varint(operations.length);
  for (const op of operations) w.bytes(serializeOperation(op));

  w.varint(0);
  return w.toBuffer();
}
