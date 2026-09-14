-- Add vendor self-management fields to vendors table
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS facebook TEXT,
  ADD COLUMN IF NOT EXISTS special_offer TEXT,
  ADD COLUMN IF NOT EXISTS special_expiry DATE,
  ADD COLUMN IF NOT EXISTS availability_note TEXT,
  ADD COLUMN IF NOT EXISTS edit_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_vendor_update TIMESTAMPTZ;

-- Backfill tokens for any existing vendors
UPDATE vendors SET edit_token = gen_random_uuid() WHERE edit_token IS NULL;

-- Unique index so token lookups are fast
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_edit_token ON vendors(edit_token);
