-- Bookings table for the new Firebase-auth booking flow
CREATE TABLE IF NOT EXISTS bookings (
 id SERIAL PRIMARY KEY,
 sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 driver_firebase_uid TEXT,
 pickup_address TEXT NOT NULL,
 dropoff_address TEXT NOT NULL,
 parcel_size TEXT NOT NULL CHECK (parcel_size IN ('Small', 'Medium', 'Large')),
 status TEXT NOT NULL DEFAULT 'searching'
 CHECK (status IN ('searching','active','in_transit','delivered','cancelled','no_drivers')),
 pickup_lat NUMERIC(10, 6),
 pickup_lng NUMERIC(10, 6),
 pickup_otp TEXT,
 pickup_photo_url TEXT,
 dropoff_photo_url TEXT,
 accepted_at TIMESTAMPTZ,
 pickup_confirmed_at TIMESTAMPTZ,
 delivered_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_sender_id ON bookings(sender_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
