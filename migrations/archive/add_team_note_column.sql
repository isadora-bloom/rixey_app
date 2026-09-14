-- Allow admin to inject notes into a couple's Sage chat thread
-- Run in Supabase SQL Editor

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_team_note BOOLEAN DEFAULT false;
