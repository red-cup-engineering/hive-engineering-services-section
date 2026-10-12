# Design note: hive-agent layer + fleet management

Produced 2026-06-12. Captures the planned architecture for the agentic layer
above `hive-tics` and the multi-agent fleet service.

## Problem

`services/hive-tics` currently conflates two concerns:
1. **Hive transport** — public browsing, raw `/vote` execution, `/health`
2. **Agent cycle** — curation decisions, market inference, `/run` loop, key
   management, autonomous execution

These need to be separate layers.

## Planned layers

```
lib/hive-topology            ← pure math (exists)
lib/hive-curation-topology   ← curation algebra (exists)
lib/market-topology          ← market algebra (exists)
apps/hive-computer           ← RPC + key management (exists)
apps/market-computer         ← market observation + judgment (exists)

NEW: lib/hive-agent          ← single-account agent cycle library:
                               fetchCurationRun, inferTrades, observe.mts.
                               Currently split across hive-tics/src/curate.mts,
                               market.mts, trade.mts, observe.mts.

NEW: apps/hive-agent-computer ← the agent computer: hive-computer + hive-agent
                                library composed. Analogous to how hive-computer
                                wraps hive-topology.

NEW: services/hive-agent-tics ← HTTP transport for one agent: /run (curation
                                 + market dry/live cycle), /status, /schedule.
                                 Keyed to one account + key set.

NEW: services/hive-agents-tics ← fleet manager: runs N hive-agent-tics
                                  instances as a single service. Exposes a
                                  unified dashboard across all managed accounts.
                                  Routing by account name or subdomain.
```

## Naming logic

`-tics` suffix = `<domain>-computer` bound to transports (persistent HTTP
service). Singular/plural carries through:

- `hive-agent-tics` — one agent, one account
- `hive-agents-tics` — N agents, N accounts, one process

The sites (`sigmund-vexler.propolis.561.group`, `help-fund.propolis.561.group`)
are currently each running their own propolis instance. Once `hive-agents-tics`
exists, those agent accounts could be managed under a single fleet service
instead of separate systemd units.

## Execution cadence requirements

The agent cycle is not monolithic. Two distinct loops at very different rates:

- **Voting cycle**: every ~1 minute. Latency tolerant; a single POST to `/run live` completing in 2–12 seconds is fine.
- **Trading cycle**: every 5–10 seconds. The current `/run` POST model is too slow and too heavy for this — an HTTP round-trip to compute + execute a trade every 5 seconds is not viable. Trading needs an **in-process loop** with live market state, not a request/response transport.

Implication: the trading cycle cannot live inside `hive-agent-tics` as an HTTP endpoint. It needs to be a background loop in the service process, reading market state continuously and executing intents directly. The `/run` endpoint is appropriate only for the voting cycle and for human-initiated inspection. The trading loop should run autonomously inside `hive-agents-tics` with its own tick rate, separate from any HTTP surface.

## Current tech debt path

1. Extract `curate.mts`, `observe.mts`, `trade.mts` from `services/hive-tics`
   into `lib/hive-agent`.
2. Create `services/hive-agent-tics` wrapping the extracted library behind HTTP.
3. Slim `services/hive-tics` down to pure Hive transport (browse, /vote, /health).
4. Build `services/hive-agents-tics` as a multi-account fleet manager.

The propolis sites (`help-fund`, `sigmund-vexler`) and the fun-named compound
services (`propolis` = hive-tics + SWARM) are separate concerns and keep their
own service processes. `hive-agents-tics` is for managing the *agentic cycle*
across accounts, not for routing web traffic.
