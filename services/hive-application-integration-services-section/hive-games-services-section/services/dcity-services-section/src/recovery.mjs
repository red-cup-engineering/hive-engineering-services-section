// recovery — dCity's game contract is closed (no new CITY-affecting actions
// are accepted by the token itself); the only live economic surface left is
// the SIM/SWAP.HIVE Hive-Engine pool. This module prices one exact full-
// balance SIM exit through that pool using integer/fraction arithmetic only,
// and never touches CITY NFTs (they are historical custody, not a market).

import { decimalUnits, formatUnits } from "@red-cup-engineering/exact-number-data-service/decimal-string";
import { engineCustomJson, exactInputSwapOutput, pools, reserveFraction } from "@red-cup-engineering/hive-blockchain-client-service/engine.mjs";

const ACCOUNT = /^(?=.{3,16}$)[a-z](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z](?:[a-z0-9-]*[a-z0-9])?)*$/;

/** The one dCity recovery operation: an exact-input SIM sale into the SIM/SWAP.HIVE pool with a
 * SWAP.HIVE floor. The planner builds it; the fleet signer admits exactly this shape. */
export function dcityRecoveryIntent(account, { tokenPair, quantitySim, minimumSwapHive }) {
  if (!ACCOUNT.test(account)) throw new Error("invalid Hive account");
  if (tokenPair !== "SWAP.HIVE:SIM" && tokenPair !== "SIM:SWAP.HIVE") throw new Error("pool is not the exact SIM/SWAP.HIVE pair");
  if (decimalUnits(quantitySim, 3) <= 0n || decimalUnits(minimumSwapHive, 8) <= 0n) throw new Error("dCity recovery quantity and floor must be positive");
  return engineCustomJson(account, pools.swapTokens({ tokenPair, tokenSymbol: "SIM", tokenAmount: quantitySim, tradeType: "exactInput", minAmountOut: minimumSwapHive }));
}

/**
 * Price a full-balance liquid-SIM exit through the observed SWAP.HIVE:SIM
 * pool, applying the deployed 25-bps Hive-Engine marketpools fee and a
 * caller-chosen slippage floor. Returns a `refuse` result (never throws) for
 * any evidence that fails validation, is empty, or has changed shape from
 * what this fleet has previously confirmed on-chain.
 */
export function planDCityLiquidSimRecovery(state, slippageBps = 100) {
  try {
    if (!ACCOUNT.test(state.account)) throw new Error("invalid Hive account");
    if (!Number.isSafeInteger(slippageBps) || slippageBps < 1 || slippageBps > 500) throw new Error("slippage policy must be 1 through 500 basis points");
    if (state.simPrecision !== 3 || state.swapHivePrecision !== 8) throw new Error("live SIM or SWAP.HIVE precision changed");
    if (state.tokenPair !== "SWAP.HIVE:SIM" && state.tokenPair !== "SIM:SWAP.HIVE") throw new Error("pool is not the exact SIM/SWAP.HIVE pair");
    const sim = decimalUnits(state.simBalance, state.simPrecision);
    if (sim <= 0n) return Object.freeze({ kind: "refuse", reason: "no liquid SIM remains to recover" });
    const simIsBase = state.tokenPair === "SIM:SWAP.HIVE";
    const reserveIn = reserveFraction(simIsBase ? state.baseQuantity : state.quoteQuantity);
    const reserveOut = reserveFraction(simIsBase ? state.quoteQuantity : state.baseQuantity);
    if (reserveIn.numerator <= 0n || reserveOut.numerator <= 0n) throw new Error("positive exact pool reserves are required");
    // The deployed marketpools fee is 25 bps.
    const outputUnits = exactInputSwapOutput({ reserveIn, reserveOut, quantity: sim, inputScale: 10n ** BigInt(state.simPrecision), outputScale: 10n ** BigInt(state.swapHivePrecision), feeBps: 25 });
    const minimumUnits = outputUnits * BigInt(10_000 - slippageBps) / 10_000n;
    if (minimumUnits <= 0n) throw new Error("bounded pool output rounds to zero");
    const quantitySim = formatUnits(sim, state.simPrecision);
    const expectedSwapHive = formatUnits(outputUnits, state.swapHivePrecision);
    const minimumSwapHive = formatUnits(minimumUnits, state.swapHivePrecision);
    return Object.freeze({
      kind: "ready",
      reason: "the closed dCity token has a live, bounded SIM-to-SWAP.HIVE pool exit; historical CITY NFTs remain untouched",
      quote: Object.freeze({
        quantitySim,
        expectedSwapHive,
        minimumSwapHive,
        slippageBps,
        operation: dcityRecoveryIntent(state.account, { tokenPair: state.tokenPair, quantitySim, minimumSwapHive }),
      }),
    });
  } catch (error) {
    return Object.freeze({ kind: "refuse", reason: `invalid dCity recovery evidence: ${error instanceof Error ? error.message : String(error)}` });
  }
}

const AGREEMENT_FIELDS = ["account", "simBalance", "swapHiveBalance", "baseQuantity", "quoteQuantity", "tokenPair"];

/** Two independently observed states are the same economic evidence when
 * every field that feeds the recovery quote agrees (observedAt may differ). */
export function statesAgree(left, right) {
  return AGREEMENT_FIELDS.every((field) => JSON.stringify(left[field]) === JSON.stringify(right[field]));
}
