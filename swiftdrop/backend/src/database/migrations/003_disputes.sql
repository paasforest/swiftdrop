-- Payout hold during open disputes (idempotent: DROP + ADD)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payout_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_payout_status_check
  CHECK (payout_status IN ('pending','processing','paid','held'));

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2);
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE disputes SET dispute_type = 'lost_item' WHERE dispute_type = 'lost';

ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_dispute_type_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_dispute_type_check
  CHECK (dispute_type IN ('lost_item','damaged','not_delivered','wrong_item','driver_behaviour','other'));

ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_resolution_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_resolution_check
  CHECK (resolution IS NULL OR resolution IN ('refund_customer','no_refund','partial_refund'));
