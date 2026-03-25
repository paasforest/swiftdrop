-- Province for geo-fenced matching (may already exist from smart_matching.sql)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS province VARCHAR(20);
