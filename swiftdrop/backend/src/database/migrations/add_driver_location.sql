-- Driver presence + GPS on users (mirrors driver_locations for simple queries / future use)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_lat NUMERIC(10,6);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_lng NUMERIC(10,6);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
