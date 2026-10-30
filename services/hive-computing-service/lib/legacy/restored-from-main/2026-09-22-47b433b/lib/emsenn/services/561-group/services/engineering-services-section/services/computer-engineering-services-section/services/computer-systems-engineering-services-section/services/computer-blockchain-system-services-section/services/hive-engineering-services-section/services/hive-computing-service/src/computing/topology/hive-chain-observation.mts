import {
  mark,
  utterance,
  type PredicationPredicate,
  type PredicationTerm,
  type UtteranceCarrier,
} from "@emsenn/relating";
import { predicationTerm, predicationPredicate, predicateMarkValue } from "../predication.mjs";
import { induceHiveTopology, type HiveTopologyCarrier } from "./hive-topology.mjs";

export interface HiveChainReferenceInput {
  readonly blockNum: number;
  readonly blockId?: string | undefined;
  readonly transactionId?: string | undefined;
  readonly operationIndex?: number | undefined;
  readonly irreversible?: boolean | undefined;
}

export interface HiveChainReference extends HiveChainReferenceInput {
  readonly kind: "hive.chain.reference";
}

export interface HiveChainObservation {
  readonly kind: "hive.chain.observation";
  readonly utterance: UtteranceCarrier;
  readonly reference: HiveChainReference;
}

export function hiveBlockTerm(reference: Pick<HiveChainReferenceInput, "blockNum" | "blockId">): PredicationTerm {
  return predicationTerm(`hive.block.${reference.blockNum}${reference.blockId === undefined ? "" : `/${reference.blockId}`}`);
}

export function hiveTransactionTerm(transactionId: string): PredicationTerm {
  return predicationTerm(`hive.tx.${transactionId}`);
}

export function hiveOperationTerm(transactionId: string, operationIndex: number): PredicationTerm {
  return predicationTerm(`hive.txop.${transactionId}/${operationIndex}`);
}

export function hiveBlockObservedPredicate(): PredicationPredicate { return predicationPredicate("hive.block.observed"); }
export function hiveBlockIrreversiblePredicate(): PredicationPredicate { return predicationPredicate("hive.block.irreversible"); }
export function hiveIncludedInBlockPredicate(): PredicationPredicate { return predicationPredicate("hive.included-in-block"); }
export function hiveIncludedInTransactionPredicate(): PredicationPredicate { return predicationPredicate("hive.included-in-transaction"); }
export function hiveWitnessedAtPredicate(): PredicationPredicate { return predicationPredicate("hive.witnessed-at"); }

export function hiveChainReference(input: HiveChainReferenceInput): HiveChainReference {
  if (!Number.isInteger(input.blockNum) || input.blockNum < 0) {
    throw new RangeError("Hive chain reference blockNum must be a non-negative integer");
  }
  if (input.blockId !== undefined && input.blockId.length === 0) {
    throw new RangeError("Hive chain reference blockId must be non-empty when present");
  }
  if (input.transactionId !== undefined && input.transactionId.length === 0) {
    throw new RangeError("Hive chain reference transactionId must be non-empty when present");
  }
  if (input.operationIndex !== undefined) {
    if (input.transactionId === undefined) {
      throw new RangeError("Hive chain reference operationIndex requires transactionId");
    }
    if (!Number.isInteger(input.operationIndex) || input.operationIndex < 0) {
      throw new RangeError("Hive chain reference operationIndex must be a non-negative integer");
    }
  }
  return Object.freeze({
    kind: "hive.chain.reference" as const,
    blockNum: input.blockNum,
    ...(input.blockId === undefined ? {} : { blockId: input.blockId }),
    ...(input.transactionId === undefined ? {} : { transactionId: input.transactionId }),
    ...(input.operationIndex === undefined ? {} : { operationIndex: input.operationIndex }),
    ...(input.irreversible === undefined ? {} : { irreversible: input.irreversible }),
  });
}

export function hiveChainObservation(
  utteranceCarrier: UtteranceCarrier,
  reference: HiveChainReferenceInput,
): HiveChainObservation {
  return Object.freeze({
    kind: "hive.chain.observation" as const,
    utterance: utteranceCarrier,
    reference: hiveChainReference(reference),
  });
}

function locusTerm(reference: HiveChainReference): PredicationTerm {
  if (reference.transactionId !== undefined && reference.operationIndex !== undefined) {
    return hiveOperationTerm(reference.transactionId, reference.operationIndex);
  }
  if (reference.transactionId !== undefined) return hiveTransactionTerm(reference.transactionId);
  return hiveBlockTerm(reference);
}

export function hiveChainReferenceUtterances(reference: HiveChainReference): readonly UtteranceCarrier[] {
  const block = hiveBlockTerm(reference);
  const utterances: UtteranceCarrier[] = [
    utterance(mark(block), mark(predicateMarkValue(hiveBlockObservedPredicate()))),
  ];
  if (reference.irreversible === true) {
    utterances.push(utterance(mark(block), mark(predicateMarkValue(hiveBlockIrreversiblePredicate()))));
  }
  if (reference.transactionId !== undefined) {
    const tx = hiveTransactionTerm(reference.transactionId);
    utterances.push(utterance(mark({ subject: tx, object: block }), mark(predicateMarkValue(hiveIncludedInBlockPredicate()))));
    if (reference.operationIndex !== undefined) {
      utterances.push(utterance(
        mark({ subject: hiveOperationTerm(reference.transactionId, reference.operationIndex), object: tx }),
        mark(predicateMarkValue(hiveIncludedInTransactionPredicate())),
      ));
    }
  }
  return Object.freeze(utterances);
}

export function hiveChainObservationUtterances(observation: HiveChainObservation): readonly UtteranceCarrier[] {
  return Object.freeze([
    observation.utterance,
    ...hiveChainReferenceUtterances(observation.reference),
    utterance(
      mark({ subject: observation.utterance.token, object: locusTerm(observation.reference) }),
      mark(predicateMarkValue(hiveWitnessedAtPredicate())),
    ),
  ]);
}

export function hiveChainObservationsUtterances(
  observations: readonly HiveChainObservation[],
): readonly UtteranceCarrier[] {
  return Object.freeze(observations.flatMap((observation) => [...hiveChainObservationUtterances(observation)]));
}

export function induceHiveObservedTopology(observations: readonly HiveChainObservation[]): HiveTopologyCarrier {
  return induceHiveTopology(hiveChainObservationsUtterances(observations));
}
