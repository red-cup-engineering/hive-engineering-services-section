---
title: "Hive-Engine"
aliases:
  - Steem-Engine
  - SSC
  - hivesmartcontracts
---

## introduction
A witness-run sidechain for the Hive blockchain. A separate set of nodes
("Hive-Engine witnesses", running the open-source `hivesmartcontracts`
software) replay every `custom_json` operation addressed to it (id
`ssc-mainnet-hive` on the production sidechain) and execute the named
contract action in a sandboxed Node VM, reaching their own consensus on the
resulting state. It is where Hive's tokens, NFTs, and an AMM (`marketpools`)
actually live — L1 Hive itself has no token-issuance or general contract
primitive.

## contract shape
One self-contained JavaScript file: no `require()`, no third-party modules,
no `RegExp`. Everything comes from the injected `api` object (`api.db`,
`api.sender`, `api.owner`, `api.BigNumber`, `api.emit`, `api.assert`).
`actions.createSSC` is the one-time table-setup hook; every other exported
`actions.*` function is a callable action.

## deploying
`custom_json` payload `{contractName:"contract", contractAction:"deploy",
contractPayload:{name, code: base64(source)}}`. On the shared mainnet
sidechain, new contract code must ship in the software every witness runs —
there is no permissionless "upload arbitrary bytecode and it just runs" path
there. Anyone can run their own `hivesmartcontracts` node as a private,
fully permissionless dev/test sidechain today.

## house use
`@red-cup-engineering/hive-blockchain-client-service/engine.mjs`
(`EngineClient`) already speaks this layer for reads and for calling
existing contracts (`tokens`, `market`, `marketpools`, `nft`, `nftmarket`,
`mining`…); the house had not deployed a *new* contract to it until
MARSH-on-Hive.

## see also
- [[Magi Network (VSC)]]
- [[Decentralized Hive Fund (DHF)]]
- computer-blockchain-system-services-section/services/hive-engineering-services-section/services/hive-fleet-operations-service/content/text/documents/research/2026-09-26-smart-contracts-on-hive-2026.md
