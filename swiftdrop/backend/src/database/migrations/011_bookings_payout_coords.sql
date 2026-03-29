-- Trip payout + drop-off coordinates for earnings and maps
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_lat NUMERIC(10, 6);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_lng NUMERIC(10, 6);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_payout NUMERIC(10, 2);
