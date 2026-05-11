-- Dispute resolution v2: extend disputes + order status for refunds.
-- NOTE: `disputes` already exists from schema; this migration ALTERs in place.

-- Allow disputed_refunded on orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pending','matching','accepted',
  'pickup_en_route','pickup_arrived','collected',
  'delivery_en_route','delivery_arrived',
  'delivered','completed','cancelled','disputed','disputed_refunded','unmatched'
));

-- Disputes: order optional when job-only (still usually bridged to order_id)
ALTER TABLE disputes ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES delivery_jobs(id) ON DELETE SET NULL;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS reason VARCHAR(50);
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS customer_photo_url TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolution_reason TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours');

UPDATE disputes SET auto_release_at = COALESCE(auto_release_at, created_at + INTERVAL '24 hours')
WHERE auto_release_at IS NULL;

UPDATE disputes SET customer_id = raised_by_user_id WHERE customer_id IS NULL;

UPDATE disputes d
SET driver_id = o.driver_id
FROM orders o
WHERE d.order_id = o.id AND d.driver_id IS NULL AND o.driver_id IS NOT NULL;

UPDATE disputes
SET reason = CASE dispute_type
  WHEN 'not_delivered' THEN 'not_delivered'
  WHEN 'damaged' THEN 'damaged'
  WHEN 'wrong_item' THEN 'wrong_item'
  WHEN 'driver_behaviour' THEN 'driver_behaviour'
  WHEN 'lost_item' THEN 'other'
  WHEN 'other' THEN 'other'
  ELSE 'other'
END
WHERE reason IS NULL;

UPDATE disputes SET reason = 'other' WHERE reason IS NULL;

UPDATE disputes SET admin_id = resolved_by_admin_id WHERE admin_id IS NULL AND resolved_by_admin_id IS NOT NULL;

UPDATE disputes SET admin_notes = resolution_notes WHERE admin_notes IS NULL AND resolution_notes IS NOT NULL;

-- Migrate legacy dispute statuses
ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_status_check;

UPDATE disputes SET status = 'under_review' WHERE status = 'in_review';

UPDATE disputes
SET status = 'resolved_release'
WHERE status = 'resolved'
  AND resolution IS NULL;

UPDATE disputes
SET status = CASE resolution
  WHEN 'refund_customer' THEN 'resolved_refund'
  WHEN 'partial_refund' THEN 'resolved_partial'
  WHEN 'no_refund' THEN 'resolved_release'
  ELSE status
END
WHERE status = 'resolved';

UPDATE disputes SET status = 'resolved_release' WHERE status = 'resolved';

ALTER TABLE disputes ADD CONSTRAINT disputes_status_check
  CHECK (status IN (
    'open',
    'under_review',
    'resolved_refund',
    'resolved_release',
    'resolved_partial',
    'closed'
  ));

ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_reason_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_reason_check
  CHECK (reason IS NULL OR reason IN (
    'not_delivered',
    'damaged',
    'wrong_item',
    'late_delivery',
    'driver_behaviour',
    'other'
  ));

CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_customer ON disputes(customer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_auto_release ON disputes(auto_release_at) WHERE status = 'open';
