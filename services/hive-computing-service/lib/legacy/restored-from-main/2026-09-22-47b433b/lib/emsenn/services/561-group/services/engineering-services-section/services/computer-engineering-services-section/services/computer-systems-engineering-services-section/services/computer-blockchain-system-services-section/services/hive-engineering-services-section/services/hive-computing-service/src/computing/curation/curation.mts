import { voteRshares } from "../topology/rewards.mjs";
import {
  voteCurationWeight, curationWindow, isCurationEligible,
  type CurationWindow,
} from "../topology/curation.mjs";
import type { Proposal } from "@emsenn/animating/becoming/doing/working/governing/deciding";
import { type ContentFitnessValuation } from "../content/index.mjs";
import { type PostObservation } from "./observation.mjs";
import { type WitnessingThresholds, DEFAULT_THRESHOLDS } from "./ontology.mjs";
import { valuatePost, scoreBasisPoints, type CurationValuation } from "./valuation.mjs";

export interface VoteAction {
  readonly author: string;
  readonly permlink: string;
  readonly weightBps: number;
}

/** A decision-topology proposal enriched with the curation reasoning. */
export interface CurationProposal extends Proposal<VoteAction> {
  readonly valuation: CurationValuation;
  /** Content-fitness axis, if fetched. Absent when body was not retrieved. */
  readonly contentFitness: ContentFitnessValuation | undefined;
  readonly window: CurationWindow;
  /** Curation can be earned (window open, post allows it, our vote is non-dust). */
  readonly eligible: boolean;
  /** Mana the vote draws (the linear cost). */
  readonly usedMana: bigint;
  /** rshares our vote contributes. */
  readonly ourRshares: bigint;
  /** Kernel magnitude before the valuation scaling (the under-voted share). */
  readonly expectedReturn: bigint;
}

export interface CurationManaState {
  readonly currentMana: bigint;
}

export interface CurationInputs {
  readonly observations: readonly PostObservation[];
  readonly mana: CurationManaState;
  readonly weightBps?: number;
  readonly votePowerReserveRate?: number;
  readonly thresholds?: WitnessingThresholds;
  /** Content-fitness valuations keyed by "author/permlink". When present for a
   *  post, both social and content axes must admit for merit to be non-zero. */
  readonly contentFitnessMap?: ReadonlyMap<string, ContentFitnessValuation>;
}

const nonNegative = (value: bigint): bigint => (value > 0n ? value : 0n);

/**
 * The kernel magnitude: our window-penalized curation weight times our share of
 * the post's eventual stake-weight. A lightly-voted post (small
 * `existingBefore`) yields a larger share — the curation-alpha shape, straight
 * from the reward mechanics, no invented coefficient.
 */
function expectedReturn(ourRshares: bigint, ageSeconds: number, netRshares: bigint): bigint {
  const existingBefore = nonNegative(netRshares);
  const curationWeight = voteCurationWeight({
    voteRshares: ourRshares,
    secondsSinceCreation: ageSeconds,
    commentRsharesBefore: existingBefore,
  });
  const denom = existingBefore + ourRshares;
  if (denom <= 0n) return 0n;
  return (curationWeight * ourRshares) / denom;
}

/** Build a curation proposal for one observed post. */
export function curationProposal(
  observation: PostObservation,
  mana: CurationManaState,
  options: {
    weightBps?: number;
    votePowerReserveRate?: number;
    thresholds?: WitnessingThresholds;
    contentFitness?: ContentFitnessValuation;
  } = {},
): CurationProposal {
  const weightBps = options.weightBps ?? 10_000;
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const valuation = valuatePost(observation, thresholds);
  const window = curationWindow(observation.ageSeconds);
  const contentFitness = options.contentFitness;

  const cost = voteRshares({
    currentMana: mana.currentMana,
    weightBps,
    ...(options.votePowerReserveRate === undefined ? {} : { votePowerReserveRate: options.votePowerReserveRate }),
  });
  const eligible = isCurationEligible({
    rshares: cost.rshares,
    secondsSinceCreation: observation.ageSeconds,
    allowsCurationRewards: observation.allowsCurationRewards,
    ...(observation.percentCurationRewards === undefined ? {} : { percentCurationRewards: observation.percentCurationRewards }),
  });

  const magnitude = eligible ? expectedReturn(cost.rshares, observation.ageSeconds, observation.netRshares) : 0n;

  // Both axes must admit when content fitness is present. Scale merit by both:
  // magnitude × social_score_bps/10000 × content_score/400.
  const socialAdmitted = valuation.admitted && eligible;
  const contentAdmitted = contentFitness === undefined || contentFitness.admitted;
  const merit = socialAdmitted && contentAdmitted
    ? contentFitness !== undefined
      ? (magnitude * scoreBasisPoints(valuation) * contentFitness.score) / (10_000n * 400n)
      : (magnitude * scoreBasisPoints(valuation)) / 10_000n
    : 0n;

  return Object.freeze({
    id: valuation.subject,
    action: Object.freeze({ author: observation.author, permlink: observation.permlink, weightBps }),
    cost: cost.usedMana,
    merit,
    justification: valuation.headline,
    valuation,
    contentFitness,
    window,
    eligible,
    usedMana: cost.usedMana,
    ourRshares: cost.rshares,
    expectedReturn: magnitude,
  });
}

/** Build proposals for every observed post. */
export function curationProposals(inputs: CurationInputs): readonly CurationProposal[] {
  const baseOptions = {
    ...(inputs.weightBps === undefined ? {} : { weightBps: inputs.weightBps }),
    ...(inputs.votePowerReserveRate === undefined ? {} : { votePowerReserveRate: inputs.votePowerReserveRate }),
    ...(inputs.thresholds === undefined ? {} : { thresholds: inputs.thresholds }),
  };
  return Object.freeze(inputs.observations.map((observation) => {
    const key = `${observation.author}/${observation.permlink}`;
    const contentFitness = inputs.contentFitnessMap?.get(key);
    return curationProposal(observation, inputs.mana, {
      ...baseOptions,
      ...(contentFitness !== undefined ? { contentFitness } : {}),
    });
  }));
}

/** The proposals both axes admit (passed to decision-topology's `decide`).
 *  When contentFitness is absent the content axis is not consulted. */
export function admittedProposals(proposals: readonly CurationProposal[]): readonly CurationProposal[] {
  return Object.freeze(proposals.filter((proposal) =>
    proposal.valuation.admitted &&
    proposal.eligible &&
    (proposal.contentFitness === undefined || proposal.contentFitness.admitted),
  ));
}
