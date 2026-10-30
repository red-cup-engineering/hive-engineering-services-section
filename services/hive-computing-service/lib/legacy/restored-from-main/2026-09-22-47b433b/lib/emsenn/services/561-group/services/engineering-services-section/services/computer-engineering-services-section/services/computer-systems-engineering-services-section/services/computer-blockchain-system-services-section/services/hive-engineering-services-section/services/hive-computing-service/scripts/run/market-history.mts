// market-history — JSONL price ticker ledger; one snapshot per fleet cycle.
import { appendJsonl, readJsonl } from "./jsonl.mjs";

export interface MarketPriceSnapshot {
  readonly ts: string;
  readonly hivePriceHbd: string;
  readonly lowestAsk: string;
  readonly highestBid: string;
  readonly percentChange24h: string;
  readonly hiveVolume: string;
  readonly hbdVolume: string;
}

export function appendMarketSnapshot(path: string, snapshot: MarketPriceSnapshot): void {
  appendJsonl(path, [snapshot]);
}

export function readMarketHistory(path: string, limit?: number): readonly MarketPriceSnapshot[] {
  const snapshots = readJsonl<MarketPriceSnapshot>(path);
  return limit !== undefined ? snapshots.slice(-limit) : snapshots;
}
