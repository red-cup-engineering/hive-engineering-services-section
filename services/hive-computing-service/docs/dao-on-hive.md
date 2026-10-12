# A DAO on Hive, taken seriously

*Design note for `@red-cup-engineering/hive-computing-service`.
Companion to `max-alpha.md`.
The claim: a DAO is not a voting widget bolted to a treasury — it is a **sheaf over a membership site**, and Hive already ships every primitive one needs (stake-weighted voting, a real on-chain treasury, a programmable sidechain) while shipping almost none of the **structure**.
The gap between "Hive has governance primitives" and "Hive has DAOs worth the name" is exactly the gap our frontier modules close.
This note records the design so the agent fleet (`propolis`) can be pointed at it.*

## The state of the art is thin

Hive's native "DAO" is the DHF — the Decentralized Hive Fund (a.k.a. the SPS).
Mechanically it is:

- a treasury that fills from a slice of inflation, denominated in HBD;
- a flat list of funding **proposals**, each asking for a daily pay rate;
- **stake-weighted approval voting** over that list, with a "return proposal" acting as a moving threshold — everything above the line that the budget reaches gets paid, per block, automatically.

That is the whole machine.
It is honest and it works, and it is also *almost nothing*: no notion of membership beyond "do you hold HP," no treasury logic beyond "pay the top of the list," no delegation graph, no quadratic or conviction weighting, no retrospective accountability, no composition of many small funds into one.
Everything interesting about a DAO — who *is* the DAO, how contention resolves, how the treasury is actually *allocated* rather than merely *disbursed* — is left as an exercise.
On the sidechain (Hive Engine) the story is even barer: DAOs there are usually a multisig and a Discord.

DAO-on-Hive is woefully underdone.
Good.
It means the math has somewhere to go.

## A DAO is a sheaf over a membership site

Take the members as the objects of a small site; the covers are the coalitions (who can act together); the sections are local commitments — votes, stakes, delegations, proposals.
A *decision* of the DAO is a **global section**: a way the local commitments glue.
The places they fail to glue — the factions, the contested proposals, the capital that has weight but no legitimacy — are exactly the **H¹ obstruction classes** of that sheaf.
This is the same object `hive/analysis` already reads off the attention graph; a DAO is that reading turned toward governance instead of curation.

Concretely, each frontier module maps onto one organ of a real DAO:

| DAO organ | what it actually is | module |
|---|---|---|
| **membership / voting power** | a non-duplicable resource — you cannot vote the same stake twice in one decision | `hive/logic` (linear mana/RC; a vote is a linear sequent, not a copyable token) |
| **consensus / contention** | harmonic agreement vs. the obstruction class that names the faction | `hive/analysis` (`rewardObstruction`, `attentionSpectrum`; the spectral gap is how fast a dispute settles) |
| **treasury allocation** | a budgeted knapsack over opportunities, not a payout queue | `hive/decision` (`allocateCapital` over `decide`/`LinearBudget`) |
| **revenue** | the DAO's real income is its share of the per-block faucet | `hive/emission` (`faucetShare`) |
| **accountability** | proposals reviewed only on information that predated them — no hindsight | `hive/geometry` (past light-cone; a retro-funding review must live in `downSet(proposal)`) |
| **execution / minutes** | every on-chain act recorded with the justification that authorized it | `hive/execution` (signing boundary + `UtteranceLog` audit) |

The DHF disburses.
A DAO built on these *allocates, under a budget, against an explicit objective, with an auditable reason for each act, and with its own revenue modeled exactly.* That is the difference, and it is entirely structural.

## The treasury is the max-alpha program

`max-alpha.md` already derived the object: capturable alpha is a resource-constrained convex program whose feasible region is the chain's executable surfaces.
A DAO treasury **is that program with a shared budget.** Its proposals are not prose asking for HBD; they are typed opportunities:

- a **capturable sink** (under-priced curation target) → `Proposal{merit = deficit, cost = mana}`;
- an **executable trade edge** → `Proposal{merit = edge − executable cost, cost = capital}`;
- a **liquidity position** on an internal or Engine pool → merit = fee share + emission share, cost = capital + impermanent-loss bound;
- a **game move** (below) → merit = expected exact payout, cost = entry + resource credits.

`hive/decision` ranks and selects these under one `LinearBudget`; the chosen set is the treasury's action for the cycle, and its total merit is the DAO's expected edge as an exact rational.
Governance is then just *whose `valueOf` and whose budget* — and disagreement about those is, again, an obstruction class you can measure rather than argue about.

## The programmable layer is Hive Engine — and that means games

L1 Hive gives you `vote`, `transfer`, `transferToVesting`, `delegateVestingShares`, `limitOrderCreate`, savings, recurrent transfers, and the universal `customJson` escape hatch.
That is a bank and a voting booth.
The **programmable** surface — tokens, NFTs, AMM pools, and the overwhelming majority of Hive's dapps and *games* — lives on **Hive Engine**, the sidechain our codecs already speak (`engineCustomJson`, `stake`/`unstake`/`delegate`, `swapTokens`, token `marketBuy`/`marketSell`, `tokens`, `pools`).

This is the underexplored money.
Hive's games (Splinterlands and its long tail) settle as Engine token and NFT operations carried by `custom_json` with app-specific schemas.
We do not yet have **per-dapp codecs** — typed sections that parse a specific game's `custom_json` into a meme-topology carrier and emit its moves.
With them, a treasury agent can:

- **read** a game's state as a typed section (positions, holdings, market depth for its token/NFTs);
- **value** moves with the same exact-rational machinery (a card's floor on the Engine market, a pool's fee+emission yield, a quest's expected drop);
- **play** by emitting the move as an audited `engineCustomJson`, scored and budgeted exactly like any other proposal.

"Automatically play web3 games" is, stated precisely, *a per-dapp codec feeding `hive/decision`, executed through `hive/execution`.* No new machinery — just a new section type per game.
That is the most legible profit-^Wresearch surface on the chain, and it is wide open.

## The Propolis DAO — the concrete proposal

`propolis` is already a fleet of persona-agents over a shared treasury carrier.
Promote it from "a cron that votes and trades" to a DAO with the structure above:

1. **Membership = stake in the carrier.** Each persona's weight is its HP / token holdings, read as a linear resource by `hive/logic` — no double-voting, mana regenerates as `!mana`, each cast is linear.
2. **A cycle proposes.** Every agent contributes typed proposals (sinks, edges, LP, game moves) from what it can see in its mandate (tag filters, venues, dapps).
3. **Consensus is harmonic.** Aggregate the fleet's `valueOf`s; the obstruction class *is* the disagreement.
  Where the fleet is harmonic, act; where it obstructs past a threshold, abstain and record the contested class as the minutes' open question.
  (This is `hive/decision` fleet-consensus + the analysis obstruction, together.)
4. **Allocate under one budget.** The whole fleet shares one `LinearBudget` of mana and capital; `decide` returns the cycle's actions.
5. **Execute through the boundary.** Every chosen action is signed only via the injected signer in `hive/execution` and recorded in the `UtteranceLog` with its justification — the DAO's transparent, on-chain-anchored minutes.
6. **Revenue is the faucet.** The DAO's income is modeled by `hive/emission`: its `faucetShare` from curation rewards, vesting, and (via Engine) token emissions.
  Max-alpha is then literally the DAO's objective function.

Nothing here is a new consensus protocol or a token launch.
It is the existing Hive primitives, *organized by the sheaf* — which is the part everyone skips.

## Gaps this note opens (work-list)

- **L1 DHF proposal ops.** The codecs build `vote`/`transfer`/… but not `create_proposal` / `update_proposal_votes` / `remove_proposal`.
  To *participate in* (or run an agent over) the native DHF we need those builders and a `topology` section for the proposal list + return-proposal threshold.
- **A membership/treasury section type.** `topology` has social and financial sections; a DAO wants a first-class *governance* section: members, weights, delegations, the proposal set, and the budget — the carrier `hive/decision` allocates over.
- **Per-dapp codecs.** Typed `custom_json` sections for specific Hive Engine games and dapps (Splinterlands first — largest surface), each emitting valued, budgetable moves.
  This is where the "automatically play web3 games" thesis becomes code.
- **Conviction / time-weighting.** The DHF is instantaneous approval; a conviction layer (weight grows with held support) is a natural exact-rational functional over the vote history — and a hedge against flash-stake governance attacks, readable as a transient in the spectrum.

> A DAO on Hive today disburses a list.
> A DAO on Hive *taken seriously* allocates a budget against an objective, names its own disagreements as cohomology, earns from the faucet, plays the chain's games for exact stakes, and signs every move with the reason that authorized it.
> Every one of those verbs is already a module.
