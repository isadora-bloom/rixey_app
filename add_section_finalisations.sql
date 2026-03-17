-- Section finalisation tracking
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS section_finalisations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  couple_finalised BOOLEAN DEFAULT FALSE,
  couple_finalised_at TIMESTAMPTZ,
  staff_finalised BOOLEAN DEFAULT FALSE,
  staff_finalised_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wedding_id, section)
);

CREATE INDEX IF NOT EXISTS idx_section_finalisations_wedding ON section_finalisations(wedding_id);

ALTER TABLE section_finalisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view finalisations for their wedding" ON section_finalisations
  FOR SELECT USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can upsert finalisations for their wedding" ON section_finalisations
  FOR INSERT WITH CHECK (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update finalisations for their wedding" ON section_finalisations
  FOR UPDATE USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
