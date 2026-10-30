// jsonl — append-only JSONL persistence shared by the server's history and snapshot logs.
//
// The append-only JSONL fs idiom now lives in the congregated projection binding
// (@emsenn/relating/holography/projecting), where `appendWitnesses` is its
// EAVT-deduped specialization. This re-export keeps the `@emsenn/computing-with-hive`
// surface for the non-EAVT advisory logs (history, per-tick snapshots) unchanged.
// Both remain best-effort: write/read errors are swallowed, malformed lines skipped.
export { appendJsonl, readJsonl } from "@emsenn/relating/holography/projecting";
