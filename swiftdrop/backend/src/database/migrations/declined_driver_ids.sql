-- Add declined_driver_ids array to orders table for cascading job offers
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS declined_driver_ids INTEGER[] DEFAULT '{}';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_declined_driver_ids ON orders USING GIN (declined_driver_ids);
