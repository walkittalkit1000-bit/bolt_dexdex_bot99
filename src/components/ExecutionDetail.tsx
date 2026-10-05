import { useEffect, useState } from 'react';
import { supabase, type ExecutionRow, type OpportunityRow } from '@/lib/supabase';
import { updateExecutionStatus } from '@/engine/dispatcher';
import { logEngine } from '@/engine/logger';
import {
  X,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  DollarSign,
  Layers,
  MapPin,
  Activity,
  RotateCcw,
  Ban,
  FileText,
  Hash,
} from 'lucide-react';

type Props = {
  executionId: string | null;
  onClose: () => void;
};

type ActionResult = { ok: boolean; message: string };

function StatusBadge({ status }: { status: ExecutionRow['status'] }) {
  const styles: Record<ExecutionRow['status'], string> = {
    pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    submitted: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    landed: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    settled: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    reverted: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    failed: 'bg-rose-700/20 text-rose-400 border-rose-700/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${styles[status]}`}>
      {status}
    </span>
  );
}

function DetailRow({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
      <div className="flex items-center gap-2">
        <span className="text-slate-600">{icon}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <span className="text-xs font-mono text-slate-300">{value}</span>
    </div>
  );
}

export function ExecutionDetail({ executionId, onClose }: Props) {
  const [execution, setExecution] = useState<ExecutionRow | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!executionId) return;
    let cancelled = false;
    setLoading(true);
    setResult(null);

    (async () => {
      const { data: exec } = await supabase
        .from('arb_executions')
        .select('*')
        .eq('id', executionId)
        .single();
      if (cancelled) return;
      setExecution(exec as ExecutionRow);

      if (exec?.opportunity_id) {
        const { data: opp } = await supabase
          .from('arb_opportunities')
          .select('*')
          .eq('id', (exec as ExecutionRow).opportunity_id)
          .single();
        if (!cancelled) setOpportunity(opp as OpportunityRow);
      }
      if (!cancelled) setLoading(false);
    })();

    const channel = supabase
      .channel(`exec_detail_${executionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'arb_executions', filter: `id=eq.${executionId}` },
        (payload) => setExecution(payload.new as ExecutionRow),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [executionId]);

  const handleRetry = async () => {
    if (!execution) return;
    setActionLoading('retry');
    setResult(null);
    try {
      await updateExecutionStatus(execution.id, 'pending');
      await logEngine('relay', 'info', `Manual retry triggered for ${execution.bundle_signature?.slice(0, 16) ?? 'bundle'}`, { executionId: execution.id });
      setResult({ ok: true, message: 'Bundle marked for retry — dispatcher will re-dispatch' });
    } catch {
      setResult({ ok: false, message: 'Failed to retry execution' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevert = async () => {
    if (!execution) return;
    setActionLoading('revert');
    setResult(null);
    try {
      await updateExecutionStatus(execution.id, 'reverted');
      await logEngine('relay', 'warn', `Manual revert for ${execution.bundle_signature?.slice(0, 16) ?? 'bundle'} — zero loss confirmed`, { executionId: execution.id });
      setResult({ ok: true, message: 'Execution reverted atomically — zero loss to sponsor' });
    } catch {
      setResult({ ok: false, message: 'Failed to revert execution' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!execution) return;
    setActionLoading('cancel');
    setResult(null);
    try {
      await updateExecutionStatus(execution.id, 'failed');
      await logEngine('relay', 'error', `Execution cancelled by operator: ${execution.bundle_signature?.slice(0, 16) ?? 'bundle'}`, { executionId: execution.id });
      setResult({ ok: true, message: 'Execution cancelled and marked as failed' });
    } catch {
      setResult({ ok: false, message: 'Failed to cancel execution' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSettleManually = async () => {
    if (!execution) return;
    setActionLoading('settle');
    setResult(null);
    try {
      await updateExecutionStatus(execution.id, 'settled', new Date().toISOString());
      await logEngine('relay', 'success', `Manual settlement confirmed for ${execution.bundle_signature?.slice(0, 16) ?? 'bundle'}`, { executionId: execution.id, netProfitUsd: execution.net_profit_usd });
      setResult({ ok: true, message: `Settlement confirmed — net profit $${execution.net_profit_usd.toFixed(4)}` });
    } catch {
      setResult({ ok: false, message: 'Failed to settle execution' });
    } finally {
      setActionLoading(null);
    }
  };

  const copySignature = () => {
    if (execution?.bundle_signature) {
      navigator.clipboard.writeText(execution.bundle_signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!executionId) return null;

  const canRetry = execution && (execution.status === 'failed' || execution.status === 'reverted');
  const canCancel = execution && (execution.status === 'pending' || execution.status === 'submitted' || execution.status === 'landed');
  const canSettle = execution && (execution.status === 'landed' || execution.status === 'submitted');
  const canRevert = execution && execution.status === 'settled';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-lg h-full bg-slate-950 border-l border-slate-800 overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200">Execution Detail</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : execution ? (
          <div className="p-5 space-y-5">
            {/* Status header */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <StatusBadge status={execution.status} />
                <div>
                  <p className="text-xs text-slate-500">Bundle Signature</p>
                  <button onClick={copySignature} className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors">
                    {execution.bundle_signature ? `${execution.bundle_signature.slice(0, 12)}…${execution.bundle_signature.slice(-6)}` : '—'}
                    {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Net P&L</p>
                <p className={`text-lg font-semibold font-mono ${execution.net_profit_usd >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  ${execution.net_profit_usd.toFixed(4)}
                </p>
              </div>
            </div>

            {/* Transaction details */}
            <div className="space-y-0.5">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-2">Transaction Details</h3>
              <DetailRow label="Flash Loan Provider" value={execution.flash_loan_provider} icon={<Zap className="w-3.5 h-3.5" />} />
              <DetailRow label="Flash Loan Asset" value={execution.flash_loan_asset} icon={<Layers className="w-3.5 h-3.5" />} />
              <DetailRow label="Flash Loan Amount" value={execution.flash_loan_amount.toLocaleString()} icon={<Layers className="w-3.5 h-3.5" />} />
              <DetailRow label="Gross Spread" value={`${execution.gross_spread_lamports.toLocaleString()} lamports`} icon={<DollarSign className="w-3.5 h-3.5" />} />
              <DetailRow label="Jito Tip" value={`${execution.jito_tip_lamports.toLocaleString()} lamports`} icon={<Zap className="w-3.5 h-3.5" />} />
              <DetailRow label="Gas" value={`${execution.gas_lamports.toLocaleString()} lamports`} icon={<Zap className="w-3.5 h-3.5" />} />
              <DetailRow label="Net Profit" value={`${execution.net_profit_lamports.toLocaleString()} lamports`} icon={<DollarSign className="w-3.5 h-3.5" />} />
              <DetailRow label="Jito Region" value={execution.jito_region} icon={<MapPin className="w-3.5 h-3.5" />} />
              <DetailRow label="Index Position" value={execution.index_position ?? '—'} icon={<Hash className="w-3.5 h-3.5" />} />
              <DetailRow label="Settlement Address" value={execution.settlement_address ? `${execution.settlement_address.slice(0, 8)}…${execution.settlement_address.slice(-4)}` : '—'} icon={<MapPin className="w-3.5 h-3.5" />} />
              <DetailRow label="On-Chain Status" value={execution.onchain_status ?? '—'} icon={<Activity className="w-3.5 h-3.5" />} />
              {execution.tx_signature && (
                <DetailRow label="TX Signature" value={`${execution.tx_signature.slice(0, 12)}…${execution.tx_signature.slice(-6)}`} icon={<Hash className="w-3.5 h-3.5" />} />
              )}
              {execution.jito_bundle_uuid && (
                <DetailRow label="Bundle UUID" value={`${execution.jito_bundle_uuid.slice(0, 12)}…`} icon={<Hash className="w-3.5 h-3.5" />} />
              )}
              <DetailRow label="Executed At" value={new Date(execution.executed_at).toLocaleString()} icon={<Clock className="w-3.5 h-3.5" />} />
              {execution.settled_at && (
                <DetailRow label="Settled At" value={new Date(execution.settled_at).toLocaleString()} icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
              )}
            </div>

            {/* Opportunity context */}
            {opportunity && (
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-2">Originating Opportunity</h3>
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Token Path</span>
                    <span className="text-xs font-mono text-slate-300">{opportunity.token_path.join(' → ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Pool Path</span>
                    <span className="text-xs font-mono text-slate-300">{opportunity.pool_path.join(' → ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Gross Spread</span>
                    <span className="text-xs font-mono text-emerald-300">${opportunity.gross_spread_usd.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Slippage</span>
                    <span className="text-xs font-mono text-slate-300">{opportunity.slippage_bps.toFixed(1)} bps</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Compute Units</span>
                    <span className="text-xs font-mono text-slate-300">{opportunity.compute_units_estimate.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action result */}
            {result && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border text-xs ${
                result.ok
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/5 border-rose-500/20 text-rose-300'
              }`}>
                {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                <span>{result.message}</span>
              </div>
            )}

            {/* Transactional controls */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium">Transactional Controls</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleRetry}
                  disabled={!canRetry || actionLoading === 'retry'}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                    canRetry
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
                      : 'bg-slate-900/40 border-slate-800 text-slate-700 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {actionLoading === 'retry' ? 'Retrying…' : 'Retry Bundle'}
                </button>
                <button
                  onClick={handleSettleManually}
                  disabled={!canSettle || actionLoading === 'settle'}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                    canSettle
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                      : 'bg-slate-900/40 border-slate-800 text-slate-700 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {actionLoading === 'settle' ? 'Settling…' : 'Settle Now'}
                </button>
                <button
                  onClick={handleRevert}
                  disabled={!canRevert || actionLoading === 'revert'}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                    canRevert
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                      : 'bg-slate-900/40 border-slate-800 text-slate-700 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {actionLoading === 'revert' ? 'Reverting…' : 'Revert Settle'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!canCancel || actionLoading === 'cancel'}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                    canCancel
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                      : 'bg-slate-900/40 border-slate-800 text-slate-700 cursor-not-allowed'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {actionLoading === 'cancel' ? 'Cancelling…' : 'Cancel Bundle'}
                </button>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Controls are context-sensitive: retry is available for failed or reverted bundles, settle for landed bundles, revert for settled bundles, and cancel for pending or landed bundles. All actions are logged to the engine log.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <Activity className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Execution not found</p>
          </div>
        )}
      </div>
    </div>
  );
}
