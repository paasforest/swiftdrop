-- Audit timestamps for dispute evidence (when proof images were stored)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_photo_uploaded_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_photo_uploaded_at TIMESTAMPTZ;
