-- Day-of media: photos & videos captured on the wedding day, uploaded by the
-- venue (admin) for the couple to view/download after the event.
-- Category split: 'video_message' (short phone clips) vs 'media' (bulk gallery).

-- Run in Supabase SQL editor.

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
