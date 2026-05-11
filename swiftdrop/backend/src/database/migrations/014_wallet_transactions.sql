-- Ledger column + indexes for wallet_transactions (safe if table/base indexes already exist)
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS balance_after NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user
  ON wallet_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created
  ON wallet_transactions(created_at);
