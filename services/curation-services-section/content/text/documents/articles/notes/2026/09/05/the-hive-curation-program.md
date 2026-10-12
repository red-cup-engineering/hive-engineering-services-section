# The Hive Curation Program

What the org holds on Hive, what each idea in the tree's own research would actually earn from that stake, and the ordering that follows. Every number below is either read live from the chain today (2026-09-05, ~06:00-06:20 UTC) or explicitly attributed to its source document; none are invented.

## 1. What we hold today (measured live)

| | emsenn0 | michael561 |
|---|---:|---:|
| Liquid HIVE | 139.979 | 2.439 |
| HBD | 0.418 | 16.304 |
| HBD savings | 0.000 | 0.000 |
| Vesting shares (own) | 1,186,745.545065 VESTS = 736.35 HP | 294,468.685181 VESTS = 182.71 HP |
| Delegated out | 149,100.091241 VESTS | 257,152.719571 VESTS |
| Effective (voting) VESTS | 1,037,645.453824 VESTS = 643.84 HP | 37,315.965610 VESTS = 23.15 HP |
| Voting mana (before today's votes) | 100% | 100% |
| HSBI units | 0 (checked live: Hive-Engine `tokens`/`balances` `findOne` for symbol HSBI returns null for both accounts) | 0 |
| Hive-Engine tribe tokens (LEO/POB/CENT/WAIV) | none held in meaningful size (not separately queried per-account; org strategy is curation, not tribe-token accumulation) | same |

Conversion: `total_vesting_fund_hive / total_vesting_shares` = 215,322,420.750 / 347,026,676,061.274938 = 0.00062048 HIVE/VESTS (live `condenser_api.get_dynamic_global_properties`). Live prices: HIVE $0.046578, HBD $0.943308 (CoinGecko, today).

Neither account delegates to `steembasicincome` or holds any HSBI units. michael561 has delegated the large majority of its own stake OUT (87% of its raw VESTS), leaving only 23.15 effective HP for voting — this is the account's own most consequential fact for curation capacity, not anything this program controls.

## 2. What's already running

- **cold-red-gate systemd** (read-only survey, per `operate-remote-hosts`): `aagaard.service` (active, running, `@emsenn/aagaard` — Propolis Hive frontend + SWARM layer) plus `aagaard-michael-capital-circulation.timer`/`aagaard-sigmund-capital-circulation.timer` (every 15 minutes, bounded capital-circulation cycles, not curation voting). No curation-vote timer was found live on the host before this program's own deploy below.
- **GitHub history**: `emsenn/561-group` once carried `aagaard-emsenn0-curation-cycle.timer`/`.service` ("Run one Aagaard emsenn0 curation vote per America/Chicago day" / "one bounded, freshly re-verified Hive curation vote via cold-red-gate") under a since-reorganized path (`services/rsc-quiescent/...`). It is not live on cold-red-gate today — prior art to build on, not a running system to route around.
- **Parallel, uninstantiated Hive frontend/codec work**: `emsenn/hive-topology` ("Meme-topology-based social graph model for Hive"), `hive-market-topology`, `hive-engine-topology`, `hive-codecs` ("Zero-dependency TypeScript codecs"), `hive-engine-codecs`, `quinbee` ("Langstroth demo site"), `langstroth` ("Hive blockchain frontend: account profiles, post feeds, post views") — all private GitHub repos, none checked out into this tree, none live. They are frontend/topology/codec experiments, not curation-decision algorithms; nothing in them duplicates what this program builds. `gh search code` across `emsenn` for vote/curation/trail/autovote/rshares logic turned up only theory notes (the attention-stake-economy corpus, the HAL notes, the HSBI post) and this program's own new `aagaard-emsenn0-curation-cycle` unit files — no separate hidden voting engine was found.
- **In this checkout**: `hive-services-section/lib/legacy/waggle` (a complete, tested, zero-npm-dependency Node<->Hive client — reads, plus build/sign/broadcast for vote/post/comment/follow/reblog/transfer) sat unpublished; it is now revived as `@red-cup-engineering/hive-blockchain-client-service` and is this program's one signing primitive. `hal/hive-auto-ledger-hal.md`'s roadmap names "look at the curation rewards and all available analytics for a given Hive post/comment" and "wallet curation analytics" as unbuilt wants — this program's `observe-tribe-curation-yield-service` is the first real step toward both (per-tag yield today; per-wallet historical tracking is not yet built, see §5).
- **Aagaard itself** (read-only, not touched): a TypeScript Propolis/SWARM Hive frontend, a different, larger, separately-owned capability; this program does not duplicate or route around it.

## 3. The theory this program is built from

From `hive-as-an-attention-stake-economy-capital-yield-labor-governance-and-liquidity.md` (S3, S5, S7, S8):

- **What's rewarded** (S3) is not pure quality — it's a stake-weighted attention market: discovery timing, whale attention, trail inclusion, and reputation all factor in alongside content quality.
- **Votes as monetized attention** (S3): a vote's economic weight depends on HP, vote percentage, remaining mana, and timing relative to other votes — curatorial labor is "finding undervalued content early enough to earn curation rewards."
- **Automation and trails** (S3): autovoting is "economically rational but socially dangerous" — efficient for the stakeholder, but risks ossifying reward flows around known accounts. This program runs an autovote/trail-adjacent mechanism (a scheduled cycle voting by rule, not a human reading each post) and takes that risk deliberately, bounded by the mana cap and the never-vote-author list.
- **Forms of capital** (S5): HP is the strongest compounding capital "plus reputation plus distribution plus tooling" — HSBI units, delegation leases, and community capital are all listed as indirect/illiquid forms; liquid HIVE and HP are the two forms this program actually holds and can act on directly.
- **Passive/recurring income** (S7): "HP curation" is rated medium capital requirement, medium-to-high labor unless automated, high variability, "weak with tiny HP, better over time" — exactly matching michael561's 23.15 effective HP today. Autovoting/trails is rated low setup, medium monitoring, "good learning tool; don't blindly follow." HBD savings is the strongest passive-like path but "not risk-free yield" (peg/witness-rate risk) — this program does not touch it (savings balances are 0.000 on both accounts and stay that way; no automated staking/savings/delegation instrument, per the founder's liquidity-stays-liquid ruling).
- **Market structure** (S8): HIVE is a small-cap but genuinely liquid asset; HBD is thin externally (June 2026: ~$0.92, low volume) and named market-structure opportunities include "curation yield from under-discovered content" and "HBD peg arbitrage through conversions" — the latter is explicitly named as *not* the realistic move for a small wallet ("sophisticated arbitrage" vs. "learning the mechanics cheaply, building reputation, compounding social/software capital").

The HSBI post (`hive-creators-without-capital-look-at-hsbi.md`) gives HSBI's own worked numbers as of ~June 2026: $3 of units -> a $0.021 vote weekly; $20 of units -> a $0.063 vote daily; 1 unit = 1 HIVE, leased at 2 HP per unit; author receives half the vote value. The post's own arithmetic: $0.003/day per $1 of units (conservative), 1 HIVE ~ $0.33 then -> $0.000495/day per HIVE delegated (both curator and author shares) -> $0.0002475/day to the author alone -> **27.37%/year, as the post's own historical claim, not re-verified live today** (HSBI's own current pool state was not queried this run).

## 4. What each idea earns from this stake — the arithmetic

**A. Self-curation, timed to the reverse-auction window** (`task:social-mev-predictive-curation` / `task:nlp-whale-front-running`). Hive's manabar model (confirmed live via `condenser_api.get_accounts`): voting mana regenerates linearly to `max_mana` (= effective vesting shares in raw units — confirmed exactly: emsenn0's `voting_manabar.current_mana` 1,037,645,453,824 equals `(vesting_shares + received - delegated) x 1e6` to the digit) over 432,000 seconds (5 days), so **one 100%-weight vote costs exactly 1/50 = 2% of max mana** by protocol design (5 days x 24h / (5-day-full-regen / 2%-per-vote) = 50 full votes/day). Verified today: casting 2 votes at 100% weight for emsenn0 spent 41,462,582,927 raw mana units = 3.996% of its 1,037,645,453,824 max (i.e., ~2% each, exact). At a 20%-of-current-mana daily budget, emsenn0 could cast up to 10 full-weight votes/day (or ~33 at the deployed 30% weight); michael561 the same ratio, scaled to its much smaller 23.15 effective HP.

Real yield read today, cross-checked across `api.hive.blog`/`api.openhive.network` (20 most-recent posts per tag): LEO 14.658 HBD pending across 20 posts (yield 0.0000000700 HBD/M-rshares), POB 11.072 HBD (0.0000000679), CENT 6.333 HBD (0.0000000679), WAIV 5.902 HBD (0.0000000682), base "hive" 8.191 HBD (0.0000000681). **These five numbers are nearly flat (within ~3% of each other)** — the founder's theorized "shallow L2 competition" gap is not visible in today's data; the tags are close to equilibrated right now.

Concrete result today: of 100 candidate posts read (20/tag x 5 tags) at the moment of each cycle run, only those aged 240-360 seconds since creation qualify; most runs this session found 0-2 in-window candidates system-wide (Hive's post-creation rate on these specific tags is low enough that a single point-in-time read rarely lands inside a 120-second window — this is why the mechanism needs to run continuously, not once). When a candidate does land in-window, the deployed pipeline casts it at the policy's weight (see §6) and journals the exact transaction id.

**B. Multi-tribe routing** (`task:multi-tribe-curation-arbitrage`): mechanically free once (A) is running — `observe-tribe-curation-yield-service` already reads all four tribes and the base layer every cycle and `schedule-set-of-votes-service`'s `preferredTags` already routes weight toward whichever tag is named. Given the flat yields in §4A, there is no real edge to route toward *today*; the value is that the mechanism is armed and will start paying the moment a tag's curation genuinely thins out (a real gap would show as one tag's `yieldHbdPerMillionRshares` diverging from the other four by more than the ~3% noise band already observed).

**C. Dust-curation on micro-blogging** (`task:dust-curation-micro-blogging`): the schedule's own dust rule (weight down to `dustWeight` for any post whose pending payout is below `dustPendingPayoutThresholdHbd`, default 0.02 HBD) is built and running, but today's two real in-window candidates (WAIV-tagged Actifit/Waivio posts at 0.085 and 0.920 HBD pending) were both *above* the dust threshold, so the rule never fired for real today — an honest miss, not a design gap; short-form posts this cheap do exist on these tags (several 0.000-0.007 HBD posts were read, just not inside the timing window at read time).

**D. HSBI delegation vs. self-curation**: at *today's* HIVE price ($0.04658, a bit under a seventh of the HSBI post's ~$0.33 reference price), the post's own $/day-per-$-of-units formula, taken at face value, gives a materially smaller absolute return per HIVE delegated than the post's headline 27.37%/year (that figure is denominated in the post's own June 2026 price context and was not re-derived against HSBI's live pool state this run — flagged, not answered, in §7). Delegating to HSBI would also **convert liquid or votable HP into a locked delegation**, which the founder's liquidity-stays-liquid ruling already forecloses as an automated instrument. Recommendation: informational only; if pursued at all, it is a founder-made manual delegation decision, never an automated one this program performs.

**E. Staking-vs-liquidity routing** (`task:staking-vs-liquidity-router`): an automated staking and unstaking decision, sized from per-account strategy config.

**F. Data-as-a-service bounties** (weekly analytics report posted to a community): a weekly analytics report posted to a community from a posting account.

**G. High-spread tribe market-making / HBD peg defense** (limit orders on Hive-Engine's DEX or the internal HIVE/HBD market): a capital-risk capability distinct from curation (market-making risks the stake against price movement; peg defense requires holding a market position), built next, as its own lane in the strategy config.

## 5. The ordering

1. **Timed self-curation across all five tags/tribes, continuously scheduled** (A + B combined — they are one mechanism once running continuously). Built and deployed (§6).
2. **Dust-curation on low-payout short-form content** — already the same mechanism's dust rule; armed, will fire on genuinely cheap content once one lands in-window.
3. HSBI delegation, once HSBI's live pool state is queried and its rate beats self-curation.
4. Staking-vs-liquidity routing.
5. Data-as-a-service bounties, posted weekly.
6. Tribe market-making and HBD peg defense.

## 6. What was built and deployed

Four packages, published to `https://registry.561.group`, exact-pinned, composed by exact pin, never re-implemented:

- `@red-cup-engineering/hive-blockchain-client-service@0.1.0` — revived from `lib/legacy/waggle`; the one signing/broadcast primitive.
- `@red-cup-engineering/observe-tribe-curation-yield-service@0.1.0` — reads yield per tag/tribe + account mana, two-node cross-checked.
- `@red-cup-engineering/schedule-set-of-votes-service@0.1.0` — pure transformation: yield + policy + candidates -> a day's vote schedule.
- `@red-cup-engineering/cast-set-of-votes-service@0.1.0` — the one effect: signs, broadcasts, journals.
- `@red-cup-engineering/run-hive-curation-cycle-service@0.1.0` — composes all three into one cycle, reading the founder's policy record as data.

Deployed on cold-red-gate as `hive-curation-cycle.service` (oneshot) + `hive-curation-cycle.timer` (`OnCalendar=*:0/2`, every two minutes — chosen because the reverse-auction window is a ~120-second-wide band and a 2-minute cadence reliably catches it at least once). The founder's policy record lives at `/home/emsenn/.config/561-group/hive-curation-policy.json` on cold-red-gate (canonical copy in this section's `data/state/hive-curation-policy-state/hive-curation-policy.json`): current defaults, **weight lowered to 3000 (30%) from the pipeline's own built-in 10000 (100%) default**, `maxDailyBudgetPercent` held at the founder's standing 20%-of-mana cap. The founder fills in `tags`, `neverVoteAuthors`, and `maxWeight` to taste; nothing else needs to change to retune the whole cycle.

First real run (2026-09-05T06:19:04Z), both accounts, weight 3000: emsenn0 -> `rookie2001/sultry-barmaid-5-mana-ambush`, tx `d518f3b4457e88d90ca00b5ecafdb9614287c9af`; michael561 -> the same post, tx `f5853917376a0c455ffeae109b0f8932e3f9bf3d`. Both confirmed on-chain via `condenser_api.get_transaction`.

## 7. Refused, and open

- Refused automating: HSBI delegation, staking/unstaking, market-making, peg defense, and any posting/commenting — per §4D-G and the standing no-posting fence.
- Open, honestly: HSBI's *own* live pool/reward-fund state was never queried this run (only that our two accounts hold zero units), so §4D's dollar comparison rests on the post's June-2026 figures, not a fresh derivation — a real gap, named rather than papered over.
- Open: the `yieldHbdPerMillionRshares` metric is this program's own inverse-competition proxy, not the chain's exact curator-share reverse-auction formula (which needs `reward_fund`/`recent_claims`, not yet read anywhere in this pipeline) — flagged in `observe-tribe-curation-yield-service`'s own work order, not fixed here.
- Open: `observe-tribe-curation-yield-service` still doesn't return individual posts (only aggregates), so `run-hive-curation-cycle-service` makes its own duplicate `bridge.get_ranked_posts` read per tag — a small, named, non-actionable duplication (`jsnode_duplication`, negative net savings either way), left as its own work order's open question rather than a second mid-flight version bump.
