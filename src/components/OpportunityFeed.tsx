import { useEffect, useState } from 'react';
import { supabase, type OpportunityRow } from '@/lib/supabase';
import { fetchRecentOpportunities } from '@/engine/scanner';

const STATUS_COLORS: Record<OpportunityRow['status'], string> = {
  detected: 'bg-slate-500/10 text-slate-300',
  qualifying: 'bg-sky-500/10 text-sky-300',
  dispatched: 'bg-cyan-500/10 text-cyan-300',
  settled: 'bg-emerald-500/10 text-emerald-300',
  reverted: 'bg-rose-500/10 text-rose-300',
  dropped: 'bg-slate-700/30 text-slate-500',
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function OpportunityFeed() {
  const [opps, setOpps] = useState<OpportunityRow[]>([]);

  useEffect(() => {
    fetchRecentOpportunities(15).then(setOpps);
    const channel = supabase
      .channel('opps_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'arb_opportunities' },
        (payload) => {
          setOpps((prev) => [payload.new as OpportunityRow, ...prev].slice(0, 15));
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
        <h3 className="text-sm font-semibold text-slate-200 tracking-wide">Scanner Feed</h3>
        <span className="text-xs text-slate-500">{opps.length} recent</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {opps.length === 0 ? (
          <p className="text-slate-600 italic text-sm p-4">No opportunities detected yet. Engine will populate this as spreads are found.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur">
              <tr className="text-slate-500 text-left">
                <th className="px-3 py-2 font-medium">Path</th>
                <th className="px-3 py-2 font-medium">Spread</th>
                <th className="px-3 py-2 font-medium">Slip</th>
                <th className="px-3 py-2 font-medium">Hops</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {opps.map((o) => (
                <tr key={o.id} className="border-t border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-300 font-mono">
                    {o.token_path.join('→')}
                  </td>
                  <td className="px-3 py-2 text-emerald-300 font-mono">${Number(o.gross_spread_usd).toFixed(4)}</td>
                  <td className="px-3 py-2 text-slate-400 font-mono">{Number(o.slippage_bps).toFixed(0)}bp</td>
                  <td className="px-3 py-2 text-slate-400">{o.hop_count}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[o.status]}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{timeAgo(o.detected_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
