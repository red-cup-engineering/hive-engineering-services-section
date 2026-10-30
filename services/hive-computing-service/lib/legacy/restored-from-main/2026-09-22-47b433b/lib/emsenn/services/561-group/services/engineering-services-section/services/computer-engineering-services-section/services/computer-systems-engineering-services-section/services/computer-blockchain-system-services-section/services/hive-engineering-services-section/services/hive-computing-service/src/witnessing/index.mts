// witnessing — re-export of the congregated three-tier witness ledger.
//
// The engine itself now lives in @emsenn/relating as proper boundary→bulk
// holography (`@emsenn/relating/holography/projecting`): the append-only EAVT log
// is the boundary; state and record are the bulk it determines by projection.
// This barrel re-exports it unchanged so Hive consumers keep importing
// `@emsenn/computing-with-hive/witnessing`. Hive-specific Feeds (the trending
// field, the market, per-account stake) are defined BY the consumer (e.g.
// sites/aagaard's witnessing.mts) — the machine is generic; only the cellizers
// and settlement predicates are domain knowledge.

export {
  cell,
  attributesOf,
  membersOf,
  type Witness,
  projectStateView,
  type EntityView,
  type StateView,
  settleCells,
  boundedReading,
  CELL_CAP,
  RUN_CAP,
  type SettlementReading,
  projectRecordData,
  type RecordPolicy,
  type RecordOutcome,
  type RecordProjection,
  type WitnessStore,
  feedPath,
  ensureStoreDirs,
  readWitnessLog,
  appendWitnesses,
  writeJsonAtomic,
  writeState,
  commitRecord,
  witnessObservation,
  projectFeedState,
  projectFeedRecord,
  type Feed,
} from "@emsenn/relating/holography/projecting";
