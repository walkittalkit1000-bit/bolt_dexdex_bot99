
/*
# Solana Arbitrage Engine Schema

1. New Tables
   - `arb_opportunities` — raw spread opportunities detected by the scanner with token paths, gross/net spreads, and status
   - `arb_executions` — Jito bundle execution records: flash loan size, tip paid, net profit, bundle signature, settlement status
   - `engine_logs` — time-series operational log entries (scanner, compiler, dispatcher, risk) for dashboard telemetry

2. Security
   - RLS enabled on all tables with anon + authenticated read/write (no sign-in required)

3. Indexes
   - Timestamp indexes on all tables for efficient recent-record queries
   - Status index on executions for filtering settled vs pending
*/

CREATE TABLE IF NOT EXISTS arb_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at timestamptz NOT NULL DEFAULT now(),
  token_path text[] NOT NULL,
  pool_path text[] NOT NULL,
  gross_spread_usd numeric(18, 6) NOT NULL,
  slippage_bps numeric(8, 4) NOT NULL,
  flash_loan_asset text NOT NULL,
  hop_count integer NOT NULL,
  compute_units_estimate integer NOT NULL,
  status text NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'qualifying', 'dispatched', 'settled', 'reverted', 'dropped'))
);

CREATE TABLE IF NOT EXISTS arb_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES arb_opportunities(id),
  executed_at timestamptz NOT NULL DEFAULT now(),
  bundle_signature text,
  flash_loan_provider text NOT NULL,
  flash_loan_asset text NOT NULL,
  flash_loan_amount numeric(18, 6) NOT NULL,
  gross_spread_lamports bigint NOT NULL,
  jito_tip_lamports bigint NOT NULL,
  gas_lamports bigint NOT NULL,
  net_profit_lamports bigint NOT NULL,
  net_profit_usd numeric(18, 6) NOT NULL,
  jito_region text NOT NULL,
  index_position integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'landed', 'settled', 'reverted', 'failed')),
  settled_at timestamptz
);

CREATE TABLE IF NOT EXISTS engine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_at timestamptz NOT NULL DEFAULT now(),
  component text NOT NULL CHECK (component IN ('scanner', 'compiler', 'dispatcher', 'risk', 'relay', 'system')),
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'success')),
  message text NOT NULL,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_arb_opportunities_detected_at ON arb_opportunities(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_arb_executions_executed_at ON arb_executions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_arb_executions_status ON arb_executions(status);
CREATE INDEX IF NOT EXISTS idx_engine_logs_logged_at ON engine_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_engine_logs_component ON engine_logs(component);

ALTER TABLE arb_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE arb_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_opportunities" ON arb_opportunities;
CREATE POLICY "anon_select_opportunities" ON arb_opportunities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_opportunities" ON arb_opportunities;
CREATE POLICY "anon_insert_opportunities" ON arb_opportunities FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_opportunities" ON arb_opportunities;
CREATE POLICY "anon_update_opportunities" ON arb_opportunities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_opportunities" ON arb_opportunities;
CREATE POLICY "anon_delete_opportunities" ON arb_opportunities FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_executions" ON arb_executions;
CREATE POLICY "anon_select_executions" ON arb_executions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_executions" ON arb_executions;
CREATE POLICY "anon_insert_executions" ON arb_executions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_executions" ON arb_executions;
CREATE POLICY "anon_update_executions" ON arb_executions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_executions" ON arb_executions;
CREATE POLICY "anon_delete_executions" ON arb_executions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_logs" ON engine_logs;
CREATE POLICY "anon_select_logs" ON engine_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_logs" ON engine_logs;
CREATE POLICY "anon_insert_logs" ON engine_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_logs" ON engine_logs;
CREATE POLICY "anon_update_logs" ON engine_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_logs" ON engine_logs;
CREATE POLICY "anon_delete_logs" ON engine_logs FOR DELETE TO anon, authenticated USING (true);
