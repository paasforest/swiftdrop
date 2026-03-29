-- Sender-facing total (R45 + R7/km + size, round R5); driver_payout = 80% of this
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_fare NUMERIC(10, 2);
