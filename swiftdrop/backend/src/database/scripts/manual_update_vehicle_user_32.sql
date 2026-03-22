-- One-off: set vehicle details for driver user_id = 32 (e.g. test driver Charles).
-- Run manually: psql "$DATABASE_URL" -f swiftdrop/backend/src/database/scripts/manual_update_vehicle_user_32.sql

UPDATE driver_profiles
SET
  vehicle_make = 'Toyota',
  vehicle_model = 'Corolla',
  vehicle_year = 2020,
  vehicle_color = 'White',
  vehicle_plate = 'CA 123-456'
WHERE user_id = 32;
