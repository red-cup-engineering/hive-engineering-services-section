import assert from "node:assert/strict";
import { test } from "node:test";
import { projectHiveFleetObservation } from "../src/fleet-observation.mjs";

test("missing execution observations remain unknown instead of zero", () => {
 const result = projectHiveFleetObservation({ ts: "2026-08-22T00:21:25.339Z", accounts: [{ account: "fixture" }] }, "fixture");
 assert.equal(result.accounts[0].trading.executed, null);
 assert.equal(result.accounts[0].trading.savingsExecuted, null);
 for (const count of Object.values(result.execution)) assert.equal(count, null);
 assert.equal(result.sourceTick.settledAt, "2026-08-22T00:21:25.339Z");
});

test("explicit zero survives and unknown accounts prevent a complete total", () => {
 const source = { ts: "2026-08-22T00:21:25.339Z", accounts: [{ account: "known", trading: { tradesExecuted: 0 } }] };
 assert.equal(projectHiveFleetObservation(source, "fixture").execution.tradesExecuted, 0);
 source.accounts.push({ account: "unknown" });
 assert.equal(projectHiveFleetObservation(source, "fixture").execution.tradesExecuted, null);
});

test("unknown account scope is refused rather than represented as an empty fleet", () => {
 assert.throws(() => projectHiveFleetObservation({ ts: "2026-08-22T00:21:25.339Z" }, "fixture"), /explicit source account scope/);
});

test("unknown operating conditions remain distinct from explicit false and empty lanes", () => {
 const unknown = projectHiveFleetObservation({ ts: "2026-08-22T00:21:25.339Z", accounts: [] }, "fixture");
 assert.deepEqual(unknown.fleet, { running: null, liveFlag: null, enabledLanes: null, accountCount: 0 });
 const observed = projectHiveFleetObservation({ ts: "2026-08-22T00:21:25.339Z", accounts: [], running: false, live: false, enabled: [] }, "fixture");
 assert.deepEqual(observed.fleet, { running: false, liveFlag: false, enabledLanes: [], accountCount: 0 });
 assert.equal(observed.execution.tradesExecuted, 0);
});
