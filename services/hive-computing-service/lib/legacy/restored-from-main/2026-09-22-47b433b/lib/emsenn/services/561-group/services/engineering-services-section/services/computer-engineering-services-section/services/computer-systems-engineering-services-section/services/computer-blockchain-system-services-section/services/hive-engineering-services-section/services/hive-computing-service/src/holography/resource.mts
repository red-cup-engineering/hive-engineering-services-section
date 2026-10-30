import {
  define,
  type Projector,
  type Resource,
} from "@emsenn/relating/holography";
import type { UtteranceCarrier } from "@emsenn/relating";
import { hiveChainReference, type HiveChainReference } from "../computing/topology/index.mjs";

export type { Projector, Resource, UtteranceCarrier };

export type JsonRecord = { readonly [key: string]: unknown };

function stringifyHiveJson(value: unknown): string {
  return JSON.stringify(value, (_key, child) => typeof child === "bigint" ? child.toString() : child);
}

export function hiveJsonResource(path: string, value: unknown): Resource {
  return {
    path,
    content: typeof value === "string" ? value : stringifyHiveJson(value),
  };
}

export function jsonOf(resource: Resource): unknown {
  try {
    return JSON.parse(resource.content) as unknown;
  } catch {
    return undefined;
  }
}

export function recordOf(resource: Resource): JsonRecord | undefined {
  const value = jsonOf(resource);
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

export function stringField(record: JsonRecord, name: string): string | undefined {
  const value = record[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function numberField(record: JsonRecord, name: string): number | undefined {
  const value = record[name];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numericField(record: JsonRecord, names: readonly string[]): number | undefined {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  }
  return undefined;
}

export function hiveChainReferenceOf(record: JsonRecord): HiveChainReference | null {
  const blockNum = numericField(record, ["block_num", "block", "blockNum", "block_number"]);
  if (blockNum === undefined) return null;
  const operationIndex = numericField(record, ["op_in_trx", "opInTrx", "operationIndex", "operation_index"]);
  return hiveChainReference({
    blockNum,
    blockId: stringField(record, "block_id") ?? stringField(record, "blockId"),
    transactionId: stringField(record, "trx_id") ?? stringField(record, "transaction_id") ?? stringField(record, "transactionId"),
    ...(operationIndex === undefined ? {} : { operationIndex }),
    ...(typeof record["irreversible"] === "boolean" ? { irreversible: record["irreversible"] } : {}),
  });
}

export const hiveJsonProjector: Projector<UtteranceCarrier> = define<UtteranceCarrier>({
  type: "hive.resource.json",
  recognize: (resource) => recordOf(resource) !== undefined,
  read: () => [],
});
