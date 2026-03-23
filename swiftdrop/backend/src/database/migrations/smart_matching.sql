-- Add province-aware smart matching columns

ALTER TABLE driver_routes
  ADD COLUMN IF NOT EXISTS province VARCHAR(20),
  ADD COLUMN IF NOT EXISTS route_polyline TEXT,
  ADD COLUMN IF NOT EXISTS is_return_route BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_route_id INTEGER 
    REFERENCES driver_routes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS driver_type VARCHAR(20) 
    DEFAULT 'commuter'
    CHECK (driver_type IN ('commuter','dedicated'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS province VARCHAR(20),
  ADD COLUMN IF NOT EXISTS assigned_driver_route_id INTEGER
    REFERENCES driver_routes(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_lat NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS current_lng NUMERIC(10,6);

CREATE TABLE IF NOT EXISTS waitlist (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  waitlist_type VARCHAR(30) DEFAULT 'area',
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  detected_area TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
