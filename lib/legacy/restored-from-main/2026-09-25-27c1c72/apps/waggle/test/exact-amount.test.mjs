import test from "node:test";
import assert from "node:assert/strict";
import {
  amount,
  addAmounts,
  parseDecimalAmount,
  formatAmount,
  exactAmountString,
} from "../src/exact-amount.mjs";

test("exact amounts retain rational value through decimal decoding and rendering", () => {
  const tenth = parseDecimalAmount("0.1");
  const fifth = parseDecimalAmount(".2");
  const sum = addAmounts(amount(tenth.num, tenth.den, "HIVE"), amount(fifth.num, fifth.den, "HIVE"));
  assert.equal(exactAmountString(sum), "3/10 HIVE");
  assert.equal(formatAmount(sum, { places: 3, grouping: false }), "0.300 HIVE");
  assert.deepEqual(parseDecimalAmount("-1,200.050"), { num: -24001n, den: 20n, places: 3 });
});
