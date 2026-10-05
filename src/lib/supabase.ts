import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export type OpportunityRow = {
  id: string;
  detected_at: string;
  token_path: string[];
  pool_path: string[];
  gross_spread_usd: number;
  slippage_bps: number;
  flash_loan_asset: string;
  hop_count: number;
  compute_units_estimate: number;
  status: 'detected' | 'qualifying' | 'dispatched' | 'settled' | 'reverted' | 'dropped';
};

export type ExecutionRow = {
  id: string;
  opportunity_id: string | null;
  executed_at: string;
  bundle_signature: string | null;
  flash_loan_provider: string;
  flash_loan_asset: string;
  flash_loan_amount: number;
  gross_spread_lamports: number;
  jito_tip_lamports: number;
  gas_lamports: number;
  net_profit_lamports: number;
  net_profit_usd: number;
  jito_region: string;
  index_position: number | null;
  status: 'pending' | 'submitted' | 'landed' | 'settled' | 'reverted' | 'failed';
  settled_at: string | null;
  tx_signature: string | null;
  onchain_status: 'unconfirmed' | 'confirmed' | 'finalized' | 'failed' | 'not_submitted' | null;
  settlement_address: string | null;
  jito_bundle_uuid: string | null;
};

export type LogRow = {
  id: string;
  logged_at: string;
  component: 'scanner' | 'compiler' | 'dispatcher' | 'risk' | 'relay' | 'system';
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  metadata: Record<string, unknown> | null;
};
