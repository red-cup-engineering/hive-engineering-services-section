/**
 * Hive curation as an operation family, so the fleet's curation duty runs in the world: one
 * verb runs one cycle for every account whose strategy carries the curation lane, from the fleet
 * config's curation block, casting through the fleet signer (which judges each vote against the
 * house's rules).
 */
import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { runHiveCurationCycle } from "../scripts/run-hive-curation-cycle.mjs";

export function hiveCurationOperations() {
  return Object.freeze([
    operation({
      verb: "hive-curation-cycle",
      summary: "Run one Hive curation cycle: observe tribe curation yield, schedule votes inside each account's mana budget, and cast them through the fleet signer.",
      reads: ["hive/chain", "hive-engine/tokens"],
      writes: ["hive/votes"],
      effects: { class: "external", replay: "coordinated", coordination: "coordination-required", deterministic: "unmeasured", totality: "unmeasured" },
      run: () => runHiveCurationCycle({}),
    }),
  ]);
}
