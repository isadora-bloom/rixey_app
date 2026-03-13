-- Add RSVP fields to wedding website settings
-- Run in Supabase SQL editor

ALTER TABLE public.wedding_website_settings
  ADD COLUMN IF NOT EXISTS show_rsvp     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rsvp_deadline DATE,
  ADD COLUMN IF NOT EXISTS rsvp_note     TEXT;
