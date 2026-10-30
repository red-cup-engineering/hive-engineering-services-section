// history — per-agent JSONL vote ledger; prevents re-voting across cycles.
import { appendJsonl, readJsonl } from "./jsonl.mjs";
export function appendVoteRecords(path, records) {
    appendJsonl(path, records);
}
export function readVoteHistory(path) {
    const records = readJsonl(path);
    const votedSet = new Set();
    for (const record of records) {
        votedSet.add(`${record.author}/${record.permlink}`);
    }
    return { records, votedSet };
}
