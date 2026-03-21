-- SwiftDrop PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  profile_photo_url TEXT,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'driver', 'admin')),
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  fcm_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id_document_url TEXT,
  license_url TEXT,
  vehicle_registration_url TEXT,
  license_disc_url TEXT,
  saps_clearance_url TEXT,
  selfie_url TEXT,
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_year INTEGER,
  vehicle_color VARCHAR(50),
  vehicle_plate VARCHAR(50),
  vehicle_photo_url TEXT,
  pdp_number VARCHAR(100),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended')),
  verification_notes TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_tiers (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_name VARCHAR(20) NOT NULL
    CHECK (tier_name IN ('new', 'trusted', 'elite')),
  deliveries_completed INTEGER NOT NULL DEFAULT 0,
  current_rating NUMERIC(3,2),
  tier_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC(10,6) NOT NULL,
  pickup_lng NUMERIC(10,6) NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat NUMERIC(10,6) NOT NULL,
  dropoff_lng NUMERIC(10,6) NOT NULL,
  parcel_type VARCHAR(100),
  parcel_size VARCHAR(20) CHECK (parcel_size IN ('small', 'medium', 'large')),
  parcel_value NUMERIC(12,2),
  special_handling TEXT,
  delivery_tier VARCHAR(20) NOT NULL
    CHECK (delivery_tier IN ('standard', 'express', 'urgent')),
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending','matching','accepted',
      'pickup_en_route','pickup_arrived','collected',
      'delivery_en_route','delivery_arrived',
      'delivered','completed','cancelled','disputed','unmatched'
    )),
  base_price NUMERIC(12,2),
  insurance_fee NUMERIC(12,2),
  total_price NUMERIC(12,2),
  commission_amount NUMERIC(12,2),
  driver_earnings NUMERIC(12,2),
  pickup_otp VARCHAR(10),
  delivery_otp VARCHAR(10),
  pickup_photo_url TEXT,
  delivery_photo_url TEXT,
  pickup_confirmed_at TIMESTAMPTZ,
  delivery_confirmed_at TIMESTAMPTZ,
  matched_at TIMESTAMPTZ,
  driver_current_lat NUMERIC(10,6),
  driver_current_lng NUMERIC(10,6),
  driver_last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_routes (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_address TEXT NOT NULL,
  from_lat NUMERIC(10,6) NOT NULL,
  from_lng NUMERIC(10,6) NOT NULL,
  to_address TEXT NOT NULL,
  to_lat NUMERIC(10,6) NOT NULL,
  to_lng NUMERIC(10,6) NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  max_parcels INTEGER NOT NULL DEFAULT 1,
  boot_space VARCHAR(20) CHECK (boot_space IN ('small', 'medium', 'large')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  commission NUMERIC(12,2),
  driver_amount NUMERIC(12,2),
  insurance_amount NUMERIC(12,2),
  payment_method VARCHAR(50),
  payment_gateway_ref VARCHAR(255),
  escrow_status VARCHAR(20) NOT NULL DEFAULT 'held'
    CHECK (escrow_status IN ('held','released','refunded')),
  payout_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending','processing','paid','held')),
  payout_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rated_by VARCHAR(20) NOT NULL CHECK (rated_by IN ('customer','driver')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  raised_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dispute_type VARCHAR(50) NOT NULL
    CHECK (dispute_type IN ('lost_item','damaged','not_delivered','wrong_item','driver_behaviour','other')),
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_review','resolved')),
  resolution VARCHAR(50)
    CHECK (resolution IS NULL OR resolution IN ('refund_customer','no_refund','partial_refund')),
  resolution_notes TEXT,
  refund_amount NUMERIC(12,2),
  resolved_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50),
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_pool (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_collected NUMERIC(12,2) NOT NULL,
  claim_amount NUMERIC(12,2),
  claim_status VARCHAR(20) NOT NULL DEFAULT 'none'
    CHECK (claim_status IN ('none','claimed','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(10) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('credit','debit')),
  amount NUMERIC(12,2) NOT NULL,
  reference VARCHAR(255),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_tiers_driver_id ON driver_tiers(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_coords ON orders(pickup_lat, pickup_lng);
CREATE INDEX IF NOT EXISTS idx_orders_dropoff_coords ON orders(dropoff_lat, dropoff_lng);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_driver_routes_driver_id ON driver_routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_ratings_order_id ON ratings(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_pool_order_id ON insurance_pool(order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions(user_id);
