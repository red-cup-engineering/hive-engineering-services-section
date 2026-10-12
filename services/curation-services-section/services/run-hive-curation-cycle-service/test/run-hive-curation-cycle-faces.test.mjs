import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runHiveCurationCycle } from "../scripts/run-hive-curation-cycle.mjs";

const examples = [
  {
    "type": "JavascriptNodeOperationExample",
    "name": "runs an empty-policy cycle (no tags, no accounts) and returns the empty-collections record shape",
    "input": {
      "policy": {
        "accounts": [],
        "tags": [],
        "nodes": [
          "https://api.hive.blog",
          "https://api.openhive.network"
        ],
        "journalRoot": "/nonexistent",
        "dailyManaBudgetPercent": 20,
        "minWeight": 100,
        "maxWeight": 3000,
        "dustPendingPayoutThresholdHbd": "0.02",
        "dustWeight": 100,
        "preferredTags": [],
        "neverVoteAuthors": [],
        "curationWindowSeconds": 300,
        "curationWindowToleranceSeconds": 60,
        "maxDailyBudgetPercent": 20
      },
      "now": "2026-09-05T00:10:00.000Z",
      "fixtures": {
        "dynamicGlobalProperties": {
          "https://api.hive.blog": {
            "head_block_number": 100000
          },
          "https://api.openhive.network": {
            "head_block_number": 100000
          }
        }
      }
    },
    "output": {
      "type": "HiveCurationCycleRunRecord",
      "version": 1,
      "runAt": "2026-09-05T00:10:00.000Z",
      "yieldReadout": {
        "type": "TribeCurationYieldObservationRecord",
        "version": 1,
        "observedAt": "2026-09-05T00:10:00.000Z",
        "witnesses": [
          {
            "node": "https://api.hive.blog",
            "headBlockNumber": 100000
          },
          {
            "node": "https://api.openhive.network",
            "headBlockNumber": 100000
          }
        ],
        "tags": [],
        "accounts": {}
      },
      "accounts": {}
    }
  }
];

for (const example of examples) {
  test(example.name, async () => {
    const importedOutput = await runHiveCurationCycle(example.input);
    assert.deepEqual(importedOutput, example.output);
    const command = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/run-hive-curation-cycle.mjs", import.meta.url))], {
      input: JSON.stringify(example.input) + "\n",
      encoding: "utf8",
    });
    assert.equal(command.status, 0, command.stderr);
    const commandOutput = JSON.parse(command.stdout.trim());
    assert.deepEqual(commandOutput, example.output);
    assert.deepEqual(commandOutput, importedOutput);
  });
}
