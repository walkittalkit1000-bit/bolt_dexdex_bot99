-- Add real on-chain settlement tracking columns to arb_executions
-- These track the actual Solana transaction signature, on-chain status,
-- and the settlement (profit destination) wallet address.

ALTER TABLE arb_executions
  ADD COLUMN IF NOT EXISTS tx_signature text,
  ADD COLUMN IF NOT EXISTS onchain_status text CHECK (onchain_status IN ('unconfirmed', 'confirmed', 'finalized', 'failed', 'not_submitted')),
  ADD COLUMN IF NOT EXISTS settlement_address text,
  ADD COLUMN IF NOT EXISTS jito_bundle_uuid text;

-- Update the status check constraint to include 'submitted' state
ALTER TABLE arb_executions DROP CONSTRAINT IF EXISTS arb_executions_status_check;
ALTER TABLE arb_executions ADD CONSTRAINT arb_executions_status_check
  CHECK (status IN ('pending', 'submitted', 'landed', 'settled', 'reverted', 'failed'));

CREATE INDEX IF NOT EXISTS idx_arb_executions_tx_signature ON arb_executions(tx_signature);
CREATE INDEX IF NOT EXISTS idx_arb_executions_settlement_addr ON arb_executions(settlement_address);
