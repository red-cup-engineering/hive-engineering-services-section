# @red-cup-engineering/run-hive-curation-cycle-service

Runs one bounded Hive curation cycle for every policy account: two-node observation supplies the
candidate posts and price, the selector plans votes, and each signer submission must be read back
from two nodes before it is reported as executed. Reward income is not inferred here; the Hive
ledger derives it later from chain history at `claim_reward_balance`.

## Operation

~~~js
export async function runHiveCurationCycle(request)
~~~

### Parameters

- request (@param {object} request.policy A HiveCurationPolicyRecord object (never a path; the CLI entry point reads the file and merges it in).
 * @param {typeof fetch} [request.fetchImpl] Injectable fetch implementation, for tests.
 * @param {object} [request.fixtures] Literal pre-recorded two-node observation results for deterministic replay.
 * @param {Function} [request.sign] Injectable signer submission, forwarded into castSetOfVotes.
 * @param {Function} [request.confirm] Injectable two-node chain confirmation, forwarded into castSetOfVotes.
 * @param {string} [request.now] An injectable ISO instant, for deterministic replay (default the real current time).
 * ): 

### Returns

Promise<object>: A HiveCurationCycleRunRecord: {type,version,runAt,yieldReadout,accounts,accounting}.

## Command

run-hive-curation-cycle reads one JSON value per input line and writes one JSON value per output line.

## Examples

### runs an empty-policy cycle (no tags, no accounts) and returns the empty-collections record shape

Input:

~~~json
{
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
}
~~~

Output:

~~~json
{
  "type": "HiveCurationCycleRunRecord",
  "version": 2,
  "runAt": "2026-09-05T00:10:00.000Z",
  "yieldReadout": {
    "type": "TribeCurationYieldObservationRecord",
    "version": 2,
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
~~~
