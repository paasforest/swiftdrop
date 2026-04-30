-- 009_intercity_trips.sql
-- Adds intercity trip booking support: trip type, pickup method, meeting point,
-- per-trip parcel slot reservations, and driver-strike tracking for cancellations.

-- Driver route fields for intercity trips
ALTER TABLE driver_routes
  ADD COLUMN IF NOT EXISTS trip_type VARCHAR(20) DEFAULT 'local'
    CHECK (trip_type IN ('local', 'intercity')),
  ADD COLUMN IF NOT EXISTS pickup_method VARCHAR(20) DEFAULT 'driver_collects'
    CHECK (pickup_method IN ('driver_collects', 'sender_drops_off')),
  ADD COLUMN IF NOT EXISTS meeting_point_address TEXT,
  ADD COLUMN IF NOT EXISTS meeting_point_lat NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS meeting_point_lng NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS cancellation_strikes INTEGER DEFAULT 0;

-- Orders -> reserved slot on a specific driver route (intercity bookings)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS assigned_driver_route_id INTEGER
    REFERENCES driver_routes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver_route_id
  ON orders(assigned_driver_route_id);

-- Driver strike log for trip cancellations (3 in 90 days = deactivate)
CREATE TABLE IF NOT EXISTS driver_strikes (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_route_id INTEGER REFERENCES driver_routes(id) ON DELETE SET NULL,
  reason VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_strikes_driver_id_created
  ON driver_strikes(driver_id, created_at DESC);
