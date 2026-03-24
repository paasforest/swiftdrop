-- Rate limiting forgot-password uses created_at on unconsumed rows.
ALTER TABLE otps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
UPDATE otps SET created_at = expires_at - INTERVAL '10 minutes' WHERE created_at IS NULL;
ALTER TABLE otps ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE otps ALTER COLUMN created_at SET NOT NULL;
