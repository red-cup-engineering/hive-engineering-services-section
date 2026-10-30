// tick — per-cycle snapshot appended to a JSONL file after each live run.
import { appendJsonl } from "./jsonl.mjs";

export interface TickSnapshot {
  readonly ts: string;
  readonly currentMana: string;
  readonly maxMana: string;
  readonly hive: string;
  readonly hbd: string;
  readonly vests: string;
  readonly votesAct: number;
  readonly votesAbst: number;
  readonly tradesInferred: number;
  readonly tradesExec: number;
  readonly lpAct?: number;
  readonly lpCount?: number;
}

export function appendTickSnapshot(path: string, snapshot: TickSnapshot): void {
  appendJsonl(path, [snapshot]);
}
