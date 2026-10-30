/**
 * @emsenn/computing-with-hive — Hive admitted as a computing package.
 *
 * The package root is the public callable surface, matching the shell/API/MCP
 * shape `(action, token, ?claim)`. Richer structure lives on subpaths:
 *
 * - `/computing`: Hive facts as `Mark -> Utterance -> settled topology`,
 *   then read through computing observation arenas.
 * - `/codecs`: free-data gates for Hive protocol representations.
 * - `/holography`: Hive boundary resources reconstructed as utterances.
 * - `/curation`, `/market`, `/analysis`, `/logic`, `/geometry`: derived
 *   computing structures over those admitted carriers.
 * - `/client`, `/rpc`, `/scripts`: operational transport boundaries.
 *
 * Root category map:
 *
 * - Package/category: computing-with-hive, Hive computations downstream of the
 *   relating -> animating -> gaming -> computing spine.
 * - Domain object: `HiveRequest` = action + token + optional claim.
 * - Codomain object: `HiveAdmission` = admitted gate + bilattice charge +
 *   topology, computing observation, valuation, or protocol operation carrier.
 * - Root morphism: `computeWithHive` / `hive`, preserving the path from Hive
 *   boundary evidence through codecs/holography into package carriers.
 * - Representation boundary: plain chain JSON and wire operations must pass
 *   through `/codecs`, `/holography`, or executable boundaries before the root
 *   treats them as structure.
 */
export {
  computeWithHive,
  hive,
} from "./admission.mjs";
export type {
  HiveAction,
  HiveAdmission,
  HiveClaim,
  HiveObstruction,
  HiveRequest,
  HiveToken,
} from "./admission.mjs";
