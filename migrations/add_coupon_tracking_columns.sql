-- Add copied_at and emailed_at columns to track when codes are used
ALTER TABLE coupon_codes 
  ADD COLUMN IF NOT EXISTS copied_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMP;

-- Update expires_at to have a default of 1 year if it doesn't have one
ALTER TABLE coupon_codes 
  ALTER COLUMN expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 year');

-- For existing codes without expiration, set them to 1 year from now
UPDATE coupon_codes 
SET expires_at = COALESCE(expires_at, CURRENT_TIMESTAMP + INTERVAL '1 year')
WHERE expires_at IS NULL;

