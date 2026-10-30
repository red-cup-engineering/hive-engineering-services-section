# Hive Engineering Services Section

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Red Cup Engineering's **Hive Engineering Services Section** owns the domain-specific source for Hive blockchain protocol clients, ledger and market integrations, account and fleet services, curation, and application integrations. Its specialized services remain separate repositories selected by this section's [submodule manifest](.gitmodules); a selected source commit does not prove an installed or independently received service.

## Read the historical protocol specifications

The retained Hive signing, serialization and read-client specifications are **one historical source set**, not three new general Engineering specifications:

- [Transaction signing and cryptography](content/text/documents/articles/notes/recovered/history/01-crypto-signing-spec.md) — secp256k1, key/address derivation and signing choices.
- [Graphene binary serialization](content/text/documents/articles/notes/recovered/history/02-serialization-spec.md) — transaction and operation encoding.
- [Hive read-side JSON-RPC](content/text/documents/articles/notes/recovered/history/03-rpc-read-spec.md) — RPC envelopes, read methods and transaction reference data.

Each records reference implementations, source-specific decisions and unresolved cases. References to former `lib/*.mjs` implementations describe the recovered source's context, **not** a currently verified module, safe cryptography implementation or interoperable service. Qualify code against current upstream Hive protocol requirements and the [current selected client service](services/hive-blockchain-client-service) before using a draft as a normative standard. The parent Engineering notes link here rather than maintaining reformatted copies.

## Other retained work

The [June 12 agent/fleet architecture](content/text/documents/articles/notes/recovered/history/2026/06/12/hive-agent-architecture.md) is a historical separation proposal, not a statement that its `-tics` services run today. The [June 15 consolidation reconnaissance](content/text/documents/articles/notes/2026/06/15/2026-06-15-hive-consolidation-recipe.md) records earlier package imports and migration suggestions; do not recreate its proposed `@emsenn/hive` package over the present service owners. The [September 26 game automation evidence](content/text/documents/articles/notes/2026/09/26/2026-09-26-note-on-web3-game-play-automation.md) reports dated on-chain observations, not current balances or running timers.

The [internal-market observation](content/text/documents/specifications/observe-hive-internal-market-work-order.md) and [signed-message verification](content/text/documents/specifications/verify-hive-signed-message-work-order.md) work orders retain their distinct requirements. Current implementations and receiving obligations belong to their own selected source repositories, including `services/hive-blockchain-client-service`, `services/hive-ledger-services-section`, and `services/verify-hive-signed-message-service`.

## Historical recovery

The earlier source restorations are held at `lib/legacy/2026-06-14-291cf22` (restore commit `291cf22`), `lib/legacy/2026-06-16-4a3582a` (`4a3582a`) and `lib/legacy/2026-06-17-0b8d657` (`0b8d657`), recovered from 561-group/bare-cedar-fog history. Those paths are custody evidence, not alternative live package owners.
