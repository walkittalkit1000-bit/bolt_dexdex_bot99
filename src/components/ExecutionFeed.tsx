import { useEffect, useState } from 'react';
import { supabase, type ExecutionRow } from '@/lib/supabase';
import { fetchRecentExecutions } from '@/engine/compiler';

const STATUS_COLORS: Record<ExecutionRow['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-300',
  submitted: 'bg-blue-500/10 text-blue-300',
  landed: 'bg-cyan-500/10 text-cyan-300',
  settled: 'bg-emerald-500/10 text-emerald-300',
  reverted: 'bg-rose-500/10 text-rose-300',
  failed: 'bg-rose-700/20 text-rose-400',
};

function shortSig(sig: string | null): string {
  if (!sig) return '—';
  return sig.length > 12 ? `${sig.slice(0, 8)}…${sig.slice(-4)}` : sig;
}

type Props = {
  onSelect: (id: string) => void;
};

export function ExecutionFeed({ onSelect }: Props) {
  const [execs, setExecs] = useState<ExecutionRow[]>([]);

  useEffect(() => {
    fetchRecentExecutions(15).then(setExecs);
    const channel = supabase
      .channel('execs_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'arb_executions' },
        (payload) => setExecs((prev) => [payload.new as ExecutionRow, ...prev].slice(0, 15)),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'arb_executions' },
        (payload) => {
          const updated = payload.new as ExecutionRow;
          setExecs((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-200 tracking-wide">Execution & Settlement</h3>
        <span className="text-xs text-slate-500">{execs.length} records · click row for details</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {execs.length === 0 ? (
          <p className="text-slate-600 italic text-sm p-4">No executions yet. Bundles will appear here after the scanner finds qualifying spreads.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur">
              <tr className="text-slate-500 text-left">
                <th className="px-3 py-2 font-medium">Signature</th>
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium">Net P&L</th>
                <th className="px-3 py-2 font-medium">Tip</th>
                <th className="px-3 py-2 font-medium">Region</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {execs.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => onSelect(e.id)}
                  className="border-t border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 text-slate-400 font-mono">{shortSig(e.bundle_signature)}</td>
                  <td className="px-3 py-2 text-slate-300">{e.flash_loan_asset}</td>
                  <td className="px-3 py-2 font-mono text-emerald-300">${Number(e.net_profit_usd).toFixed(4)}</td>
                  <td className="px-3 py-2 text-slate-400 font-mono">{Number(e.jito_tip_lamports).toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-400">{e.jito_region}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[e.status]}`}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
