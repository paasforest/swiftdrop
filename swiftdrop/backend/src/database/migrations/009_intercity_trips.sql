-- Intercity trip booking model — Phase 1 schema additions

-- Pickup method + meeting point + trip type on driver_routes
ALTER TABLE driver_routes
  ADD COLUMN IF NOT EXISTS pickup_method VARCHAR(20) DEFAULT 'driver_collects'
    CHECK (pickup_method IN ('driver_collects', 'sender_drops_off')),
  ADD COLUMN IF NOT EXISTS meeting_point_address TEXT,
  ADD COLUMN IF NOT EXISTS meeting_point_lat NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS meeting_point_lng NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS trip_type VARCHAR(20) DEFAULT 'local'
    CHECK (trip_type IN ('local', 'intercity')),
  ADD COLUMN IF NOT EXISTS cancellation_strikes INTEGER DEFAULT 0;

-- Driver strikes (cancel abuse tracking)
CREATE TABLE IF NOT EXISTS driver_strikes (
  id         SERIAL PRIMARY KEY,
  driver_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     VARCHAR(100) NOT NULL,
  order_id   INTEGER REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Remove province restriction from orders (keep column for analytics)
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_province_check;

-- Remove province restriction from driver_routes
ALTER TABLE driver_routes
  DROP CONSTRAINT IF EXISTS driver_routes_province_check;
