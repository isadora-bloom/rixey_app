-- Borrow Selections Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS wedding_borrow_selections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES borrow_catalog(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(wedding_id, item_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_borrow_selections_wedding ON wedding_borrow_selections(wedding_id);

-- Grant permissions
GRANT ALL ON wedding_borrow_selections TO authenticated;
GRANT ALL ON wedding_borrow_selections TO service_role;
