---
title: "Magi Network (VSC)"
aliases:
  - VSC
  - vsc.eco
  - Virtual Smart Chain
---

## introduction
Hive's WASM Layer 2 — "the first truly decentralized, full-featured smart
contract system on the Hive blockchain." Contract code and state are
content-addressed on IPFS; Magi validators publish anchor records back to
Hive L1 (via `custom_json`) to keep the network in consensus. Feeless
contract calls, paid for through Hive's Resource-Credit model rather than
gas. Formerly branded "VSC" (`vsc.eco`); documentation now lives at
`docs.magi.eco` (301-redirected from `docs.vsc.eco`), while its GitHub
organization (`vsc-eco`) and npm scope (`@vsc.eco`) still carry the old
name — both names name the same project.

## writing a contract
Go (compiled with TinyGo to WASM) or AssemblyScript. Go SDK: `sdk.StateSetObject`/
`StateGetObject`/`StateDeleteObject` (own state), `ContractStateGet` (another
contract's state), `GetEnv`/`GetEnvKey` (`contract.id`, `msg.sender`,
`block.height`, `tx.id`), `GetBalance`/`HiveDraw`/`HiveTransfer`/
`HiveWithdraw` (asset movement), `ContractCall` (cross-contract, 20-deep
recursion limit), `TssCreateKey`/`TssGetKey`/`TssSignKey` (threshold-signed
keys for cross-chain custody), `Log`, `Abort`/`Revert`.

## deploying
`vsc-contract-deploy -wasmPath artifacts/main-striped.wasm -name "..."`,
~10 HBD per deployment, against an identity config holding a BLS key, a
libp2p key, and a funded Hive account's active key. A local multi-node
devnet exists (`go-vsc-node`'s `devnet-setup`/`magid`/`genesis-elector`),
needing Go, MongoDB, and a running Hive testnet node.

## calling a contract
Documented today as a web-explorer action ("Magi Blocks",
`vsc.techcoderx.com`) with a connected wallet. A JS/TS library ("Magi JS")
is referenced for wallet interop and multi-op sign/broadcast, but its exact
`custom_json` wire format for an unattended Node client was not confirmed
from public docs as of 2026-09-26 — check `github.com/vsc-eco/go-vsc-node`'s
source before relying on it.

## see also
- [[Hive-Engine]]
- computer-blockchain-system-services-section/services/hive-engineering-services-section/services/hive-fleet-operations-service/content/text/documents/research/2026-09-26-smart-contracts-on-hive-2026.md
