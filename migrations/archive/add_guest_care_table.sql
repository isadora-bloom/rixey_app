-- Guest care notes per wedding
-- Filled out by clients, visible and editable by admin
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS wedding_guest_care (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID UNIQUE NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_care_wedding
  ON wedding_guest_care(wedding_id);

ALTER TABLE wedding_guest_care ENABLE ROW LEVEL SECURITY;

-- Clients can read and write their own wedding's guest care data
CREATE POLICY "Clients can manage their guest care notes"
  ON wedding_guest_care FOR ALL
  USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );
