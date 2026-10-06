import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Eye, Activity, CheckCircle2, XCircle, Clock, TrendingUp, Database, ScanLine } from 'lucide-react';

type ScanAuditRow = {
  id: string;
  scanned_at: string;
  chain_id: number;
  pairs_scanned: number;
  opportunities_found: number;
  qualifying_count: number;
  best_spread_usd: number;
  scan_duration_ms: number;
  native_price_usd: number;
  strategies_used: string[];
  dexes_used: string[];
  metadata: Record<string, unknown> | null;
};

type ExecutionStats = {
  total: number;
  settled: number;
  reverted: number;
  pending: number;
  totalProfitUsd: number;
  avgProfitUsd: number;
  successRate: number;
};

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  10: 'Optimism',
  42161: 'Arbitrum',
  137: 'Polygon',
  43114: 'Avalanche',
  56: 'BNB Chain',
  100: 'Gnosis',
};

export function MonitoringPanel() {
  const [audits, setAudits] = useState<ScanAuditRow[]>([]);
  const [execStats, setExecStats] = useState<ExecutionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setError(null);
    try {
      const [auditRes, execRes] = await Promise.all([
        supabase
          .from('scan_audit')
          .select('*')
          .order('scanned_at', { ascending: false })
          .limit(30),
        supabase
          .from('arb_executions')
          .select('status, net_profit_usd')
          .order('executed_at', { ascending: false })
          .limit(500),
      ]);

      if (auditRes.error) throw auditRes.error;
      setAudits((auditRes.data ?? []) as ScanAuditRow[]);

      const execs = (execRes.data ?? []) as Array<{ status: string; net_profit_usd: number | null }>;
      const settled = execs.filter((e) => e.status === 'settled');
      const reverted = execs.filter((e) => e.status === 'reverted' || e.status === 'failed');
      const pending = execs.filter((e) => e.status === 'pending' || e.status === 'submitted');
      const totalProfit = settled.reduce((sum, e) => sum + (e.net_profit_usd ?? 0), 0);

      setExecStats({
        total: execs.length,
        settled: settled.length,
        reverted: reverted.length,
        pending: pending.length,
        totalProfitUsd: totalProfit,
        avgProfitUsd: settled.length > 0 ? totalProfit / settled.length : 0,
        successRate: execs.length > 0 ? (settled.length / execs.length) * 100 : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* Execution Statistics */}
      {execStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-500">Total Executions</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">{execStats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-500">Settled</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{execStats.settled}</p>
            <p className="text-[11px] text-slate-600 mt-1">{execStats.successRate.toFixed(1)}% success rate</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-rose-400" />
              <span className="text-xs text-slate-500">Reverted</span>
            </div>
            <p className="text-2xl font-bold text-rose-400">{execStats.reverted}</p>
            <p className="text-[11px] text-slate-600 mt-1">atomic — zero loss</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-500">Total Profit</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">${execStats.totalProfitUsd.toFixed(4)}</p>
            <p className="text-[11px] text-slate-600 mt-1">avg ${execStats.avgProfitUsd.toFixed(4)}/execution</p>
          </div>
        </div>
      )}

      {/* Scan Audit Trail */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200">Scan Audit Trail</h2>
          </div>
          <span className="text-xs text-slate-500">Last 30 scans · auto-refresh 10s</span>
        </div>
        <div className="overflow-x-auto">
          {audits.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Eye className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No scan audits yet. Start the engine or click "Scan Now" to begin.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-950/40 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">Time</th>
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">Chain</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">Pairs</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">Found</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">Qualifying</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">Best Spread</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">Duration</th>
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">Strategies</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => (
                  <tr key={audit.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-4 py-2 text-slate-400">
                      {new Date(audit.scanned_at).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      {CHAIN_NAMES[audit.chain_id] ?? `Chain ${audit.chain_id}`}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-400 font-mono">{audit.pairs_scanned}</td>
                    <td className="px-4 py-2 text-right text-slate-400 font-mono">{audit.opportunities_found}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      <span className={audit.qualifying_count > 0 ? 'text-emerald-400' : 'text-slate-500'}>
                        {audit.qualifying_count}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <span className={audit.best_spread_usd > 0 ? 'text-emerald-400' : 'text-slate-500'}>
                        ${Number(audit.best_spread_usd).toFixed(6)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-400 font-mono">{audit.scan_duration_ms}ms</td>
                    <td className="px-4 py-2 text-slate-500">
                      {(audit.strategies_used ?? []).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Verification Status */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
          <Clock className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">Settlement Verification</h2>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">
            Every execution is verified on-chain. Transactions are atomic — if the arbitrage spread evaporates
            before execution, the entire transaction reverts with zero loss. The flash loan is repaid within the
            same transaction, so no capital is ever at risk.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-slate-500">Atomic Execution</span>
              </div>
              <p className="text-[11px] text-slate-600">Flash loan + swaps + repay in one transaction. Reverts = zero loss.</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-slate-500">On-chain Verification</span>
              </div>
              <p className="text-[11px] text-slate-600">Transaction receipts checked for status confirmation.</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-slate-500">No Fake Data</span>
              </div>
              <p className="text-[11px] text-slate-600">All spreads from live DEX quotes. No simulated prices.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
