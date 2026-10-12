// state — the operational record and the in-memory control plane.
//
// Two things persist across the fleet's life: the *tick log* (one append-only
// JSONL line per cycle per account, the canonical per-cycle metrics recorded
// through the upstream `appendTickSnapshot`) and the *last fleet readout* (the
// full structured plan+execution of the most recent tick, for the ops surface
// to serve). The *control plane* (running / live / enabled lanes) lives in
// memory and is the single mutable authority the ops endpoints turn; locked
// lanes can never be added to it.

import path from "node:path";
import { mkdirSync } from "node:fs";

import { appendJsonl, readJsonl } from "@red-cup-engineering/feltos/persistence";
import { readJsonFile, writeFileAtomic } from "@red-cup-engineering/computer-system-engine/filesystem";
import { } from "@emsenn/computing-with-hive/scripts";

import { isLocked } from "./config.mjs";

/** The single mutable control authority the ops surface turns. Locked lanes can
 *  never enter `enabled`, whatever a caller asks. */
export class ControlPlane {
  running;
  live;
 enabled;

  constructor(config) {
    this.running = true;
    this.live = config.live;
    this.enabled = new Set(config.enabled.filter((c) => !isLocked(c)));
  }

  isEnabled(capability) {
    return !isLocked(capability) && this.enabled.has(capability);
  }

  /** Enable an UNLOCKED lane. Returns false (no-op) for a locked lane. */
  enable(capability) {
    if (isLocked(capability)) return false;
    this.enabled.add(capability);
    return true;
  }

  disable(capability) {
    this.enabled.delete(capability);
  }

  enabledList() {
    return Object.freeze([...this.enabled]);
  }
}

export function ensureDirs(store) {
  mkdirSync(store.logDir, { recursive: true });
  mkdirSync(store.stateDir, { recursive: true });
  mkdirSync(store.recordDir, { recursive: true });
  mkdirSync(store.draftsDir, { recursive: true });
}

/** Record one account's canonical per-cycle metrics through the upstream tick
 *  recorder, into a per-account JSONL in the log dir. */
export function recordAccountTick(store, account, snapshot) {
  appendJsonl(path.join(store.logDir, `${account}.ticks.jsonl`), [snapshot]);
}

/** Append the full fleet readout to the fleet tick log (canonical JSONL) and
 *  write it as the current last-readout for the ops surface (atomically). */
export function recordFleetTick(store, readout) {
  appendJsonl(path.join(store.logDir, "fleet.ticks.jsonl"), [readout]);
  writeFileAtomic(path.join(store.stateDir, "last.json"), `${JSON.stringify(readout, null, 2)}\n`);
}

export function readLastReadout(store) {
  return readJsonFile(path.join(store.stateDir, "last.json"));
}

/** Read the most recent fleet tick records (newest last). */
export function readFleetTicks(store, limit) {
  const all = readJsonl(path.join(store.logDir, "fleet.ticks.jsonl"));
  return all.slice(-limit);
}
