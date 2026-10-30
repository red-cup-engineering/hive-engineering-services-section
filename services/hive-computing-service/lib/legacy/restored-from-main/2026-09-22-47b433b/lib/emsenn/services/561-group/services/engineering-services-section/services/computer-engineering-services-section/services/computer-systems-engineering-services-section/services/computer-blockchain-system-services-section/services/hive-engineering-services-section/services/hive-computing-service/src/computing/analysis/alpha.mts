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
 *    correction ⟹ durable alpha) plus the exact Laplacian characteristic
 *    polynomial (whose root gap λ₂ is the correction rate).
 *
 * Exact throughout: edge weights are integers, the reward field is rational, so
 * the addressable alpha is an exact rational — science on the money, not a float.
 */
import {
  componentCount, spectrumPolynomial,
  type RelationGraphCarrier,
} from "@emsenn/relating/analysis";
import {
  fromInteger, intIsZero, natCompare, natOne, ratZero, ratAdd, ratSubtract, ratMultiply, ratNegate, ratSign, ratCompare,
  type Rational, type Integer, type Natural,
} from "@emsenn/relating";
import type { HiveTopologyCarrier } from "../topology/index.mjs";
import { attentionGraph } from "./graph.mjs";

type Term = RelationGraphCarrier["terms"][number];

/** The exact mispricing energy E(r) = Σ_{i<j} w_ij (r_i − r_j)² — the total
 *  addressable alpha in the reward field. Exactly zero iff r is harmonic. */
export function mispricingEnergy(
  carrier: HiveTopologyCarrier,
  valueOf: (term: Term) => Rational,
): Rational {
  const graph = attentionGraph(carrier);
  const r = graph.terms.map(valueOf);
  let energy = ratZero;
  for (let i = 0; i < graph.terms.length; i++) {
    for (let j = i + 1; j < graph.terms.length; j++) {
      const w = graph.weights[i]![j]!;
      if (intIsZero(w)) continue;
      const diff = ratSubtract(r[i]!, r[j]!);
      energy = ratAdd(energy, ratMultiply(fromInteger(w), ratMultiply(diff, diff)));
    }
  }
  return energy;
}

export interface CapturableSink {
  readonly term: Term;
  /** How far below its neighbourhood the subject is priced — exact, positive. */
  readonly deficit: Rational;
}

/** Subjects priced below their neighbourhood (negative harmonic deviation): the
 *  curation-alpha opportunity set, deepest deficit first. Subject i's deviation
 *  is (L r)_i = Σ_j w_ij (r_i − r_j); a sink has it negative. */
export function capturableSinks(
  carrier: HiveTopologyCarrier,
  valueOf: (term: Term) => Rational,
): readonly CapturableSink[] {
  const graph = attentionGraph(carrier);
  const r = graph.terms.map(valueOf);
  const sinks: CapturableSink[] = [];
  for (let i = 0; i < graph.terms.length; i++) {
    let dev = ratZero;
    for (let j = 0; j < graph.terms.length; j++) {
      if (i === j) continue;
      const w = graph.weights[i]![j]!;
      if (intIsZero(w)) continue;
      dev = ratAdd(dev, ratMultiply(fromInteger(w), ratSubtract(r[i]!, r[j]!)));
    }
    if (ratSign(dev) < 0) sinks.push({ term: graph.terms[i]!, deficit: ratNegate(dev) });
  }
  return Object.freeze([...sinks].sort((a, b) => ratCompare(b.deficit, a.deficit)));
}

export interface AlphaDecay {
  readonly kind: "hive-analysis.alpha-decay";
  /** Connected components = multiplicity of the zero Laplacian eigenvalue. */
  readonly components: Natural;
  /** Fragmented attention (>1 component): slow/never correction — durable alpha. */
  readonly durable: boolean;
  /** Exact Laplacian characteristic polynomial; its root gap λ₂ is the rate at
   *  which the market corrects an edge. */
  readonly characteristicPolynomial: readonly Integer[];
}

/** The spectral persistence of any edge over this attention field. */
export function alphaDecay(carrier: HiveTopologyCarrier): AlphaDecay {
  const graph = attentionGraph(carrier);
  const components = componentCount(graph);
  return Object.freeze({
    kind: "hive-analysis.alpha-decay" as const,
    components,
    durable: natCompare(components, natOne) === 1,
    characteristicPolynomial: spectrumPolynomial(graph),
  });
}
