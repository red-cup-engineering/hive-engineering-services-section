import { DEFAULT_THRESHOLDS, MERIT_TRAITS, RISK_TRAITS, postSubject, witnessedMeritTraits, witnessedRiskTraits } from "./ontology.mjs";
const SCALE=10000n;
const ratio=(count,total)=>total===0?0n:BigInt(count)*SCALE/BigInt(total);
export function valuatePost(observation, thresholds=DEFAULT_THRESHOLDS) {
 const meritTraits=witnessedMeritTraits(observation,thresholds); const riskTraits=witnessedRiskTraits(observation,thresholds);
 const meritMass=ratio(meritTraits.length,MERIT_TRAITS.length); const riskMass=ratio(riskTraits.length,RISK_TRAITS.length); const conflictMass=0n; const score=meritMass-riskMass;
 return Object.freeze({kind:"hive-curation.valuation",subject:postSubject(observation),meritMass,riskMass,conflictMass,meritTraits,riskTraits,score,admitted:meritMass>0n&&score>0n,headline:Object.freeze({subject:postSubject(observation),meritTraits,riskTraits})});
}
export const dominates=(a,b)=>(a.meritMass>=b.meritMass&&a.riskMass<=b.riskMass&&a.conflictMass<=b.conflictMass)&&(a.meritMass>b.meritMass||a.riskMass<b.riskMass||a.conflictMass<b.conflictMass);
export const incomparable=(a,b)=>!dominates(a,b)&&!dominates(b,a)&&(a.meritMass!==b.meritMass||a.riskMass!==b.riskMass||a.conflictMass!==b.conflictMass);
export const scoreBasisPoints=valuation=>valuation.score>0n?valuation.score:0n;
