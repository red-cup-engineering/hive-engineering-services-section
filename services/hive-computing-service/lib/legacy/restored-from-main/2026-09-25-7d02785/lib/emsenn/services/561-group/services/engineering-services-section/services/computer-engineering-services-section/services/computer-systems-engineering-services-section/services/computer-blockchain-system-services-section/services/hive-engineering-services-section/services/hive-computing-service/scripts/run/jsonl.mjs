import { appendFileSync, readFileSync } from "node:fs";
/** Append durable JSON records in caller order. I/O failure is intentionally a
 * no-op because these are advisory observation logs, never transaction state. */
export function appendJsonl(path, records) {
  const rows = [...records].map(record => `${JSON.stringify(record)}\n`).join("");
  if (rows === "") return;
  try { appendFileSync(path, rows, "utf8"); } catch { /* advisory log unavailable */ }
}
/** Read valid JSONL records, ignoring malformed or unavailable historical rows. */
export function readJsonl(path) {
  try { return Object.freeze(readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).flatMap(row => { try { return [JSON.parse(row)]; } catch { return []; } })); }
  catch { return Object.freeze([]); }
}
