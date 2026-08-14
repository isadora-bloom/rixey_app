-- Day-of media: the table the feature has always needed and never had.
--
-- Same story as section_finalisations. add_day_of_media.sql has sat unrun in
-- the repo root while server/index.js reads and writes day_of_media from three
-- endpoints and the Day-of Memories page consumes them. The table is not in
-- the database, so every upload of a wedding-day photo or video message has
-- failed and every gallery has been empty.
--
-- Found by scripts/audit-schema-usage.mjs, which checks every table and column
-- the code asks for against the live schema. Worth running before believing
-- any feature works.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

-- 1. Metadata table
CREATE TABLE IF NOT EXISTS day_of_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('video_message', 'media')),
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_day_of_media_wedding ON day_of_media(wedding_id);
CREATE INDEX IF NOT EXISTS idx_day_of_media_category ON day_of_media(wedding_id, category, sort_order);

-- 2. RLS: service role only (backend writes/reads; no direct client access)
ALTER TABLE day_of_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON day_of_media FOR ALL TO service_role USING (true);

-- 3. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('day-of-media', 'day-of-media', true)
ON CONFLICT (id) DO NOTHING;
