import { getSettings } from './settings';
import { CHAINS } from './constants';
import type { CompiledBundle } from './compiler';
import { logEngine } from './logger';
import { supabase, type ExecutionRow } from '@/lib/supabase';

const RELAY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arb-relay`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type DispatchResult =
  | { ok: true; executionId: string; bundleSignature: string; txHash: string | null }
  | { ok: false; reason: string };

export type DispatcherState = {
  dispatching: boolean;
  bundlesSent: number;
  bundlesLanded: number;
  bundlesReverted: number;
  lastDispatchAt: number | null;
};

export const dispatcherState: DispatcherState = {
  dispatching: false,
  bundlesSent: 0,
  bundlesLanded: 0,
  bundlesReverted: 0,
  lastDispatchAt: null,
};

type ExecuteRelayResponse = {
  status: 'submitted' | 'failed' | 'reverted';
  bundleSignature: string;
  executionId: string | null;
  txHash: string | null;
  netProfitUsd: number;
  netProfitWei: string;
  paymasterUsed: boolean;
  error: string | null;
  reason?: string;
};

type SettleRelayResponse = {
  status: 'settled' | 'reverted';
  bundleSignature: string;
  txHash: string | null;
  blockNumber: number | null;
  settlementAddress: string;
};

export async function dispatchBundle(
  bundle: CompiledBundle,
  executionId: string,
): Promise<DispatchResult> {
  const s = getSettings();
  dispatcherState.dispatching = true;
  dispatcherState.lastDispatchAt = Date.now();
  const chainName = CHAINS[bundle.chainId]?.name ?? 'unknown';

  await logEngine('dispatcher', 'info', `Dispatching ${bundle.strategy} bundle to ${chainName} via relay${bundle.paymasterSponsored ? ' (CDP paymaster-sponsored gas)' : ''}`, {
    signature: bundle.bundleSignature.slice(0, 16),
    chainId: bundle.chainId,
    strategy: bundle.strategy,
    dexPath: bundle.dexPath,
    gasEstimate: bundle.gasEstimate,
    gasPriceGwei: bundle.gasPriceGwei,
    tokenPath: bundle.tokenPath.join('→'),
  });

  try {
    const res = await fetch(`${RELAY_URL}?action=execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        chainId: bundle.chainId,
        tokenPath: bundle.tokenPath,
        poolPath: bundle.poolPath,
        dexPath: bundle.dexPath,
        strategy: bundle.strategy,
        grossSpreadUsd: bundle.grossSpreadUsd,
        flashLoanAsset: bundle.flashLoanAsset,
        flashLoanAnchorSize: bundle.flashLoanAmount,
        flashLoanProvider: bundle.flashLoanProvider,
        gasEstimate: bundle.gasEstimate,
        gasPriceGwei: bundle.gasPriceGwei,
        paymasterSponsored: bundle.paymasterSponsored,
        cdpPaymaster: s.cdpPaymaster,
        walletMode: s.walletMode,
        manualWalletAddress: s.manualWalletAddress,
        opportunityId: executionId,
        bundleSignature: bundle.bundleSignature,
        netProfitWei: bundle.netProfitWei.toString(),
        settlementWindow: bundle.settlementWindow,
        executorAddress: bundle.settlementAddress,
      }),
      signal: AbortSignal.timeout(30000),
    });

    dispatcherState.dispatching = false;

    if (!res.ok) {
      const errText = await res.text().catch(() => 'HTTP error');
      dispatcherState.bundlesReverted += 1;
      await logEngine('dispatcher', 'error', `Relay execute failed on ${chainName}: ${errText}`, {
        signature: bundle.bundleSignature.slice(0, 16),
      });
      await updateExecutionStatus(executionId, 'failed');
      return { ok: false, reason: `Relay error: ${errText}` };
    }

    const data = await res.json() as ExecuteRelayResponse;

    if (data.status === 'reverted') {
      dispatcherState.bundlesReverted += 1;
      await updateExecutionStatus(executionId, 'reverted');
      await logEngine('dispatcher', 'warn', `Bundle reverted on ${chainName}: ${data.reason ?? 'spread evaporated'}`, {
        signature: bundle.bundleSignature.slice(0, 16),
      });
      return { ok: false, reason: data.reason ?? 'reverted' };
    }

    if (data.status === 'failed') {
      dispatcherState.bundlesReverted += 1;
      await updateExecutionStatus(executionId, 'failed');
      await logEngine('dispatcher', 'error', `Bundle failed on ${chainName}: ${data.error ?? 'unknown'}`, {
        signature: bundle.bundleSignature.slice(0, 16),
      });
      return { ok: false, reason: data.error ?? 'failed' };
    }

    dispatcherState.bundlesSent += 1;
    await updateExecutionStatus(executionId, 'submitted');

    if (data.executionId && data.executionId !== executionId) {
      executionId = data.executionId;
    }

    await logEngine('dispatcher', 'success', `Bundle submitted to ${chainName}${data.paymasterUsed ? ' — gas sponsored by CDP paymaster' : ''}`, {
      signature: bundle.bundleSignature.slice(0, 16),
      txHash: data.txHash?.slice(0, 18),
      netProfitUsd: data.netProfitUsd,
    });

    return {
      ok: true,
      executionId,
      bundleSignature: bundle.bundleSignature,
      txHash: data.txHash,
    };
  } catch (err) {
    dispatcherState.dispatching = false;
    dispatcherState.bundlesReverted += 1;
    await updateExecutionStatus(executionId, 'failed');
    await logEngine('dispatcher', 'error', `Dispatch error on ${chainName}: ${err instanceof Error ? err.message : 'unknown'}`, {
      signature: bundle.bundleSignature.slice(0, 16),
    });
    return { ok: false, reason: 'Network error during dispatch' };
  }
}

export async function settleExecution(
  executionId: string,
  bundle: CompiledBundle,
  txHash: string | null,
): Promise<boolean> {
  const s = getSettings();
  const chainName = CHAINS[bundle.chainId]?.name ?? 'unknown';

  await logEngine('relay', 'info', `Monitoring settlement for bundle ${bundle.bundleSignature.slice(0, 16)} on ${chainName}`, {
    windowMs: bundle.settlementWindow,
    txHash: txHash?.slice(0, 18),
  });

  try {
    const res = await fetch(`${RELAY_URL}?action=settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        chainId: bundle.chainId,
        bundleSignature: bundle.bundleSignature,
        executionId,
        txHash,
      }),
      signal: AbortSignal.timeout(s.settlementTimeoutMs + 5000),
    });

    if (!res.ok) {
      dispatcherState.bundlesReverted += 1;
      await updateExecutionStatus(executionId, 'reverted');
      await logEngine('relay', 'warn', `Settlement check failed on ${chainName} — marking as reverted`, { executionId });
      return false;
    }

    const data = await res.json() as SettleRelayResponse;

    if (data.status === 'settled') {
      dispatcherState.bundlesLanded += 1;
      await updateExecutionStatus(executionId, 'settled', new Date().toISOString());
      await logEngine('relay', 'success', `Settlement confirmed on ${chainName} — net profit $${bundle.netProfitUsd.toFixed(4)}`, {
        executionId,
        txHash: data.txHash?.slice(0, 18),
        blockNumber: data.blockNumber,
      });
      return true;
    }

    dispatcherState.bundlesReverted += 1;
    await updateExecutionStatus(executionId, 'reverted');
    await logEngine('relay', 'warn', `Bundle reverted atomically on ${chainName} — zero loss, paymaster absorbed gas cost`, { executionId });
    return false;
  } catch (err) {
    dispatcherState.bundlesReverted += 1;
    await updateExecutionStatus(executionId, 'reverted');
    await logEngine('relay', 'error', `Settlement error on ${chainName}: ${err instanceof Error ? err.message : 'unknown'}`, { executionId });
    return false;
  }
}

export async function updateExecutionStatus(
  executionId: string,
  status: ExecutionRow['status'],
  settledAt: string | null = null,
): Promise<void> {
  try {
    const update: Partial<ExecutionRow> = { status };
    if (settledAt || status === 'settled') {
      update.settled_at = settledAt ?? new Date().toISOString();
    }
    await supabase.from('arb_executions').update(update).eq('id', executionId);
  } catch {
    // best-effort
  }
}
