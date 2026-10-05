import { getSettings } from './settings';
import { getScannerPairs, tokenBySymbol } from './tokens';
import { ENGINE_CONSTANTS, CHAINS, type ChainId, type DexPlatform, ARB_STRATEGIES, type ArbStrategy } from './constants';
import { logEngine } from './logger';
import { supabase, type OpportunityRow } from '@/lib/supabase';

const RELAY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arb-relay`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type SpreadResult = {
  pair: [string, string];
  tokenPath: string[];
  poolPath: string[];
  dexPath: DexPlatform[];
  grossSpreadUsd: number;
  slippageBps: number;
  flashLoanAsset: string;
  hopCount: number;
  strategy: ArbStrategy;
  chainId: ChainId;
  gasEstimate: number;
  inputAmount: string;
  outputAmount: string;
  nativePriceUsd: number;
  // Route quality score — higher is better. Used for prioritization.
  routeScore: number;
};

export type ScannerState = {
  scanning: boolean;
  lastScanAt: number | null;
  opportunitiesFound: number;
  totalScans: number;
  apiErrors: number;
  chainsActive: number;
  scanDurationMs: number;
};

export const scannerState: ScannerState = {
  scanning: false,
  lastScanAt: null,
  opportunitiesFound: 0,
  totalScans: 0,
  apiErrors: 0,
  chainsActive: 0,
  scanDurationMs: 0,
};

type RelayScanResponse = {
  opportunities: Array<{
    pair: [string, string];
    tokenPath: string[];
    poolPath: string[];
    dexPath: DexPlatform[];
    grossSpreadUsd: number;
    slippageBps: number;
    flashLoanAsset: string;
    hopCount: number;
    strategy: ArbStrategy;
    chainId: ChainId;
    gasEstimate: number;
    inputAmount: string;
    outputAmount: string;
  }>;
  nativePriceUsd: number;
  chainId: ChainId;
  scannedAt: string;
};

function estimateGasForHops(hopCount: number): number {
  return ENGINE_CONSTANTS.BASE_GAS_UNITS + hopCount * ENGINE_CONSTANTS.GAS_PER_SWAP_UNITS + ENGINE_CONSTANTS.FLASH_LOAN_GAS_RESERVE;
}

// Route quality score: balances profit vs gas cost vs slippage risk.
// Higher score = better route. Used to prioritize execution order.
function computeRouteScore(spread: {
  grossSpreadUsd: number;
  slippageBps: number;
  hopCount: number;
  gasEstimate: number;
}): number {
  const profitWeight = spread.grossSpreadUsd * 100;
  const slippagePenalty = spread.slippageBps * 0.5;
  const hopPenalty = spread.hopCount * 2;
  const gasPenalty = spread.gasEstimate / 50_000;
  return profitWeight - slippagePenalty - hopPenalty - gasPenalty;
}

// ---------------------------------------------------------------------------
// Route optimizer — deduplicate, sort by profitability, cap concurrency
// ---------------------------------------------------------------------------

export function optimizeRoutes(results: SpreadResult[], maxCount: number): SpreadResult[] {
  // Deduplicate by token path + chain — keep highest-scoring variant
  const seen = new Map<string, SpreadResult>();
  for (const r of results) {
    const key = `${r.chainId}:${r.tokenPath.join('>')}:${r.strategy}`;
    const existing = seen.get(key);
    if (!existing || r.routeScore > existing.routeScore) {
      seen.set(key, r);
    }
  }

  // Sort by route score descending — most profitable first
  const sorted = Array.from(seen.values()).sort((a, b) => b.routeScore - a.routeScore);

  // Cap at maxCount to avoid overloading the executor
  return sorted.slice(0, maxCount);
}

// ---------------------------------------------------------------------------
// Scan a single chain — returns all opportunities found on that chain
// ---------------------------------------------------------------------------

async function scanChain(chainId: ChainId): Promise<SpreadResult[]> {
  const s = getSettings();
  const chainConfig = CHAINS[chainId];
  if (!chainConfig) return [];

  const pairs = getScannerPairs(chainId).map(([symA, symB]) => {
    const tokenA = tokenBySymbol(symA, chainId);
    const tokenB = tokenBySymbol(symB, chainId);
    return {
      symbolA: symA,
      symbolB: symB,
      addressA: tokenA?.address ?? '',
      addressB: tokenB?.address ?? '',
      decimalsA: tokenA?.decimals ?? 18,
      decimalsB: tokenB?.decimals ?? 18,
    };
  });

  if (pairs.length === 0) return [];

  try {
    const chainTimeoutMs = Math.min(60_000, Math.max(10_000, Math.floor(s.scannerIntervalMs / 2)));
    const res = await fetch(`${RELAY_URL}?action=scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        chainId,
        pairs,
        flashLoanAnchorSize: s.flashLoanAnchorSize,
        maxSlippageBps: s.maxSlippageBps,
        minProfitThresholdUsd: s.minProfitThresholdUsd,
        maxHopCount: s.maxHopCount,
        enabledDexes: s.enabledDexes,
        enabledStrategies: s.enabledStrategies,
        circularMinSpreadBps: s.circularMinSpreadBps,
      }),
      signal: AbortSignal.timeout(chainTimeoutMs),
    });

    if (!res.ok) {
      scannerState.apiErrors += 1;
      await logEngine('scanner', 'error', `Relay scan failed on ${chainConfig.name}: HTTP ${res.status}`, { chainId });
      return [];
    }

    const relayData = await res.json() as RelayScanResponse;

    return (relayData.opportunities ?? []).map((o) => {
      const gasEstimate = o.gasEstimate ?? estimateGasForHops(o.hopCount);
      const base = {
        pair: o.pair,
        tokenPath: o.tokenPath,
        poolPath: o.poolPath,
        dexPath: o.dexPath ?? [],
        grossSpreadUsd: o.grossSpreadUsd,
        slippageBps: o.slippageBps,
        flashLoanAsset: o.flashLoanAsset,
        hopCount: o.hopCount,
        strategy: o.strategy ?? ARB_STRATEGIES.TRIANGULAR,
        chainId: o.chainId ?? chainId,
        gasEstimate,
        inputAmount: o.inputAmount,
        outputAmount: o.outputAmount,
        nativePriceUsd: relayData.nativePriceUsd ?? 0,
      };
      return { ...base, routeScore: computeRouteScore(base) };
    });
  } catch (err) {
    scannerState.apiErrors += 1;
    await logEngine('scanner', 'error', `Relay unreachable on ${chainConfig.name}: ${err instanceof Error ? err.message : 'unknown'}`, { chainId });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main scan cycle — PARALLEL across all active chains
// ---------------------------------------------------------------------------

export async function runScanCycle(): Promise<SpreadResult[]> {
  const s = getSettings();
  const scanStart = Date.now();
  scannerState.scanning = true;
  scannerState.totalScans += 1;
  scannerState.chainsActive = s.activeChains.length;

  // Fire all chain scans in parallel — each chain is independent
  const chainResults = await Promise.allSettled(
    s.activeChains.map((chainId) => scanChain(chainId)),
  );

  // Collect results from fulfilled promises
  const allResults: SpreadResult[] = [];
  for (const result of chainResults) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    }
  }

  scannerState.scanning = false;
  scannerState.lastScanAt = Date.now();
  scannerState.scanDurationMs = Date.now() - scanStart;

  // Filter qualifying opportunities
  const qualifying = allResults.filter(
    (r) =>
      r.grossSpreadUsd > s.minProfitThresholdUsd &&
      r.slippageBps <= s.maxSlippageBps &&
      r.hopCount <= s.maxHopCount,
  );

  scannerState.opportunitiesFound = qualifying.length;

  if (qualifying.length > 0) {
    await logEngine(
      'scanner', 'success',
      `Detected ${qualifying.length} qualifying spread${qualifying.length > 1 ? 's' : ''} across ${s.activeChains.length} chain${s.activeChains.length > 1 ? 's' : ''} in ${scannerState.scanDurationMs}ms`,
      {
        opportunities: qualifying.map((q) => ({
          chain: CHAINS[q.chainId]?.shortName,
          pair: q.pair,
          strategy: q.strategy,
          spread: q.grossSpreadUsd.toFixed(4),
          dexes: q.dexPath,
          routeScore: q.routeScore.toFixed(2),
        })),
        scanDurationMs: scannerState.scanDurationMs,
      },
    );
    await persistOpportunities(qualifying);
  } else {
    const best = allResults.reduce<number>((m, r) => Math.max(m, r.grossSpreadUsd), 0);
    await logEngine('scanner', 'info', `Parallel scan complete across ${s.activeChains.length} chain(s) in ${scannerState.scanDurationMs}ms — best spread $${best.toFixed(6)}`, {
      totalResults: allResults.length,
      threshold: s.minProfitThresholdUsd,
      chains: s.activeChains.map((c) => CHAINS[c]?.shortName),
      scanDurationMs: scannerState.scanDurationMs,
    });
  }

  return qualifying;
}

async function persistOpportunities(spreads: SpreadResult[]): Promise<void> {
  const rows: Omit<OpportunityRow, 'id' | 'detected_at'>[] = spreads.map((s) => ({
    token_path: s.tokenPath,
    pool_path: s.poolPath,
    gross_spread_usd: s.grossSpreadUsd,
    slippage_bps: s.slippageBps,
    flash_loan_asset: s.flashLoanAsset,
    hop_count: s.hopCount,
    compute_units_estimate: s.gasEstimate,
    status: 'qualifying',
  }));

  try {
    await supabase.from('arb_opportunities').insert(rows);
  } catch {
    // best-effort
  }
}

export async function fetchRecentOpportunities(limit = 20): Promise<OpportunityRow[]> {
  const { data, error } = await supabase
    .from('arb_opportunities')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as OpportunityRow[];
}

