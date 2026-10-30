import { restrict } from "@emsenn/relating/holography";
import {
  hiveUnvoteUtterance,
  hiveVoteUtterance,
} from "../computing/topology/index.mjs";
import {
  numberField,
  recordOf,
  stringField,
  type JsonRecord,
  type Projector,
  type UtteranceCarrier,
} from "./resource.mjs";
import { hivePostProjector } from "./post.mjs";

function voteUtterances(record: JsonRecord): UtteranceCarrier[] {
  const voter = stringField(record, "voter");
  const author = stringField(record, "author");
  const permlink = stringField(record, "permlink");
  if (voter === undefined || author === undefined || permlink === undefined) return [];
  const weight = numberField(record, "weight") ?? 1;
  return [weight === 0 ? hiveUnvoteUtterance(voter, author, permlink) : hiveVoteUtterance(voter, author, permlink)];
}

export const hiveVoteProjector: Projector<UtteranceCarrier> = restrict(hivePostProjector, {
  type: "hive.resource.vote",
  recognize: (resource) => {
    const record = recordOf(resource);
    return record !== undefined && stringField(record, "voter") !== undefined;
  },
  read: (resource) => voteUtterances(recordOf(resource) ?? {}),
});
