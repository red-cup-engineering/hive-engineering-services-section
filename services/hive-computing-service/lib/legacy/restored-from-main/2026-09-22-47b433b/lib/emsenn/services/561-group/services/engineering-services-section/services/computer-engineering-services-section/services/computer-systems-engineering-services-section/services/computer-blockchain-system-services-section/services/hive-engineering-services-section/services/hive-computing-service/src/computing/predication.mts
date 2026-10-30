import {
  claim,
  mark,
  predicateOfClaim,
  token,
  type PredicationPredicate,
  type PredicationTerm,
} from "@emsenn/relating";

export const predicationTerm = (value: string): PredicationTerm => token(mark(value));
export const predicationPredicate = (value: string): PredicationPredicate => predicateOfClaim(claim(mark(value)));
export const predicateMarkValue = (predicate: PredicationPredicate): unknown => predicate.mark.value;
