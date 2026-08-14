-- Section finalisation: the table the feature has always needed and never had.
--
-- add_section_finalisations.sql has sat in the repo root, unrun, while the
-- server queried section_finalisations from two endpoints and three frontend
-- files consumed the result. The table does not exist in the database, so
-- every read has returned a PostgREST error and every write has failed.
--
-- The whole "mark this section as finalised" feature — the tick a couple gives
-- a section, the matching one from the venue, the FINALISABLE list in
-- DashboardNav and the SectionFinaliser component — has therefore never
-- worked for anyone.
--
-- Moved into migrations/ with a number so it is actually run, rather than
-- being one of fifty loose add_*.sql files in the root that nobody can tell
-- apart from the ones already applied.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

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
