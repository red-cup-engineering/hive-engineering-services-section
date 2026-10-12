---
title: "Hive Application Framework (HAF)"
aliases:
  - HAF
---

## introduction
Not a contract layer — a *reading* framework. A `hived` node's blocks are
replayed into a Postgres database with a fork manager, and "HAF apps" are
SQL-defined APIs/indices over that database: account balances
(`balance_tracker`), block explorers (`haf_block_explorer`), reputation,
custom per-app tables. Nothing in HAF executes user-submitted code; it is
the layer a witness/API operator runs to offer rich, low-latency queries
over chain history without re-deriving them from raw blocks on every
request.

## house relevance
Named here for completeness in the smart-contracts-on-Hive survey and as
the likely shape of a paid API-node earning line (see the earning-lines
enumeration) — running a HAF-backed endpoint is a way to monetize node
operation without needing witness votes.

## see also
- [[Hive-Engine]]
- [[Magi Network (VSC)]]
