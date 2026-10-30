/**
 * geometry — the past light-cone of a vote: backtests with no lookahead bias.
 *
 * A curation backtest is a claim about a decision made AT a vote, and the only
 * honest claim is one that uses only what was knowable BEFORE the vote settled.
 * The chain gives us exactly the order that makes "before" precise: block
 * height. We model the chain's social events (posts, votes, blocks) as a
 * Castellan–Clairambault–Winskel polarized prime event structure
 * (@emsenn/gaming/structuring), with the causal order $\leq$ read off block height
 * (and any finer reply/dependency edges the caller supplies). In that structure
 * the *past light-cone* of a vote $v$ is its down-set $\{c : c \leq v\}$ — the
 * causal past, the only legal information set for a strategy deciding at $v$.
 *
 *  - `pastLightCone(structure, v)` restricts the structure to $\mathrm{down}(v)$
 *    (@emsenn/gaming/structuring `restrictStructure`): the causal past as a genuine
 *    sub-event-structure (down-closed, so the restriction is a valid PES).
 *  - `backtestAdmissible(structure, v, reads)` certifies a strategy reads only
 *    from that cone. A read is admissible IFF it lies in $\mathrm{down}(v)$
 *    (equivalently `causes(read, v)`); any read outside the cone is *lookahead*
 *    — future or merely-concurrent information — and is named as the
 *    obstruction. This kills lookahead bias STRUCTURALLY, by set membership in
 *    the causal past, not by a heuristic or a timestamp comparison after the
 *    fact.
 *  - `legalInformationSet(structure, v)` bundles the cone with Huizinga's magic
 *    circle (@emsenn/gaming/structuring `magicCircle`) drawn on the discrete arena
 *    of the structure with the inside set to $\mathrm{down}(v)$. Because a
 *    down-set is down-closed by construction, the circle is a sub-arena (its
 *    `subArenaJudgment` witnesses) — the legal information set is the inside of
 *    the magic circle of the vote.
 *
 * The carrier subtlety (the load-bearing honesty): a `HiveTopologyCarrier` is
 * an *unordered* meme-topology carrier. Its vote/post/follow cells carry no
 * block height and no intrinsic causal order, so a causal order CANNOT be
 * derived from the carrier alone. We therefore take the event SET's legitimacy
 * from the carrier (each event id must name a real carrier subject/object —
 * `chainEventStructure` validates against the voter and author entries) but the
 * causal ORDER from the caller-supplied block heights. The carrier says *what
 * exists*; the heights say *what came first*.
 *
 * Exact and discrete throughout: causality is a finite edge relation, the cone
 * is a finite set, admissibility is finite set membership. No floats, no LLM —
 * a theorem about information sets, decided by computation.
 */
import {
  eventStructure, event, downSet,
  type PrimeEventStructure, type EventPair, type Polarity,
} from "@emsenn/gaming/structuring";
import { discreteArena } from "@emsenn/gaming/structuring";
import { magicCircle, restrictStructure, type MagicCircle } from "@emsenn/gaming/structuring";
import type { HiveTopologyCarrier } from "../topology/index.mjs";
import {
  hiveKnowledgeSection,
} from "../topology/index.mjs";
import { hiveProjectedSection } from "../topology/hive-section-boundary.mjs";

// ---------------------------------------------------------------------------
// Chain events
// ---------------------------------------------------------------------------

/**
 * A single chain event in the causal history: a post, a vote, or a block,
 * identified by `id`, stamped with the `blockHeight` at which it became real,
 * and polarized (positive = the player's own committing move, negative = an
 * environment/Opponent move) so the structure embeds into a polarized PES.
 */
export interface ChainEvent {
  readonly kind: "hive-geometry.chainEvent";
  readonly id: string;
  readonly blockHeight: number;
  readonly polarity: Polarity;
}

/** Construct a chain event. `blockHeight` is the integer chain index that
 *  defines "before"; it is an ordering coordinate, never a money quantity. */
export function chainEvent(id: string, blockHeight: number, polarity: Polarity): ChainEvent {
  if (!Number.isInteger(blockHeight)) {
    throw new TypeError(`chainEvent: blockHeight must be an integer, got ${blockHeight}`);
  }
  return Object.freeze({
    kind: "hive-geometry.chainEvent" as const,
    id,
    blockHeight,
    polarity,
  });
}

// ---------------------------------------------------------------------------
// The chain event structure derived from a carrier
// ---------------------------------------------------------------------------

/**
 * The chain's events as a polarized prime event structure, paired with the
 * block-height stamp of each event. The PES carries the causal order; the
 * `heights` map records the chain index each event id occurred at (the witness
 * that the order is genuinely "before/after on chain", not invented).
 */
export interface ChainEventStructure {
  readonly kind: "hive-geometry.chainEventStructure";
  readonly structure: PrimeEventStructure;
  readonly heights: ReadonlyMap<string, number>;
}

/** Every distinct carrier identifier (account/post mark value) that appears as
 *  a subject or object of a voter or author entry — the set of things the
 *  carrier actually knows about. An event id is honest iff it names one. */
function carrierIdentifiers(carrier: HiveTopologyCarrier): ReadonlySet<string> {
  const section = hiveProjectedSection(hiveKnowledgeSection(carrier));
  const ids = new Set<string>();
  for (const entry of section.entries) {
    const subject = entry.cell.subject.mark.value;
    const object = entry.cell.object.mark.value;
    if (typeof subject === "string") ids.add(subject);
    if (typeof object === "string") ids.add(object);
  }
  return ids;
}

/**
 * Build the chain event structure from a carrier and a caller-supplied set of
 * chain events (with explicit block heights and polarities), plus optional
 * explicit dependency edges (finer reply/parent structure than height alone).
 *
 * The event SET is validated against the carrier — every event id must name a
 * real carrier subject or object (a known account or post); an id the carrier
 * has never seen is an `unknown-event` and is rejected, because a backtest may
 * not invent history. The causal ORDER is built from the heights: `[a, b]` is a
 * causality edge whenever `heights[a] < heights[b]` (a strictly-earlier event
 * causally precedes a later one), unioned with the supplied dependencies. The
 * resulting `causes` closure is exactly "no later than on chain".
 */
export function chainEventStructure(
  carrier: HiveTopologyCarrier,
  events: readonly ChainEvent[],
  dependencies: readonly EventPair[] = [],
): ChainEventStructure {
  const known = carrierIdentifiers(carrier);
  for (const ev of events) {
    if (!known.has(ev.id)) {
      throw new RangeError(
        `chainEventStructure: event "${ev.id}" names no carrier subject or object`,
      );
    }
  }
  const heights = new Map<string, number>();
  for (const ev of events) heights.set(ev.id, ev.blockHeight);

  // Causality from height: every strictly-earlier event precedes every later.
  const causality: EventPair[] = [];
  for (const a of events) {
    for (const b of events) {
      if (a.id === b.id) continue;
      if (a.blockHeight < b.blockHeight) causality.push([a.id, b.id]);
    }
  }
  // Union the caller's explicit dependency edges (e.g. reply-to within a block).
  for (const dep of dependencies) causality.push(dep);

  const pesEvents = events.map((ev) => event(ev.id, ev.polarity));
  const structure = eventStructure(pesEvents, causality);

  return Object.freeze({
    kind: "hive-geometry.chainEventStructure" as const,
    structure,
    heights: heights as ReadonlyMap<string, number>,
  });
}

// ---------------------------------------------------------------------------
// The past light-cone
// ---------------------------------------------------------------------------

/**
 * The past light-cone of a vote: the causal past $\{c : c \leq v\}$ restricted
 * to its own sub-event-structure. This is `restrictStructure` applied to the
 * `downSet` — and because a down-set is down-closed (every cause of a kept
 * event is kept), the restriction is a genuine PES. This is the legal
 * information set: the most a strategy deciding at `v` may ever read.
 *
 * NOTE on the upstream surface: `restrictStructure` is exported from
 * `@emsenn/gaming/structuring` (it lives in geometry/boundary and is re-exported
 * via the geometry index — verified against the dist `.d.ts`); it keeps only
 * the edges both of whose endpoints survive, which on a down-closed set is a
 * valid sub-PES. The optional diagnostics (`ludusIndex`, `coveringRelation`,
 * `entryPoints`) are not needed to realize the cone and are left to callers.
 */
export function pastLightCone(structure: ChainEventStructure, voteEventId: string): PrimeEventStructure {
  const cone = downSet(structure.structure, voteEventId);
  return restrictStructure(structure.structure, cone);
}

// ---------------------------------------------------------------------------
// Backtest admissibility — lookahead bias killed structurally
// ---------------------------------------------------------------------------

export interface BacktestAdmissibleWitness {
  readonly kind: "hive-geometry.backtestAdmissible:witness";
  readonly voteEvent: string;
  /** The past light-cone — every id the strategy is permitted to read. */
  readonly cone: readonly string[];
  /** The ids the strategy actually read — all inside the cone. */
  readonly reads: readonly string[];
}

export interface BacktestAdmissibleObstruction {
  readonly kind: "hive-geometry.backtestAdmissible-obstruction";
  /** `lookahead`: a read outside the cone (future/concurrent). `unknown-event`:
   *  a read (or the vote) that is not an event of the structure at all. */
  readonly reason: "lookahead" | "unknown-event";
  readonly voteEvent: string;
  readonly offending: string;
}

export type BacktestAdmissibleJudgment = BacktestAdmissibleWitness | BacktestAdmissibleObstruction;

/**
 * Certify that a strategy deciding at `voteEventId` reads only from that vote's
 * past light-cone. THEOREM (no lookahead): a read is admissible iff it lies in
 * $\mathrm{down}(v)$, i.e. iff `causes(read, v)`; any read not in the cone is
 * future or concurrent information and is named as a `lookahead` obstruction.
 * An unknown vote, or a read that is not an event of the structure, is an
 * `unknown-event` obstruction. Admissibility is decided by set membership in
 * the causal past — there is no way to "accidentally" read the future.
 */
export function backtestAdmissible(
  structure: ChainEventStructure,
  voteEventId: string,
  reads: readonly string[],
): BacktestAdmissibleJudgment {
  const allIds = new Set(structure.structure.events.map((ev) => ev.id));
  if (!allIds.has(voteEventId)) {
    return Object.freeze({
      kind: "hive-geometry.backtestAdmissible-obstruction" as const,
      reason: "unknown-event" as const,
      voteEvent: voteEventId,
      offending: voteEventId,
    });
  }
  const cone = downSet(structure.structure, voteEventId);
  const coneSet = new Set(cone);
  for (const read of reads) {
    if (!allIds.has(read)) {
      return Object.freeze({
        kind: "hive-geometry.backtestAdmissible-obstruction" as const,
        reason: "unknown-event" as const,
        voteEvent: voteEventId,
        offending: read,
      });
    }
    if (!coneSet.has(read)) {
      return Object.freeze({
        kind: "hive-geometry.backtestAdmissible-obstruction" as const,
        reason: "lookahead" as const,
        voteEvent: voteEventId,
        offending: read,
      });
    }
  }
  return Object.freeze({
    kind: "hive-geometry.backtestAdmissible:witness" as const,
    voteEvent: voteEventId,
    cone: Object.freeze([...cone]),
    reads: Object.freeze([...reads]),
  });
}

/** Whether the strategy's reads are backtest-admissible (cone-confined). */
export function isBacktestAdmissible(
  structure: ChainEventStructure,
  voteEventId: string,
  reads: readonly string[],
): boolean {
  return backtestAdmissible(structure, voteEventId, reads).kind
    === "hive-geometry.backtestAdmissible:witness";
}

// ---------------------------------------------------------------------------
// The legal information set as a magic circle
// ---------------------------------------------------------------------------

export interface InformationSet {
  readonly kind: "hive-geometry.informationSet";
  /** The past light-cone as a sub-PES — the legal information set. */
  readonly cone: PrimeEventStructure;
  /** Huizinga's magic circle drawn on the structure's arena with the cone
   *  inside: down-closed by construction, so its inside is a sub-arena. */
  readonly circle: MagicCircle;
  /** The causal past as a flat id list (the circle's inside). */
  readonly conePast: readonly string[];
}

/**
 * The legal information set of a vote: its past light-cone PES, together with
 * the magic circle drawn on the discrete arena of the whole structure with the
 * inside set to the cone. THEOREM: a down-set is down-closed, so this circle's
 * inside is a genuine sub-arena (`subArenaJudgment` would witness it) — the
 * legal information set is exactly the inside of the vote's magic circle. The
 * outside is the future-and-concurrent region from which any read is lookahead.
 */
export function legalInformationSet(structure: ChainEventStructure, voteEventId: string): InformationSet {
  const conePast = downSet(structure.structure, voteEventId);
  const cone = restrictStructure(structure.structure, conePast);
  const arena = discreteArena(structure.structure);
  const circle = magicCircle(arena, conePast);
  return Object.freeze({
    kind: "hive-geometry.informationSet" as const,
    cone,
    circle,
    conePast: Object.freeze([...conePast]),
  });
}
