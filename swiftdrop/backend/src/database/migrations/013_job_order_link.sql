-- Link job-board deliveries to legacy orders when customer confirms a driver.
-- Enables TripDeliveryManager / OTP flows that operate on orders.id.

ALTER TABLE delivery_jobs
  ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_job_id INTEGER REFERENCES delivery_jobs(id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS trip_type VARCHAR(20) DEFAULT 'local';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_delivery_jobs_order_id ON delivery_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_job_id ON orders(delivery_job_id);
