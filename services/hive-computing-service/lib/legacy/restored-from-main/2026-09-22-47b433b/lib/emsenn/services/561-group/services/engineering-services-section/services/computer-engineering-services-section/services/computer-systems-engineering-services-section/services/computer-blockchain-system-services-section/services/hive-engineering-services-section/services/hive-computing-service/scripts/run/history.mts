// history — per-agent JSONL vote ledger; prevents re-voting across cycles.
import { appendJsonl, readJsonl } from "./jsonl.mjs";

export interface VoteRecord {
  readonly ts: string;
  readonly agent?: string | undefined;
  readonly author: string;
  readonly permlink: string;
  readonly weightBps: number;
}

export interface VoteHistory {
  readonly records: readonly VoteRecord[];
  readonly votedSet: ReadonlySet<string>;
}

export function appendVoteRecords(path: string, records: readonly VoteRecord[]): void {
  appendJsonl(path, records);
}

export function readVoteHistory(path: string): VoteHistory {
  const records = readJsonl<VoteRecord>(path);
  const votedSet = new Set<string>();
  for (const record of records) {
    votedSet.add(`${record.author}/${record.permlink}`);
  }
  return { records, votedSet };
}
