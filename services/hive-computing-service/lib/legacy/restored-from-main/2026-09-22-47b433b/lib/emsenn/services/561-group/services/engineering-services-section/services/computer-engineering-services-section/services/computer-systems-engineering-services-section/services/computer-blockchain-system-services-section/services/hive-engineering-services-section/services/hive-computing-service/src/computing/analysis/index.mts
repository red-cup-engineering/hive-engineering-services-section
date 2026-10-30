/**
 * analysis — spectral & harmonic geometry of the Hive attention-capital graph.
 *
 * A settled Hive carrier is a typed graph of subjects (accounts, posts, tags,
 * communities) related by the cells of its sections: who voted on what, who
 * follows whom, who authored what. This module reads that graph spectrally —
 * the move the attention-capital research calls for, where attention,
 * reputation, reward, and governance are coupled flows over a site of local
 * contexts rather than separate dashboards.
 *
 *  - `attentionSpectrum` exposes the graph Laplacian's exact characteristic
 *    polynomial — the *semantic eigenvalues* of the attention field — together
 *    with the component count (isolated cliques: the spectral signature of
 *    curation-trail cartels and whale silos; the multiplicity of the zero
 *    eigenvalue is exactly that count).
 *  - `rewardObstruction` tests whether a reward assignment is *harmonic* over
 *    the graph. A harmonic assignment is one where every subject's reward is the
 *    weighted average of its neighbours' — a globally consistent section. On a
 *    connected graph the only harmonic assignments are the constants, so any
 *    real reward field obstructs, and the obstruction is the exact realization
 *    of the H¹ class the research names: a subject that is a net *source*
 *    (over-rewarded, positive deviation) or *sink* (under-rewarded, negative
 *    deviation) of reward relative to its neighbourhood. Curation alpha — value
 *    not yet priced by the graph — lives in the negative deviations.
 */
import {
  componentCount, spectrumPolynomial, harmonic,
  type RelationGraphCarrier, type HarmonicJudgment,
} from "@emsenn/relating/analysis";
import { natCompare, natOne, type Integer, type Natural, type Rational } from "@emsenn/relating";
import type { HiveTopologyCarrier } from "../topology/index.mjs";
import { attentionGraph } from "./graph.mjs";
export { attentionGraph } from "./graph.mjs";

export interface AttentionSpectrum {
  readonly kind: "hive-analysis.attention-spectrum";
  /** Connected components of the relation graph — isolated attention/reward
   *  cliques. >1 means the attention field has fractured into silos. */
  readonly components: Natural;
  /** Exact characteristic polynomial of the graph Laplacian, lowest degree
   *  first. Its roots are the Laplacian eigenvalues; the multiplicity of the
   *  zero root equals `components`. The full exact spectral content — no floats. */
  readonly characteristicPolynomial: readonly Integer[];
  /** A single connected attention field (no fragmentation into cliques). */
  readonly connected: boolean;
}

/** Read the attention field of a Hive carrier spectrally. */
export function attentionSpectrum(carrier: HiveTopologyCarrier): AttentionSpectrum {
  const graph = attentionGraph(carrier);
  const components = componentCount(graph);
  return Object.freeze({
    kind: "hive-analysis.attention-spectrum" as const,
    components,
    characteristicPolynomial: spectrumPolynomial(graph),
    connected: natCompare(components, natOne) <= 0,
  });
}

/**
 * Whether a reward assignment is harmonic (a balanced global section) over the
 * attention graph. `valueOf` reads a real-valued reward potential for each
 * subject term. A witness means reward flows are balanced everywhere; an
 * obstruction names the first subject whose reward departs from its
 * neighbourhood average — `deviation > 0` over-rewarded, `deviation < 0`
 * under-rewarded (where curation alpha hides).
 */
export function rewardObstruction(
  carrier: HiveTopologyCarrier,
  valueOf: (term: RelationGraphCarrier["terms"][number]) => Rational,
): HarmonicJudgment {
  const graph = attentionGraph(carrier);
  return harmonic(graph, graph.terms.map((term) => valueOf(term)));
}

// The exact alpha functionals (see ./alpha.mts and docs/max-alpha.md): the
// derivable, bounded "max alpha" objects built on the spectral/harmonic core.
export * from "./alpha.mjs";
