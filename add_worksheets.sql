-- Add worksheet response columns to weddings table
ALTER TABLE weddings
  ADD COLUMN IF NOT EXISTS worksheet_priorities JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS worksheet_guest_rules JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS worksheet_budget_alignment JSONB DEFAULT '{}';
