import { supabase, type LogRow } from '@/lib/supabase';

export type LogComponent = LogRow['component'];
export type LogLevel = LogRow['level'];

export async function logEngine(
  component: LogComponent,
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from('engine_logs').insert({
      component,
      level,
      message,
      metadata: metadata ?? null,
    });
  } catch {
    // logging is best-effort; never block the engine on telemetry
  }
}

export type LogListener = (log: LogRow) => void;

export function subscribeToLogs(callback: LogListener): () => void {
  const channel = supabase
    .channel('engine_logs_live')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'engine_logs' },
      (payload) => callback(payload.new as LogRow),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchRecentLogs(limit = 50): Promise<LogRow[]> {
  const { data, error } = await supabase
    .from('engine_logs')
    .select('*')
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as LogRow[];
}
