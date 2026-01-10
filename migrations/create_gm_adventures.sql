-- Create gm_adventures junction table to associate GMs with adventures
-- This allows filtering which GMs show up in the survey based on adventure

CREATE TABLE IF NOT EXISTS gm_adventures (
  id SERIAL PRIMARY KEY,
  gm_interest_id INTEGER NOT NULL REFERENCES gm_interest(id) ON DELETE CASCADE,
  adventure VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gm_interest_id, adventure)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gm_adventures_adventure ON gm_adventures(adventure);
CREATE INDEX IF NOT EXISTS idx_gm_adventures_gm_interest_id ON gm_adventures(gm_interest_id);

