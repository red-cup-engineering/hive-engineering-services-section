import { settleJudgments } from "@red-cup-engineering/signchain/bilattice";
import { TellingLog } from "@red-cup-engineering/signchain/log";

const SIGNED_PREDICATE = "signed";

function isSigned(op) {
  return typeof op?.signature === "string" && op.signature.length > 0
    && typeof op.serialized === "string" && op.serialized.length > 0;
}

/** Record one signing intent without accepting or retaining private key material. */
export function intentEntry(acted, op) {
  return Object.freeze({
    opId: op.opId,
    subject: acted.action.subject,
    predicate: SIGNED_PREDICATE,
    object: op.opId,
    provenance: Object.freeze({
      justification: acted.justification,
      merit: acted.merit,
      cost: acted.cost,
      signature: op.signature,
    }),
  });
}

/** Classify each injected signing result for the supplied allocation. */
export function executionJudgments(signed, allocation) {
  return Object.freeze(signed.map((op, index) => {
    const acted = allocation.acted[index];
    const admitted = isSigned(op);
    return Object.freeze({
      name: op.opId,
      value: admitted ? "potential" : "active",
      reason: admitted
        ? `signed for broadcast (${op.action.kind} of ${op.action.subject})`
        : `signing boundary returned no signature for ${op.action.subject}`,
      path: acted ? `acted/${acted.id}` : `signed/${op.opId}`,
    });
  }));
}

/**
 * Fold a pure allocation through an injected signer. This does not broadcast
 * or load key material: it preserves each signed intent as a telling log
 * and returns the settled result to the caller that owns the network boundary.
 */
export function executeAllocation(allocation, signer) {
  const signed = [];
  const entries = [];
  for (const acted of allocation.acted) {
    const op = signer(acted.action, acted.justification);
    signed.push(op);
    entries.push(intentEntry(acted, op));
  }
  const log = new TellingLog();
  for (const entry of entries) log.tell(entry, entry.opId);
  const settlement = settleJudgments(executionJudgments(signed, allocation));
  return Object.freeze({
    kind: "hive-execution.result",
    log,
    signed: Object.freeze([...signed]),
    settlement,
    trace: Object.freeze([...entries]),
  });
}
