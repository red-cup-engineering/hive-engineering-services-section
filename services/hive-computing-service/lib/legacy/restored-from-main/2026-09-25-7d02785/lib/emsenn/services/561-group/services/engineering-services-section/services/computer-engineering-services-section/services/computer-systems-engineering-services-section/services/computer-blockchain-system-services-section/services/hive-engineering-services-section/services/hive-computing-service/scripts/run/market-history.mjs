// market-history — JSONL price ticker ledger; one snapshot per fleet cycle.
import { appendJsonl, readJsonl } from "./jsonl.mjs";
export function appendMarketSnapshot(path, snapshot) {
    appendJsonl(path, [snapshot]);
}
export function readMarketHistory(path, limit) {
    const snapshots = readJsonl(path);
    return limit !== undefined ? snapshots.slice(-limit) : snapshots;
}
