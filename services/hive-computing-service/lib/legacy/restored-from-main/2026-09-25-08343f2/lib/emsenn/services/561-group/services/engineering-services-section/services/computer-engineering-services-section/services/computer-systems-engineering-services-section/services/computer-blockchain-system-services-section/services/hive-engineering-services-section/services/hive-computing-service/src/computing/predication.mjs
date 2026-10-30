import { claim, token } from "@red-cup-engineering/computer-data-engineering-services-section/signcell/utterance";
import { mark } from "@red-cup-engineering/computer-data-engineering-services-section/signcell/mark";
import { predicateOfClaim } from "@red-cup-engineering/computer-data-engineering-services-section/signcell/predication";
export const predicationTerm = (value) => token(mark(value));
export const predicationPredicate = (value) => predicateOfClaim(claim(mark(value)));
export const predicateMarkValue = (predicate) => predicate.mark.value;
