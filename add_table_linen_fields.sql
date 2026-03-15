-- Extended linen + layout fields for wedding_tables
-- Run in Supabase SQL editor

ALTER TABLE public.wedding_tables
  ADD COLUMN IF NOT EXISTS linen_drop         TEXT DEFAULT 'floor',
  ADD COLUMN IF NOT EXISTS linen_venue_choice BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS runner_style       TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS chair_sash         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS chair_sash_color   TEXT,
  ADD COLUMN IF NOT EXISTS dance_floor_size   TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS lounge_area        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS head_table_placement TEXT,
  ADD COLUMN IF NOT EXISTS linen_notes        TEXT;
