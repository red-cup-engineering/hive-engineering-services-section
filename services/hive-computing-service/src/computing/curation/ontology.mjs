import { reputationScore, downvoteRshares } from "./observation.mjs";
export const EXHIBITS = "exhibits";
export const INVESTMENT_MERIT = "investment-merit";
export const INVESTMENT_RISK = "investment-risk";
export const MERIT_TRAITS = Object.freeze(["underrecognition", "broad-engagement", "discussion-depth", "author-standing", "community-embedding", "sourced-provenance"]);
export const RISK_TRAITS = Object.freeze(["whale-propping", "downvote-contest", "reward-saturation"]);
export const DEFAULT_THRESHOLDS = Object.freeze({ underrecognizedMinChildren:2, underrecognizedMaxPendingMicro:5000000n, broadMinVoters:5, depthMinChildren:3, authorStandingMinScore:40, saturationMinPendingMicro:30000000n, downvoteContestPerMille:100n });
export const postSubject = observation => `${observation.author}/${observation.permlink}`;
const majorityVoter = observation => observation.absRshares > 0n && observation.topVoterRshares * 2n > observation.absRshares;
export function witnessedMeritTraits(observation, thresholds = DEFAULT_THRESHOLDS) {
 const traits=[];
 if(observation.children >= thresholds.underrecognizedMinChildren && observation.pendingPayoutHbdMicro < thresholds.underrecognizedMaxPendingMicro) traits.push("underrecognition");
 if(observation.distinctVoters >= thresholds.broadMinVoters && !majorityVoter(observation)) traits.push("broad-engagement");
 if(observation.children >= thresholds.depthMinChildren) traits.push("discussion-depth");
 if(reputationScore(observation.authorReputationRaw) >= thresholds.authorStandingMinScore) traits.push("author-standing");
 if(observation.inCommunity) traits.push("community-embedding");
 if(observation.hasSourceLinks === true) traits.push("sourced-provenance");
 return Object.freeze(traits);
}
export function witnessedRiskTraits(observation, thresholds = DEFAULT_THRESHOLDS) {
 const traits=[];
 if(majorityVoter(observation)) traits.push("whale-propping");
 const downvotePerMille=observation.absRshares>0n ? downvoteRshares(observation)*1000n/observation.absRshares : 0n;
 if(observation.netRshares<=0n || downvotePerMille>=thresholds.downvoteContestPerMille) traits.push("downvote-contest");
 if(observation.pendingPayoutHbdMicro>=thresholds.saturationMinPendingMicro) traits.push("reward-saturation");
 return Object.freeze(traits);
}
/** Plain evidence records retain the observed trait and its predicate. */
export function ontologyEdges() { return Object.freeze([...MERIT_TRAITS.map(trait=>Object.freeze({subject:trait,predicate:"specializes",object:INVESTMENT_MERIT})),...RISK_TRAITS.map(trait=>Object.freeze({subject:trait,predicate:"specializes",object:INVESTMENT_RISK}))]); }
export function postUtterances(observation, thresholds=DEFAULT_THRESHOLDS) { const subject=postSubject(observation); return Object.freeze([...witnessedMeritTraits(observation,thresholds),...witnessedRiskTraits(observation,thresholds)].map(trait=>Object.freeze({subject,predicate:EXHIBITS,object:trait}))); }
