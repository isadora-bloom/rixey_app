-- Add new columns to wedding_website_settings for the website overhaul
-- Safe to re-run (uses IF NOT EXISTS)

ALTER TABLE public.wedding_website_settings
  ADD COLUMN IF NOT EXISTS accent_color     TEXT,
  ADD COLUMN IF NOT EXISTS font_pair        TEXT DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS hero_pretext     TEXT,
  ADD COLUMN IF NOT EXISTS the_proposal     TEXT,
  ADD COLUMN IF NOT EXISTS things_to_do     JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS footer_message   TEXT,
  ADD COLUMN IF NOT EXISTS section_order    JSONB,
  ADD COLUMN IF NOT EXISTS access_password  TEXT,
  ADD COLUMN IF NOT EXISTS show_things_to_do BOOLEAN DEFAULT false;
