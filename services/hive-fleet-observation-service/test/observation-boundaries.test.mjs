import assert from "node:assert/strict";
import test from "node:test";
import { projectHiveFleetObservation } from "../src/fleet-observation.mjs";

const ts = "2026-10-10T12:00:00.000Z";
const observe = (accounts, extra = {}) => projectHiveFleetObservation({ ts, accounts, ...extra }, "fixture-source");
const counters = (value) => ({
  account: "fixture",
  voting: { votesPlanned: value, votesBroadcast: value, votesSkipped: value, execution: { errors: value } },
  trading: { tradesPlanned: value, tradesExecuted: value, lpPlanned: value, lpExecuted: value },
});

test("every missing execution count remains null, while observed zero remains zero", () => {
  for (const [source, expected] of [[{ account: "fixture" }, null], [counters(0), 0]]) {
    const observation = observe([source]);
    assert.deepEqual(observation.accounts[0].voting, { planned: expected, broadcast: expected, skipped: expected, errors: expected });
    for (const field of ["planned", "executed", "liquidityPlanned", "liquidityExecuted"]) assert.equal(observation.accounts[0].trading[field], expected);
    for (const value of Object.values(observation.execution)) assert.equal(value, expected);
  }
});

test("malformed counts never coerce into observations or complete execution totals", () => {
  for (const value of [undefined, null, true, false, "0", "3", "", -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const observation = observe([counters(value)]);
    for (const count of Object.values(observation.accounts[0].voting)) assert.equal(count, null, String(value));
    for (const field of ["planned", "executed", "liquidityPlanned", "liquidityExecuted"]) assert.equal(observation.accounts[0].trading[field], null, String(value));
    for (const count of Object.values(observation.execution)) assert.equal(count, null, String(value));
  }
});

test("safe execution totals survive and overflow or any unknown contributor stays null", () => {
  const large = { ...counters(Number.MAX_SAFE_INTEGER), account: "large" };
  for (const [second, expected] of [[counters(0), Number.MAX_SAFE_INTEGER], [counters(1), null], [{ account: "unknown" }, null]]) {
    for (const value of Object.values(observe([large, second]).execution)) assert.equal(value, expected);
  }
  for (const value of Object.values(observe([counters(2), { ...counters(3), account: "other" }]).execution)) assert.equal(value, 5);
});

test("only an explicit array establishes account scope, including a valid empty fleet", () => {
  for (const accounts of [undefined, null, false, "", {}, 0]) assert.throws(() => observe(accounts), /explicit source account scope/);
  for (const tick of [undefined, null, false]) assert.throws(() => projectHiveFleetObservation(tick, "fixture"), /explicit source account scope/);
  const empty = observe([]);
  assert.equal(empty.fleet.accountCount, 0);
  assert.deepEqual(empty.aggregateLiquid, { hive: "0", hbd: "0" });
  for (const value of Object.values(empty.execution)) assert.equal(value, 0);
});

test("account scope refuses missing, malformed and duplicate identities before aggregation", () => {
  for (const account of [undefined, null, false, 0, "fixture", [], {},
    { account: undefined }, { account: null }, { account: false }, { account: 1 }, { account: [] }, { account: {} },
    { account: "" }, { account: " " }, { account: " fixture" }, { account: "fixture " }]) {
    assert.throws(() => observe([account]), /account identities/);
  }
  assert.throws(() => observe(new Array(1)), /account identities/);
  const account = { account: "fixture", trading: { hive: "2 HIVE", hbd: "1 HBD", tradesExecuted: 1 } };
  assert.throws(() => observe([account, account]), /duplicate account identity/);
  assert.throws(() => observe([account, { ...account, trading: { hive: "3 HIVE", hbd: "1 HBD", tradesExecuted: 2 } }]), /duplicate account identity/);
  const distinct = observe([account, { ...account, account: "other" }]);
  assert.equal(distinct.aggregateLiquid.hive, "4");
  assert.equal(distinct.execution.tradesExecuted, 2);
});

test("only observed booleans and lane lists establish operating conditions", () => {
  for (const value of [undefined, null, 0, 1, "false", "true", {}, []]) {
    const result = observe([{ account: "fixture", trading: { savingsExecuted: value } }], { running: value, live: value });
    assert.equal(result.fleet.running, null);
    assert.equal(result.fleet.liveFlag, null);
    assert.equal(result.accounts[0].trading.savingsExecuted, null);
  }
  for (const value of [false, true]) {
    const result = observe([{ account: "fixture", trading: { savingsExecuted: value } }], { running: value, live: value });
    assert.equal(result.fleet.running, value);
    assert.equal(result.fleet.liveFlag, value);
    assert.equal(result.accounts[0].trading.savingsExecuted, value);
  }
  for (const enabled of [undefined, null, false, "", {}, [""], [false]]) assert.equal(observe([], { enabled }).fleet.enabledLanes, null);
  assert.deepEqual(observe([], { enabled: [] }).fleet.enabledLanes, []);
  assert.deepEqual(observe([], { enabled: ["curation"] }).fleet.enabledLanes, ["curation"]);
});

test("balances retain exact decimal quantities and unknowns independently from counters", () => {
  const known = [
    { account: "large", trading: { hive: "9007199254740993 HIVE", hbd: "0 HBD", tradesExecuted: 0 } },
    { account: "small", trading: { hive: "0.0000000000000000000000001 HIVE", hbd: "0 HBD", tradesExecuted: 0 } },
  ];
  const result = observe(known);
  assert.equal(result.aggregateLiquid.hive, "9007199254740993.0000000000000000000000001");
  assert.equal(result.aggregateLiquid.hbd, "0");
  assert.equal(result.execution.tradesExecuted, 0);
  const incomplete = observe([...known, { account: "unknown" }]);
  assert.equal(incomplete.aggregateLiquid.hive, null);
  assert.equal(incomplete.aggregateLiquid.hbd, null);
  assert.equal(incomplete.execution.tradesExecuted, null);
});

test("projection does not mutate or retain the input lane array", () => {
  const tick = { ts, accounts: [{ account: "z" }, { account: "a" }], enabled: ["curation"] };
  const before = structuredClone(tick);
  const observation = projectHiveFleetObservation(tick, "fixture-source");
  assert.deepEqual(tick, before);
  assert.deepEqual(observation.accounts.map((account) => account.account), ["a", "z"]);
  observation.fleet.enabledLanes.push("fixture-lane");
  assert.deepEqual(tick, before);
  assert.equal(observation.credentialAccess, false);
  assert.equal(observation.chainMutation, false);
});
