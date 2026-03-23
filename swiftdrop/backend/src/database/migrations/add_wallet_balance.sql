-- Add wallet_balance column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12,2) DEFAULT 0.00;

-- Update existing users to have 0.00 balance if NULL
UPDATE users SET wallet_balance = 0.00 WHERE wallet_balance IS NULL;
