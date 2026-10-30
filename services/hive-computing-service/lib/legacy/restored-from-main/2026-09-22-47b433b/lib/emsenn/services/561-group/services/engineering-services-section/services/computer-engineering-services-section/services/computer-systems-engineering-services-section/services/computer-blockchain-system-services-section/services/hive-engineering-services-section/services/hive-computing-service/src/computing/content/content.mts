/**
 * content — Hive content-fitness axis.
 *
 * ContentObservation carries what condenser_api.get_content yields: body,
 * title, links, word count, and the first paragraph (lede). It is the
 * content-layer analogue of PostObservation (which carries only on-chain
 * metadata). A curation decision for a new post composites both.
 *
 * contentFitnessValuation() applies four domain-neutral gates from
 * content-topology with Hive-appropriate thresholds and Hive-specific
 * evidence strings. The thresholds and evidence are consumer policy;
 * the underlying computations (wordCount, prophecyFindings, etc.) are
 * shared primitives.
 */

import {
  wordCount,
  extractLinks,
  proseLines,
  prophecyFindings,
  repetitionFindings,
  proseLintErrors,
} from "@emsenn/content/topology/gates";

// ---------- ContentObservation ----------

export interface ContentObservation {
  readonly kind: "hive.content-observation";
  readonly author: string;
  readonly permlink: string;
  /** Raw markdown body text. */
  readonly body: string;
  /** Post title as returned by condenser_api.get_content. */
  readonly title: string;
  /** All markdown link URLs extracted from the body. */
  readonly links: readonly string[];
  /** Word count of the body. */
  readonly wordCount: number;
  /** First prose paragraph (heading lines excluded). Empty string if none. */
  readonly lede: string;
  /** Primary tag (tags[0] from json_metadata, if present). */
  readonly primaryTag: string | undefined;
  /** Whether the body appears to be English prose (heuristic). */
  readonly likelyEnglish: boolean;
}

/** Shape of the raw condenser_api.get_content response fields we need. */
export interface RawHiveContent {
  readonly author: string;
  readonly permlink: string;
  readonly body: string;
  readonly title: string;
  readonly json_metadata: string;
}

function firstProse(body: string): string {
  // proseLines() (shared gate primitive) strips heading lines; we then take the
  // first non-empty blank-line-delimited block as the lede.
  return proseLines(body)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block !== "") ?? "";
}

/** True if the body contains enough ASCII-range word characters to appear
 *  English (a rough guard against non-Latin-script posts where prose-lint
 *  would fire misleadingly). */
function looksEnglish(body: string): boolean {
  const words = body.match(/\b[a-zA-Z]{3,}\b/g) ?? [];
  return words.length >= 30;
}

function parsePrimaryTag(jsonMetadata: string): string | undefined {
  try {
    const meta = JSON.parse(jsonMetadata) as unknown;
    if (meta !== null && typeof meta === "object" && "tags" in meta) {
      const tags = (meta as { tags?: unknown }).tags;
      if (Array.isArray(tags) && tags.length > 0 && typeof tags[0] === "string") {
        return tags[0] as string;
      }
    }
  } catch {
    // malformed json_metadata is normal on Hive
  }
  return undefined;
}

/** Build a ContentObservation from a condenser_api.get_content response. */
export function contentObservation(raw: RawHiveContent): ContentObservation {
  const links = extractLinks(raw.body);
  const wc = wordCount(raw.body);
  return Object.freeze({
    kind: "hive.content-observation" as const,
    author: raw.author,
    permlink: raw.permlink,
    body: raw.body,
    title: raw.title,
    links,
    wordCount: wc,
    lede: firstProse(raw.body),
    primaryTag: parsePrimaryTag(raw.json_metadata),
    likelyEnglish: looksEnglish(raw.body),
  });
}

// ---------- content-fitness valuation ----------

/** One gate's verdict on a Hive post. */
export interface ContentGate {
  readonly gate: string;
  readonly charge: "pass" | "fail";
  readonly evidence: string;
}

/**
 * A valuation of a post's content fitness. `admitted` is true if the post
 * clears `minPassingGates` of the four gates. `score` is a bigint from 0
 * to 400 (100 per gate), suitable for compositing with the social-signal
 * score from hive-curation-topology.
 */
export interface ContentFitnessValuation {
  readonly kind: "hive.content-fitness-valuation";
  readonly author: string;
  readonly permlink: string;
  readonly gates: readonly ContentGate[];
  readonly passingCount: number;
  readonly score: bigint;
  readonly admitted: boolean;
}

export interface ContentFitnessPolicy {
  /** Minimum word count to pass the length gate. Default: 300. */
  readonly minWords?: number;
  /** Minimum markdown links to pass the citations gate. Default: 2. */
  readonly minLinks?: number;
  /** Number of gates (out of 4) that must pass for admission. Default: 3. */
  readonly minPassingGates?: number;
}

const DEFAULT_POLICY: Required<ContentFitnessPolicy> = {
  minWords: 300,
  minLinks: 2,
  minPassingGates: 3,
};

/**
 * Evaluate a Hive post's content fitness across four domain-neutral gates:
 * length (word count), citations (link count), no-prophecy, and repetition.
 *
 * Prose-lint is skipped on non-English posts — it would fire misleadingly
 * on posts written in other scripts or languages.
 */
export function contentFitnessValuation(
  obs: ContentObservation,
  policy: ContentFitnessPolicy = {},
): ContentFitnessValuation {
  const minWords = policy.minWords ?? DEFAULT_POLICY.minWords;
  const minLinks = policy.minLinks ?? DEFAULT_POLICY.minLinks;
  const minPassingGates = policy.minPassingGates ?? DEFAULT_POLICY.minPassingGates;

  const gates: ContentGate[] = [];
  const judge = (gate: string, pass: boolean, evidence: string): void => {
    gates.push(Object.freeze({ gate, charge: pass ? "pass" : "fail" as const, evidence }));
  };

  judge(
    "length",
    obs.wordCount >= minWords,
    obs.wordCount >= minWords
      ? `${obs.wordCount} words`
      : `${obs.wordCount} words (needs ≥ ${minWords})`,
  );

  const externalLinks = obs.links.filter((link) => /^https?:\/\//i.test(link));
  judge(
    "citations",
    externalLinks.length >= minLinks,
    externalLinks.length >= minLinks
      ? `${externalLinks.length} external link(s)`
      : `${externalLinks.length} external link(s) (needs ≥ ${minLinks})`,
  );

  const prophecies = prophecyFindings(obs.body);
  judge(
    "no-prophecy",
    prophecies.length === 0,
    prophecies.length === 0
      ? "no modal-certainty sentences"
      : `${prophecies.length} prophecy-shaped sentence(s)`,
  );

  const repetitions = repetitionFindings(obs.body);
  judge(
    "repetition",
    repetitions.length === 0,
    repetitions.length === 0
      ? "no repeated sentences or 8-word phrases"
      : repetitions.slice(0, 2).join("; "),
  );

  if (obs.likelyEnglish) {
    const lintErrors = proseLintErrors(obs.body);
    judge(
      "prose",
      lintErrors.length === 0,
      lintErrors.length === 0
        ? "no prose-lint errors"
        : `${lintErrors.length} prose-lint error(s): ${lintErrors.slice(0, 2).join(" | ")}`,
    );
  }

  const passingCount = gates.filter((g) => g.charge === "pass").length;
  const totalGates = gates.length;
  const score = BigInt(Math.round((passingCount / Math.max(totalGates, 1)) * 400));

  return Object.freeze({
    kind: "hive.content-fitness-valuation" as const,
    author: obs.author,
    permlink: obs.permlink,
    gates: Object.freeze(gates),
    passingCount,
    score,
    admitted: passingCount >= minPassingGates,
  });
}
