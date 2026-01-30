-- Create gm_conventions junction table to associate GMs with conventions
-- This allows filtering which GMs show up in the survey based on convention

CREATE TABLE IF NOT EXISTS gm_conventions (
  id SERIAL PRIMARY KEY,
  gm_interest_id INTEGER NOT NULL REFERENCES gm_interest(id) ON DELETE CASCADE,
  convention VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gm_interest_id, convention)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gm_conventions_convention ON gm_conventions(convention);
CREATE INDEX IF NOT EXISTS idx_gm_conventions_gm_interest_id ON gm_conventions(gm_interest_id);

