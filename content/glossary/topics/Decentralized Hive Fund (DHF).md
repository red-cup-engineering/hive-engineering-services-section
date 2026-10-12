---
title: "Decentralized Hive Fund (DHF)"
aliases:
  - DHF
  - SPS
  - Hive Fund
  - hive.fund
---

## introduction
Hive's own built-in treasury and grants program (originally called the
"Steem Proposal System", SPS). The account `hive.fund` receives a slice of
new HIVE issuance and holds it mostly as HBD — **23,221,826 HBD and
28,115,432 HIVE**, read live 2026-09-26 via
`condenser_api.get_accounts(["hive.fund"])`.

## how a proposal works
Anyone posts a `create_proposal` (receiver account, a daily HBD pay rate, a
start/end date, and a permlink to the proposal's justification post). Hive
accounts vote proposals up by stake-weighted approval, exactly like
witnesses — HP delegated *to* an account carries that voter's proposal
votes too. Payout is automatic, per block, to every proposal above a moving
"Return Proposal" threshold, until the fund's own daily budget (roughly 1%
of the fund per day) is exhausted. Proposals below the line simply accrue no
pay; there is no application/rejection step beyond the vote itself.

## current scale (as searched 2026-09-26)
Four proposals were reported above the return line, led by an "HBD
Stabilizer" proposal at 12,000 HBD/day — DHF-funded work is a real, ongoing
income line for tool-builders on Hive, not a one-off grant program.

## house relevance
The Group's own tooling (MARSH-on-Hive, the curation cycle, the peg-ladder
market-making services, the Hive-Engine/game integrations) is exactly the
kind of maintained infrastructure the DHF funds elsewhere (see the VSC/Magi
Network DHF proposals at `ecency.com/proposals/279` and `/303`) — see the
draft proposal under hive-fleet-operations-service/content/text/documents.

## see also
- [[Hive-Engine]]
- [[Magi Network (VSC)]]
