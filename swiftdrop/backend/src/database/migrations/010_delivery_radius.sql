-- 010_delivery_radius.sql
-- Add delivery_radius_km to driver_routes for intercity trips

ALTER TABLE driver_routes
  ADD COLUMN IF NOT EXISTS delivery_radius_km
    INTEGER DEFAULT 10
    CHECK (delivery_radius_km IN (5,10,20,30));
