/**
 * ontology — the curation predicate ontology, and the utterance-only
 * translation of on-chain facts.
 *
 * Discipline (meme-topology): evidence enters only by articulating utterances.
 * A trait is a relational claim — cell `(post, exhibits, <trait>)`; a "bad"
 * trait (`whale-propping`, `downvote-contest`) is itself a claimed contrary
 * predicate, never a denial. There is no denial verb: a contested trait (e.g.
 * a post we claimed underrecognized that later caught a reward wave) is met by
 * claiming the contrary predicate, and opposing evidence knowledge-joins the
 * cell to `stable` — a surfaced contradiction, not an erasure.
 *
 * The ontology is itself claimed via the specialization concept: each merit
 * trait specializes `investment-merit`, each risk trait `investment-risk` —
 * a relational claim of the specialization predicate that also installs the
 * specialization edge. These edges carry no charge (the probe confirmed they
 * do not roll up in the section); they are the proof-carrying record of WHY a
 * trait counts, read by the typed theory, and they fix the two trait frames
 * the valuation measures over.
 *
 * The witnessing thresholds below are FACTS at the boundary — "does the chain
 * show this" — exposed as parameters, never as merit weights. Whether a trait
 * holds is boolean; how traits combine is the measure's job (see valuation),
 * never a coefficient here.
 */
import {
  mark,
  utterance,
  type PredicationPredicate,
  type PredicationTerm,
  type UtteranceCarrier,
} from "@emsenn/relating";
import { predicationTerm, predicationPredicate, predicateMarkValue } from "../predication.mjs";
import { type PostObservation, reputationScore, downvoteRshares } from "./observation.mjs";

export const EXHIBITS = "exhibits";
export const SPECIALIZES = "specializes";
export const INVESTMENT_MERIT = "investment-merit";
export const INVESTMENT_RISK = "investment-risk";

/** Traits that specialize investment-merit (the curation-alpha frame). */
export const MERIT_TRAITS = Object.freeze([
  "underrecognition",
  "broad-engagement",
  "discussion-depth",
  "author-standing",
  "community-embedding",
  "sourced-provenance",
] as const);

/** Traits that specialize investment-risk (the discount frame). */
export const RISK_TRAITS = Object.freeze([
  "whale-propping",
  "downvote-contest",
  "reward-saturation",
] as const);

export type MeritTrait = (typeof MERIT_TRAITS)[number];
export type RiskTrait = (typeof RISK_TRAITS)[number];

/** Boundary facts: the chain conditions under which each trait is witnessed.
 *  Defaults are starting points; tuning them is a correspondence question, not
 *  a change to the valuation. Amounts are HBD micro-units (1 HBD = 1_000_000). */
export interface WitnessingThresholds {
  /** discussion exists but reward has not arrived: children ≥ this … */
  readonly underrecognizedMinChildren: number;
  /** … and pending payout below this. */
  readonly underrecognizedMaxPendingMicro: bigint;
  /** broad approval: at least this many distinct voters … */
  readonly broadMinVoters: number;
  /** depth: at least this many replies. */
  readonly depthMinChildren: number;
  /** an author at or above this reputation score is "standing". */
  readonly authorStandingMinScore: number;
  /** saturation: pending payout at or above this is already well-rewarded. */
  readonly saturationMinPendingMicro: bigint;
  /** downvote magnitude over abs_rshares, in parts-per-thousand, to flag contest. */
  readonly downvoteContestPerMille: bigint;
}

export const DEFAULT_THRESHOLDS: WitnessingThresholds = Object.freeze({
  underrecognizedMinChildren: 2,
  underrecognizedMaxPendingMicro: 5_000_000n, // 5.000 HBD
  broadMinVoters: 5,
  depthMinChildren: 3,
  authorStandingMinScore: 40,
  saturationMinPendingMicro: 30_000_000n, // 30.000 HBD
  downvoteContestPerMille: 100n, // 10%
});

/** The post's stable subject term, "author/permlink". */
export const postSubject = (observation: PostObservation): string =>
  `${observation.author}/${observation.permlink}`;

const majorityVoter = (observation: PostObservation): boolean =>
  observation.absRshares > 0n && observation.topVoterRshares * 2n > observation.absRshares;

/** Which merit traits the chain witnesses for this post (boolean facts). */
export function witnessedMeritTraits(
  observation: PostObservation,
  thresholds: WitnessingThresholds = DEFAULT_THRESHOLDS,
): readonly MeritTrait[] {
  const traits: MeritTrait[] = [];
  if (
    observation.children >= thresholds.underrecognizedMinChildren &&
    observation.pendingPayoutHbdMicro < thresholds.underrecognizedMaxPendingMicro
  ) traits.push("underrecognition");
  if (observation.distinctVoters >= thresholds.broadMinVoters && !majorityVoter(observation)) {
    traits.push("broad-engagement");
  }
  if (observation.children >= thresholds.depthMinChildren) traits.push("discussion-depth");
  if (reputationScore(observation.authorReputationRaw) >= thresholds.authorStandingMinScore) {
    traits.push("author-standing");
  }
  if (observation.inCommunity) traits.push("community-embedding");
  if (observation.hasSourceLinks === true) traits.push("sourced-provenance");
  return Object.freeze(traits);
}

/** Which risk traits the chain witnesses for this post (boolean facts). */
export function witnessedRiskTraits(
  observation: PostObservation,
  thresholds: WitnessingThresholds = DEFAULT_THRESHOLDS,
): readonly RiskTrait[] {
  const traits: RiskTrait[] = [];
  if (majorityVoter(observation)) traits.push("whale-propping");
  const downvotePerMille = observation.absRshares > 0n
    ? (downvoteRshares(observation) * 1000n) / observation.absRshares
    : 0n;
  if (observation.netRshares <= 0n || downvotePerMille >= thresholds.downvoteContestPerMille) {
    traits.push("downvote-contest");
  }
  if (observation.pendingPayoutHbdMicro >= thresholds.saturationMinPendingMicro) {
    traits.push("reward-saturation");
  }
  return Object.freeze(traits);
}

/** A relational claim of the specialization concept — installs the edge. */
export const curationTerm = (value: string): PredicationTerm => predicationTerm(value);
export const curationPredicate = (value: string): PredicationPredicate => predicationPredicate(value);

const specializationUtterance = (subject: string, object: string): UtteranceCarrier =>
  utterance(mark({ subject: curationTerm(subject), object: curationTerm(object) }), mark(predicateMarkValue(curationPredicate(SPECIALIZES))));

/** A trait claim: the relational cell `(post, exhibits, <trait>)`. */
const traitUtterance = (subject: string, trait: string): UtteranceCarrier =>
  utterance(mark({ subject: curationTerm(subject), object: curationTerm(trait) }), mark(predicateMarkValue(curationPredicate(EXHIBITS))));

/** The recorded ontology edges — proof-carrying, settled once per carrier. */
export function ontologyEdges(): readonly UtteranceCarrier[] {
  return Object.freeze([
    ...MERIT_TRAITS.map((trait) => specializationUtterance(trait, INVESTMENT_MERIT)),
    ...RISK_TRAITS.map((trait) => specializationUtterance(trait, INVESTMENT_RISK)),
  ]);
}

/**
 * The utterance log for one post: every witnessed trait, plus the ontology
 * edges. Fixed-point readings of this utterance log give the post's settled carrier reads.
 */
export function postUtterances(
  observation: PostObservation,
  thresholds: WitnessingThresholds = DEFAULT_THRESHOLDS,
): readonly UtteranceCarrier[] {
  const subject = postSubject(observation);
  const merit = witnessedMeritTraits(observation, thresholds);
  const risk = witnessedRiskTraits(observation, thresholds);
  return Object.freeze([
    ...merit.map((trait) => traitUtterance(subject, trait)),
    ...risk.map((trait) => traitUtterance(subject, trait)),
    ...ontologyEdges(),
  ]);
}
