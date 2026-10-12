import { cohomologyLaplacian, cohomologyOfCells } from "@red-cup-engineering/signgraph/cohomology";
import { hiveKnowledgeSection } from "../topology/index.mjs";

/** The attention-capital relation graph of a settled Hive carrier (SignGraph): its terms (the
 *  settled cells' subjects and objects), its edges { i, j, w } with w the number of cells relating
 *  terms i < j, and its connected components (the rank of H⁰). Sparse and exact; the Laplacian's
 *  characteristic polynomial is left to `attentionSpectrum`, which only the decay reading needs. */
export function attentionGraph(carrier) {
  const cohomology = cohomologyOfCells(hiveKnowledgeSection(carrier));
  const index = new Map(cohomology.entities.map((term, position) => [term, position]));
  const weights = new Map();
  for (const cell of cohomology.cells) {
    const [i, j] = [index.get(cell.subject), index.get(cell.object)].sort((a, b) => a - b);
    if (i === j) continue;
    weights.set(`${i},${j}`, (weights.get(`${i},${j}`) ?? 0) + 1);
  }
  const edges = [...weights].map(([key, w]) => {
    const [i, j] = key.split(",").map(Number);
    return Object.freeze({ i, j, w });
  });
  return Object.freeze({
    kind: "hive-analysis.attention-graph",
    terms: cohomology.entities,
    edges: Object.freeze(edges),
    components: cohomology.zeroCohomology.rank,
    cohomology,
  });
}

/** The attention graph's Laplacian characteristic polynomial (its root gap λ₂ is the correction
 *  rate). Exact integer arithmetic: bounded to fields SignGraph's Laplacian can hold. */
export function attentionSpectrum(graph) {
  return cohomologyLaplacian(graph.cohomology).characteristicPolynomial;
}
