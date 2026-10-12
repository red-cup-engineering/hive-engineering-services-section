import { tokenValue, utterance } from "@red-cup-engineering/signcell/cell";
import { induceHiveTopology } from "./hive-topology.mjs";
export function hiveBlockTerm(reference) {
    return `hive.block.${reference.blockNum}${reference.blockId === undefined ? "" : `/${reference.blockId}`}`;
}
export function hiveTransactionTerm(transactionId) {
    return `hive.tx.${transactionId}`;
}
export function hiveOperationTerm(transactionId, operationIndex) {
    return `hive.txop.${transactionId}/${operationIndex}`;
}
export function hiveBlockObservedPredicate() { return "hive.block.observed"; }
export function hiveBlockIrreversiblePredicate() { return "hive.block.irreversible"; }
export function hiveIncludedInBlockPredicate() { return "hive.included-in-block"; }
export function hiveIncludedInTransactionPredicate() { return "hive.included-in-transaction"; }
export function hiveWitnessedAtPredicate() { return "hive.witnessed-at"; }
export function hiveChainReference(input) {
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
        kind: "hive.chain.reference",
        blockNum: input.blockNum,
        ...(input.blockId === undefined ? {} : { blockId: input.blockId }),
        ...(input.transactionId === undefined ? {} : { transactionId: input.transactionId }),
        ...(input.operationIndex === undefined ? {} : { operationIndex: input.operationIndex }),
        ...(input.irreversible === undefined ? {} : { irreversible: input.irreversible }),
    });
}
export function hiveChainObservation(utteranceCarrier, reference) {
    return Object.freeze({
        kind: "hive.chain.observation",
        utterance: utteranceCarrier,
        reference: hiveChainReference(reference),
    });
}
function locusTerm(reference) {
    if (reference.transactionId !== undefined && reference.operationIndex !== undefined) {
        return hiveOperationTerm(reference.transactionId, reference.operationIndex);
    }
    if (reference.transactionId !== undefined)
        return hiveTransactionTerm(reference.transactionId);
    return hiveBlockTerm(reference);
}
export function hiveChainReferenceUtterances(reference) {
    const block = hiveBlockTerm(reference);
    const utterances = [
        utterance(block, hiveBlockObservedPredicate()),
    ];
    if (reference.irreversible === true) {
        utterances.push(utterance(block, hiveBlockIrreversiblePredicate()));
    }
    if (reference.transactionId !== undefined) {
        const tx = hiveTransactionTerm(reference.transactionId);
        utterances.push(utterance({ subject: tx, object: block }, hiveIncludedInBlockPredicate()));
        if (reference.operationIndex !== undefined) {
            utterances.push(utterance({ subject: hiveOperationTerm(reference.transactionId, reference.operationIndex), object: tx }, hiveIncludedInTransactionPredicate()));
        }
    }
    return Object.freeze(utterances);
}
export function hiveChainObservationUtterances(observation) {
    return Object.freeze([
        observation.utterance,
        ...hiveChainReferenceUtterances(observation.reference),
        utterance({ subject: tokenValue(observation.utterance), object: locusTerm(observation.reference) }, hiveWitnessedAtPredicate()),
    ]);
}
export function hiveChainObservationsUtterances(observations) {
    return Object.freeze(observations.flatMap((observation) => [...hiveChainObservationUtterances(observation)]));
}
export function induceHiveObservedTopology(observations) {
    return induceHiveTopology(hiveChainObservationsUtterances(observations));
}
