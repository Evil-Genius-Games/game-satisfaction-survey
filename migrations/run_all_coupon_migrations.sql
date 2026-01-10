CREATE TABLE IF NOT EXISTS coupon_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
  response_id INTEGER REFERENCES responses(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,
  copied_at TIMESTAMP,
  emailed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 year'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_coupon_codes_status ON coupon_codes(status);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_code ON coupon_codes(code);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_response_id ON coupon_codes(response_id);

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

