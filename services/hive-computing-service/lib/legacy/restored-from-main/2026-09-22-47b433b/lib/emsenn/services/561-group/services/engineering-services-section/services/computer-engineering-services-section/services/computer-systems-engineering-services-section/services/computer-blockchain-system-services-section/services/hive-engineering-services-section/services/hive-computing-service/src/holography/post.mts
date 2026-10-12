import { restrict } from "@emsenn/relating/holography";
import {
  hiveCommunityUtterance,
  hivePostExistsUtterance,
  hiveTagUtterance,
} from "../computing/topology/index.mjs";
import {
  hiveJsonProjector,
  jsonOf,
  recordOf,
  stringField,
  type JsonRecord,
  type Projector,
  type Resource,
  type UtteranceCarrier,
} from "./resource.mjs";

function jsonMetadata(record: JsonRecord): JsonRecord | undefined {
  const value = record["json_metadata"];
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = jsonOf({ path: "json_metadata", content: value });
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : undefined;
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function tagsOf(record: JsonRecord): readonly string[] {
  const metadata = jsonMetadata(record);
  const tags = metadata?.["tags"];
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0) : [];
}

function postResourceUtterances(record: JsonRecord): UtteranceCarrier[] {
  const author = stringField(record, "author");
  const permlink = stringField(record, "permlink");
  if (author === undefined || permlink === undefined) return [];
  const utterances: UtteranceCarrier[] = [hivePostExistsUtterance(author, permlink)];
  const category = stringField(record, "category");
  if (category !== undefined) utterances.push(hiveTagUtterance(author, permlink, category));
  for (const tag of tagsOf(record)) utterances.push(hiveTagUtterance(author, permlink, tag));
  const community = stringField(record, "community") ?? stringField(record, "parent_permlink");
  if (community !== undefined && community.startsWith("hive-")) {
    utterances.push(hiveCommunityUtterance(author, permlink, community));
  }
  return utterances;
}

export function isHivePostResource(resource: Resource): boolean {
  const record = recordOf(resource);
  return record !== undefined && stringField(record, "author") !== undefined && stringField(record, "permlink") !== undefined;
}

export const hivePostProjector: Projector<UtteranceCarrier> = restrict(hiveJsonProjector, {
  type: "hive.resource.post",
  recognize: isHivePostResource,
  read: (resource) => postResourceUtterances(recordOf(resource) ?? {}),
});
