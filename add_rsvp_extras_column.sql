-- Add rsvp_extras JSONB column for custom RSVP form fields
-- (song requests, accessibility needs, hotel pref, shuttle pref, custom questions, etc.)
-- Run in Supabase SQL Editor
ALTER TABLE wedding_guests ADD COLUMN IF NOT EXISTS rsvp_extras JSONB DEFAULT '{}';
