import type { NormalizedEarningOpportunity } from "@red-cup-engineering/normalize-earning-opportunity-service";

export const HIVE_ENGINE_CONTRACTS_ENDPOINT: string;
export const HIVE_ENGINE_BLOCKCHAIN_ENDPOINT: string;
export function observeHiveEngineLiquidityOpportunity(
  input: Readonly<{ account: string; baseSymbol: string; quoteSymbol: string }>,
  injected?: Readonly<{ fetchImpl?: typeof fetch; timeoutMs?: number; now?: () => Date; contractsEndpoint?: string; blockchainEndpoint?: string }>,
): Promise<NormalizedEarningOpportunity>;
