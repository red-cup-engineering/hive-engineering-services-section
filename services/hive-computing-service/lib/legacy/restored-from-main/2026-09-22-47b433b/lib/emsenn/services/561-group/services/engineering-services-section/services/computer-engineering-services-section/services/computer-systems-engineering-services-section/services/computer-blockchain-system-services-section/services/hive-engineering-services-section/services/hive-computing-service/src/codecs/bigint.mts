export function bytesToBigInt(buf: Uint8Array): bigint {
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  return n;
}
