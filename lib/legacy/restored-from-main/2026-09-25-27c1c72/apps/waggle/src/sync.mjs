import { readFileSync, existsSync } from "node:fs";
import { writeFileAtomic } from "@red-cup-engineering/computer-system-engine/filesystem";
import path from "node:path";
import { bookHistory, settle, reconcile, formatAmount } from "./ledger.mjs";
import { hiveKeyDir, defaultHiveKeyRoot } from "@red-cup-engineering/key-management-services-section/hive-keystore";
const DEFAULT_PAGE_LIMIT = 1000;
const MAX_PAGES = 1000;
function isAmount(v) {
    return typeof v === "object" && v !== null && typeof v.num === "bigint" && typeof v.den === "bigint" && typeof v.commodity === "string";
}
function isJsonAmount(v) {
    return typeof v === "object" && v !== null && v.__amount === true;
}
function jsonifyAmounts(value) {
    if (isAmount(value)) {
        return {
            __amount: true,
            num: value.num.toString(),
            den: value.den.toString(),
            commodity: value.commodity
        };
    }
    if (Array.isArray(value)) return value.map(jsonifyAmounts);
    if (typeof value === "object" && value !== null) {
        const out = {};
        for (const [k, v] of Object.entries(value))out[k] = jsonifyAmounts(v);
        return out;
    }
    return value;
}
function reviveAmounts(value) {
    if (isJsonAmount(value)) {
        return {
            num: BigInt(value.num),
            den: BigInt(value.den),
            commodity: value.commodity
        };
    }
    if (Array.isArray(value)) return value.map(reviveAmounts);
    if (typeof value === "object" && value !== null) {
        const out = {};
        for (const [k, v] of Object.entries(value))out[k] = reviveAmounts(v);
        return out;
    }
    return value;
}
export function serializeLedger(account, transactions, lastSeq, unmappedCount) {
    return {
        account,
        lastSeq,
        unmappedCount,
        transactions: transactions.map((t)=>jsonifyAmounts(t))
    };
}
export function deserializeLedger(persisted) {
    const transactions = persisted.transactions.map((t)=>reviveAmounts(t));
    return {
        transactions,
        lastSeq: persisted.lastSeq,
        unmappedCount: persisted.unmappedCount
    };
}
function ledgerPath(account, root) {
    return path.join(hiveKeyDir(account, root), "ledger.json");
}
function balancesPath(account, root) {
    return path.join(hiveKeyDir(account, root), "balances.txt");
}
function placesFor(commodity) {
    return commodity === "VESTS" ? 6 : 3;
}
export function renderBalances(balances) {
    const lines = [];
    for (const account of [
        ...balances.keys()
    ].sort()){
        const byCommodity = balances.get(account);
        for (const commodity of [
            ...byCommodity.keys()
        ].sort()){
            const a = byCommodity.get(commodity);
            lines.push(`${account}  ${formatAmount(a, {
                places: placesFor(commodity),
                grouping: false
            })}`);
        }
    }
    return lines;
}
function chainStateOf(account) {
    const cs = {
        balance: account.balance,
        hbd_balance: account.hbd_balance
    };
    if (typeof account["savings_balance"] === "string") cs.savings_balance = account["savings_balance"];
    if (typeof account["savings_hbd_balance"] === "string") cs.savings_hbd_balance = account["savings_hbd_balance"];
    return cs;
}
function loadPersisted(account, root) {
    const file = ledgerPath(account, root);
    if (!existsSync(file)) return {
        transactions: [],
        lastSeq: -1,
        unmappedCount: 0
    };
    return deserializeLedger(JSON.parse(readFileSync(file, "utf8")));
}
async function fetchNewHistory(client, account, sinceSeq, pageLimit) {
    const collected = [];
    let start = -1;
    let pages = 0;
    for(; pages < MAX_PAGES;){
        if (start !== -1 && start < 0) break;
        const limit = start === -1 ? pageLimit : Math.min(pageLimit, start);
        const rows = await client.getAccountHistory(account, start, limit);
        pages += 1;
        if (rows.length === 0) break;
        let lowest = Number.POSITIVE_INFINITY;
        let reachedSeen = false;
        for (const entry of rows){
            const seq = entry[0];
            if (seq < lowest) lowest = seq;
            if (seq <= sinceSeq) {
                reachedSeen = true;
                continue;
            }
            collected.push(entry);
        }
        if (reachedSeen) break;
        if (lowest <= 0) break;
        if (!Number.isFinite(lowest)) break;
        start = lowest - 1;
    }
    return {
        entries: collected,
        pages
    };
}
export async function syncAccount(opts) {
    const { client, account } = opts;
    const root = opts.root ?? defaultHiveKeyRoot();
    const pageLimit = opts.pageLimit ?? DEFAULT_PAGE_LIMIT;
    const persisted = loadPersisted(account, root);
    const seen = new Set(persisted.transactions.map((t)=>String(t.id)));
    const { entries, pages } = await fetchNewHistory(client, account, persisted.lastSeq, pageLimit);
    const booked = bookHistory(entries, account, seen);
    const allTransactions = [
        ...persisted.transactions,
        ...booked.transactions
    ];
    const lastSeq = Math.max(persisted.lastSeq, booked.lastSeq);
    const unmappedTotal = persisted.unmappedCount + booked.unmapped.length;
    const ledger = settle(allTransactions);
    const chainAccount = await client.getAccount(account);
    const report = chainAccount ? reconcile(ledger.balances, chainStateOf(chainAccount)) : {
        kind: "ledger-computer.reconcile",
        lines: [],
        reconciled: false
    };
    const renderedBalances = renderBalances(ledger.balances);
    writeFileAtomic(ledgerPath(account, root), JSON.stringify(serializeLedger(account, allTransactions, lastSeq, unmappedTotal)), { directoryMode: 0o700 });
    writeFileAtomic(balancesPath(account, root), renderSummary(account, renderedBalances, report, unmappedTotal, lastSeq), { directoryMode: 0o700 });
    return {
        account,
        opsFetched: entries.length,
        pagesFetched: pages,
        transactionsTotal: allTransactions.length,
        unmappedTotal,
        balances: renderedBalances,
        reconcile: report,
        lastSeq
    };
}
export function renderSummary(account, balances, report, unmappedTotal, lastSeq) {
    const lines = [];
    lines.push(`# @${account} — waggle balances`);
    lines.push(`# lastSeq=${lastSeq}  unmapped=${unmappedTotal}  reconciled=${report.reconciled}`);
    lines.push("");
    lines.push("## balances");
    for (const b of balances)lines.push(b);
    lines.push("");
    lines.push("## reconciliation");
    for (const l of report.lines){
        lines.push(`${l.reconciled ? "ok  " : "DIFF"}  ${l.account}  booked ${l.booked}  actual ${l.actual}${l.reconciled ? "" : `  delta ${l.delta}`}`);
    }
    return `${lines.join("\n")}\n`;
}
export function loadBalances(account, root = defaultHiveKeyRoot()) {
    const file = ledgerPath(account, root);
    if (!existsSync(file)) return undefined;
    const { transactions, lastSeq, unmappedCount } = loadPersisted(account, root);
    const ledger = settle(transactions);
    return {
        balances: renderBalances(ledger.balances),
        lastSeq,
        unmappedCount
    };
}
