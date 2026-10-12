import {
  amount,
  addAmounts,
  subtractAmounts,
  negateAmount,
  zeroAmount,
  isZeroAmount,
  exactAmountString,
  parseDecimalAmount,
  formatAmount,
} from "@lenticule-science/metrologic/number/commodity-amount";

export { formatAmount };

const ASSETS_HIVE_LIQUID = "Assets:Hive:Liquid";
const ASSETS_HBD_LIQUID = "Assets:Hbd:Liquid";
const ASSETS_HIVE_SAVINGS = "Assets:Hive:Savings";
const ASSETS_HBD_SAVINGS = "Assets:Hbd:Savings";
const INCOME_INTEREST_HBD = "Income:Interest:Hbd";

const incomeFromCounterparty = (from) => `Income:Transfers:${from}`;
const expenseToCounterparty = (to) => `Expenses:Transfers:${to}`;

export function parseAsset(text) {
  const match = /^(-?[\d.,]+)\s+([A-Z]+)$/u.exec(String(text).trim());
  if (!match) throw new TypeError(`ledger: unparseable asset ${JSON.stringify(text)}`);
  const decimal = parseDecimalAmount(match[1]);
  if (!decimal) throw new TypeError(`ledger: unparseable magnitude in ${JSON.stringify(text)}`);
  return amount(decimal.num, decimal.den, match[2]);
}

function liquidAccount(value) {
  if (value.commodity === "HIVE") return ASSETS_HIVE_LIQUID;
  if (value.commodity === "HBD") return ASSETS_HBD_LIQUID;
  throw new TypeError(`ledger: no liquid account for ${value.commodity}`);
}

function savingsAccount(value) {
  if (value.commodity === "HIVE") return ASSETS_HIVE_SAVINGS;
  if (value.commodity === "HBD") return ASSETS_HBD_SAVINGS;
  throw new TypeError(`ledger: no savings account for ${value.commodity}`);
}

export function postingId(operation) {
  return `hive:${operation.block}:${operation.trx_in_block}:${operation.op_in_trx}`;
}

function posting(account, value) {
  return { account, amount: value, cost: null, price: null, balanceAssertion: null, meta: {} };
}

function transaction(operation, sequence, narration, postings) {
  const id = postingId(operation);
  return {
    id,
    date: operation.timestamp.split("T")[0] ?? operation.timestamp,
    time: null,
    flag: null,
    payee: null,
    narration,
    postings,
    tags: [],
    links: [],
    meta: { id, seq: sequence, trx: operation.trx_id, virtual: operation.virtual_op ?? false },
    code: null,
    source: null,
  };
}

/** Turn one Hive history operation into the same balanced ledger posting pair as the former ledger package. */
export function opToTransaction(entry, owner) {
  const [sequence, operation] = entry;
  const [type, data] = operation.op;
  switch (type) {
    case "transfer": {
      const value = parseAsset(data.amount);
      const memo = data.memo || "";
      if (data.to === owner) {
        return transaction(operation, sequence, `transfer from ${data.from}${memo ? `: ${memo.slice(0, 80)}` : ""}`, [
          posting(liquidAccount(value), value),
          posting(incomeFromCounterparty(data.from), negateAmount(value)),
        ]);
      }
      return transaction(operation, sequence, `transfer to ${data.to}${memo ? `: ${memo.slice(0, 80)}` : ""}`, [
        posting(liquidAccount(value), negateAmount(value)),
        posting(expenseToCounterparty(data.to), value),
      ]);
    }
    case "transfer_to_savings": {
      const value = parseAsset(data.amount);
      if (data.to === owner) {
        return transaction(operation, sequence, "to savings", [
          posting(savingsAccount(value), value),
          posting(liquidAccount(value), negateAmount(value)),
        ]);
      }
      return transaction(operation, sequence, `to ${data.to} savings`, [
        posting(liquidAccount(value), negateAmount(value)),
        posting(expenseToCounterparty(data.to), value),
      ]);
    }
    case "fill_transfer_from_savings":
    case "transfer_from_savings": {
      const value = parseAsset(data.amount);
      return transaction(operation, sequence, "from savings", [
        posting(liquidAccount(value), value),
        posting(savingsAccount(value), negateAmount(value)),
      ]);
    }
    case "interest": {
      const value = parseAsset(data.interest);
      return transaction(operation, sequence, "HBD savings interest", [
        posting(ASSETS_HBD_SAVINGS, value),
        posting(INCOME_INTEREST_HBD, negateAmount(value)),
      ]);
    }
    default:
      return null;
  }
}

/** Book a descending or ascending history page without double-booking overlap. */
export function bookHistory(entries, owner, seen = new Set()) {
  const transactions = [];
  const unmapped = [];
  const ids = new Set(seen);
  let lastSeq = -1;
  for (const entry of entries) {
    const [sequence, operation] = entry;
    if (sequence > lastSeq) lastSeq = sequence;
    const id = postingId(operation);
    if (ids.has(id)) continue;
    const booked = opToTransaction(entry, owner);
    if (booked === null) {
      unmapped.push({ kind: "ledger-computer.unmapped", id, seq: sequence, opType: operation.op[0], timestamp: operation.timestamp });
      continue;
    }
    ids.add(id);
    transactions.push(booked);
  }
  return { transactions, unmapped, lastSeq };
}

/** Fold booked postings to the account/commodity balance carrier. */
export function settle(transactions) {
  const balances = new Map();
  for (const transaction of transactions) {
    for (const entry of transaction.postings) {
      const value = entry.amount;
      if (!value) continue;
      let byCommodity = balances.get(entry.account);
      if (!byCommodity) {
        byCommodity = new Map();
        balances.set(entry.account, byCommodity);
      }
      byCommodity.set(value.commodity, byCommodity.has(value.commodity)
        ? addAmounts(byCommodity.get(value.commodity), value)
        : value);
    }
  }
  for (const [account, byCommodity] of balances) {
    for (const [commodity, value] of byCommodity) {
      if (isZeroAmount(value)) byCommodity.delete(commodity);
    }
    if (byCommodity.size === 0) balances.delete(account);
  }
  return { balances };
}

function bookedOf(balances, account, commodity) {
  return balances.get(account)?.get(commodity) ?? zeroAmount(commodity);
}

function reconcileLine(balances, account, chainValue) {
  const actual = parseAsset(chainValue);
  const booked = bookedOf(balances, account, actual.commodity);
  const delta = subtractAmounts(actual, booked);
  return {
    account,
    commodity: actual.commodity,
    booked: formatAmount(booked, { places: actual.commodity === "VESTS" ? 6 : 3, grouping: false }),
    actual: chainValue,
    delta: exactAmountString(delta),
    reconciled: isZeroAmount(delta),
  };
}

/** Compare booked liquid and optional savings balances to an injected chain observation. */
export function reconcile(balances, chain) {
  const lines = [
    reconcileLine(balances, ASSETS_HIVE_LIQUID, chain.balance),
    reconcileLine(balances, ASSETS_HBD_LIQUID, chain.hbd_balance),
  ];
  if (chain.savings_balance !== undefined) lines.push(reconcileLine(balances, ASSETS_HIVE_SAVINGS, chain.savings_balance));
  if (chain.savings_hbd_balance !== undefined) lines.push(reconcileLine(balances, ASSETS_HBD_SAVINGS, chain.savings_hbd_balance));
  return { kind: "ledger-computer.reconcile", lines, reconciled: lines.every((line) => line.reconciled) };
}
