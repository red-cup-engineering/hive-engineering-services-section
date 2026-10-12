import {
  cellEventId,
  observeReading,
  type Observation,
} from "@emsenn/computing/operating";
import type { EventPair } from "@emsenn/gaming/structuring";
import { fixedPointReadingsOfUtterances, type Cell } from "@emsenn/relating";
import {
  hiveChainObservationUtterances,
  induceHiveObservedTopology,
  type HiveChainObservation,
  type HiveTopologyCarrier,
  type UtteranceCarrier,
} from "./topology/index.mjs";

export type HiveComputingObservation = Observation;

export interface HiveComputingObservationOptions {
  readonly causality?: readonly EventPair[];
  readonly conflict?: readonly EventPair[];
}

export function hiveSettledFrontier(topology: HiveTopologyCarrier): readonly Cell[] {
  const cells = topology.fixedPointReadings.knowledgeLeast.extremum.sheaf.section.fibers
    .flatMap((fiber) => fiber.assignments.map((assignment) => assignment.cell));
  const ids = new Set<string>();
  return Object.freeze(cells.filter((cell) => {
    const id = cellEventId(cell);
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  }));
}

export function observeHiveTopology(
  topology: HiveTopologyCarrier,
  options: HiveComputingObservationOptions = {},
): HiveComputingObservation {
  return observeReading(topology.fixedPointReadings.knowledgeLeast, hiveSettledFrontier(topology), options);
}

const utteranceEventId = (utterance: UtteranceCarrier): string =>
  cellEventId(fixedPointReadingsOfUtterances([utterance]).knowledgeLeast.extremum.sheaf.section.fibers[0]!.assignments[0]!.cell);

function addPair(pairs: EventPair[], from: string | undefined, to: string | undefined): void {
  if (from === undefined || to === undefined || from === to) return;
  if (pairs.some((pair) => pair[0] === from && pair[1] === to)) return;
  pairs.push(Object.freeze([from, to] as const));
}

export function hiveChainObservationCausality(
  observations: readonly HiveChainObservation[],
): readonly EventPair[] {
  const pairs: EventPair[] = [];
  for (const observation of observations) {
    const ids = new Map<unknown, string>();
    for (const utterance of hiveChainObservationUtterances(observation)) {
      ids.set(utterance.claim.mark.value, utteranceEventId(utterance));
    }
    const block = ids.get("hive.block.observed");
    const irreversible = ids.get("hive.block.irreversible");
    const tx = ids.get("hive.included-in-block");
    const op = ids.get("hive.included-in-transaction");
    const witnessed = ids.get("hive.witnessed-at");
    const locus = op ?? tx ?? block;
    addPair(pairs, block, irreversible);
    addPair(pairs, block, tx);
    addPair(pairs, tx, op);
    addPair(pairs, locus, witnessed);
    addPair(pairs, witnessed, utteranceEventId(observation.utterance));
  }
  return Object.freeze(pairs);
}

export function observeHiveChainObservations(
  observations: readonly HiveChainObservation[],
  options: HiveComputingObservationOptions = {},
): HiveComputingObservation {
  return observeHiveTopology(induceHiveObservedTopology(observations), {
    ...options,
    causality: Object.freeze([
      ...hiveChainObservationCausality(observations),
      ...(options.causality ?? []),
    ]),
  });
}
