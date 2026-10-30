import { restrict } from "@emsenn/relating/holography";
import {
  hiveAccountActiveUtterance,
  hiveBalanceUtterance,
  hiveHBDUtterance,
  hiveHivePowerUtterance,
} from "../computing/topology/index.mjs";
import {
  hiveJsonProjector,
  recordOf,
  stringField,
  type JsonRecord,
  type Projector,
  type UtteranceCarrier,
} from "./resource.mjs";

function accountUtterances(record: JsonRecord): UtteranceCarrier[] {
  const name = stringField(record, "name") ?? stringField(record, "account");
  if (name === undefined) return [];
  const utterances: UtteranceCarrier[] = [hiveAccountActiveUtterance(name)];
  if (stringField(record, "balance") !== undefined) utterances.push(hiveBalanceUtterance(name));
  if (stringField(record, "hbd_balance") !== undefined) utterances.push(hiveHBDUtterance(name));
  if (stringField(record, "vesting_shares") !== undefined) utterances.push(hiveHivePowerUtterance(name));
  return utterances;
}

export const hiveAccountProjector: Projector<UtteranceCarrier> = restrict(hiveJsonProjector, {
  type: "hive.resource.account",
  recognize: (resource) => {
    const record = recordOf(resource);
    return record !== undefined && (stringField(record, "name") !== undefined || stringField(record, "account") !== undefined);
  },
  read: (resource) => accountUtterances(recordOf(resource) ?? {}),
});
