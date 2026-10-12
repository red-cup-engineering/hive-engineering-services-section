import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { castSetOfVotes } from "../scripts/cast-set-of-votes.mjs";

const examples = [
  {
    "type": "JavascriptNodeOperationExample",
    "name": "refuses without casting when the schedule's budget exceeds a 20 percent ceiling",
    "input": {
      "schedule": {
        "type": "VoteScheduleRecord",
        "version": 1,
        "account": "emsenn0",
        "generatedAt": "2026-09-05T00:10:00.000Z",
        "manaBudgetRaw": "500000000000",
        "manaBudgetPercent": 50,
        "scheduled": [],
        "refused": []
      },
      "account": "emsenn0",
      "journalRoot": "/nonexistent",
      "maxDailyBudgetPercent": 20,
      "now": "2026-09-05T00:10:00.000Z"
    },
    "output": {
      "type": "CastSetOfVotesRecord",
      "version": 1,
      "account": "emsenn0",
      "castAt": "2026-09-05T00:10:00.000Z",
      "cast": [],
      "refusal": {
        "reason": "budget-exceeds-ceiling",
        "scheduleManaBudgetPercent": 50,
        "maxDailyBudgetPercent": 20
      }
    }
  }
];

for (const example of examples) {
  test(example.name, async () => {
    const importedOutput = await castSetOfVotes(example.input);
    assert.deepEqual(importedOutput, example.output);
    const command = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/cast-set-of-votes.mjs", import.meta.url))], {
      input: JSON.stringify(example.input) + "\n",
      encoding: "utf8",
    });
    assert.equal(command.status, 0, command.stderr);
    const commandOutput = JSON.parse(command.stdout.trim());
    assert.deepEqual(commandOutput, example.output);
    assert.deepEqual(commandOutput, importedOutput);
  });
}
