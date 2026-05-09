-- Intercity search: normalized city labels for TripBrowser matching (address fallback remains in API).
-- Existing rows keep NULL until reposted; app sends from_city/to_city on new posts.

ALTER TABLE driver_routes
  ADD COLUMN IF NOT EXISTS from_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS to_city VARCHAR(100);
