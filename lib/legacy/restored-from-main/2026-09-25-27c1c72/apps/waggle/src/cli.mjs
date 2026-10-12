#!/usr/bin/env node
const argv = process.argv.slice(2);
const out = (v)=>console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
const die = (msg)=>{
    console.error(`waggle: ${msg}`);
    process.exit(1);
};
const env = process.env;
const root = env["WAGGLE_ROOT"] || undefined;
function nodesFrom(flagNode) {
    if (flagNode) return [
        flagNode
    ];
    if (env["WAGGLE_NODES"]) return env["WAGGLE_NODES"].split(",").map((s)=>s.trim()).filter(Boolean);
    return undefined;
}
function takeFlag(args, flag) {
    const i = args.indexOf(flag);
    if (i === -1) return {
        value: undefined,
        rest: args
    };
    const value = args[i + 1];
    return {
        value,
        rest: [
            ...args.slice(0, i),
            ...args.slice(i + 2)
        ]
    };
}
async function cmdSync(args) {
    const { HiveClient } = await import("@red-cup-engineering/hive-blockchain-client-service");
    const { syncAccount } = await import("./sync.mjs");
    const { value: node, rest } = takeFlag(args, "--node");
    const account = rest[0];
    if (!account) return die("sync <account> — the Hive account to sync");
    const nodes = nodesFrom(node);
    const client = new HiveClient({
        ...nodes !== undefined ? {
            nodes
        } : {}
    });
    const result = await syncAccount({
        client,
        account,
        ...root !== undefined ? {
            root
        } : {}
    });
    out(`@${result.account} — synced ${result.opsFetched} new op(s) over ${result.pagesFetched} page(s), lastSeq=${result.lastSeq}`);
    out(`transactions=${result.transactionsTotal}  unmapped=${result.unmappedTotal}`);
    out("");
    out("balances:");
    for (const b of result.balances)out(`  ${b}`);
    out("");
    out(`reconciliation: ${result.reconcile.reconciled ? "RECONCILED" : "NOT reconciled"}`);
    for (const l of result.reconcile.lines){
        out(`  ${l.reconciled ? "ok  " : "DIFF"}  ${l.account}  booked ${l.booked}  actual ${l.actual}${l.reconciled ? "" : `  delta ${l.delta}`}`);
    }
    return result.reconcile.reconciled ? 0 : 2;
}
async function cmdBalances(args) {
    const { loadBalances } = await import("./sync.mjs");
    const account = args[0];
    if (!account) return die("balances <account>");
    const loaded = loadBalances(account, root);
    if (!loaded) {
        console.error(`waggle: no persisted ledger for @${account}; run \`waggle sync ${account}\` first`);
        return 1;
    }
    out(`@${account} — lastSeq=${loaded.lastSeq}  unmapped=${loaded.unmappedCount}`);
    for (const b of loaded.balances)out(`  ${b}`);
    return 0;
}
async function main() {
    const cmd = argv[0];
    const rest = argv.slice(1);
    switch(cmd){
        case "sync":
            return cmdSync(rest);
        case "balances":
            return cmdBalances(rest);
        default:
            console.error("usage: waggle <sync|balances> ...");
            console.error("  waggle sync <account> [--node URL]");
            console.error("  waggle balances <account>");
            return cmd ? 1 : 1;
    }
}
main().then((code)=>{
    process.exitCode = code;
}).catch((err)=>{
    console.error(`waggle: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});
