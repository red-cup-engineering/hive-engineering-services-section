import { restrict } from "@emsenn/relating/holography";
import {
  hiveFollowUtterance,
  hiveUnfollowUtterance,
} from "../computing/topology/index.mjs";
import {
  hiveJsonProjector,
  recordOf,
  stringField,
  type JsonRecord,
  type Projector,
  type UtteranceCarrier,
} from "./resource.mjs";

function followUtterances(record: JsonRecord): UtteranceCarrier[] {
  const follower = stringField(record, "follower");
  const following = stringField(record, "following") ?? stringField(record, "account");
  if (follower === undefined || following === undefined) return [];
  const what = record["what"];
  const emptyFollow = Array.isArray(what) && what.length === 0;
  return [emptyFollow ? hiveUnfollowUtterance(follower, following) : hiveFollowUtterance(follower, following)];
}

export const hiveFollowProjector: Projector<UtteranceCarrier> = restrict(hiveJsonProjector, {
  type: "hive.resource.follow",
  recognize: (resource) => {
    const record = recordOf(resource);
    return record !== undefined && stringField(record, "follower") !== undefined &&
      (stringField(record, "following") !== undefined || stringField(record, "account") !== undefined);
  },
  read: (resource) => followUtterances(recordOf(resource) ?? {}),
});
