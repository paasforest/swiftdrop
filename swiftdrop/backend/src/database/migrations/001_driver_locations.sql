-- Driver locations for matching (online drivers + GPS)
CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_offers (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_offers_order_id ON job_offers(order_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_driver_id ON job_offers(driver_id);
