// engine — core Hive Engine sidechain types and custom_json wrappers.
//
// Hive Engine actions ride Hive L1 as `custom_json` operations with id
// "ssc-mainnet-hive" and a JSON payload of shape
// { contractName, contractAction, contractPayload }. One custom_json may carry
// a single action object or an array of actions. Pure: no network, no signing.
import { customJson } from "@red-cup-engineering/hive-blockchain-client-service/ops.mjs";
/** The custom_json id for the Hive Engine mainnet sidechain. */
export const SSC_MAINNET_HIVE = "ssc-mainnet-hive";
/**
 * The JSON payload for a Hive Engine custom_json op: a single action object,
 * or an array of action objects executed in order.
 */
export function enginePayload(actions) {
    return Array.isArray(actions) ? [...actions] : actions;
}
/**
 * Full `custom_json` Operation tuple carrying the given Hive Engine action(s).
 *
 * Hive Engine token/market/NFT actions require the ACTIVE authority, so
 * `account` is placed in required_auths (not required_posting_auths).
 */
export function engineCustomJson(account, actions) {
    return customJson({
        id: SSC_MAINNET_HIVE,
        required_auths: [account],
        json: enginePayload(actions),
    });
}
/**
 * Format a token quantity as an exact decimal string with exactly `precision`
 * fractional digits (Hive Engine token amounts are decimal strings with
 * up-to-8 precision).
 *
 * All arithmetic is bigint/string based — no float drift. Number inputs are
 * taken at their shortest decimal representation and rounded half-away-from-
 * zero to `precision`; string and bigint inputs are exact at any magnitude.
 * Builders in this package do NOT format for you: pass pre-formatted decimal
 * strings (use this helper) as `quantity`/`price`.
 */
export function formatAmount(amount, precision) {
    if (!Number.isInteger(precision) || precision < 0 || precision > 8) {
        throw new RangeError(`precision must be an integer in [0, 8], got ${String(precision)}`);
    }
    let text;
    if (typeof amount === "bigint") {
        text = amount.toString();
    }
    else if (typeof amount === "number") {
        if (!Number.isFinite(amount)) {
            throw new RangeError(`amount must be finite, got ${String(amount)}`);
        }
        text = String(amount);
    }
    else {
        text = amount.trim();
    }
    const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
    const intDigits = match?.[2] ?? "";
    const fracDigits = match?.[3] ?? "";
    if (match === null || (intDigits === "" && fracDigits === "")) {
        throw new RangeError(`amount is not a decimal number: ${JSON.stringify(text)}`);
    }
    const negative = match[1] === "-";
    const exponent = match[4] === undefined ? 0 : Number.parseInt(match[4], 10);
    // value = digits × 10^(exponent − fracDigits.length); scale to 10^precision.
    const digits = BigInt(intDigits + fracDigits);
    const shift = exponent - fracDigits.length + precision;
    let scaled;
    if (shift >= 0) {
        scaled = digits * 10n ** BigInt(shift);
    }
    else {
        const divisor = 10n ** BigInt(-shift);
        const quotient = digits / divisor;
        const remainder = digits % divisor;
        // Round half away from zero (digits is non-negative here).
        scaled = remainder * 2n >= divisor ? quotient + 1n : quotient;
    }
    const abs = scaled.toString().padStart(precision + 1, "0");
    const intPart = abs.slice(0, abs.length - precision);
    const out = precision === 0 ? intPart : `${intPart}.${abs.slice(abs.length - precision)}`;
    return negative && scaled !== 0n ? `-${out}` : out;
}
