/**
 * logic — voting mana / Resource Credits as LINEAR resources, and curation as a
 * linear-logic program (see the corpus on linear logic as the logic of
 * non-duplicable resources, Girard 1987).
 *
 * The load-bearing fact about Hive's mana and RC is that they are LINEAR: a unit
 * of vote-mana spent on one vote is gone — you cannot spend the same mana twice.
 * Linear logic is *exactly* the logic with no contraction and no weakening, i.e.
 * the logic in which a hypothesis may be used neither twice nor zero times. So a
 * vote is the linear sequent
 *
 *     (mana ⊗ stake) ⊸ reward
 *
 * realized as `lolli(tensor(mana, stake), reward)`. The antecedent is consumed
 * by the cast; the reward is produced. Crucially the CAST uses the *linear*
 * (non-`!`) atoms — that is the whole point: regenerating mana *capacity* is the
 * replicable `!mana` (`ofCourse`), but each individual spend is a non-duplicable
 * linear occurrence. Replicable capacity vs. non-duplicable spend is the
 * exponential/multiplicative distinction made syntactic.
 *
 * A `ManaContext` is the linear multiset of resources actually available. A
 * `VoteSchedule` is well-formed iff the votes can be discharged against that
 * context with NO double-spend — which, because contraction and weakening are
 * absent, is exactly the arithmetic fact that the total consumed of each resource
 * is ≤ the total available. `linearlyWellFormed` returns a witness when this
 * holds and an obstruction (naming the overspent resource) when it does not.
 *
 * The curation PROGRAM is the multiplicative composition (tensor-fold) of the
 * vote sequents, and `certifyFragment` certifies that it stays inside the
 * multiplicative-exponential fragment MELL: multiplicatives (⊗, ⅋, 1, ⊥, ⊸) and
 * exponentials (!, ?) only — NO additives (&, ⊕, ⊤, 0). The classical classifier
 * upstream ranges MLL → MALL → CLL → LL and has no MELL element, so MELL is
 * derived exactly as: the proposition uses no additive connective.
 *
 * Exact throughout: every mana/RC/stake quantity is a `@emsenn/relating`
 * rational — resources on the money, never a float.
 */
import {
  atom,
  tensor,
  lolli,
  ofCourse,
  one,
  connectivesOf,
  classifyFragment,
  inFragment,
  fragment,
  type Proposition,
  type Connective,
  type Fragment,
  type InFragmentJudgment,
} from "@emsenn/gaming/structuring";
import { positive, negative } from "@emsenn/gaming/structuring";
import {
  ratAdd,
  ratZero,
  ratCompare,
  type Rational,
} from "@emsenn/relating";

// ---------------------------------------------------------------------------
// Mana units and the linear context (a multiset of available resources)
// ---------------------------------------------------------------------------

export type ManaResource = "vote-mana" | "rc" | "stake";

/** A single quantum of a linear resource: an exact `amount` of `resource`,
 *  carried with a human `label`. A mana unit is a *token*: once consumed it is
 *  gone (no contraction). */
export interface ManaUnit {
  readonly kind: "hive-logic.manaUnit";
  readonly resource: ManaResource;
  readonly amount: Rational;
  readonly label: string;
}

export function manaUnit(resource: ManaResource, amount: Rational, label: string): ManaUnit {
  return Object.freeze({ kind: "hive-logic.manaUnit" as const, resource, amount, label });
}

/** The linear multiset of resources a curator actually has on hand — the
 *  left-hand context Γ against which a vote schedule is discharged. */
export interface ManaContext {
  readonly kind: "hive-logic.manaContext";
  readonly units: readonly ManaUnit[];
}

export function manaContext(units: readonly ManaUnit[]): ManaContext {
  return Object.freeze({ kind: "hive-logic.manaContext" as const, units: Object.freeze([...units]) });
}

/** The exact total of one resource in the context — the additive capacity of
 *  the multiset for that resource. Exact rational; no float. */
export function contextTotal(context: ManaContext, resource: ManaResource): Rational {
  let total = ratZero;
  for (const u of context.units) {
    if (u.resource === resource) total = ratAdd(total, u.amount);
  }
  return total;
}

// ---------------------------------------------------------------------------
// A vote as a linear sequent (mana ⊗ stake) ⊸ reward
// ---------------------------------------------------------------------------

/** A single vote, both as its EXACT resource cost and as its LINEAR-LOGIC type.
 *
 *  The `sequent` is `(mana ⊗ stake) ⊸ reward`, built from non-`!` (linear)
 *  atoms: the cast consumes its mana and stake exactly once and produces a
 *  reward. `antecedent` is `mana ⊗ stake` and `reward` is the produced atom.
 *  `manaCost`/`stakeCost` are the exact rational quantities the cast withdraws
 *  from the linear context. */
export interface VoteSequent {
  readonly kind: "hive-logic.voteSequent";
  readonly antecedent: Proposition;
  readonly reward: Proposition;
  readonly sequent: Proposition;
  readonly manaCost: Rational;
  readonly stakeCost: Rational;
  readonly label: string;
}

export function voteSequent(label: string, manaCost: Rational, stakeCost: Rational): VoteSequent {
  // Linear (non-!) atoms: each cast is a single, non-duplicable occurrence.
  // Antecedent atoms are negative (consumed / Opponent-committed inputs); the
  // reward is positive (produced / Proponent-committed output).
  const mana = atom(`${label}:mana`, negative());
  const stake = atom(`${label}:stake`, negative());
  const reward = atom(`${label}:reward`, positive());
  const antecedent = tensor(mana, stake);
  const sequent = lolli(antecedent, reward);
  return Object.freeze({
    kind: "hive-logic.voteSequent" as const,
    antecedent,
    reward,
    sequent,
    manaCost,
    stakeCost,
    label,
  });
}

/** Regenerating mana *capacity* as the replicable resource `!mana`
 *  (`ofCourse`). This is the EXPONENTIAL companion to {@link voteSequent}'s
 *  linear cast: capacity may be promoted/contracted (it regenerates), but every
 *  individual spend is the linear atom. Exposed so a curation program can name
 *  its replenishing source while keeping each cast non-duplicable. */
export function regeneratingCapacity(label: string): Proposition {
  return ofCourse(atom(`${label}:mana`, positive()));
}

// ---------------------------------------------------------------------------
// A vote schedule and its linear well-formedness
// ---------------------------------------------------------------------------

export interface VoteSchedule {
  readonly kind: "hive-logic.voteSchedule";
  readonly available: ManaContext;
  readonly votes: readonly VoteSequent[];
}

export function voteSchedule(available: ManaContext, votes: readonly VoteSequent[]): VoteSchedule {
  return Object.freeze({
    kind: "hive-logic.voteSchedule" as const,
    available,
    votes: Object.freeze([...votes]),
  });
}

/** Sum of the cost projection over all votes — each vote counted EXACTLY ONCE.
 *  Counting once (no contraction, no weakening) is the linear-logic content of
 *  "no double-spend": a vote in the schedule consumes its cost a single time. */
function totalCost(votes: readonly VoteSequent[], project: (v: VoteSequent) => Rational): Rational {
  let total = ratZero;
  for (const v of votes) total = ratAdd(total, project(v));
  return total;
}

export interface LinearWellFormedWitness {
  readonly kind: "hive-logic.linearWellFormed:witness";
  readonly consumedMana: Rational;
  readonly consumedStake: Rational;
  readonly availableMana: Rational;
  readonly availableStake: Rational;
}

export interface LinearWellFormedObstruction {
  readonly kind: "hive-logic.linearWellFormed-obstruction";
  readonly reason: "mana-overspent" | "stake-overspent";
  readonly consumed: Rational;
  readonly available: Rational;
  readonly offending: VoteSequent;
}

export type LinearWellFormedJudgment = LinearWellFormedWitness | LinearWellFormedObstruction;

/**
 * The LINEAR well-formedness judgment for a vote schedule.
 *
 * Theorem (no double-spend ⟺ within budget): because the resource logic has no
 * contraction and no weakening, each vote consumes its mana and stake exactly
 * once, and a schedule is dischargeable against the context Γ iff the total
 * consumed of every resource is ≤ the total available. This function therefore
 * sums the per-vote costs (each once) and compares — by exact `ratCompare`, no
 * float — against `contextTotal`. Mana is checked first; the first resource that
 * is overspent yields the obstruction, naming the vote that pushed it over.
 */
export function linearlyWellFormed(schedule: VoteSchedule): LinearWellFormedJudgment {
  const availableMana = contextTotal(schedule.available, "vote-mana");
  const availableStake = contextTotal(schedule.available, "stake");

  // Walk the votes in order; the obstruction names the vote that crosses the
  // budget so the diagnosis is the offending cast, not just an aggregate.
  let runningMana = ratZero;
  let runningStake = ratZero;
  for (const v of schedule.votes) {
    runningMana = ratAdd(runningMana, v.manaCost);
    if (ratCompare(runningMana, availableMana) > 0) {
      return Object.freeze({
        kind: "hive-logic.linearWellFormed-obstruction" as const,
        reason: "mana-overspent" as const,
        consumed: runningMana,
        available: availableMana,
        offending: v,
      });
    }
    runningStake = ratAdd(runningStake, v.stakeCost);
    if (ratCompare(runningStake, availableStake) > 0) {
      return Object.freeze({
        kind: "hive-logic.linearWellFormed-obstruction" as const,
        reason: "stake-overspent" as const,
        consumed: runningStake,
        available: availableStake,
        offending: v,
      });
    }
  }

  return Object.freeze({
    kind: "hive-logic.linearWellFormed:witness" as const,
    consumedMana: totalCost(schedule.votes, (v) => v.manaCost),
    consumedStake: totalCost(schedule.votes, (v) => v.stakeCost),
    availableMana,
    availableStake,
  });
}

export function isLinearlyWellFormed(schedule: VoteSchedule): boolean {
  return linearlyWellFormed(schedule).kind === "hive-logic.linearWellFormed:witness";
}

// ---------------------------------------------------------------------------
// The curation program and its fragment certificate
// ---------------------------------------------------------------------------

export interface CurationProgram {
  readonly kind: "hive-logic.curationProgram";
  readonly proposition: Proposition;
  readonly votes: readonly VoteSequent[];
}

/**
 * The curation PROGRAM of a schedule: the MULTIPLICATIVE composition of its vote
 * sequents — the right-fold `s₁ ⊗ s₂ ⊗ … ⊗ sₙ` (the empty program is the unit
 * `1`). Tensor is the right composition because casts run together, each
 * consuming its own linear resources; there is no choice (&/⊕) between votes, so
 * the program is purely multiplicative-exponential by construction.
 */
export function curationProgram(schedule: VoteSchedule): CurationProgram {
  const votes = schedule.votes;
  let proposition: Proposition;
  if (votes.length === 0) {
    proposition = one();
  } else {
    proposition = votes[votes.length - 1]!.sequent;
    for (let i = votes.length - 2; i >= 0; i--) {
      proposition = tensor(votes[i]!.sequent, proposition);
    }
  }
  return Object.freeze({
    kind: "hive-logic.curationProgram" as const,
    proposition,
    votes: Object.freeze([...votes]),
  });
}

/** The additive connectives — the connectives a MELL proposition must NOT use. */
const ADDITIVE_CONNECTIVES: readonly Connective[] = Object.freeze(["with", "plus", "top", "zero"]);

export interface FragmentCertificate {
  readonly kind: "hive-logic.fragmentCertificate";
  readonly fragment: Fragment;
  readonly used: readonly Connective[];
  readonly inMELL: boolean;
  readonly judgment: InFragmentJudgment;
}

/**
 * Certify the linear-logic fragment of a curation program.
 *
 * Theorem (the MELL gate): MELL — the multiplicative-exponential fragment — is
 * exactly the multiplicatives (⊗, ⅋, 1, ⊥, and the derived ⊸ = (·)⊥ ⅋ ·) plus
 * the exponentials (!, ?), with NO additives (&, ⊕, ⊤, 0). The classical
 * classifier upstream ranges MLL → MALL → CLL → LL and carries no MELL element,
 * so we derive `inMELL` directly from the connective signature: a proposition is
 * in MELL iff `connectivesOf(p)` contains none of {with, plus, top, zero}. By
 * construction {@link curationProgram} only ever introduces tensor, lolli (⅋
 * over duals), the linear atoms, the unit 1, and — where capacity is named —
 * ofCourse, so a well-formed curation program is always in MELL.
 *
 * `fragment` is the least classical fragment containing the program
 * (`classifyFragment`); `judgment` is the upstream in-fragment witness for that
 * fragment, so the certificate carries an upstream-checkable proof object.
 */
export function certifyFragment(program: CurationProgram): FragmentCertificate {
  const used = connectivesOf(program.proposition);
  const classified = classifyFragment(program.proposition);
  const inMELL = !used.some((c) => ADDITIVE_CONNECTIVES.includes(c));
  const judgment = inFragment(program.proposition, classified.name);
  return Object.freeze({
    kind: "hive-logic.fragmentCertificate" as const,
    fragment: classified,
    used: Object.freeze([...used]),
    inMELL,
    judgment,
  });
}

/** The MELL fragment as a named handle, for callers that want to assert the gate
 *  against the upstream fragment lattice (the classical chain's MLL is its
 *  additive-free, exponential-free floor; MELL adds only the exponentials). */
export function mellFloor(): Fragment {
  return fragment("MLL");
}
