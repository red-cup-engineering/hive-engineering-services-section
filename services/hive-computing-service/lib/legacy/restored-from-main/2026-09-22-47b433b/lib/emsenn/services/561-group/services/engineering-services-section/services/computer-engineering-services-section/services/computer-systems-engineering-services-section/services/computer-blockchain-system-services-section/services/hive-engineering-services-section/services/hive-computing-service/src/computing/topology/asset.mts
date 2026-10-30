// asset — legacy Hive asset-string codec ("12.345 HIVE" ↔ exact rational Amount).
// Condenser APIs return amounts as decimal strings with fixed precision
// (HIVE/HBD: 3 places, VESTS: 6 places). Parsing is exact via ledger-codecs
// rationals; no floats ever touch a money value.
import type { Amount } from "@emsenn/animating/becoming/doing/working/accounting";
import { amount } from "@emsenn/animating/becoming/doing/working/accounting";
import { format, parseDecimal } from "@emsenn/computing-with-ledgers";

/** Display precision per Hive commodity (legacy serialization). */
export const ASSET_PLACES: Readonly<Record<string, number>> = {
  HIVE: 3,
  HBD: 3,
  VESTS: 6,
  TESTS: 3,
  TBD: 3,
};

/** Parse a legacy asset string like "1048289.647 HIVE" into an exact rational Amount. */
export function parseLegacyAsset(s: string): Amount {
  const m = /^(-?[\d.,]+)\s+([A-Z]+)$/.exec(s.trim());
  if (!m) throw new Error(`hive-topology: unparseable asset string "${s}"`);
  const dec = parseDecimal(m[1] ?? "");
  if (!dec) throw new Error(`hive-topology: unparseable asset magnitude in "${s}"`);
  return amount(dec.num, dec.den, m[2] ?? "");
}

/** Render an Amount back to the legacy string form at the commodity's chain precision. */
export function formatLegacyAsset(a: Amount): string {
  const places = ASSET_PLACES[a.commodity] ?? 3;
  return `${format(a, { places, grouping: false })} ${a.commodity}`;
}

/** Require a specific commodity; returns the amount unchanged. */
export function expectCommodity(a: Amount, commodity: string): Amount {
  if (a.commodity !== commodity) {
    throw new TypeError(`hive-topology: expected ${commodity}, got ${a.commodity}`);
  }
  return a;
}
