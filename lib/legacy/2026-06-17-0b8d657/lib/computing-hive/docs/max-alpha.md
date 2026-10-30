# Max alpha as a derivable, bounded object

*Design note for `@emsenn/computing-hive/analysis`. The claim: "maximum alpha" is not a
vibe — it is the optimum of a resource-constrained convex program whose feasible
region is the chain's exact executable surfaces and whose ceiling is the
spectral gap of the attention graph plus the reverse-auction game. Derivable
optimum; provable bounded approximations at every layer. This note records the
formalization so the analysis module can be built against it.*

Notation: a settled Hive carrier induces the **attention graph** `G` (vertices =
subjects — accounts, posts, tags, communities; edge weight `w_ij` = number of
section cells relating `i` and `j`). `L = D − W` is its graph Laplacian, positive
semidefinite. `r` is a **reward field**: a real (rational) potential per subject,
read from on-chain reward state. Everything below is exact — `w_ij` are integers,
`r` rationals, so every quantity is an exact rational unless a root is taken.

## Layer 1 — total alpha is one exact number (Dirichlet energy)

```
E(r) = rᵀ L r = Σ_{i~j} w_ij (r_i − r_j)²   ≥ 0,    E(r) = 0  ⟺  r is harmonic
```

`E(r)` is the **total addressable mispricing** in the field — a single exact
rational. Harmonic (`E = 0`) means every subject's reward already equals its
neighbourhood average: fully priced, no edge. We already ship the harmonic
*test* (`rewardObstruction`); `E(r)` is its magnitude.

→ planned: `mispricingEnergy(carrier, valueOf) → Rational`.

## Layer 2 — the capturable slice (the sinks)

`(L r)_i = Σ_j w_ij (r_i − r_j)` is subject `i`'s deviation from its
neighbourhood. `(L r)_i < 0` ⟹ `i` is priced **below** its neighbours — an
under-recognized **sink**. Captured alpha from voting `i` ≈
`your_reward_share × |negative deviation|`. The negative half of the obstruction
vector *is* the opportunity set; max alpha sums over reachable sinks.

→ planned: `capturableSinks(carrier, valueOf) → readonly { term, deficit: Rational }[]`
(the sinks, deepest first).

## Layer 3 — the resource bound (it's a knapsack)

Voting mana is finite and regenerating; each vote costs mana and yields
captured-sink-value. Max alpha is

```
maximize  Σ value_i x_i      s.t.  Σ mana_i x_i ≤ budget
```

a knapsack / LP — **provably bounded**: greedy-by-(value/mana) is within a fixed
factor; the LP relaxation gives the exact ceiling. `@emsenn/animating`'s `decide()`
*is* this budgeted allocation, and `hive/curation` already calls it — so the
constrained optimum is computed with error bars, not guessed.

## Layer 4 — the spectral ceiling (the punchline)

Expand `r` in the Laplacian eigenbasis `{φ_k, λ_k}`:

```
E(r) = Σ_k λ_k ⟨r, φ_k⟩²
```

Mispricing is exactly the spectral weight of the reward field *away from the
kernel*. The **correction rate** — how fast the market eats the edge — is the
spectral gap `λ₂` (algebraic connectivity / Fiedler value):

- large `λ₂` (well-connected attention) → fast diffusion → thin, fleeting alpha;
- small `λ₂`, or `λ₂ = 0` (fragmented graph: cartels, whale silos — exactly when
  `componentCount > 1`) → slow or never correction → **fat, persistent alpha.**

So cartel/silo detection (`attentionSpectrum.components`, the gap) is the **alpha
radar**: fragmentation you can read off the spectrum is where durable edge lives,
and `λ₂` is the decay constant on every edge you find. The semantic eigenvalues
upper-bound how long alpha survives.

→ planned: `alphaDecay(carrier) → { gap, components, durable: boolean }`. The gap
is an eigenvalue, generally irrational; expose its exact characteristic
polynomial (already in `attentionSpectrum`) plus a bounded numeric estimate, or
the exact rational Cheeger-style bound on `λ₂` rather than a rounded root.

## Trading alpha (same shape, different feasible set)

For markets the bound is executable no-arbitrage: `marketBuyWalk` /
`marketSellWalk` give the exact executable cost + shortfall; `spread` / `midpoint`
the instantaneous edge; `market-computer.judgeIntent` already computes
edge-vs-slippage. Max trade alpha = capital allocated across executable surfaces
to maximize `Σ (edge − executable cost)`, bounded by depth (the walk shortfall).

## The reflexive twist (why it's a fixed point, not a max)

Deploying capital **changes the graph**: votes add stake, trades consume depth —
so `x` moves the spectrum `L(x)` and partially closes the very gap it harvests.
The honest object is

```
maximize  captured-alpha(x)   subject to the spectrum L(x) that x itself induces
```

a control problem with self-impact (the mean-field / reflexivity layer). Bounded
approximation: price-taker for small capital (ignore impact), then add the
first-order spectral perturbation `δλ₂` as you scale. Even "max alpha accounting
for the fact that taking it destroys it" is a bounded approximation.

## Planned surface (additions to `hive/analysis`)

| function | returns | meaning |
|---|---|---|
| `mispricingEnergy(carrier, valueOf)` | `Rational` | total addressable alpha `E(r)` (exact) |
| `capturableSinks(carrier, valueOf)` | `{ term, deficit }[]` | under-priced subjects, deepest first |
| `alphaDecay(carrier)` | `{ gap, components, durable }` | spectral decay constant of the edge |

Already shipped and underpinning all three: `attentionSpectrum` (Laplacian
characteristic polynomial = the semantic eigenvalues; `componentCount`) and
`rewardObstruction` (the harmonic H¹ test whose deviations are the sinks/sources).

> Capital in, eigenvalues out — a *number* for how much edge exists and how long
> it lasts.
