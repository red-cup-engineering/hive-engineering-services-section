# @red-cup-engineering/hive-computing-service

Hive as a computing package downstream of the `relating -> animating -> gaming -> computing` spine.

The root callable surface is:

```ts
computeWithHive(action, token, claim?)
```

Raw chain JSON, RPC responses, keys, and HTTP bodies are boundary evidence.
They enter the package through codecs, holography, the client, or the script boundary before they are read as Hive structure.

## Category Map

| Package/module | Category role |
| --- | --- |
| `@red-cup-engineering/hive-computing-service` | Package root: admits Hive observations, curation requests, or codec-built operations as charge-backed computation results. |
| `./computing/topology` | Hive facts as relational utterances and settled topology carriers inside the computing surface. |
| `./holography` | Boundary Hive resources, especially JSON account/post/vote/follow records, projected into topology utterances. |
| `./codecs` | Free-data gates for Hive wire forms: hashes, keys, serialization, operations, transactions, and Hive Engine payloads. |
| `./computing` | Settled Hive topology read through `@emsenn/computing` observation arenas. |
| `./content`, `./curation` | Content/post observations and curation valuations derived from Hive carriers and content fitness. |
| `./market` | Hive and Hive Engine venues read as trading/market topology. |
| `./analysis`, `./logic`, `./geometry`, `./decision`, `./execution`, `./emission` | Downstream computing readings: spectra, linear resource schedules, event geometry, allocation, signed-intent traces, and exact emission laws. |
| `./rpc`, `./chain`, `./client`, `./wallet` | Host boundaries for RPC transport, chain DTO names, signing-capable clients, and local key material. |
| `./scripts` | Executable boundary morphisms for service, HTTP, or MCP adapters. Private run machinery lives under `scripts/run`. |

## Verification

```sh
pnpm --filter @red-cup-engineering/hive-computing-service run verify
```

`verify` typechecks, builds, runs the package tests, and audits the public package boundary.
