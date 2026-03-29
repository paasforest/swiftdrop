-- Sender parcel declaration + unguessable public tracking token (share link)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS declaration_accepted_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS public_track_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_public_track_token
  ON bookings (public_track_token)
  WHERE public_track_token IS NOT NULL;
