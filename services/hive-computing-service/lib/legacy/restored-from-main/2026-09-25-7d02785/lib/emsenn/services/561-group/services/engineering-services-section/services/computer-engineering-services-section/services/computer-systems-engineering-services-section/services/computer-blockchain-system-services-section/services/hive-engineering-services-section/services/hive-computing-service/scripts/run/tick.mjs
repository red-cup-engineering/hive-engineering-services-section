// tick — per-cycle snapshot appended to a JSONL file after each live run.
import { appendJsonl } from "./jsonl.mjs";
export function appendTickSnapshot(path, snapshot) {
    appendJsonl(path, [snapshot]);
}
