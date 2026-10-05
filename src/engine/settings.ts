import { CHAINS } from './constants';
import { getSettings } from './settings';
import { runScanCycle, optimizeRoutes, scannerState } from './scanner';
import { compileAndPersist, persistExecution } from './compiler';
import { dispatchBundle, settleExecution, dispatcherState } from './dispatcher';
import { assessSpreadRisk, assessBundleRisk, logRiskDecision } from './risk';
import { logEngine } from './logger';

export type EngineStatus = 'idle' | 'running' | 'paused' | 'error';

export type EngineMetrics = {
  status: EngineStatus;
  totalScans: number;
  opportunitiesFound: number;
  bundlesCompiled: number;
  bundlesDispatched: number;
  bundlesLanded: number;
  bundlesReverted: number;
  totalNetProfitUsd: number;
  lastScanAt: number | null;
  lastDispatchAt: number | null;
  cycleCount: number;
  scanDurationMs: number;
  parallelExecutions: number;
};

export type MetricsListener = (metrics: EngineMetrics) => void;

const metrics: EngineMetrics = {
  status: 'idle',
  totalScans: 0,
  opportunitiesFound: 0,
  bundlesCompiled: 0,
  bundlesDispatched: 0,
  bundlesLanded: 0,
  bundlesReverted: 0,
  totalNetProfitUsd: 0,
  lastScanAt: null,
  lastDispatchAt: null,
  cycleCount: 0,
  scanDurationMs: 0,
  parallelExecutions: 0,
};

let listeners: MetricsListener[] = [];
let cycleTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let metricsEmitTimer: ReturnType<typeof setTimeout> | null = null;

export function subscribeToMetrics(callback: MetricsListener): () => void {
  if (listeners.includes(callback)) {
    return () => {
      listeners = listeners.filter((listener) => listener !== callback);
    };
  }

  listeners.push(callback);
  callback({ ...metrics });
  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
  };
}

function emitMetrics(): void {
  if (metricsEmitTimer) {
    clearTimeout(metricsEmitTimer);
  }

  metricsEmitTimer = setTimeout(() => {
    const snapshot = { ...metrics };
    listeners.forEach((listener) => listener(snapshot));
    metricsEmitTimer = null;
  }, 0);
}

function updateMetrics(partial: Partial<EngineMetrics>): void {
  Object.assign(metrics, partial);
  emitMetrics();
}

export async function startEngine(): Promise<void> {
  if (running) return;
  running = true;
  updateMetrics({ status: 'running' });
  const s = getSettings();
  const chainNames = s.activeChains.map((c) => CHAINS[c]?.name).join(', ');
  await logEngine('system', 'info', `Engine started — parallel multi-chain mode on ${chainNames}`, {
    activeChains: s.activeChains,
    flashLoanAnchor: s.flashLoanAnchorSize,
    minProfitThreshold: s.minProfitThresholdUsd,
    maxGasPriceGwei: s.maxGasPriceGwei,
    scannerIntervalMs: s.scannerIntervalMs,
    maxHopCount: s.maxHopCount,
    enabledDexes: s.enabledDexes,
    enabledStrategies: s.enabledStrategies,
    paymasterEnabled: s.cdpPaymaster.enabled,
    walletMode: s.walletMode,
    maxConcurrentBundles: s.maxConcurrentBundles,
    autoExecute: s.autoExecute,
    mode: s.autoExecute ? 'LIVE EXECUTION' : 'DRY RUN (scan only)',
    capitalConstraint: 'zero user-side capital — paymaster sponsors gas, flash loan funds arbitrage',
    flashLoanProviders: s.activeChains.map((c) => ({ chain: CHAINS[c]?.shortName, provider: CHAINS[c]?.flashLoanProvider, fee: CHAINS[c]?.flashLoanFeeBps })),
  });
  scheduleCycle();
}

export async function stopEngine(): Promise<void> {
  running = false;
  if (cycleTimer) {
    clearTimeout(cycleTimer);
    cycleTimer = null;
  }
  updateMetrics({ status: 'paused' });
  await logEngine('system', 'info', 'Engine paused');
}

export function isRunning(): boolean {
  return running;
}

function scheduleCycle(): void {
  if (!running) return;
  const interval = getSettings().scannerIntervalMs;
  cycleTimer = setTimeout(() => {
    runEngineCycle().finally(() => scheduleCycle());
  }, interval);
}

// ---------------------------------------------------------------------------
// Concurrency-limited parallel runner — processes up to N items at once
// ---------------------------------------------------------------------------

async function parallelMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runEngineCycle(): Promise<void> {
  try {
    metrics.cycleCount += 1;
    updateMetrics({ totalScans: scannerState.totalScans });

    // Phase 1: Parallel scan across all active chains
    const spreads = await runScanCycle();
    updateMetrics({
      opportunitiesFound: scannerState.opportunitiesFound,
      lastScanAt: scannerState.lastScanAt ?? null,
      scanDurationMs: scannerState.scanDurationMs,
    });

    if (spreads.length === 0) {
      updateMetrics({
        bundlesLanded: dispatcherState.bundlesLanded,
        bundlesReverted: dispatcherState.bundlesReverted,
        lastDispatchAt: dispatcherState.lastDispatchAt,
        parallelExecutions: 0,
      });
      return;
    }

    // Phase 2: Route optimization — deduplicate, sort by profitability, cap
    const s = getSettings();
    const optimizedRoutes = optimizeRoutes(spreads, s.maxConcurrentBundles * 3);

    if (optimizedRoutes.length < spreads.length) {
      await logEngine('scanner', 'info', `Route optimizer: ${spreads.length} raw → ${optimizedRoutes.length} optimized (deduped + sorted)`, {
        raw: spreads.length,
        optimized: optimizedRoutes.length,
        topScore: optimizedRoutes[0]?.routeScore.toFixed(2),
      });
    }

    // Phase 3: Parallel processing with concurrency control
    // Risk assessment + compilation happen in parallel up to maxConcurrentBundles
    const concurrency = Math.min(s.maxConcurrentBundles, optimizedRoutes.length);
    let activeExecutions = 0;

    await parallelMap(optimizedRoutes, concurrency, async (spread) => {
      const spreadRisk = assessSpreadRisk(spread);
      await logRiskDecision('scanner', spreadRisk, {
        pair: spread.pair,
        grossSpreadUsd: spread.grossSpreadUsd,
        strategy: spread.strategy,
        chain: CHAINS[spread.chainId]?.shortName,
      });
      if (!spreadRisk.approved) return undefined;

      const bundle = await compileAndPersist(spread, null);
      if (!bundle) return undefined;
      metrics.bundlesCompiled += 1;
      updateMetrics({ bundlesCompiled: metrics.bundlesCompiled });

      const bundleRisk = assessBundleRisk(bundle);
      await logRiskDecision('compiler', bundleRisk, { signature: bundle.bundleSignature.slice(0, 16) });
      if (!bundleRisk.approved) return undefined;

      // Dry run mode — log the opportunity but don't execute
      if (!getSettings().autoExecute) {
        await logEngine('dispatcher', 'info',
          `[DRY RUN] Would execute ${bundle.strategy} on ${CHAINS[bundle.chainId]?.name}: ${bundle.tokenPath.join('→')} — est. net $${bundle.netProfitUsd.toFixed(4)} via ${bundle.dexPath.join('→')}`,
          {
            signature: bundle.bundleSignature.slice(0, 16),
            chainId: bundle.chainId,
            netProfitUsd: bundle.netProfitUsd,
            gasEstimate: bundle.gasEstimate,
            flashLoanProvider: bundle.flashLoanProvider,
            dexPath: bundle.dexPath,
          },
        );
        return undefined;
      }

      activeExecutions += 1;
      updateMetrics({ parallelExecutions: activeExecutions });

      const executionId = await persistExecution(bundle, 'pending');
      if (!executionId) {
        await logEngine('dispatcher', 'error', 'Failed to persist execution record');
        activeExecutions -= 1;
        updateMetrics({ parallelExecutions: activeExecutions });
        return undefined;
      }

      const dispatchResult = await dispatchBundle(bundle, executionId);
      if (!dispatchResult.ok) {
        activeExecutions -= 1;
        updateMetrics({ parallelExecutions: activeExecutions });
        return undefined;
      }

      metrics.bundlesDispatched += 1;
      updateMetrics({ bundlesDispatched: metrics.bundlesDispatched });

      // Settlement monitoring — each runs independently
      const settled = await settleExecution(dispatchResult.executionId, bundle, dispatchResult.txHash);
      if (settled) {
        metrics.bundlesLanded += 1;
        metrics.totalNetProfitUsd += bundle.netProfitUsd;
        updateMetrics({
          bundlesLanded: metrics.bundlesLanded,
          totalNetProfitUsd: metrics.totalNetProfitUsd,
        });
      } else {
        metrics.bundlesReverted += 1;
        updateMetrics({ bundlesReverted: metrics.bundlesReverted });
      }

      activeExecutions -= 1;
      updateMetrics({ parallelExecutions: activeExecutions });
      return bundle.bundleSignature;
    });

    updateMetrics({
      bundlesLanded: dispatcherState.bundlesLanded,
      bundlesReverted: dispatcherState.bundlesReverted,
      lastDispatchAt: dispatcherState.lastDispatchAt,
      parallelExecutions: 0,
    });
  } catch (err) {
    await logEngine('system', 'error', `Engine cycle error: ${err instanceof Error ? err.message : String(err)}`);
    updateMetrics({ status: 'error' });
  }
}

