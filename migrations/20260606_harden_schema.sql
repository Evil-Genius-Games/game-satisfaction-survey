-- Harden production schema for admin GM mappings and coupon delivery tracking.
-- This migration intentionally preserves incompatible legacy association tables by renaming
-- them with a _legacy suffix instead of dropping data at request time.

DO $$
BEGIN
  IF to_regclass('public.gm_conventions') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gm_conventions'
      AND column_name = 'gm_option_id'
  ) THEN
    ALTER TABLE gm_conventions RENAME TO gm_conventions_legacy;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS gm_conventions (
  id SERIAL PRIMARY KEY,
  gm_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
  convention_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gm_option_id, convention_option_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_conventions_gm_option_id ON gm_conventions(gm_option_id);
CREATE INDEX IF NOT EXISTS idx_gm_conventions_convention_option_id ON gm_conventions(convention_option_id);

DO $$
BEGIN
  IF to_regclass('public.gm_adventures') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gm_adventures'
      AND column_name = 'gm_option_id'
  ) THEN
    ALTER TABLE gm_adventures RENAME TO gm_adventures_legacy;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS gm_adventures (
  id SERIAL PRIMARY KEY,
  gm_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
  convention_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
  adventure_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gm_option_id, convention_option_id, adventure_option_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_adventures_gm_option_id ON gm_adventures(gm_option_id);
CREATE INDEX IF NOT EXISTS idx_gm_adventures_convention_option_id ON gm_adventures(convention_option_id);
CREATE INDEX IF NOT EXISTS idx_gm_adventures_adventure_option_id ON gm_adventures(adventure_option_id);
CREATE INDEX IF NOT EXISTS idx_gm_adventures_gm_convention ON gm_adventures(gm_option_id, convention_option_id);

CREATE TABLE IF NOT EXISTS coupon_deliveries (
  id SERIAL PRIMARY KEY,
  response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  coupon_code VARCHAR(255) NOT NULL,
  email_address VARCHAR(320),
  delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(response_id, coupon_code)
);

CREATE INDEX IF NOT EXISTS idx_coupon_deliveries_response_id ON coupon_deliveries(response_id);
CREATE INDEX IF NOT EXISTS idx_coupon_deliveries_coupon_code ON coupon_deliveries(coupon_code);
