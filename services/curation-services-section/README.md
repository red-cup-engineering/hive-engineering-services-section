# Curation Services Section

Curation Services holds the org's no-capital Hive earning loop. `observe-tribe-curation-yield-service`
produces two-node witnesses for candidate posts, curation price, and account voting mana;
`schedule-set-of-votes-service` transforms only those observations and the declared mana/author/tag
policy into bounded vote proposals; and `cast-set-of-votes-service` uses the fleet signer, then
requires two nodes to prove the exact vote operation before treating it as executed. A broadcast
that cannot be confirmed remains an explicit reconciliation item, not an earnings record. The
separate Hive ledger derives income from chain history at `claim_reward_balance`; this curation
loop never invents reward income from a vote prediction or a local journal.

`run-hive-curation-cycle-service/scripts/execute-hive-curation-cycle.mjs` is the production
one-shot: it uses the fleet's current curation policy rather than waiting for NDJSON input.
In production the cycle is the `hive-curation-cycle` verb, scheduled by the `metroplex:cold-red-gate`
clock (`metroplat-clock.timer`, `run-due` each minute, on the host whose keystore holds the fleet's
keys; the schedule lives in that metroplex's data, not an instance file); a missed occurrence is not replayed, and the verb signs through the fleet's local signer.
