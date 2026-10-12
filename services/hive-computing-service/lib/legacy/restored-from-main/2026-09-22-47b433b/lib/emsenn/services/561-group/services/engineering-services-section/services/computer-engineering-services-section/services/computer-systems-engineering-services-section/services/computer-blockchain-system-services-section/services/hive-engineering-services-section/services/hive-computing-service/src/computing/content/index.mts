/**
 * @emsenn/computing-with-hive-content-topology — content-fitness axis for Hive curation.
 *
 * ContentObservation is built from condenser_api.get_content (body, title,
 * links, word count, lede). contentFitnessValuation() applies four gates
 * from content-topology with Hive-appropriate thresholds. The result
 * composites with PostObservation (the social-signal axis from
 * hive-curation-topology) to form a multi-dimensional curation decision.
 */

export {
  contentObservation,
  contentFitnessValuation,
} from "./content.mjs";

export type {
  ContentObservation,
  RawHiveContent,
  ContentGate,
  ContentFitnessValuation,
  ContentFitnessPolicy,
} from "./content.mjs";
