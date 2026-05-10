-- Delivery jobs posted by customers (job board)
CREATE TABLE IF NOT EXISTS delivery_jobs (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id),

  pickup_address TEXT NOT NULL,
  pickup_lat DECIMAL(10,7),
  pickup_lng DECIMAL(10,7),

  dropoff_address TEXT NOT NULL,
  dropoff_lat DECIMAL(10,7),
  dropoff_lng DECIMAL(10,7),

  parcel_size VARCHAR(20) NOT NULL DEFAULT 'small'
    CHECK (parcel_size IN ('small','medium','large')),
  parcel_type VARCHAR(100) DEFAULT 'General',
  parcel_value DECIMAL(10,2) DEFAULT 0,

  delivery_type VARCHAR(20) NOT NULL DEFAULT 'local'
    CHECK (delivery_type IN ('local','intercity')),

  base_price DECIMAL(10,2) NOT NULL,
  insurance_fee DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  driver_earnings DECIMAL(10,2) NOT NULL,
  commission DECIMAL(10,2) NOT NULL,

  distance_km DECIMAL(10,2),
  estimated_minutes INTEGER,

  status VARCHAR(30) NOT NULL DEFAULT 'open'
    CHECK (status IN (
      'open',
      'driver_selected',
      'collecting',
      'collected',
      'delivering',
      'delivered',
      'completed',
      'cancelled',
      'expired'
    )),

  selected_driver_id INTEGER REFERENCES users(id),

  payment_method VARCHAR(20) DEFAULT 'wallet',
  payment_status VARCHAR(20) DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','refunded')),

  pickup_otp VARCHAR(10),
  delivery_otp VARCHAR(10),
  pickup_photo_url TEXT,
  delivery_photo_url TEXT,

  pickup_confirmed_at TIMESTAMPTZ,
  delivery_confirmed_at TIMESTAMPTZ,

  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '4 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES users(id),

  driver_route_id INTEGER REFERENCES driver_routes(id),

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','selected','rejected','withdrawn')),

  message TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(job_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_jobs_customer ON delivery_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_jobs_status ON delivery_jobs(status);
CREATE INDEX IF NOT EXISTS idx_delivery_jobs_type ON delivery_jobs(delivery_type);
CREATE INDEX IF NOT EXISTS idx_delivery_jobs_location ON delivery_jobs(pickup_lat, pickup_lng);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_driver ON job_applications(driver_id);
