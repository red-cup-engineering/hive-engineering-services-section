/**
 * decision — the max-alpha knapsack made executable (Layer 3 of docs/max-alpha.md).
 *
 * Layers 1–2 (../analysis/alpha) expose the addressable curation alpha as an
 * exact rational field: `mispricingEnergy` is the total alpha, `capturableSinks`
 * is the opportunity set (subjects priced below their neighbourhood, deepest
 * deficit first), `alphaDecay` is its spectral persistence. This module is the
 * allocator: it turns each opportunity into a fundable `Proposal` and draws a
 * *linear* budget — finite mana for votes, finite capital for trades — across
 * them under @emsenn/animating/becoming/doing/working/governing/deciding's greedy capital-efficiency allocator.
 *
 * The theorem the code realizes: allocation of a finite linear resource over
 * priced opportunities is exactly the linear (greedy-density) knapsack. A
 * capturable sink of depth `deficit` funded at mana cost `manaCost` is a
 * proposal with merit = deficit (the captured alpha) and cost = manaCost; an
 * executable trade edge `edge` with on-chain execution friction `executableCost`
 * is a proposal with merit = edge − executableCost (the net edge) and cost =
 * capitalCost (the capital it locks). decide() walks proposals in
 * merit-per-unit-cost order, funds while the budget holds, and records every
 * pass-over as a typed `Abstained` — so the deepest, cheapest alpha is funded
 * first and the run is a complete, auditable ledger.
 *
 * Fleet consensus: several agent personas each contribute proposals; the fleet
 * does not vote on a winner — it *pools* its opportunities into one proposal set
 * and runs ONE decide() over the shared budget (aggregate, then allocate). The
 * persona is carried in the proposal-id namespace (`persona:id`) for
 * auditability, so collective allocation remains a complete record of who
 * proposed what and why it was funded or passed.
 *
 * Exactness boundary: merit and cost are kept as exact `Rational`s on the
 * `RationalProposal` wrapper (provenance — these are the alpha and the spend,
 * rational because the analysis is rational). The ONE money-touching float-risk
 * boundary is the conversion to the bigint micro-units decide() requires: it is
 * an exact fixed-point floor — scale the rational by 10⁶ and take the integer
 * part by exact integer division (truncation toward zero, which equals floor on
 * the non-negative merit/cost the allocator funds) — never `Number()`, never a
 * float. Non-positive merit/cost is left to decide() itself, which abstains it
 * (`non-positive-cost` / `below-threshold`). Pure, frozen, kind-tagged, no LLM.
 */
import {
  decide, actionsOf, actedOf,
  type Proposal, type LinearBudget, type DecisionRun, type Acted, type DecideOptions,
} from "@emsenn/animating/becoming/doing/working/governing/deciding";
import { type CapturableSink } from "../analysis/alpha.mjs";
import {
  ratSubtract,
  type Rational,
} from "@emsenn/relating";
import { toInt } from "@emsenn/relating/codecs/exact-number";
import {
  type ChargeCarrier,
  type PredicationTerm,
} from "@emsenn/relating";

/** Fixed-point scale for the rational → bigint-micro conversion decide() needs:
 *  one unit of merit/cost is resolved to 10⁻⁶. */
const MICRO_SCALE = 1_000_000n;

/**
 * Exact fixed-point floor of a rational to bigint micro-units — the single
 * money-touching boundary, and it never sees a float.
 *
 * The rational's exact num/den are read out as integers and the micro-unit
 * floor is computed in arbitrary-precision bigint: ⌊(num · 10⁶) / den⌋. The
 * floor is taken toward −∞ (not toward zero) so the conversion is monotone in q
 * across the sign change — though only non-negative merit/cost is ever funded
 * (decide() abstains non-positive cost/merit before any spend), so the rounding
 * never moves money. The exactness is in the bigint: no `Number()`, no float on
 * the scaled value.
 *
 * Why bigint and not the algebra's own scale-then-`quotient`: the algebra's
 * `Natural` is unary (Peano successor), so multiplying a rational by a 10⁶
 * `Natural` is infeasible. We read the small exact num/den the analysis yields
 * (`toInt` is a boundary read of an exact integer) and do the 10⁶ scaling in
 * native bigint — exact, and the only place a JS integer touches the money.
 */
function rationalToMicro(q: Rational): bigint {
  const num = BigInt(toInt(q.num));
  const den = BigInt(toInt(q.den)); // den > 0 by construction of Rational
  const scaled = num * MICRO_SCALE;
  const q0 = scaled / den; // bigint division truncates toward zero
  // Correct truncation to floor (toward −∞) on a non-zero negative remainder.
  if (scaled % den !== 0n && (scaled < 0n) !== (den < 0n)) return q0 - 1n;
  return q0;
}

/**
 * The stable string id of a graph term — the subject under which an action is
 * funded and audited. A hive term's mark carries its subject string
 * (`hive.account.alice`, `hive.post.bob/x`); render any term to that string,
 * falling back to a deterministic stringification for non-string marks. Pure,
 * no float.
 */
function termId(term: PredicationTerm): string {
  const value: unknown = term.mark.value;
  return typeof value === "string" ? value : String(value);
}

/** A capital action awaiting the budget verdict: a curation/governance `vote`
 *  funded with mana, or a market `trade` funded with capital. The `subject` is
 *  the priced thing — the sink's term, or the trade's market id. */
export interface CapitalAction {
  readonly kind: "vote" | "trade";
  readonly subject: string;
}

export interface SinkProposalInput {
  readonly sink: CapturableSink;
  /** The mana the vote draws to capture this sink — the linear cost. */
  readonly manaCost: Rational;
  readonly justification: ChargeCarrier;
}

export interface TradeProposalInput {
  readonly id: string;
  readonly subject: string;
  /** The raw edge of the trade (gross expected return), exact-rational. */
  readonly edge: Rational;
  /** On-chain execution friction (fees/slippage) netted off the edge. */
  readonly executableCost: Rational;
  /** The capital the trade locks — the linear cost. */
  readonly capitalCost: Rational;
  readonly justification: ChargeCarrier;
}

/** A proposal carrying its exact-rational merit and cost (provenance) alongside
 *  the bigint-micro `Proposal` handed to decide(). The rationals are the true
 *  alpha and spend; the bigint is the allocator's fixed-point view of them. */
export interface RationalProposal {
  readonly kind: "hive-decision.proposal";
  readonly proposal: Proposal<CapitalAction>;
  readonly merit: Rational;
  readonly cost: Rational;
}

/**
 * A capturable sink as a fundable proposal. Merit = the sink's `deficit` (the
 * captured alpha — exactly the depth it is priced below its neighbourhood);
 * cost = the mana the vote draws. The deeper the deficit per unit mana, the
 * earlier decide() funds it.
 */
export function sinkProposal(input: SinkProposalInput): RationalProposal {
  const merit = input.sink.deficit;
  const cost = input.manaCost;
  const subject = termId(input.sink.term);
  const action: CapitalAction = Object.freeze({ kind: "vote" as const, subject });
  const proposal: Proposal<CapitalAction> = Object.freeze({
    id: subject,
    action,
    cost: rationalToMicro(cost),
    merit: rationalToMicro(merit),
    justification: input.justification,
  });
  return Object.freeze({ kind: "hive-decision.proposal" as const, proposal, merit, cost });
}

/**
 * An executable trade edge as a fundable proposal. Merit = edge − executableCost
 * (the NET edge after on-chain friction — the only honest return); cost =
 * capitalCost (the capital it locks). A trade whose friction swallows its edge
 * has non-positive merit and is abstained by decide().
 */
export function tradeProposal(input: TradeProposalInput): RationalProposal {
  const merit = ratSubtract(input.edge, input.executableCost);
  const cost = input.capitalCost;
  const action: CapitalAction = Object.freeze({ kind: "trade" as const, subject: input.subject });
  const proposal: Proposal<CapitalAction> = Object.freeze({
    id: input.id,
    action,
    cost: rationalToMicro(cost),
    merit: rationalToMicro(merit),
    justification: input.justification,
  });
  return Object.freeze({ kind: "hive-decision.proposal" as const, proposal, merit, cost });
}

/** Lift a whole opportunity set into proposals: each capturable sink becomes a
 *  sink proposal, mana-priced by `manaCostOf` and justified by `justifyOf`.
 *  Order is preserved (deepest-deficit-first from `capturableSinks`). */
export function sinkProposals(
  sinks: readonly CapturableSink[],
  manaCostOf: (sink: CapturableSink) => Rational,
  justifyOf: (sink: CapturableSink) => ChargeCarrier,
): readonly RationalProposal[] {
  return Object.freeze(
    sinks.map((sink) =>
      sinkProposal({ sink, manaCost: manaCostOf(sink), justification: justifyOf(sink) }),
    ),
  );
}

/** The funded allocation: the complete decide() run, the acted decisions (with
 *  their cost/merit/justification retained), and the emitted capital actions in
 *  allocation order. Frozen and kind-tagged — an auditable allocation ledger. */
export interface Allocation {
  readonly kind: "hive-decision.allocation";
  readonly run: DecisionRun<CapitalAction>;
  readonly acted: readonly Acted<CapitalAction>[];
  readonly actions: readonly CapitalAction[];
}

/**
 * Allocate a finite linear budget across the priced opportunities — the
 * executable max-alpha knapsack. decide() walks the proposals in
 * merit-per-unit-cost order, funds each while the remaining budget holds, and
 * abstains the rest; the deepest, cheapest alpha is funded first, and the run
 * records every verdict. The Allocation wraps that run with its acted set and
 * emitted actions.
 */
export function allocateCapital(
  proposals: readonly RationalProposal[],
  budget: LinearBudget,
  options?: DecideOptions,
): Allocation {
  const run = decide(proposals.map((p) => p.proposal), budget, options);
  return Object.freeze({
    kind: "hive-decision.allocation" as const,
    run,
    acted: actedOf(run),
    actions: actionsOf(run),
  });
}

/** One persona's contribution to a fleet: its name and the proposals it makes. */
export interface FleetProposals {
  readonly kind: "hive-decision.fleetProposals";
  readonly persona: string;
  readonly proposals: readonly RationalProposal[];
}

/** Tag a persona's proposals for fleet aggregation. */
export function fleetProposals(persona: string, proposals: readonly RationalProposal[]): FleetProposals {
  return Object.freeze({
    kind: "hive-decision.fleetProposals" as const,
    persona,
    proposals: Object.freeze([...proposals]),
  });
}

/**
 * Fleet consensus by aggregation, not by vote. The fleet does not elect a
 * winning persona — it POOLS every persona's opportunities into one proposal set
 * and runs ONE decide() over the SHARED budget, so the collective funds the
 * globally best alpha-per-unit-cost across the union (a persona's shallow-but-
 * cheap edge can beat another's deep-but-dear one). Each pooled proposal is
 * re-namespaced `persona:id` so the allocation ledger names who proposed every
 * funded and passed-over action — collective allocation that stays auditable.
 */
export function decideFleet(
  fleet: readonly FleetProposals[],
  budget: LinearBudget,
  options?: DecideOptions,
): Allocation {
  const pooled: RationalProposal[] = [];
  for (const member of fleet) {
    for (const p of member.proposals) {
      pooled.push(
        Object.freeze({
          ...p,
          proposal: Object.freeze({ ...p.proposal, id: `${member.persona}:${p.proposal.id}` }),
        }),
      );
    }
  }
  return allocateCapital(Object.freeze(pooled), budget, options);
}
