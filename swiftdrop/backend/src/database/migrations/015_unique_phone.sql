-- Optional: expiry column for licence checks on job applications (nullable)
ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS licence_expiry DATE;

-- Canonicalize common SA formats to +27XXXXXXXXX (best-effort; matches app validators)
UPDATE users
SET phone = '+27' || SUBSTRING(TRIM(phone) FROM 2)
WHERE TRIM(phone) ~ '^0[678][0-9]{8}$';

UPDATE users
SET phone = '+' || TRIM(phone)
WHERE TRIM(phone) ~ '^27[678][0-9]{8}$'
  AND LEFT(TRIM(phone), 1) <> '+';

-- Enforce unique phone numbers (PostgreSQL partial unique index; safe if UNIQUE already exists on column)
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_e164_idx
  ON users (phone)
  WHERE phone IS NOT NULL AND TRIM(phone) <> '';
