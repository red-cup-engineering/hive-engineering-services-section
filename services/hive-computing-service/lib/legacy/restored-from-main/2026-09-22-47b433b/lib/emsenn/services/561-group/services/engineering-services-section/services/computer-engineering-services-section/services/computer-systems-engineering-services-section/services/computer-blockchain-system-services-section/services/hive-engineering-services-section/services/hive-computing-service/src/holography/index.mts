/**
 * @emsenn/computing-with-hive/holography — Hive resources reconstructed as
 * relational utterances.
 *
 * This is the reconstruction sibling of the Hive carrier. It recognizes
 * boundary resources such as JSON account/post/vote records and reads them into
 * the utterance carriers that `@emsenn/computing-with-hive/computing/topology`
 * settles.
 * It does not fetch from the network and it does not sign: host access remains
 * injected through `client`, `rpc`, or service code.
 */
import {
  classify,
  type Projector,
  type Resource,
} from "@emsenn/relating/holography";
import type { UtteranceCarrier } from "@emsenn/relating";
import {
  hiveChainObservation,
  type HiveChainObservation,
} from "../computing/topology/index.mjs";
import { hiveAccountProjector } from "./account.mjs";
import { hiveFollowProjector } from "./follow.mjs";
import { hivePostProjector } from "./post.mjs";
import { hiveChainReferenceOf, hiveJsonProjector, hiveJsonResource, recordOf } from "./resource.mjs";
import { hiveVoteProjector } from "./vote.mjs";

export type { Projector, Resource, UtteranceCarrier, HiveChainObservation };
export { hiveJsonResource } from "./resource.mjs";
export { hiveAccountProjector } from "./account.mjs";
export { hiveFollowProjector } from "./follow.mjs";
export { hivePostProjector } from "./post.mjs";
export { hiveJsonProjector } from "./resource.mjs";
export { hiveVoteProjector } from "./vote.mjs";

export function classifyHiveJson(path: string, value: unknown): Projector<UtteranceCarrier> | null {
  return classifyHiveResource(hiveJsonResource(path, value));
}

export function readHiveJson(path: string, value: unknown): readonly UtteranceCarrier[] {
  return readHiveResource(hiveJsonResource(path, value));
}

export function readHiveChainResource(resource: Resource): readonly HiveChainObservation[] {
  const record = recordOf(resource);
  if (record === undefined) return [];
  const reference = hiveChainReferenceOf(record);
  if (reference === null) return [];
  return Object.freeze(readHiveResource(resource).map((utterance) => hiveChainObservation(utterance, reference)));
}

export function readHiveChainJson(path: string, value: unknown): readonly HiveChainObservation[] {
  return readHiveChainResource(hiveJsonResource(path, value));
}

export const hiveProjectors: readonly Projector<UtteranceCarrier>[] = Object.freeze([
  hiveJsonProjector,
  hiveAccountProjector,
  hivePostProjector,
  hiveVoteProjector,
  hiveFollowProjector,
]);

export function classifyHiveResource(resource: Resource): Projector<UtteranceCarrier> | null {
  return classify(resource, hiveProjectors);
}

export function readHiveResource(resource: Resource): readonly UtteranceCarrier[] {
  const projector = classifyHiveResource(resource);
  return projector?.read?.(resource) ?? [];
}
