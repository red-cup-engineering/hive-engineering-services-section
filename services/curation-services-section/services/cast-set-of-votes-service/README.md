# @red-cup-engineering/cast-set-of-votes-service

Submits a day's bounded Hive curation votes through the fleet signer, then has two public nodes
read back each exact vote operation.  A signer transaction ID is only a submitted action:
`cast` contains chain-confirmed votes, while `unconfirmed` contains broadcasts that need later
chain reconciliation.  Neither is a curation-income record; income is derived later from Hive
history when a reward balance is claimed.

## Operation

~~~js
export async function castSetOfVotes(request)
~~~

### Parameters

- request (@param {object} request.schedule A VoteScheduleRecord from schedule-set-of-votes.
 * @param {string} request.account The Hive account to sign votes as; must equal request.schedule.account.
 * @param {string} request.journalRoot Filesystem root of the owning services-section passed to createSemanticRecordJournal for the per-vote journal.
 * @param {number} [request.maxDailyBudgetPercent] Hard ceiling on the schedule's declared manaBudgetPercent (default 20); the whole cast is refused when the schedule exceeds it.
 * @param {Function} [request.sign] Injectable signer submission; default the fleet signer.
 * @param {Function} [request.confirm] Injectable two-witness confirmation; default public Hive RPC confirmation.
 * @param {readonly string[]} [request.nodes] At least two independent public Hive nodes for default confirmation.
 * @param {string} [request.now] An injectable ISO instant for castAt, for deterministic replay (default the real current time).
 * ): 

### Returns

Promise<object>: A CastSetOfVotesRecord: {type,version,account,castAt,cast,unconfirmed,refused,refusal}.

### Refusals

- TypeError: When request.account does not equal request.schedule.account.

## Command

cast-set-of-votes reads one JSON value per input line and writes one JSON value per output line.

## Examples

### refuses without casting when the schedule's budget exceeds a 20 percent ceiling

Input:

~~~json
{
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
}
~~~

Output:

~~~json
{
  "type": "CastSetOfVotesRecord",
  "version": 2,
  "account": "emsenn0",
  "castAt": "2026-09-05T00:10:00.000Z",
  "cast": [],
  "unconfirmed": [],
  "refused": [],
  "refusal": {
    "reason": "budget-exceeds-ceiling",
    "scheduleManaBudgetPercent": 50,
    "maxDailyBudgetPercent": 20
  }
}
~~~
