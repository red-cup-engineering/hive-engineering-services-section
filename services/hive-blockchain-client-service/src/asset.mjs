// asset — the chain's legacy asset strings ("1.000 HIVE") as graded rationals, graded by the asset symbol.
import { decimalOfRational } from "@red-cup-engineering/exact-number-data-service/decimal-string";
import { gradeOf, graded, gradedValue, parseDecimalAmount } from "@red-cup-engineering/exact-number-data-service/graded";
export const ASSET_PLACES = Object.freeze({ HIVE: 3, HBD: 3, VESTS: 6, TESTS: 3, TBD: 3 });
export function parseLegacyAsset(text) {
  const match = /^(-?[\d.,]+)\s+([A-Z]+)$/.exec(String(text).trim());
  if (!match) throw new Error(`hive asset: unparseable asset string ${JSON.stringify(text)}`);
  const value = parseDecimalAmount(match[1]);
  if (!value) throw new Error(`hive asset: unparseable asset magnitude ${JSON.stringify(text)}`);
  return graded(value.value, match[2]);
}
/** Hive legacy wire rendering truncates at the asset's declared precision; ledger display rounds half-up. */
export function formatLegacyAsset(asset) {
  const places = ASSET_PLACES[gradeOf(asset)] ?? 3;
  return `${decimalOfRational(gradedValue(asset), places, { rounding: "toward-zero" })} ${gradeOf(asset)}`;
}
export function expectCommodity(asset, commodity) {
  if (gradeOf(asset) !== commodity) throw new TypeError(`hive asset: expected ${commodity}, got ${gradeOf(asset)}`);
  return asset;
}
