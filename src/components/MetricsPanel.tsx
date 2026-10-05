import { useEffect, useState } from 'react';
import type { EngineMetrics } from '@/engine/orchestrator';
import { subscribeToMetrics } from '@/engine/orchestrator';
import { ENGINE_CONSTANTS } from '@/engine/constants';
import { Activity, Zap, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Radio } from 'lucide-react';

type Props = {
  metrics: EngineMetrics;
};

function MetricCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={`${accent} opacity-80`}>{icon}</div>
      </div>
    </div>
  );
}

export function MetricsPanel({ metrics }: Props) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 300);
    return () => clearTimeout(t);
  }, [metrics.cycleCount]);

  const statusColor =
    metrics.status === 'running'
      ? 'text-emerald-400'
      : metrics.status === 'error'
        ? 'text-rose-400'
        : metrics.status === 'paused'
          ? 'text-amber-400'
          : 'text-slate-400';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-1">
        <span className={`relative flex h-2.5 w-2.5 ${pulse ? 'scale-125' : ''} transition-transform`}>
          <span className={`absolute inline-flex h-full w-full rounded-full ${metrics.status === 'running' ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'} opacity-75`} />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${metrics.status === 'running' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
        </span>
        <span className={`text-sm font-medium ${statusColor} uppercase tracking-wider`}>{metrics.status}</span>
        <span className="text-xs text-slate-600 ml-auto">Cycle #{metrics.cycleCount}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard
          label="Scans"
          value={metrics.totalScans}
          sub={metrics.scanDurationMs > 0 ? `${(metrics.scanDurationMs / 1000).toFixed(1)}s/scan` : undefined}
          accent="text-sky-300"
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard
          label="Opportunities"
          value={metrics.opportunitiesFound}
          accent="text-violet-300"
          icon={<Radio className="w-5 h-5" />}
        />
        <MetricCard
          label="Bundles"
          value={metrics.bundlesCompiled}
          sub={`${metrics.bundlesDispatched} dispatched`}
          accent="text-cyan-300"
          icon={<Zap className="w-5 h-5" />}
        />
        <MetricCard
          label="Settled"
          value={metrics.bundlesLanded}
          accent="text-emerald-300"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <MetricCard
          label="Reverted"
          value={metrics.bundlesReverted}
          sub="zero loss"
          accent="text-rose-300"
          icon={<XCircle className="w-5 h-5" />}
        />
        <MetricCard
          label="Net P&L"
          value={`${metrics.totalNetProfitUsd.toFixed(4)}`}
          sub={metrics.parallelExecutions > 0 ? `${metrics.parallelExecutions} active` : 'after gas'}
          accent="text-emerald-300"
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <span className="text-slate-500">Flash Loan Anchor</span>
          <p className="text-slate-300 font-mono mt-0.5">${ENGINE_CONSTANTS.FLASH_LOAN_ANCHOR_SIZE.toLocaleString()} USD</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <span className="text-slate-500">Min Profit</span>
          <p className="text-slate-300 font-mono mt-0.5">${ENGINE_CONSTANTS.MIN_PROFIT_THRESHOLD_USD.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <span className="text-slate-500">Max Gas Price</span>
          <p className="text-slate-300 font-mono mt-0.5">{ENGINE_CONSTANTS.MAX_GAS_PRICE_GWEI} gwei</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <span className="text-slate-500">Scanner Interval</span>
          <p className="text-slate-300 font-mono mt-0.5">{ENGINE_CONSTANTS.SCANNER_INTERVAL_MS / 1000}s</p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70" />
        <span>Zero-capital mode: Balancer V2 flash loans + CDP paymaster gas sponsorship. Atomic revert on insufficient net profit.</span>
      </div>
    </div>
  );
}

export function useEngineMetrics() {
  const [metrics, setMetrics] = useState<EngineMetrics | null>(null);
  useEffect(() => {
    const unsub = subscribeToMetrics(setMetrics);
    return unsub;
  }, []);
  return metrics;
}
