---
title: Web3 Game Play Automation — What Plays Today, What It Earns, What Scaling Takes
description: Inventory of every Hive/Hive-Engine game integration in the fleet, on-chain evidence of the three games now playing on a 15-minute systemd timer (HoloZing, TerraCore, dCrops), the fourth read-only WorkerBee audit, and per-game/per-account earnings and scaling notes.
date: 2026-09-26
status: sourced-from-live-execution
---

Everything below is sourced from this session's own reads and broadcasts against live Hive and
Hive-Engine RPC nodes on 2026-09-26 (observed between 18:53 and 19:20 UTC), not from prior notes or
inferred design. Account: `michael561` unless stated otherwise (the fleet account whose
`aagaard.config.json` lanes are `games`, `holozing-rewards`, `splinterlands`, `workerbee-yield`).

## What plays automatically now (verified on chain today)

Four systemd `--user` timers on cold-red-gate, each appending one JSON line per tick to
`~/.local/state/561-group/hive-games/<game>.jsonl` via
`hive-fleet-operations-service/scripts/journal-game-tick.mjs`:

| timer | cadence | key | verified on chain today |
|---|---|---|---|
| `hive-game-holozing-rewards` | 15 min | posting | txid `9bcb2bdb431ad072b99ddf55d55680d24cb90baa`, block 63196786 |
| `hive-game-terracore` | 15 min | posting | txids `30949bbb50ddd3192250b282c5a5e50de1e0462c` (block 110257677), `a31b9c75b6e66c992ab273ac8a363e3460ea3e34` (block 110257754), `78e9079bb4f0d58fca9720985caad9737a1a432a` (block 110257802) |
| `hive-game-dcrops` | 15 min | active | plot state change confirmed by direct game-state read on two independent Hive-Engine providers (land 472218 plot 0: empty → "Artichoke", `plantedAtUnix` 1790333622) |
| `hive-game-workerbee-audit` | 1 hour | none (read-only) | confirms the existing WORKERBEE→ph1102 delegation and checks for a settled BEE distribution |

Every claim/battle/plant receipt above reconciles against at least two independently queried Hive
or Hive-Engine nodes before it reports success — that reconciliation, not the broadcast alone, is
what "verified on chain" means here.

## HoloZing — ZING reward claim (posting key, zero new capital)

- Before: 1157.079 ZING pending (1148.764 holding-achievement + 8.315 stake reward), 9.084 ZING
  already staked, 36,066.720 ZING liquid, Alpha Vial #1831 held and unopened.
- Claimed: **1157.079 ZING**, confirmed by two independent Hive-Engine providers at block
  63196786. Staked ZING after: 1166.163. Liquid ZING and the Alpha Vial were untouched (the claim
  path only converts pending → staked; it has no vial-open or transfer path at all).
- Scaling: this account's pending-reward rate comes from ZING already staked/held, not from this
  automation. To earn more per cycle, stake or hold more ZING (buy ZING, or convert other assets to
  it) — the claim automation itself has no capital requirement and no ceiling of its own.

## TerraCore — SCRAP claim + one conservative battle per cooldown (posting key, zero new capital)

- Before: 198.75336909 liquid SCRAP, 99.99962753 SCRAP sitting raid-exposed in the mining stash,
  mine rate 0.00070859 SCRAP/sec (≈61.2 SCRAP/day passive).
- In roughly three minutes of automated operation today: claimed the 99.99962753 raid-exposed
  stash (block 110257677), then — because the claim also cleared the account's one battle cooldown
  — the same tick spent the account's single available attack against the highest-scoring in-policy
  target (`changminh`, chosen by `selectTerraCoreBattleTarget`'s existing conservative rules: no
  protection buff, bounded dodge, defense ≤ 2/3 of this account's damage), won, and looted 49.092
  SCRAP from their stash (block 110257754). The next 15-minute tick claimed the newly re-accumulated
  49.35705811 SCRAP (block 110257802).
- Net liquid SCRAP change in ~9 minutes of automated running: 198.75336909 → 348.11005473
  (+149.35668564 SCRAP), roughly two and a half days of passive mining pulled forward via one claim
  and one battle win, plus the ordinary claim cadence going forward.
- SCRAP is currently thin: a full-depth exit of the claimed 99.99962753 SCRAP quoted at only
  0.00320098 SWAP.HIVE (an on-chain order-book read, not an estimate). Scaling requires the
  Engineering upgrade path (`hive-fleet-operations-service/scripts/terracore-engineering-upgrade.mjs`,
  not yet wired to a timer) to raise the mine rate, paid for out of accumulated SCRAP.

## dCrops — one starter plot (active key, zero new capital)

- The account holds exactly one Land NFT (472218, "Starter Land", one plot) and four Seed NFTs
  (Clover 472214, Bok Choy 472215, Asparagus 472216, Artichoke 472217); a fifth NFT (472219,
  "Cooking Pot") is farm equipment, not plantable.
- Today's automated tick planted Artichoke (472217) into the empty plot; the crop is now growing
  through the current in-game season (`endsAtUnix` 1790878266) and the plot will not be eligible to
  harvest until `nextEligibleAtUnix` 1790592822 (about two days out).
- Found and fixed in passing: the already-deployed `dcrops-cycle.mjs` (release
  `aagaard-0.4.6` on cold-red-gate) had a single-shot, non-retrying on-chain confirmation check,
  which reported today's plant as failed even though it landed correctly (confirmed independently by
  re-reading plot state). Patched in place to retry like `terracore-cycle.mjs` already does; the
  current repo source (`scripts/dcrops-cycle.mjs`) never had this bug — it already uses the shared,
  retrying `HiveClient.confirmTransaction`.
- Scaling: this is a one-plot starter land; growth requires acquiring additional/upgraded Land NFTs
  (a capital purchase), not more automation of the existing plot.

## WorkerBee — existing position, watched for its first payout (read-only)

- The account already staked and delegated 3.66758 WORKERBEE to the no-fee `ph1102` mining pool on
  2026-07-22; no liquid WORKERBEE remains to add to that position.
- No settled BEE distribution has been observed yet from that pool for this account
  (`settledDistributions: []`); `hive-game-workerbee-audit` now checks hourly and will journal the
  first one whenever `ph1102` pays out.
- Scaling: acquire more liquid WORKERBEE; `planWorkerBeeYield`
  (`hive-application-integration-services-section/hive-games-services-section/services/workerbee-services-section/src/yield.mjs`)
  already plans the stake-and-delegate batch for a fresh balance up to its existing 10.00000
  WORKERBEE signer cap — it just has nothing to act on right now.

## Deliberately not automated (existing decisions this session did not change)

- **Splinterlands** — 54 cards (9 modern, undelegated), energy 49, rating 260 (65 battles, 29
  wins). Splinterlands' own ToS §1.A.5/§1.A.6 prohibit bot/script play; the house
  `splinterlands-services-section` package never built a battle-submission path on purpose (see its
  README). This session confirmed that boundary is still exactly where the existing code left it and
  did not cross it.
- **dCity** — 47 CITY NFTs across the fleet (32 on `emsenn0`, 15 on `michael561`, 300 SIM locked),
  10,018.923 liquid SIM on `michael561`. The dCity contract itself is closed to new play; the only
  live surface is a one-time SIM→SWAP.HIVE pool exit quoted today at 0.41064080 SWAP.HIVE minimum —
  a liquidation decision for the founder to make once, not a daily-play target.
- **HashKings** — `emsenn0` holds 18 HKFARM NFTs; `michael561` holds none and zero BUDS/HKWATER/MOTA.
  The game's web client redirects to a parked `/lander` page; the house package only classifies
  custody (`preserve-custody` / `review-recovery`), with no action path at all — nothing to run on a
  schedule.

## What was built (paths)

- `hive-fleet-operations-service/src/operations.mjs` — the four verbs above
  (`hive-game-holozing-rewards`, `hive-game-terracore-cycle`, `hive-game-dcrops-cycle`,
  `hive-game-workerbee-pool-audit`) as a MetroPlat operation family, account resolved from
  `accountsWithLane(...)` (never a name hardcoded in this file), registered in
  `apps/metroplat/src/catalog.mjs`.
- `hive-fleet-operations-service/scripts/journal-game-tick.mjs` — wraps any one-tick game script so
  every run (success or "nothing to do") appends one JSON line to a per-game journal, never just
  prose on stderr.
- `hive-fleet-operations-service/content/deployment/systemd-user/hive-game-{holozing-rewards,
  terracore,dcrops,workerbee-audit}.{service,timer}` — the deployed timer definitions.
- `hive-fleet-operations-service/lib/agency/offices/fleet-custodian.json` — added the
  `playing-hive-games` skill and `hive-game-play` duty to the existing office (no new office; this
  is squarely the fleet custodian's existing jurisdiction); also corrected its `authority-scope`/
  `jurisdiction`, which still named the pre-rename `rsc-quiescent/services/aagaard/` path.
- `hive-fleet-operations-service/lib/agency/skills/playing-hive-games/SKILL.md` — the skill
  granting the four verbs above.

## What needs the founder

- The `aagaard` release deployed on cold-red-gate (`aagaard-0.4.6`) is stale against this repo's
  `hive-fleet-operations-service@0.4.10`: several house packages the current source imports under
  consolidated names (e.g. `@red-cup-engineering/computer-code-engineering-services-section`,
  `@red-cup-engineering/computer-data-engineering-services-section`) 404 against
  `registry.561.group`/the local verdaccio mirror on cold-red-gate — they have not been published
  under their new names yet. Today's automation runs on the older, still-correct 0.4.6 code (with
  the one dcrops confirmation patch above); a real redeploy needs those packages published first.
- The MetroPlat catalog registration (`apps/metroplat/src/catalog.mjs`) takes effect on
  `ops.561.group`'s own next release checkout — this session edited the source but did not force a
  redeploy of that separately-checked-out release worktree.
- Per-wallet policy (what an account MUST/MUST NOT do) still lives as guard code inside each game
  script rather than as an evaluable agency rule — see the candidate BCP-14-style statements below
  for the founder's unified rule-check layer.

## Candidate per-wallet rules for the unified rule-check layer

Phrased as (subject, keyword, action, condition), for the agency-records rule layer now being
built, matching what the existing code already enforces as guard code today:

- `michael561` MUST NOT open, transfer, or sell the HoloZing Alpha Vial (`ZINGALPHA` #1831) —
  already enforced by `protectedAssets.mjs`'s `assertProtectedAlphaVialObserved` /
  `assertHoloZingApiMutationAllowed`, unconditionally.
- Any Hive wallet MUST NOT submit a Splinterlands battle, team, or surrender custom_json
  (`sm_find_match`/`sm_submit_team`/`sm_surrender`) — a ToS §1.A.5/§1.A.6 condition, not a capital
  one; the house package simply never built the capability.
- `michael561` MUST NOT unstake, undelegate, transfer, or trade WORKERBEE or BEE through the
  automated yield path — `planWorkerBeeYield` only ever plans the one stake-and-delegate batch.
- `michael561` MUST NOT delegate or spend more than 10.00000 WORKERBEE through the automated yield
  path (the existing hard signer cap in `workerbee-services-section/src/yield.mjs`).
- `michael561` MUST NOT liquidate, transfer, or list a CITY NFT through the dCity recovery path —
  `dcity-services-section` only prices a SIM→SWAP.HIVE exit and passes `cityNfts` through untouched.
- Any Hive wallet holding HashKings HKFARM NFTs (`emsenn0`) SHOULD preserve custody absent a
  material buy order or comparable sale — `hashkings-services-section`'s own
  `assessHashKingsRecovery` classification, not yet a standing rule.
- `michael561` SHOULD claim TerraCore's raid-exposed SCRAP whenever it clears the policy minimum,
  and MUST NOT spend more than the one attack `planTerraCoreActions`/`selectTerraCoreBattleTarget`
  admit per regenerated cooldown.
