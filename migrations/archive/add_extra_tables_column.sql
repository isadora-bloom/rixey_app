-- Add missing columns to wedding_tables
-- Run in Supabase SQL Editor

ALTER TABLE public.wedding_tables
  ADD COLUMN IF NOT EXISTS extra_tables JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;
