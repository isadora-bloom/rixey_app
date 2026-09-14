-- Internal admin notes per wedding
-- Only accessible via service role (backend) — clients never see these
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS wedding_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_notes_wedding
  ON wedding_internal_notes(wedding_id, created_at DESC);

-- RLS: enable but no client-accessible policies
-- The backend uses the service role key which bypasses RLS entirely
-- Clients have no way to query this table
ALTER TABLE wedding_internal_notes ENABLE ROW LEVEL SECURITY;
