import { ENGINE_CONSTANTS, CHAINS, type ChainId, type DexPlatform, type ArbStrategy } from './constants';
import { getSettings } from './settings';
import type { SpreadResult } from './scanner';
import { logEngine } from './logger';
import { supabase, type ExecutionRow } from '@/lib/supabase';

export type CompiledBundle = {
  opportunityId: string | null;
  bundleSignature: string;
  chainId: ChainId;
  flashLoanAsset: string;
  flashLoanAmount: number;
  flashLoanProvider: string;
  flashLoanFeeBps: number;
  grossSpreadWei: bigint;
  gasEstimate: number;
  gasPriceGwei: number;
  totalGasCostWei: bigint;
  netProfitWei: bigint;
  netProfitUsd: number;
  paymasterSponsored: boolean;
  tokenPath: string[];
  poolPath: string[];
  dexPath: DexPlatform[];
  strategy: ArbStrategy;
  grossSpreadUsd: number;
  nativePriceUsd: number;
  settlementAddress: string;
  settlementWindow: number;
};

export type CompilationResult =
  | { ok: true; bundle: CompiledBundle }
  | { ok: false; reason: string };

function generateBundleSignature(): string {
  return crypto.randomUUID();
}

function weiToUsd(wei: bigint, nativePriceUsd: number): number {
  const native = Number(wei) / Number(ENGINE_CONSTANTS.WEI_PER_ETH);
  return native * nativePriceUsd;
}

export function compileBundle(
  spread: SpreadResult,
  opportunityId: string | null,
): CompilationResult {
  const s = getSettings();
  const nativePriceUsd = spread.nativePriceUsd;
  if (!Number.isFinite(nativePriceUsd) || nativePriceUsd <= 0) {
    return { ok: false, reason: 'Missing valid native token price' };
  }

  const chainConfig = CHAINS[spread.chainId];
  if (!chainConfig) {
    return { ok: false, reason: `Unknown chain ${spread.chainId}` };
  }

  const grossSpreadUsd = spread.grossSpreadUsd;
  const grossSpreadWei = BigInt(Math.floor((grossSpreadUsd / nativePriceUsd) * Number(ENGINE_CONSTANTS.WEI_PER_ETH)));

  const swapCount = spread.tokenPath.length - 1;
  const gasEstimate = s.baseGasUnits + swapCount * s.gasPerSwapUnits + ENGINE_CONSTANTS.FLASH_LOAN_GAS_RESERVE;
  const gasPriceGwei = s.priorityGasPriceGwei;
  const totalGasCostWei = BigInt(gasEstimate) * BigInt(gasPriceGwei) * ENGINE_CONSTANTS.WEI_PER_GWEI;

  const flashLoanFeeWei = BigInt(Math.floor(Number(grossSpreadWei) * chainConfig.flashLoanFeeBps / 10000));

  const netProfitWei = grossSpreadWei - totalGasCostWei - flashLoanFeeWei;

  if (netProfitWei <= 0n) {
    return { ok: false, reason: 'Net profit non-positive after gas and flash loan fees' };
  }

  const netProfitUsd = weiToUsd(netProfitWei, nativePriceUsd);

  if (netProfitUsd < s.minProfitThresholdUsd) {
    return { ok: false, reason: `Net ${netProfitUsd.toFixed(4)} below ${s.minProfitThresholdUsd} threshold` };
  }

  if (spread.hopCount > s.maxHopCount) {
    return { ok: false, reason: `Hop count ${spread.hopCount} exceeds max ${s.maxHopCount}` };
  }

  const signature = generateBundleSignature();
  const paymasterSponsored = s.cdpPaymaster.enabled && s.cdpPaymaster.sponsorshipRatio > 0;

  const bundle: CompiledBundle = {
    opportunityId,
    bundleSignature: signature,
    chainId: spread.chainId,
    flashLoanAsset: spread.flashLoanAsset,
    flashLoanAmount: s.flashLoanAnchorSize,
    flashLoanProvider: chainConfig.flashLoanProvider,
    flashLoanFeeBps: chainConfig.flashLoanFeeBps,
    grossSpreadWei,
    gasEstimate,
    gasPriceGwei,
    totalGasCostWei,
    netProfitWei,
    netProfitUsd,
    paymasterSponsored,
    tokenPath: spread.tokenPath,
    poolPath: spread.poolPath,
    dexPath: spread.dexPath,
    strategy: spread.strategy,
    grossSpreadUsd: spread.grossSpreadUsd,
    nativePriceUsd,
    settlementAddress: s.executorAddress,
    settlementWindow: s.settlementTimeoutMs,
  };

  return { ok: true, bundle };
}

export async function compileAndPersist(
  spread: SpreadResult,
  opportunityId: string | null,
): Promise<CompiledBundle | null> {
  const result = compileBundle(spread, opportunityId);
  if (!result.ok) {
    await logEngine('compiler', 'warn', `Bundle rejected: ${result.reason}`, {
      pair: spread.pair,
      grossSpreadUsd: spread.grossSpreadUsd,
      chain: CHAINS[spread.chainId]?.shortName,
    });
    return null;
  }

  const bundle = result.bundle;
  await logEngine('compiler', 'success', `Bundle compiled for ${spread.pair.join('→')} on ${CHAINS[bundle.chainId]?.name}`, {
    signature: bundle.bundleSignature.slice(0, 16),
    netProfitUsd: bundle.netProfitUsd,
    strategy: bundle.strategy,
    dexPath: bundle.dexPath,
    gasEstimate: bundle.gasEstimate,
    gasPriceGwei: bundle.gasPriceGwei,
    paymasterSponsored: bundle.paymasterSponsored,
    flashLoanProvider: bundle.flashLoanProvider,
  });

  return bundle;
}

export async function persistExecution(
  bundle: CompiledBundle,
  status: ExecutionRow['status'] = 'pending',
): Promise<string | null> {
  const row: Omit<ExecutionRow, 'id' | 'executed_at'> = {
    opportunity_id: bundle.opportunityId,
    bundle_signature: bundle.bundleSignature,
    flash_loan_provider: bundle.flashLoanProvider,
    flash_loan_asset: bundle.flashLoanAsset,
    flash_loan_amount: bundle.flashLoanAmount,
    gross_spread_lamports: Number(bundle.grossSpreadWei),
    jito_tip_lamports: 0,
    gas_lamports: Number(bundle.totalGasCostWei),
    net_profit_lamports: Number(bundle.netProfitWei),
    net_profit_usd: bundle.netProfitUsd,
    jito_region: CHAINS[bundle.chainId]?.shortName ?? 'unknown',
    index_position: 0,
    status,
    settled_at: null,
    tx_signature: null,
    onchain_status: 'not_submitted',
    settlement_address: bundle.settlementAddress || null,
    jito_bundle_uuid: null,
  };

  try {
    const { data, error } = await supabase
      .from('arb_executions')
      .insert(row)
      .select('id')
      .maybeSingle();
    if (error || !data) return null;
    return data.id;
  } catch {
    return null;
  }
}

export async function fetchRecentExecutions(limit = 20): Promise<ExecutionRow[]> {
  const { data, error } = await supabase
    .from('arb_executions')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as ExecutionRow[];
}
