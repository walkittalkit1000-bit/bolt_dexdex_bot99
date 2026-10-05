-- Remove public DELETE policies (security: anyone could wipe all data)
DROP POLICY IF EXISTS "anon_delete_opportunities" ON arb_opportunities;
DROP POLICY IF EXISTS "anon_delete_executions" ON arb_executions;
DROP POLICY IF EXISTS "anon_delete_logs" ON engine_logs;

-- Remove public UPDATE policies (security: anyone could tamper with execution records)
DROP POLICY IF EXISTS "anon_update_opportunities" ON arb_opportunities;
DROP POLICY IF EXISTS "anon_update_executions" ON arb_executions;
DROP POLICY IF EXISTS "anon_update_logs" ON engine_logs;
