# @sigmund-vexler strategy

## Identity

Sigmund is a "fuckaround and plan" account: aggressive, experimental, capital accumulation focus. Not a conservative curation account.

## Hive mainchain

**Curation rewards → compounding HP.**

- Receive curation rewards as HP, HIVE, and occasionally HBD.
- Convert all liquid rewards (HIVE, HBD) to HP and power up immediately.
- Rationale: compounding HP increases voting power, which increases future curation rewards. The chain rewards capital concentration; lean into it.

**Tech debt**: The auto-conversion loop (liquid → HP via powerup) is not yet implemented. Currently manual.

## Hive Engine

**HE rewards → SWAP.BTC accumulation.**

- Use all Hive Engine token income for experimental trading.
- Reserve currency: SWAP.BTC. All successful trades eventually convert to SWAP.BTC.
- Intermediate positions are acceptable; the exit target is always SWAP.BTC.
- Rationale: SWAP.BTC is the hardest asset available on Hive Engine and the most direct peg to off-chain capital. Holding SWAP.BTC preserves purchasing power across Hive volatility.

**Tech debt**: HE custom_json broadcast is not yet wired to hive-computer. Trading remains propose-only (inference visible at /run but not executable). See `hive-tics/src/trade.mts`.

## Voting

Curation decisions run via the hive-curation-topology algorithm. Autonomous voting requires sufficient HP; the dust threshold is ~2,500 VESTS (~50M rshares minimum). As of 2026-06-12, sigmund has ~259 VESTS and cannot cast non-dust votes. Requires HP delegation or power-up.

Access the agent cycle at `/run`.
