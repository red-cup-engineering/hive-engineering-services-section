/**
 * Internal section projection boundary.
 *
 * Relating compares term carriers by identity. Hive admits relation-shaped
 * marks at its topology boundary, then package readers need value-level
 * projections such as `{ subject, object }` to derive familiar Hive section
 * reads. This module is not Hive ontology; it is the local proof/read boundary
 * that lets derived readers inspect admitted mark payloads without spreading
 * that inspection through the topology code.
 */
import { bottom, joinKnowledge } from "@emsenn/relating";
import type {
  Cell,
  ChargeCarrier,
  PredicationPredicate,
  PredicationTerm,
  SectionCarrier,
  SectionEntry,
} from "@emsenn/relating";
import { cell, mark, token } from "@emsenn/relating";

export type HiveBoundaryValue =
  | string
  | number
  | boolean
  | null
  | readonly HiveBoundaryValue[]
  | { readonly [key: string]: HiveBoundaryValue };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasMarkValue = (value: Record<string, unknown>): boolean =>
  isRecord(value.mark) && "value" in value.mark;

/**
 * Project a relational carrier admitted by this package into its domain
 * boundary reading. This is not the identity relation used by relating; it is
 * the Hive package's named read of marks like `{ subject, object }`.
 */
export function hiveBoundaryValue(value: unknown): HiveBoundaryValue {
  if (value === undefined) return null;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item) => hiveBoundaryValue(item)));
  if (!isRecord(value)) return String(value);

  if (
    typeof value.kind === "string" &&
    (value.kind === "utterance.token" ||
      value.kind === "utterance.claim" ||
      value.kind === "utterance.mark" ||
      value.kind === "predication.predicate") &&
    hasMarkValue(value)
  ) {
    return hiveBoundaryValue((value.mark as Record<string, unknown>).value);
  }

  if ("subject" in value && "object" in value) {
    return Object.freeze({
      subject: hiveBoundaryValue(value.subject),
      object: hiveBoundaryValue(value.object),
    });
  }

  return Object.freeze(Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, hiveBoundaryValue(entryValue)]),
  ));
}

export function hiveBoundaryKey(value: unknown): string {
  const projected = hiveBoundaryValue(value);
  if (Array.isArray(projected)) return `[${projected.map((entry) => hiveBoundaryKey(entry)).join(",")}]`;
  if (isRecord(projected)) {
    return `{${Object.entries(projected)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${hiveBoundaryKey(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(projected);
}

export function sameHiveBoundary(left: unknown, right: unknown): boolean {
  return hiveBoundaryKey(left) === hiveBoundaryKey(right);
}

const projectedPair = (subject: PredicationTerm, object?: PredicationTerm): HiveBoundaryValue => {
  if (object === undefined) return hiveBoundaryValue(subject);
  return Object.freeze({
    subject: hiveBoundaryValue(subject),
    object: hiveBoundaryValue(object),
  });
};

const entryTokenMatches = (entry: SectionEntry, expected: HiveBoundaryValue): boolean =>
  sameHiveBoundary(entry.cell.subject, expected) && sameHiveBoundary(entry.cell.object, expected);

const entryPredicateMatches = (entry: SectionEntry, predicate: PredicationPredicate): boolean =>
  sameHiveBoundary(entry.cell.predicate, predicate);

export function hiveChargeAtBoundary(
  section: SectionCarrier,
  subject: PredicationTerm,
  predicate: PredicationPredicate,
  object?: PredicationTerm,
): ChargeCarrier {
  const expected = projectedPair(subject, object);
  return section.entries
    .filter((entry) => entryTokenMatches(entry, expected) && entryPredicateMatches(entry, predicate))
    .reduce((charge, entry) => joinKnowledge(charge, entry.charge), bottom);
}

export function hiveEntriesForBoundarySubject(
  section: SectionCarrier,
  subject: PredicationTerm,
): readonly SectionEntry[] {
  const expected = hiveBoundaryValue(subject);
  return Object.freeze(section.entries.filter((entry) => {
    const projected = hiveBoundaryValue(entry.cell.subject);
    if (sameHiveBoundary(projected, expected)) return true;
    return isRecord(projected) && sameHiveBoundary(projected.subject, expected);
  }));
}

export function hiveEntriesForBoundaryMention(
  section: SectionCarrier,
  term: PredicationTerm,
): readonly SectionEntry[] {
  const expected = hiveBoundaryValue(term);
  return Object.freeze(section.entries.filter((entry) => {
    const projected = hiveBoundaryValue(entry.cell.subject);
    if (sameHiveBoundary(projected, expected)) return true;
    return isRecord(projected) && (
      sameHiveBoundary(projected.subject, expected) ||
      sameHiveBoundary(projected.object, expected)
    );
  }));
}

export function hiveEntriesForBoundaryPredicate(
  section: SectionCarrier,
  predicate: PredicationPredicate,
): readonly SectionEntry[] {
  return Object.freeze(section.entries.filter((entry) => entryPredicateMatches(entry, predicate)));
}

function projectedPairOf(value: unknown): readonly [HiveBoundaryValue, HiveBoundaryValue] {
  const projected = hiveBoundaryValue(value);
  if (isRecord(projected) && "subject" in projected && "object" in projected) {
    return [projected.subject as HiveBoundaryValue, projected.object as HiveBoundaryValue];
  }
  return [projected, projected];
}

/**
 * Re-read a section through Hive's boundary projection, preserving the section
 * charges but replacing diagonal composite tokens with projected subject/object
 * terms. Reused projected terms share carrier identity inside this derived
 * section, so generic relating analysis can see Hive edges without treating
 * boundary labels as the original topology.
 */
export function hiveProjectedSection(section: SectionCarrier): SectionCarrier {
  const terms = new Map<string, PredicationTerm>();
  const termOf = (value: HiveBoundaryValue): PredicationTerm => {
    const key = hiveBoundaryKey(value);
    const existing = terms.get(key);
    if (existing !== undefined) return existing;
    const term = token(mark(value));
    terms.set(key, term);
    return term;
  };
  const entries = section.entries.map((entry): SectionEntry => {
    const [subject, object] = projectedPairOf(entry.cell.subject);
    const projectedCell: Cell = cell(termOf(subject), entry.cell.predicate, termOf(object));
    return Object.freeze({
      kind: "meme-topology.section.entry" as const,
      cell: projectedCell,
      charge: entry.charge,
    });
  });
  return Object.freeze({
    kind: "meme-topology.section.carrier" as const,
    order: section.order,
    bound: section.bound,
    entries: Object.freeze(entries),
  });
}
