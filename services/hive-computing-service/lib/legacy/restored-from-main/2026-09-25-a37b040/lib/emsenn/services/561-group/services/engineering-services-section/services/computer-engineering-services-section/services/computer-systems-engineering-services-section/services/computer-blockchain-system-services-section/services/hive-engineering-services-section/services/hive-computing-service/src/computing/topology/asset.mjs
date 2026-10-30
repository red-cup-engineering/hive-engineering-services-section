/** Hive chain asset syntax and precision. Generic exact amounts live in the ledger carrier. */
import { amount, parseDecimalAmount } from "@lenticule-science/metrologic/number/commodity-amount";
export const ASSET_PLACES = Object.freeze({ HIVE: 3, HBD: 3, VESTS: 6, TESTS: 3, TBD: 3 });
export function parseLegacyAsset(text) {
  const match = /^(-?[\d.,]+)\s+([A-Z]+)$/.exec(String(text).trim());
  if (!match) throw new Error(`hive asset: unparseable asset string ${JSON.stringify(text)}`);
  const value = parseDecimalAmount(match[1]);
  if (!value) throw new Error(`hive asset: unparseable asset magnitude ${JSON.stringify(text)}`);
  return amount(value.num, value.den, match[2]);
}
/** Hive legacy wire rendering truncates at the asset's declared precision; ledger display rounds half-up. */
export function formatLegacyAsset(asset) {
  const places = ASSET_PLACES[asset.commodity] ?? 3;
  const rounded = asset.num * (10n ** BigInt(places)) / asset.den;
  const negative = rounded < 0n; const digits = (negative ? -rounded : rounded).toString().padStart(places + 1, "0");
  const whole = digits.slice(0, -places) || "0"; const fraction = places === 0 ? "" : `.${digits.slice(-places)}`;
  return `${negative ? "-" : ""}${whole}${fraction} ${asset.commodity}`;
}
export function expectCommodity(asset, commodity) {
  if (asset.commodity !== commodity) throw new TypeError(`hive asset: expected ${commodity}, got ${asset.commodity}`);
  return asset;
}
