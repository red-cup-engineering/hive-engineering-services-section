---
title: "Resource Credits (RC)"
aliases:
  - RC
  - Resource Credits
---

## introduction
Hive's bandwidth meter: every account has an RC pool that regenerates from
staked HP (Hive Power) the same way voting mana regenerates, and every
operation an account broadcasts costs RC. An account with too little RC
cannot broadcast at all, regardless of liquid HIVE/HBD balance — RC, not
gas, is what a Hive transaction actually spends.

## delegation
RC can be delegated between accounts (`delegate_rc` custom_json), and
`rc_api` exposes reads (`find_rc_accounts`, `get_rc_current_allocations`).
There is no single canonical open marketplace for this the way there is for
bandwidth/energy rental on some other chains — delegation happens mostly
bilaterally today (an app or guild delegating RC to its own users' accounts
so they can transact without holding their own HP). This is a thin,
real, currently-unbrokered opportunity, not an already-saturated market.

## see also
- [[Hive-Engine]]
- [[Magi Network (VSC)]]
