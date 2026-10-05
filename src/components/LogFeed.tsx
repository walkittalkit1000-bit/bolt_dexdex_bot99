import { useEffect, useState } from 'react';
import type { LogRow } from '@/lib/supabase';
import { subscribeToLogs, fetchRecentLogs } from '@/engine/logger';

const LEVEL_COLORS: Record<LogRow['level'], string> = {
  info: 'text-sky-300',
  warn: 'text-amber-300',
  error: 'text-rose-300',
  success: 'text-emerald-300',
};

const COMPONENT_COLORS: Record<LogRow['component'], string> = {
  scanner: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  compiler: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  dispatcher: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  risk: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  relay: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  system: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export function LogFeed() {
  const [logs, setLogs] = useState<LogRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchRecentLogs(60).then((initial) => {
      if (!cancelled) setLogs(initial.reverse());
    });

    const unsub = subscribeToLogs((log) => {
      setLogs((prev) => [...prev.slice(-99), log]);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-200 tracking-wide">Live Engine Log</h3>
        <span className="text-xs text-slate-500">{logs.length} entries</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 p-3 min-h-0">
        {logs.length === 0 ? (
          <p className="text-slate-600 italic">Waiting for engine activity...</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 leading-relaxed">
              <span className="text-slate-600 shrink-0">{formatTime(log.logged_at)}</span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-medium ${COMPONENT_COLORS[log.component]}`}>
                {log.component}
              </span>
              <span className={`${LEVEL_COLORS[log.level]} break-all`}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
