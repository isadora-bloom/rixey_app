-- Manor brand assets — downloadable files (logos, sketches, etc.)
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.manor_assets (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT    NOT NULL,
  description TEXT,
  storage_path TEXT   NOT NULL,
  file_name   TEXT    NOT NULL,
  mime_type   TEXT    DEFAULT 'image/png',
  sort_order  INT     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.manor_assets ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public download page)
CREATE POLICY "Public read manor_assets"
  ON public.manor_assets FOR SELECT USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role manage manor_assets"
  ON public.manor_assets FOR ALL USING (auth.role() = 'service_role');
