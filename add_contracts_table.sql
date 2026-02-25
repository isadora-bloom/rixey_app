-- Create the contracts table for storing uploaded vendor contracts
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT,
  extracted_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by wedding
CREATE INDEX IF NOT EXISTS contracts_wedding_id_idx ON contracts(wedding_id);

-- Also make sure the vendor-contracts storage bucket exists.
-- If it doesn't, go to Supabase Dashboard > Storage > New bucket:
--   Name: vendor-contracts
--   Public: false (private)
--   File size limit: 10MB
--   Allowed MIME types: application/pdf, image/jpeg, image/png, image/webp
