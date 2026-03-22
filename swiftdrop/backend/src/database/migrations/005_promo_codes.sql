-- Promo codes (customer discounts)

CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INTEGER DEFAULT 1,
  uses_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_code_uses (
  id SERIAL PRIMARY KEY,
  code_id INTEGER REFERENCES promo_codes(id),
  user_id INTEGER REFERENCES users(id),
  order_id INTEGER REFERENCES orders(id),
  discount_applied NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(code_id, user_id)
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code_id INTEGER REFERENCES promo_codes(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_discount_amount NUMERIC(12,2) DEFAULT 0;

INSERT INTO promo_codes (code, discount_type, discount_value, max_uses)
VALUES ('FIRST', 'percent', 100, 1000)
ON CONFLICT (code) DO NOTHING;
