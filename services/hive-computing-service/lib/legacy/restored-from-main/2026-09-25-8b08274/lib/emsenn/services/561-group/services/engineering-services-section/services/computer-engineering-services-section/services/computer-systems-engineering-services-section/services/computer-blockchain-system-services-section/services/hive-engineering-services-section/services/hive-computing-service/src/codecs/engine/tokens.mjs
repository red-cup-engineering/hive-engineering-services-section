const TOKENS_CONTRACT = "tokens";
export function tokenTransfer({ symbol, to, quantity, memo }) {
    return {
        contractName: TOKENS_CONTRACT,
        contractAction: "transfer",
        contractPayload: { symbol, to, quantity, ...(memo === undefined ? {} : { memo }) },
    };
}
export function stake({ symbol, to, quantity }) {
    return {
        contractName: TOKENS_CONTRACT,
        contractAction: "stake",
        contractPayload: { symbol, to, quantity },
    };
}
export function unstake({ symbol, quantity }) {
    return {
        contractName: TOKENS_CONTRACT,
        contractAction: "unstake",
        contractPayload: { symbol, quantity },
    };
}
export function cancelUnstake({ txID }) {
    return {
        contractName: TOKENS_CONTRACT,
        contractAction: "cancelUnstake",
        contractPayload: { txID },
    };
}
export function delegate({ symbol, to, quantity }) {
    return {
        contractName: TOKENS_CONTRACT,
        contractAction: "delegate",
        contractPayload: { symbol, to, quantity },
    };
}
export function undelegate({ symbol, from, quantity }) {
    return {
        contractName: TOKENS_CONTRACT,
        contractAction: "undelegate",
        contractPayload: { symbol, from, quantity },
    };
}
/** Issue new tokens (sender must be the token issuer). */
export function tokenIssue({ symbol, to, quantity, memo }) {
    return {
        contractName: TOKENS_CONTRACT,
        contractAction: "issue",
        contractPayload: { symbol, to, quantity, ...(memo === undefined ? {} : { memo }) },
    };
}
