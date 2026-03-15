-- Bar planner notes (one JSON blob per wedding, keyed by tab)
-- Run in Supabase SQL editor

ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS bar_notes JSONB DEFAULT '{}'::jsonb;
