/**
 * alpha — max curation-alpha as a derivable, bounded object (see docs/max-alpha.md).
 *
 * Reward as a field r over the attention graph G with Laplacian L = D − W:
 *  - `mispricingEnergy` = E(r) = rᵀ L r = Σ_{i<j} w_ij (r_i − r_j)² — the exact
 *    total addressable alpha; zero iff r is harmonic (everything fairly priced).
 *  - `capturableSinks` = the subjects priced BELOW their neighbourhood (negative
 *    harmonic deviation): the opportunity set, deepest deficit first.
 *  - `alphaDecay` = the spectral persistence of the edge: component count (the
 *    zero-eigenvalue multiplicity; >1 ⟹ fragmented graph ⟹ slow/never
 *    correction ⟹ durable alpha), with the Laplacian characteristic polynomial
 *    (whose root gap λ₂ is the correction rate) when asked for.
 *
 * Exact throughout: edge weights are integers and the reward field is an exact
 * amount per subject (graded rationals), so the
 * addressable alpha is an exact amount in the field's commodity squared.
 */
import { ratFromInt } from "@red-cup-engineering/exact-number-data-service/exact-number";
import { gradeOf, gradedAdd, gradedCompare, gradedNegate, gradedScale, gradedSign, gradedSubtract, gradedTimes, gradedZero } from "@red-cup-engineering/exact-number-data-service/graded";
import { attentionGraph, attentionSpectrum } from "./graph.mjs";

function field(graph, valueOf) {
    const r = graph.terms.map(valueOf);
    const commodity = r[0] === undefined ? undefined : gradeOf(r[0]);
    if (r.some((value) => gradeOf(value) !== commodity)) throw new TypeError("alpha: the reward field must be in one commodity");
    return { r, commodity: commodity ?? "reward" };
}

/** The exact mispricing energy E(r) = Σ_{i<j} w_ij (r_i − r_j)², in the field's commodity squared.
 *  Exactly zero iff r is harmonic. */
export function mispricingEnergy(carrier, valueOf) {
    const graph = attentionGraph(carrier);
    const { r, commodity } = field(graph, valueOf);
    const squared = `${commodity}^2`;
    let energy = gradedZero(squared);
    for (const { i, j, w } of graph.edges) {
        const diff = gradedSubtract(r[i], r[j]);
        energy = gradedAdd(energy, gradedScale(gradedTimes(diff, diff, squared), ratFromInt(w)));
    }
    return energy;
}

/** Subjects priced below their neighbourhood (negative harmonic deviation): the curation-alpha
 *  opportunity set, deepest deficit first. Subject i's deviation is (L r)_i = Σ_j w_ij (r_i − r_j);
 *  a sink has it negative, and its deficit is that deviation negated. */
export function capturableSinks(carrier, valueOf) {
    const graph = attentionGraph(carrier);
    const { r, commodity } = field(graph, valueOf);
    const deviation = graph.terms.map(() => gradedZero(commodity));
    for (const { i, j, w } of graph.edges) {
        const diff = gradedScale(gradedSubtract(r[i], r[j]), ratFromInt(w));
        deviation[i] = gradedAdd(deviation[i], diff);
        deviation[j] = gradedAdd(deviation[j], gradedNegate(diff));
    }
    const sinks = graph.terms.flatMap((term, index) => gradedSign(deviation[index]) < 0 ? [{ term, deficit: gradedNegate(deviation[index]) }] : []);
    return Object.freeze(sinks.sort((a, b) => gradedCompare(b.deficit, a.deficit)));
}

/** The spectral persistence of any edge over this attention field: fragmentation (components > 1)
 *  means durable alpha; the characteristic polynomial carries the correction rate when asked. */
export function alphaDecay(carrier, { spectrum = false } = {}) {
    const graph = attentionGraph(carrier);
    return Object.freeze({
        kind: "hive-analysis.alpha-decay",
        components: graph.components,
        durable: graph.components > 1,
        ...(spectrum ? { characteristicPolynomial: attentionSpectrum(graph) } : {}),
    });
}

