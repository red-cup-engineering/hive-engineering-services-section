import { hiveChainReference } from "../computing/social.mjs";
export function hiveJsonResource(path, value) { return { path, content: typeof value === "string" ? value : JSON.stringify(value, (_key, child) => typeof child === "bigint" ? child.toString() : child) }; }
export function jsonOf(resource) { try { return JSON.parse(resource.content); } catch { return undefined; } }
export function recordOf(resource) { const value = jsonOf(resource); return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined; }
export function stringField(record, name) { const value = record[name]; return typeof value === "string" && value.length > 0 ? value : undefined; }
export function numberField(record, name) { const value = record[name]; return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function numericField(record, names) { for (const name of names) { const value = record[name]; if (typeof value === "number" && Number.isInteger(value)) return value; if (typeof value === "string" && /^\d+$/.test(value)) return Number(value); } return undefined; }
export function hiveChainReferenceOf(record) { const blockNum = numericField(record,["block_num","block","blockNum","block_number"]); if (blockNum === undefined) return null; const operationIndex=numericField(record,["op_in_trx","opInTrx","operationIndex","operation_index"]); return hiveChainReference({blockNum,blockId:stringField(record,"block_id")??stringField(record,"blockId"),transactionId:stringField(record,"trx_id")??stringField(record,"transaction_id")??stringField(record,"transactionId"),...(operationIndex===undefined?{}:{operationIndex}),...(typeof record.irreversible==="boolean"?{irreversible:record.irreversible}:{})}); }
export const hiveJsonProjector = Object.freeze({ type:"hive.resource.json", recognize: resource => recordOf(resource) !== undefined, read: () => [] });
export const projector = (type, recognize, read) => Object.freeze({ type, recognize, read });
