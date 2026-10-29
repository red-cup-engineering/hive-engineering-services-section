# @red-cup-engineering/schedule-set-of-votes-service

Schedules a day's Hive curation votes for one account, weighting and budgeting candidate posts by policy.

## Operation

~~~js
export function scheduleSetOfVotes(request)
~~~

### Parameters

- request (@param {object} request.yieldReadout A TribeCurationYieldObservationRecord naming this account's votingManabar and each tag's yieldHbdPerMillionRshares.
 * @param {string} request.account The account to schedule votes for; must be a key of request.yieldReadout.accounts.
 * @param {readonly object[]} request.candidatePosts Two-node witnessed posts to consider: {tag,symbol,post,witnesses}.
 * @param {object} [request.price] Two-node observed chain curation price. Its rational hbdPerRshare components may be JSON decimal strings or BigInts.
 * @param {object} [request.policy] Vote policy; see DEFAULT_POLICY for every field and its default.
 * @param {string} [request.now] An injectable ISO instant for generatedAt and vote time scheduling (default the real current time).
 * ): 

### Returns

object: A VoteScheduleRecord: {type,version,account,generatedAt,manaBudgetRaw,manaBudgetPercent,scheduled,refused}.

### Refusals

- TypeError: When request.account is not a key of request.yieldReadout.accounts.

## Command

schedule-set-of-votes reads one JSON value per input line and writes one JSON value per output line.

## Examples

### schedules one preferred-tag post at max weight inside window and budget

Input:

~~~json
{
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
      "author": "alice",
      "permlink": "p1",
      "ageSeconds": 300,
      "pendingPayoutValueHbd": "0.500",
      "netRshares": 1000000
    }
  ],
  "policy": {
    "preferredTags": [
      "proofofbrain"
    ]
  },
  "now": "2026-09-05T00:10:00.000Z"
}
~~~

Output:

~~~json
{
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
      "time": "2026-09-05T00:10:00.000Z",
      "expectedCurationReturnHbd": "100000"
    }
  ],
  "refused": []
}
~~~
