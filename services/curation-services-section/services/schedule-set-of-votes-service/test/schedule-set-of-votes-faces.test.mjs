import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { scheduleSetOfVotes } from "../scripts/schedule-set-of-votes.mjs";

const examples = [
  {
    "type": "JavascriptNodeOperationExample",
    "name": "schedules one preferred-tag post at max weight inside window and budget",
    "input": {
      "yieldReadout": {
        "tags": [
          {
            "tag": "proofofbrain",
            "yieldHbdPerMillionRshares": "0.1"
          }
        ],
        "accounts": {
          "emsenn0": {
            "votingManabar": {
              "maxManaRaw": "1000000000000",
              "currentManaRaw": "1000000000000"
            }
          }
        }
      },
      "account": "emsenn0",
      "candidatePosts": [
        {
          "tag": "proofofbrain",
          "symbol": "POB",
          "post": {
            "author": "alice", "permlink": "p1", "category": "hive-167922", "created": "2026-09-05T00:05:00",
            "net_rshares": "5000000", "abs_rshares": "5000000", "pending_payout_value": "0.500 HBD", "children": 3,
            "author_reputation": "100000000000", "json_metadata": "{}",
            "active_votes": [{ "voter": "v1", "rshares": "1000000" }, { "voter": "v2", "rshares": "1000000" }, { "voter": "v3", "rshares": "1000000" }, { "voter": "v4", "rshares": "1000000" }, { "voter": "v5", "rshares": "1000000" }]
          }
        }
      ],
      "policy": {
        "preferredTags": [
          "proofofbrain"
        ]
      },
      "now": "2026-09-05T00:10:00.000Z"
    },
    "output": {
      "type": "VoteScheduleRecord",
      "version": 1,
      "account": "emsenn0",
      "generatedAt": "2026-09-05T00:10:00.000Z",
      "manaBudgetRaw": "200000000000",
      "manaBudgetPercent": 20,
      "scheduled": [
        {
          "tag": "proofofbrain",
          "author": "alice",
          "permlink": "p1",
          "weight": 10000,
          "dtstart": "20260905T001000Z",
          "time": "2026-09-05T00:10:00.000Z",
          "expectedCurationReturnHbd": "997.500000000000"
        }
      ],
      "refused": []
    }
  }
];

for (const example of examples) {
  test(example.name, async () => {
    const importedOutput = await scheduleSetOfVotes(example.input);
    assert.deepEqual(importedOutput, example.output);
    const command = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/schedule-set-of-votes.mjs", import.meta.url))], {
      input: JSON.stringify(example.input) + "\n",
      encoding: "utf8",
    });
    assert.equal(command.status, 0, command.stderr);
    const commandOutput = JSON.parse(command.stdout.trim());
    assert.deepEqual(commandOutput, example.output);
    assert.deepEqual(commandOutput, importedOutput);
  });
}
