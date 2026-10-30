/**
 * execution — the signing boundary as a traced, auditable fold (Layer 4).
 *
 * Layers 1–3 (../analysis/alpha, ../decision) are pure: they price the
 * curation/market field, lift each opportunity into a fundable proposal, and
 * draw a finite linear budget across them. The output of that pipeline — an
 * `Allocation` — is a *pure capital decision*: a list of `Acted` operations,
 * each carrying its exact merit/cost and a `ChargeCarrier` justification, and
 * NOTHING has touched a key or the wire. This module is the one impure edge:
 * it turns each pure-decided operation into a real, signed broadcast — and it
 * does so behind an INJECTED boundary so the module itself stays keyless.
 *
 * The theorem the code realizes: pure decision in, traced intent out — the
 * signing boundary is the only impure edge and it is injected. Concretely,
 * executeAllocation is a fold over `allocation.acted`: for each `Acted`
 * operation it (1) asks the injected `Signer` to produce a `SignedOp` (the
 * single impure call — actual crypto is delegated, never rolled here, and no
 * private-key material is ever imported into this module), (2) records that
 * intent as a `LessonEvidence` whose subject is the action's subject, predicate is
 * the fixed `signed`/`broadcast` term, object is the op id, and provenance is
 * the operation's carried justification together with its exact merit/cost,
 * and (3) emits a per-op `LessonJudgment`. The intent entries are uttered
 * (`utterEvidenceSet`) into a fresh `LessonMemory`, so the log's size equals the
 * number of signed operations exactly — one recorded intent per broadcast.
 * The judgments are settled (`settleLessonJudgments`) by the knowledge join: a
 * signed op is `potential` (truth-evidence present — the broadcast was
 * authorized) and a missing/failed signature is `active` (falsity-evidence
 * present); an all-admitted run therefore settles to `potential`, and any
 * failure drives the join to `stable` (a held contradiction, rendered, never
 * thrown). The result is a frozen, kind-tagged audit object — every intended
 * operation, its signature, and its justification, recorded.
 *
 * Signing-boundary discipline: this module imports NO key material and rolls
 * NO crypto. The `Signer` is a function the caller constructs (typically over
 * @emsenn/computing-with-hive/codecs and a key the caller holds); here it is just a boundary,
 * which is exactly what keeps the module testable with a keyless stub signer.
 * No floats, no LLM — merit/cost are carried as the bigint micro-units the
 * decision layer already resolved, never re-touched as numbers.
 */
import {
  LessonMemory,
  utterEvidenceSet,
  settleLessonJudgments,
  type LessonEvidence,
  type LessonJudgment,
  type LessonSettlement,
} from "@emsenn/animating/becoming/doing/working/learning/lessons";
import type { Acted } from "@emsenn/animating/becoming/doing/working/governing/deciding";
import type { Allocation, CapitalAction } from "../decision/index.mjs";

/** The fixed predicate every intent entry articulates: the action was signed
 *  for broadcast. A two-place mark would lose the op id, so the entry is
 *  three-place (subject —signed→ op id) and this is the relation. */
const SIGNED_PREDICATE = "signed" as const;

/**
 * A pure decision rendered as a real, signed broadcast. `serialized` is the
 * wire bytes the codec produced (hex/base64 — a string, never a buffer of key
 * material), `signature` is the codec's signature over them. This module never
 * constructs either: they come back from the injected `Signer`.
 */
export interface SignedOp {
  readonly kind: "hive-execution.signedOp";
  readonly opId: string;
  readonly action: CapitalAction;
  readonly serialized: string;
  readonly signature: string;
}

/**
 * The injected signing boundary — the ONLY impure edge of the pipeline. The
 * caller constructs it (over @emsenn/computing-with-hive/codecs and a key the caller holds);
 * this module only invokes it. A signer that cannot sign should throw or
 * return an op with an empty signature, which this module records as an
 * obstruction judgment rather than a broadcast.
 */
export type Signer = (action: CapitalAction, justification: unknown) => SignedOp;

/** A lesson-evidence entry that also names the op it records — the recorded intent. */
export interface IntentEntry extends LessonEvidence {
  readonly opId: string;
}

/** The audit trail of an executed allocation: the utterance log of recorded
 *  intents (one per signed op), the signed ops in allocation order, the
 *  settled per-op judgments, and the raw intent entries. Frozen, kind-tagged —
 *  a complete, auditable record of what was intended, signed, and why. */
export interface ExecutionResult {
  readonly kind: "hive-execution.result";
  readonly log: LessonMemory;
  readonly signed: readonly SignedOp[];
  readonly settlement: LessonSettlement;
  readonly trace: readonly LessonEvidence[];
}

/** Whether a signature is actually present — an empty/blank signature is a
 *  failed sign, recorded as an obstruction, never a broadcast. */
function isSigned(op: SignedOp): boolean {
  return op.signature.length > 0 && op.serialized.length > 0;
}

/**
 * The recorded intent for one signed operation: subject = the action's subject
 * (the priced thing the decision funded), predicate = the fixed `signed` term,
 * object = the op id, provenance = the operation's carried justification (the
 * `ChargeCarrier` from ../decision) together with its exact bigint merit/cost.
 * Three-place, so the op id is retained in the cell the entry articulates.
 */
export function intentEntry(acted: Acted<CapitalAction>, op: SignedOp): IntentEntry {
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

/**
 * The per-op admission judgments: a signed op is `potential` (truth-evidence
 * present — authorized to broadcast), a failed/missing signature is `active`
 * (falsity-evidence present — the broadcast did not stand). The knowledge join
 * of these (via `settleLessonJudgments`) is therefore `potential` iff EVERY op was
 * signed, and `stable` (held contradiction) the moment any one fails — exactly
 * the all-admitted reading the audit needs. `signed[i]` is matched to
 * `allocation.acted[i]` by allocation order.
 */
export function executionJudgments(
  signed: readonly SignedOp[],
  allocation: Allocation,
): readonly LessonJudgment[] {
  return Object.freeze(
    signed.map((op, i) => {
      const acted = allocation.acted[i];
      const admitted = isSigned(op);
      return Object.freeze({
        name: op.opId,
        value: (admitted ? "potential" : "active") as LessonJudgment["value"],
        reason: admitted
          ? `signed for broadcast (${op.action.kind} of ${op.action.subject})`
          : `signing boundary returned no signature for ${op.action.subject}`,
        path: acted ? `acted/${acted.id}` : `signed/${op.opId}`,
      });
    }),
  );
}

/**
 * Execute a pure allocation across the injected signing boundary, returning the
 * audit trail. A fold over `allocation.acted`: each pure-decided operation is
 * signed by the injected `Signer` (the only impure call — no key material and
 * no crypto live in this module), recorded as an intent `LessonEvidence`, and
 * judged. The intents are uttered into a fresh `LessonMemory` (so `log.size`
 * equals `signed.length` — one recorded intent per broadcast), and the
 * judgments are settled by the knowledge join (so `settlement.value` is
 * `potential` exactly when every op signed). Pure decision in, traced intent
 * out; the signing boundary is the only impure edge and it is injected.
 */
export function executeAllocation(allocation: Allocation, signer: Signer): ExecutionResult {
  const signed: SignedOp[] = [];
  const entries: IntentEntry[] = [];
  for (const acted of allocation.acted) {
    const op = signer(acted.action, acted.justification);
    signed.push(op);
    entries.push(intentEntry(acted, op));
  }
  const log = new LessonMemory().admit(...utterEvidenceSet(entries));
  const settlement = settleLessonJudgments(executionJudgments(signed, allocation));
  return Object.freeze({
    kind: "hive-execution.result" as const,
    log,
    signed: Object.freeze([...signed]),
    settlement,
    trace: Object.freeze([...entries]),
  });
}
