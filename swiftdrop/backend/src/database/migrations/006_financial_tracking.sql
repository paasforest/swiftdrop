-- Financial tracking: platform commission ledger + insurance pool extensions
-- (insurance_pool may already exist from schema.sql with fewer columns)

CREATE TABLE IF NOT EXISTS platform_revenue (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  order_number VARCHAR(50),
  commission_amount NUMERIC(10,2),
  revenue_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'earned',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_revenue_order_id ON platform_revenue(order_id);

CREATE TABLE IF NOT EXISTS insurance_pool (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number VARCHAR(50),
  amount_collected NUMERIC(10,2) NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  claim_amount NUMERIC(10,2) DEFAULT 0,
  claim_status VARCHAR(20) DEFAULT 'none',
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE insurance_pool ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);
ALTER TABLE insurance_pool ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE insurance_pool ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'insurance_pool' AND column_name = 'created_at'
  ) THEN
    UPDATE insurance_pool SET collected_at = created_at WHERE collected_at IS NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_insurance_pool_order_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_insurance_pool_order_id ON insurance_pool(order_id);
