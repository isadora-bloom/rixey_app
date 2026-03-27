-- Ensure ALL wedding_website_settings columns exist
-- Combines add_website_theme.sql + add_rsvp_settings.sql + 004_website_new_columns.sql
-- Safe to re-run

ALTER TABLE public.wedding_website_settings
  ADD COLUMN IF NOT EXISTS theme            TEXT DEFAULT 'warm',
  ADD COLUMN IF NOT EXISTS show_rsvp        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rsvp_deadline    DATE,
  ADD COLUMN IF NOT EXISTS rsvp_note        TEXT,
  ADD COLUMN IF NOT EXISTS accent_color     TEXT,
  ADD COLUMN IF NOT EXISTS font_pair        TEXT DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS hero_pretext     TEXT,
  ADD COLUMN IF NOT EXISTS the_proposal     TEXT,
  ADD COLUMN IF NOT EXISTS things_to_do     JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS footer_message   TEXT,
  ADD COLUMN IF NOT EXISTS section_order    JSONB,
  ADD COLUMN IF NOT EXISTS access_password  TEXT,
  ADD COLUMN IF NOT EXISTS show_things_to_do BOOLEAN DEFAULT false;
