-- Customer → driver ratings: link to order and/or delivery job; update aggregates on driver_tiers.

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES delivery_jobs(id) ON DELETE SET NULL;

-- Allow ratings linked only to a delivery job where no order row is used yet.
ALTER TABLE ratings
  ALTER COLUMN order_id DROP NOT NULL;

UPDATE ratings r
SET
  customer_id = o.customer_id,
  driver_id = o.driver_id
FROM orders o
WHERE r.order_id IS NOT NULL
  AND r.order_id = o.id
  AND (r.customer_id IS NULL OR r.driver_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_ratings_driver ON ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_ratings_job ON ratings(job_id);
CREATE INDEX IF NOT EXISTS idx_ratings_customer ON ratings(customer_id);
