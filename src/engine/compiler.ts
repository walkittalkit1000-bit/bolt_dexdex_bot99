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

// Safe decimal-aware conversion from USD to Wei
function usdToWei(usd: number, nativePriceUsd: number): bigint {
  if (!Number.isFinite(usd) || !Number.isFinite(nativePriceUsd)) {
    throw new Error('Invalid USD or price value');
  }
  if (usd < 0 || nativePriceUsd <= 0) {
    throw new Error('USD and price must be positive');
  }
  // 1 ETH = 1e18 Wei; multiply by ETH amount
  const ethAmount = usd / nativePriceUsd;
  // Use BigInt for precision: convert to Wei with fixed-point math
  const weiPerEth = BigInt(1e18);
  const wei = BigInt(Math.round(ethAmount * 1e18));
  return wei;
}

function weiToUsd(wei: bigint, nativePriceUsd: number): number {
  if (!Number.isFinite(nativePriceUsd) || nativePriceUsd <= 0) {
    throw new Error('Invalid native price');
  }
  const eth = Number(wei) / 1e18;
  return eth * nativePriceUsd;
}

export function compileBundle(
  spread: SpreadResult,
  opportunityId: string | null,
): CompilationResult {
  try {
    const s = getSettings();
    const nativePriceUsd = spread.nativePriceUsd;

    // Validate price
    if (!Number.isFinite(nativePriceUsd) || nativePriceUsd <= 0) {
      return { ok: false, reason: 'Invalid native token price' };
    }

    const chainConfig = CHAINS[spread.chainId];
    if (!chainConfig) {
      return { ok: false, reason: `Unknown chain ${spread.chainId}` };
    }

    // Validate spread amount
    const grossSpreadUsd = spread.grossSpreadUsd;
    if (!Number.isFinite(grossSpreadUsd) || grossSpreadUsd <= 0) {
      return { ok: false, reason: 'Invalid spread amount' };
    }

    if (grossSpreadUsd < s.minProfitThresholdUsd) {
      return { ok: false, reason: `Spread $${grossSpreadUsd.toFixed(4)} below minimum $${s.minProfitThresholdUsd}` };
    }

    // Convert spread to Wei
    let grossSpreadWei: bigint;
    try {
      grossSpreadWei = usdToWei(grossSpreadUsd, nativePriceUsd);
    } catch (err) {
      return { ok: false, reason: `Cannot convert spread to Wei: ${err instanceof Error ? err.message : 'unknown'}` };
    }

    if (grossSpreadWei <= 0n) {
      return { ok: false, reason: 'Spread wei non-positive after conversion' };
    }

    // Validate token path
    if (!Array.isArray(spread.tokenPath) || spread.tokenPath.length < 2) {
      return { ok: false, reason: 'Invalid token path (minimum 2 tokens required)' };
    }

    if (spread.tokenPath.some((t) => typeof t !== 'string' || t.length === 0)) {
      return { ok: false, reason: 'Token path contains invalid entries' };
    }

    // Validate hop count
    const swapCount = spread.tokenPath.length - 1;
    if (swapCount > s.maxHopCount) {
      return { ok: false, reason: `Swap count ${swapCount} exceeds max ${s.maxHopCount}` };
    }

    // Calculate gas cost with overflow protection
    const baseGas = BigInt(s.baseGasUnits);
    const gasPerSwap = BigInt(s.gasPerSwapUnits);
    const flashLoanGas = BigInt(ENGINE_CONSTANTS.FLASH_LOAN_GAS_RESERVE);
    const totalGasUnits = baseGas + BigInt(swapCount) * gasPerSwap + flashLoanGas;

    const gasPriceGwei = Math.min(s.priorityGasPriceGwei, s.maxGasPriceGwei);
    if (gasPriceGwei <= 0 || !Number.isFinite(gasPriceGwei)) {
      return { ok: false, reason: 'Invalid gas price' };
    }

    const totalGasCostWei = totalGasUnits * BigInt(Math.floor(gasPriceGwei * 1e9));

    // Calculate flash loan fee
    const flashLoanFeeWei = (grossSpreadWei * BigInt(chainConfig.flashLoanFeeBps)) / 10000n;

    // Calculate net profit
    const netProfitWei = grossSpreadWei - totalGasCostWei - flashLoanFeeWei;

    if (netProfitWei <= 0n) {
      return { ok: false, reason: `Net profit non-positive: gross $${grossSpreadUsd.toFixed(4)} - gas/fees = $${weiToUsd(totalGasCostWei + flashLoanFeeWei, nativePriceUsd).toFixed(4)}` };
    }

    const netProfitUsd = weiToUsd(netProfitWei, nativePriceUsd);

    if (netProfitUsd < s.minProfitThresholdUsd) {
      return { ok: false, reason: `Net profit $${netProfitUsd.toFixed(4)} below threshold $${s.minProfitThresholdUsd}` };
    }

    // Verify gas estimate from scanner is reasonable
    if (spread.gasEstimate > Number(totalGasUnits) * 1.5) {
      await logEngine('compiler', 'warn', `Gas estimate ${spread.gasEstimate} is significantly higher than calculated ${Number(totalGasUnits)}`, {
        pair: spread.pair,
      });
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
      gasEstimate: Number(totalGasUnits),
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
  } catch (err) {
    return { ok: false, reason: `Compilation error: ${err instanceof Error ? err.message : 'unknown'}` };
  }
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
  try {
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

    const { data, error } = await supabase
      .from('arb_executions')
      .insert(row)
      .select('id')
      .maybeSingle();

    if (error || !data?.id) {
      await logEngine('compiler', 'error', `Failed to persist execution: ${error?.message ?? 'no data returned'}`, {
        signature: bundle.bundleSignature.slice(0, 16),
      });
      return null;
    }

    return data.id;
  } catch (err) {
    await logEngine('compiler', 'error', `Execution persistence error: ${err instanceof Error ? err.message : 'unknown'}`);
    return null;
  }
}

export async function fetchRecentExecutions(limit = 20): Promise<ExecutionRow[]> {
  try {
    const { data, error } = await supabase
      .from('arb_executions')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) {
      await logEngine('compiler', 'warn', `Failed to fetch executions: ${error.message}`);
      return [];
    }

    return (data ?? []) as ExecutionRow[];
  } catch (err) {
    return [];
  }
}
