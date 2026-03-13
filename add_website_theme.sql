-- Add theme column to wedding_website_settings
-- Run in Supabase SQL editor

ALTER TABLE public.wedding_website_settings
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'warm';
