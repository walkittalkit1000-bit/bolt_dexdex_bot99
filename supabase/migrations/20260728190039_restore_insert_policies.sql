-- Restore INSERT-only policies for anon (needed by frontend to log and persist opportunities)
-- DELETE and UPDATE remain locked to service-role only (the real security fix).
-- INSERT of new records is safe for a no-auth app; tampering with or wiping existing records is not.

CREATE POLICY "anon_insert_opportunities" ON arb_opportunities
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "anon_insert_executions" ON arb_executions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "anon_insert_logs" ON engine_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);
