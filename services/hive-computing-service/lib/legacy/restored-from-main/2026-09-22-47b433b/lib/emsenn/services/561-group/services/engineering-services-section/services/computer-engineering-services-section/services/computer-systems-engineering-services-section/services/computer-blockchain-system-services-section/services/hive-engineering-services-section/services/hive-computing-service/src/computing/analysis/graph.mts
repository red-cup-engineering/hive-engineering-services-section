import {
  relationGraph,
  type RelationGraphCarrier,
} from "@emsenn/relating/analysis";
import { hiveKnowledgeSection, type HiveTopologyCarrier } from "../topology/index.mjs";
import { hiveProjectedSection } from "../topology/hive-section-boundary.mjs";

/** The attention-capital relation graph of a settled Hive carrier, read through
 * Hive's admitted subject/object projection. */
export function attentionGraph(carrier: HiveTopologyCarrier): RelationGraphCarrier {
  return relationGraph(hiveProjectedSection(hiveKnowledgeSection(carrier)));
}

export type { RelationGraphCarrier };
