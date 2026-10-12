#!/usr/bin/env node
import { observeHiveEngineLiquidityOpportunity } from "../src/index.mjs";

const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== "--account" || args[2] !== "--base" || args[4] !== "--quote") {
  console.error("usage: observe-hive-engine-liquidity-opportunity.mjs --account ACCOUNT --base SYMBOL --quote SYMBOL");
  process.exitCode = 2;
} else {
  const opportunity = await observeHiveEngineLiquidityOpportunity({
    account: args[1], baseSymbol: args[3], quoteSymbol: args[5],
  });
  process.stdout.write(`${JSON.stringify(opportunity, null, 2)}\n`);
}
