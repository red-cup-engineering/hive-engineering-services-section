// tokens — builders for the Hive Engine "tokens" contract. Each returns an
// EngineAction ready for engineCustomJson. Pure: no network, no signing.
//
// Quantities are decimal STRINGS at the token's precision (max 8); callers
// must pre-format (see formatAmount in ./engine.mts). Payload shapes verified
// against hive-engine/steemsmartcontracts contracts/tokens.js.
import type { EngineAction } from "./core.mjs";

const TOKENS_CONTRACT = "tokens";

export interface TokenTransferInput {
  readonly symbol: string;
  readonly to: string;
  /** Decimal string at the token's precision. */
  readonly quantity: string;
  readonly memo?: string;
}

export function tokenTransfer({ symbol, to, quantity, memo }: TokenTransferInput): EngineAction {
  return {
    contractName: TOKENS_CONTRACT,
    contractAction: "transfer",
    contractPayload: { symbol, to, quantity, ...(memo === undefined ? {} : { memo }) },
  };
}

export interface StakeInput {
  readonly symbol: string;
  /** Account to stake to (may be the sender for self-stake). */
  readonly to: string;
  readonly quantity: string;
}

export function stake({ symbol, to, quantity }: StakeInput): EngineAction {
  return {
    contractName: TOKENS_CONTRACT,
    contractAction: "stake",
    contractPayload: { symbol, to, quantity },
  };
}

export interface UnstakeInput {
  readonly symbol: string;
  readonly quantity: string;
}

export function unstake({ symbol, quantity }: UnstakeInput): EngineAction {
  return {
    contractName: TOKENS_CONTRACT,
    contractAction: "unstake",
    contractPayload: { symbol, quantity },
  };
}

export interface CancelUnstakeInput {
  /** Transaction id of the pending unstake to cancel. */
  readonly txID: string;
}

export function cancelUnstake({ txID }: CancelUnstakeInput): EngineAction {
  return {
    contractName: TOKENS_CONTRACT,
    contractAction: "cancelUnstake",
    contractPayload: { txID },
  };
}

export interface DelegateInput {
  readonly symbol: string;
  readonly to: string;
  readonly quantity: string;
}

export function delegate({ symbol, to, quantity }: DelegateInput): EngineAction {
  return {
    contractName: TOKENS_CONTRACT,
    contractAction: "delegate",
    contractPayload: { symbol, to, quantity },
  };
}

export interface UndelegateInput {
  readonly symbol: string;
  /** Account the delegation was made to (the delegation is pulled back from it). */
  readonly from: string;
  readonly quantity: string;
}

export function undelegate({ symbol, from, quantity }: UndelegateInput): EngineAction {
  return {
    contractName: TOKENS_CONTRACT,
    contractAction: "undelegate",
    contractPayload: { symbol, from, quantity },
  };
}

export interface TokenIssueInput {
  readonly symbol: string;
  readonly to: string;
  readonly quantity: string;
  readonly memo?: string;
}

/** Issue new tokens (sender must be the token issuer). */
export function tokenIssue({ symbol, to, quantity, memo }: TokenIssueInput): EngineAction {
  return {
    contractName: TOKENS_CONTRACT,
    contractAction: "issue",
    contractPayload: { symbol, to, quantity, ...(memo === undefined ? {} : { memo }) },
  };
}
