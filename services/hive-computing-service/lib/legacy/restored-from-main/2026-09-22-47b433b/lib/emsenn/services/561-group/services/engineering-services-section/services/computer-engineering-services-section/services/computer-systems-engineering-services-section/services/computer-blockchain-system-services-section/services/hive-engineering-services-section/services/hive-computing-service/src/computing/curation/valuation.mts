/**
 * valuation — the cardinal curation valuation, derived from the bilattice via
 * spacetime-topology's evidence coordinates.
 *
 * The bilattice charge is four-valued (qualitative); a ranking needs a cardinal
 * order. The bridge is `evidenceCoordinates` (lifted from spacetime-topology):
 * the EXPECTED presence of each charge side over a frame of cells is an exact
 * rational. Measured over the merit-trait frame it gives `meritMass` — the
 * witnessed fraction of merit evidence, graded honestly because an unwitnessed
 * trait reads `absurd` (absence dilutes; it never fabricates falsity). Measured
 * over the risk frame it gives `riskMass`. A contested trait — opposing
 * evidence knowledge-joined — reads `stable` and lands in `conflictMass` — its
 * own exact penalty axis, surfaced, never averaged into the mass.
 *
 * The honest object is the POINT `(meritMass, riskMass, conflictMass) ∈ ℚ³` and
 * the DOMINANCE partial order on it — exact, with incomparabilities real. Only
 * the linear-mana knapsack forces a total order, and there a single declared
 * boundary read collapses the point to a scalar (in spacetime's "floats only at
 * the boundary" discipline). Nothing here is a fitted weight.
 */
import { fixedPointReadingsOfUtterances, sectionOf, chargeValue, type ChargeValue, type ChargeCarrier } from "@emsenn/relating";
import { chargeDistribution, evidenceCoordinates } from "@emsenn/relating/analysis";
import { toNumber } from "@emsenn/relating/codecs/exact-number";
import { ratSubtract, ratSign, type Rational } from "@emsenn/relating";
import { hiveChargeAtBoundary } from "../topology/hive-section-boundary.mjs";
import { type PostObservation } from "./observation.mjs";
import {
  EXHIBITS, MERIT_TRAITS, RISK_TRAITS, curationPredicate, curationTerm, postSubject, postUtterances,
  type WitnessingThresholds, DEFAULT_THRESHOLDS,
} from "./ontology.mjs";

/** Read a carrier's settled charge value from its present/absent sides. */
const chargeValueOf = (charge: ChargeCarrier): ChargeValue => {
  const truth = charge.value[0].name === "present";
  const falsity = charge.value[1].name === "present";
  return chargeValue(truth && falsity ? "stable" : truth ? "potential" : falsity ? "active" : "absurd");
};

const truthPresent = (value: ChargeValue): boolean => value.coordinates[0].name === "present";

export interface CurationValuation {
  readonly kind: "hive-curation.valuation";
  readonly subject: string;
  /** Expected witnessed presence over the merit frame, exact in [0,1]. */
  readonly meritMass: Rational;
  /** Expected witnessed presence over the risk frame, exact in [0,1]. */
  readonly riskMass: Rational;
  /** Expected contested (stable) presence over the merit frame, exact in [0,1]. */
  readonly conflictMass: Rational;
  /** Merit traits the section witnesses for this post. */
  readonly meritTraits: readonly string[];
  /** Risk traits the section witnesses for this post. */
  readonly riskTraits: readonly string[];
  /** Boundary read: meritMass − riskMass − conflictMass, exact. */
  readonly score: Rational;
  /** Admitted iff some merit is witnessed and the boundary score is positive. */
  readonly admitted: boolean;
  /** The settled charge on the headline merit trait (underrecognition) — a
   *  proof-carrying anchor for the decision's justification. */
  readonly headline: ChargeCarrier;
}

/** Valuate one post: settle its utterance log, read the trait frames, and
 *  compute the exact evidence-coordinate point. */
export function valuatePost(
  observation: PostObservation,
  thresholds: WitnessingThresholds = DEFAULT_THRESHOLDS,
): CurationValuation {
  const subject = postSubject(observation);
  const section = sectionOf(fixedPointReadingsOfUtterances([...postUtterances(observation, thresholds)]).knowledgeLeast);

  const subjectTerm = curationTerm(subject);
  const exhibitsPredicate = curationPredicate(EXHIBITS);
  const meritValues = MERIT_TRAITS.map((trait) => chargeValueOf(hiveChargeAtBoundary(section, subjectTerm, exhibitsPredicate, curationTerm(trait))));
  const riskValues = RISK_TRAITS.map((trait) => chargeValueOf(hiveChargeAtBoundary(section, subjectTerm, exhibitsPredicate, curationTerm(trait))));

  const meritCoords = evidenceCoordinates(chargeDistribution([...meritValues]));
  const riskCoords = evidenceCoordinates(chargeDistribution([...riskValues]));

  const score = ratSubtract(ratSubtract(meritCoords.truth, riskCoords.truth), meritCoords.conflict);
  const meritTraits = Object.freeze(MERIT_TRAITS.filter((_, index) => truthPresent(meritValues[index]!)));
  const riskTraits = Object.freeze(RISK_TRAITS.filter((_, index) => truthPresent(riskValues[index]!)));

  return Object.freeze({
    kind: "hive-curation.valuation" as const,
    subject,
    meritMass: meritCoords.truth,
    riskMass: riskCoords.truth,
    conflictMass: meritCoords.conflict,
    meritTraits,
    riskTraits,
    score,
    admitted: ratSign(meritCoords.truth) > 0 && ratSign(score) > 0,
    headline: hiveChargeAtBoundary(section, subjectTerm, exhibitsPredicate, curationTerm(MERIT_TRAITS[0])),
  });
}

/** The dominance partial order on valuation points: `a` dominates `b` when it
 *  carries at least as much merit, no more risk, no more conflict, and is
 *  strictly better on some axis. Neither-dominates is genuine incomparability —
 *  not a defect to be scalarized away. */
export function dominates(a: CurationValuation, b: CurationValuation): boolean {
  const meritDelta = ratSign(ratSubtract(a.meritMass, b.meritMass));
  const riskDelta = ratSign(ratSubtract(a.riskMass, b.riskMass));
  const conflictDelta = ratSign(ratSubtract(a.conflictMass, b.conflictMass));
  const weaklyBetter = meritDelta >= 0 && riskDelta <= 0 && conflictDelta <= 0;
  const strictlyBetter = meritDelta > 0 || riskDelta < 0 || conflictDelta < 0;
  return weaklyBetter && strictlyBetter;
}

/** Two valuations are incomparable under dominance — each better on some axis. */
export function incomparable(a: CurationValuation, b: CurationValuation): boolean {
  return !dominates(a, b) && !dominates(b, a) && !(
    ratSign(ratSubtract(a.meritMass, b.meritMass)) === 0 &&
    ratSign(ratSubtract(a.riskMass, b.riskMass)) === 0 &&
    ratSign(ratSubtract(a.conflictMass, b.conflictMass)) === 0
  );
}

/**
 * The declared boundary read: the exact score collapsed to basis points for the
 * linear-mana knapsack. This is the ONE place a float enters — slice
 * coordinate, in spacetime's `AtBoundary` spirit. Non-positive scores clamp to
 * 0 (the candidate will abstain in the allocator). The exact `score` and the
 * dominance order remain the real objects; this is only the knapsack's ruler.
 */
export function scoreBasisPoints(valuation: CurationValuation): bigint {
  const bp = Math.round(toNumber(valuation.score) * 10000);
  return BigInt(bp > 0 ? bp : 0);
}
