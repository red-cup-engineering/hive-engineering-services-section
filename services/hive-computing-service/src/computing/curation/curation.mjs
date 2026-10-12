import { expectedCurationReward } from "@red-cup-engineering/hive-blockchain-client-service/rewards.mjs";
import { rationalUnits } from "@red-cup-engineering/exact-number-data-service/decimal-string";
import { gradedSign, gradedValue } from "@red-cup-engineering/exact-number-data-service/graded";
import { DEFAULT_THRESHOLDS } from "./ontology.mjs";
import { valuatePost, scoreBasisPoints } from "./valuation.mjs";
/**
 * Build a curation proposal for one observed post. Its value is the vote's expected curation
 * reward in HBD (the client's expectedCurationReward: window-penalized curation weight at the
 * price per rshare the post realizes, `hbdPerRshare`), and its merit is that value scaled by the
 * post's trait valuation and, when present, its content fitness.
 */
export function curationProposal(observation, mana, options = {}) {
    const weightBps = options.weightBps ?? 10_000;
    const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
    if (!options.hbdPerRshare) throw new TypeError("curationProposal: an hbdPerRshare price is required");
    const valuation = valuatePost(observation, thresholds);
    const contentFitness = options.contentFitness;
    const reward = expectedCurationReward({
        currentMana: mana.currentMana,
        weightBps,
        secondsSinceCreation: observation.ageSeconds,
        hbdPerRshare: options.hbdPerRshare,
        allowsCurationRewards: observation.allowsCurationRewards,
        ...(observation.percentCurationRewards === undefined ? {} : { percentCurationRewards: observation.percentCurationRewards }),
        ...(options.votePowerReserveRate === undefined ? {} : { votePowerReserveRate: options.votePowerReserveRate }),
    });
    const expectedMicroHbd = rationalUnits(gradedValue(reward.expectedHbd), 6, { rounding: "toward-zero" });
    // Both axes must admit when content fitness is present: value × social_score_bps/10000 × content_score/400.
    const socialAdmitted = valuation.admitted && reward.eligible;
    const contentAdmitted = contentFitness === undefined || contentFitness.admitted;
    const merit = socialAdmitted && contentAdmitted
        ? contentFitness !== undefined
            ? (expectedMicroHbd * scoreBasisPoints(valuation) * contentFitness.score) / (10000n * 400n)
            : (expectedMicroHbd * scoreBasisPoints(valuation)) / 10000n
        : 0n;
    return Object.freeze({
        id: valuation.subject,
        action: Object.freeze({ author: observation.author, permlink: observation.permlink, weightBps }),
        cost: reward.usedMana,
        merit,
        admitted: socialAdmitted && contentAdmitted,
        justification: valuation.headline,
        valuation,
        contentFitness,
        window: reward.window,
        eligible: reward.eligible,
        usedMana: reward.usedMana,
        ourRshares: reward.rshares,
        expectedHbd: reward.expectedHbd,
    });
}
/**
 * Choose an account's curation votes from observed posts: the one curation selection.
 * Each post is priced (curationProposal: expected HBD at `price`, or at `priceOf(observation)`
 * where a community's realized price is known), refused where a rule forbids it, and the admitted
 * rest are allocated by merit per unit of mana while the mana above the floor lasts.
 *
 * Refusals: author-excluded (policy.neverVoteAuthors), already-voted (the account is among the
 * post's voters), excluded (policy.exclude(observation) names a reason), not-admitted (the trait
 * valuation, or the content fitness the observation carries, does not admit it), no-expected-curation-reward (window closed or
 * curation declined), over-budget (the mana above the floor, or policy.budgetBps of current mana,
 * is spent).
 *
 * @param {{ account: string, observations: readonly object[], mana: {currentMana: bigint, maxMana: bigint},
 *   price: {hbdPerRshare, percentCurationRewards?, votePowerReserveRate?}, priceOf?: Function,
 *   thresholds?: object,
 *   policy?: { weightBps?: number, weightOf?: Function, manaFloorBps?: number, budgetBps?: number,
 *     neverVoteAuthors?: readonly string[], exclude?: Function } }} input
 * @returns {{ proposals, decisions: readonly {proposal, accepted, reason?}[], votes, remainingMana: bigint }}
 */
export function selectCurationVotes(input) {
    const policy = input.policy ?? {};
    const never = new Set(policy.neverVoteAuthors ?? []);
    const { currentMana, maxMana } = input.mana;
    const floor = (maxMana * BigInt(Math.max(0, Math.min(10_000, Math.trunc(policy.manaFloorBps ?? 0))))) / 10000n;
    const aboveFloor = currentMana > floor ? currentMana - floor : 0n;
    const budget = policy.budgetBps === undefined ? aboveFloor : (() => {
        const capped = (currentMana * BigInt(policy.budgetBps)) / 10000n;
        return capped < aboveFloor ? capped : aboveFloor;
    })();
    const decisions = [];
    const candidates = [];
    const proposals = [];
    for (const observation of input.observations) {
        const weightBps = policy.weightOf?.(observation) ?? policy.weightBps ?? 10_000;
        const contentFitness = observation.contentFitness;
        const proposal = curationProposal(observation, { currentMana }, {
            weightBps,
            hbdPerRshare: input.priceOf?.(observation) ?? input.price.hbdPerRshare,
            ...(input.price.votePowerReserveRate === undefined ? {} : { votePowerReserveRate: input.price.votePowerReserveRate }),
            ...(input.thresholds === undefined ? {} : { thresholds: input.thresholds }),
            ...(contentFitness === undefined ? {} : { contentFitness }),
        });
        proposals.push(proposal);
        const excluded = policy.exclude?.(observation);
        const reason = never.has(observation.author) ? "author-excluded"
            : (observation.voters ?? []).includes(input.account) ? "already-voted"
                : excluded ? excluded
                    : !proposal.eligible || gradedSign(proposal.expectedHbd) <= 0 ? "no-expected-curation-reward"
                        : !proposal.admitted ? "not-admitted"
                            : null;
        if (reason) decisions.push(Object.freeze({ proposal, accepted: false, reason }));
        else candidates.push(proposal);
    }
    // Merit per unit of mana, densest first.
    candidates.sort((left, right) => {
        const l = left.merit * right.cost;
        const r = right.merit * left.cost;
        return l === r ? 0 : l > r ? -1 : 1;
    });
    let remaining = budget;
    const votes = [];
    for (const proposal of candidates) {
        if (proposal.cost <= remaining) {
            remaining -= proposal.cost;
            votes.push(proposal);
            decisions.push(Object.freeze({ proposal, accepted: true }));
        } else decisions.push(Object.freeze({ proposal, accepted: false, reason: "over-budget" }));
    }
    return Object.freeze({ proposals: Object.freeze(proposals), decisions: Object.freeze(decisions), votes: Object.freeze(votes), remainingMana: remaining });
}
