/**
 * admission — the Hive package root morphism.
 *
 * Hive is a computing package: callers present a Hive computation request at
 * the root, and the request is admitted only when it reduces to carriers owned
 * by this package: settled Hive topology, curation valuation, or an operation
 * already constructed by the Hive wire codec. Raw chain JSON, RPC clients,
 * sockets, keys, and files live at codecs/holography/client/script boundaries.
 */
import {
  chargeValueName,
  mark,
  negate,
  valueOf,
  witnessedPotential,
  type ChargeCarrier,
  type ChargeValueName,
} from "@emsenn/relating";
import type { UtteranceCarrier } from "@emsenn/relating";
import {
  hiveChainObservationCausality,
  observeHiveTopology,
  type HiveComputingObservation,
} from "./computing/index.mjs";
import type { Operation } from "./codecs/index.mjs";
import {
  hiveChainObservationsUtterances,
  induceHiveTopology,
  type HiveChainObservation,
  type HiveTopologyCarrier,
} from "./computing/topology/index.mjs";
import {
  valuatePost,
  type CurationValuation,
  type PostObservation,
  type WitnessingThresholds,
} from "./computing/curation/index.mjs";

export type HiveAction = "hive.observe" | "hive.curate" | "hive.operation" | string;

export interface HiveToken {
  /** Already-admitted Hive evidence. Boundary data should reach this via holography/codecs. */
  readonly utterances?: readonly UtteranceCarrier[];
  /** Chain-located Hive evidence with block/transaction/operation provenance. */
  readonly observations?: readonly HiveChainObservation[];
  /** A post observation carrier for the curation decision topology. */
  readonly post?: PostObservation;
  /** A Hive protocol operation constructed by the operation codec. */
  readonly operation?: Operation;
}

export interface HiveClaim {
  readonly minimumWitnesses?: number;
  readonly thresholds?: WitnessingThresholds;
  readonly operationName?: Operation[0];
}

export interface HiveRequest {
  readonly action: HiveAction;
  readonly token: HiveToken;
  readonly claim?: HiveClaim;
}

export type HiveObstruction =
  | {
      readonly kind: "hive.root.unsupported-action-obstruction";
      readonly action: string;
    }
  | {
      readonly kind: "hive.root.missing-utterances-obstruction";
    }
  | {
      readonly kind: "hive.root.minimum-witnesses-obstruction";
      readonly expected: number;
      readonly actual: number;
    }
  | {
      readonly kind: "hive.root.missing-post-observation-obstruction";
    }
  | {
      readonly kind: "hive.root.missing-operation-obstruction";
    }
  | {
      readonly kind: "hive.root.operation-name-obstruction";
      readonly expected: Operation[0];
      readonly actual: Operation[0];
    };

export interface HiveAdmission {
  readonly action: HiveAction;
  readonly admitted: boolean;
  readonly status: ChargeValueName;
  readonly charge: ChargeCarrier;
  readonly topology?: HiveTopologyCarrier;
  readonly computing?: HiveComputingObservation;
  readonly valuation?: CurationValuation;
  readonly operation?: Operation;
  readonly obstruction?: HiveObstruction;
}

/**
 * Admit a Hive computation by reducing it to this package's carriers.
 *
 * Domain: `HiveAction x HiveToken x HiveClaim?`.
 * Codomain: `HiveAdmission`.
 * Law: admission succeeds exactly when the request has a carrier-bearing
 * witness: a settled Hive topology, a curation valuation, or a codec-built Hive
 * operation. Refusals are charge-backed obstructions, not untyped booleans.
 */
export function computeWithHive(
  action: HiveAction,
  token: HiveToken,
  claim: HiveClaim = {},
): HiveAdmission {
  switch (action) {
    case "hive.observe":
      return admitObservation(action, token, claim);
    case "hive.curate":
      return admitCuration(action, token, claim);
    case "hive.operation":
      return admitOperation(action, token, claim);
    default:
      return refused(action, { kind: "hive.root.unsupported-action-obstruction", action });
  }
}

export const hive = computeWithHive;

function admitObservation(
  action: HiveAction,
  token: HiveToken,
  claim: HiveClaim,
): HiveAdmission {
  const direct = token.utterances ?? [];
  const observations = token.observations ?? [];
  if (direct.length === 0 && observations.length === 0) {
    return refused(action, { kind: "hive.root.missing-utterances-obstruction" });
  }
  const actual = direct.length + observations.length;
  const expected = claim.minimumWitnesses ?? 0;
  if (actual < expected) {
    return refused(action, {
      kind: "hive.root.minimum-witnesses-obstruction",
      expected,
      actual,
    });
  }
  const topology = induceHiveTopology([
    ...direct,
    ...hiveChainObservationsUtterances(observations),
  ]);
  const computing = observations.length === 0
    ? observeHiveTopology(topology)
    : observeHiveTopology(topology, {
        causality: hiveChainObservationCausality(observations),
      });
  return admitted(action, { carrier: "hive.topology", witnesses: actual }, {
    topology,
    computing,
  });
}

function admitCuration(
  action: HiveAction,
  token: HiveToken,
  claim: HiveClaim,
): HiveAdmission {
  if (token.post === undefined) {
    return refused(action, { kind: "hive.root.missing-post-observation-obstruction" });
  }
  const valuation = valuatePost(token.post, claim.thresholds);
  return admitted(action, {
    carrier: "hive.curation.valuation",
    subject: valuation.subject,
    admitted: valuation.admitted,
  }, { valuation });
}

function admitOperation(
  action: HiveAction,
  token: HiveToken,
  claim: HiveClaim,
): HiveAdmission {
  if (token.operation === undefined) {
    return refused(action, { kind: "hive.root.missing-operation-obstruction" });
  }
  const actual = token.operation[0];
  if (claim.operationName !== undefined && claim.operationName !== actual) {
    return refused(action, {
      kind: "hive.root.operation-name-obstruction",
      expected: claim.operationName,
      actual,
    });
  }
  return admitted(action, { carrier: "hive.codecs.operation", operation: actual }, { operation: token.operation });
}

function admitted(
  action: HiveAction,
  witness: unknown,
  fields: Pick<HiveAdmission, "topology" | "computing" | "valuation" | "operation">,
): HiveAdmission {
  const charge = witnessedPotential(mark({ action, witness }));
  return Object.freeze({
    action,
    admitted: true,
    status: statusOf(charge),
    charge,
    ...fields,
  } as const);
}

function refused(action: HiveAction, obstruction: HiveObstruction): HiveAdmission {
  const charge = negate(witnessedPotential(mark({ action, obstruction })));
  return Object.freeze({
    action,
    admitted: false,
    status: statusOf(charge),
    charge,
    obstruction,
  } as const);
}

function statusOf(charge: ChargeCarrier): ChargeValueName {
  return chargeValueName(valueOf(charge));
}
