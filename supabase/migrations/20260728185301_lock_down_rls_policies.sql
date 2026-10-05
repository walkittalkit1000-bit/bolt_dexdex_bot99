-- Security: Remove all anon INSERT/UPDATE/DELETE policies
-- The frontend (anon key) only needs SELECT access.
-- All writes go through the edge function using the service role key (bypasses RLS).

-- Opportunities: anon can only read
DROP POLICY IF EXISTS "anon_insert_opportunities" ON arb_opportunities;
DROP POLICY IF EXISTS "anon_update_opportunities" ON arb_opportunities;
DROP POLICY IF EXISTS "anon_delete_opportunities" ON arb_opportunities;

-- Executions: anon can only read
DROP POLICY IF EXISTS "anon_insert_executions" ON arb_executions;
DROP POLICY IF EXISTS "anon_update_executions" ON arb_executions;
DROP POLICY IF EXISTS "anon_delete_executions" ON arb_executions;

-- Logs: anon can only read
DROP POLICY IF EXISTS "anon_insert_logs" ON engine_logs;
DROP POLICY IF EXISTS "anon_update_logs" ON engine_logs;
DROP POLICY IF EXISTS "anon_delete_logs" ON engine_logs;

-- Re-confirm SELECT-only policies for anon + authenticated
CREATE POLICY "anon_read_opportunities" ON arb_opportunities
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_executions" ON arb_executions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_logs" ON engine_logs
  FOR SELECT TO anon, authenticated USING (true);
