#!/usr/bin/env node
/**
 * Production one-shot for the curation system.
 *
 * `run-hive-curation-cycle.mjs` is deliberately an NDJSON operation boundary for callers that
 * supply a policy.  A timer needs the different carrier: one actual invocation using the fleet's
 * current curation policy and a machine-readable record on stdout.  Keeping that distinction here
 * prevents a deployed service from successfully doing no work merely because stdin was empty.
 */
import { runHiveCurationCycle } from "./run-hive-curation-cycle.mjs";

try {
  const record = await runHiveCurationCycle();
  process.stdout.write(`${JSON.stringify(record)}\n`);
} catch (error) {
  process.stderr.write(`execute-hive-curation-cycle: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
