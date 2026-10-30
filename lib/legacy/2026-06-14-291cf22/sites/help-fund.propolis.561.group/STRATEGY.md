# @help-fund strategy

## Identity

Help-fund is a liquidity provisioning account. Its purpose is to provide market depth to SWAP pairs on Hive Engine, earning LP fees in exchange. It holds the group's on-chain liquidity position.

## Hive mainchain

**5 HP delegation from @michael561. Goal: earn enough to be self-sufficient.**

- Votes only on content about Hive, Hive Engine, and the HIVE/HE economy (tag filter applied at fetch time; 17 tag feeds scanned per cycle).
- Curation rewards accumulate as HP (auto-vest from delegation flow).
- **HP independence target**: accumulate enough HP from curation rewards that help-fund can vote on its own if @michael561 removes the delegation. Once self-sufficient, further liquid curation rewards (HIVE, HBD) convert to HE tokens for liquidity pooling.
- Until self-sufficient: power up all liquid rewards.

**Tech debt**: The power-up loop (claim rewards → transfer_to_vesting) is not yet automated. Currently manual.

## Hive Engine

**Liquidity pool provisioning for SWAP pairs.**

- Provide liquidity to Hive Engine Liquidity Pools (HE LP).
- Target pairs: SWAP.* pairs, especially those with SWAP.HIVE or SWAP.BTC.
- Strategy: deposit balanced positions into LP pools, earn trading fees, compound back into LP.
- LP fees accrue in the pair tokens; periodically rebalance or exit to SWAP.BTC.

**LP placement criteria** (as of 2026-06-12):
- Target pairs: those with enough *current* volume that funds placed there will actually trade, not sit idle.
- Selection is not static — Hive transactions are essentially free (for non-spam), so moving LP positions every minute to track current volume demand is feasible and desirable. No special amortization math required; just track which pairs are active right now and reposition accordingly.
- "Which pairs have liquidity" is not the question. The question is: which pairs have enough *trade flow in this window* that our LP deposit will fill, earning fees?

**Open questions**:
- What is help-fund's current HE token balance?
- Which HE pools are active with real volume right now?
- HE LP transactions use `custom_json` — not yet wired to hive-computer broadcast layer.

**Tech debt**: HE LP add/remove liquidity operations are not yet implemented. The `hive-engine-codecs` market builders exist for order book trading but LP is a separate contract interface. Needs investigation and implementation.

Access the agent cycle at `/run`.
