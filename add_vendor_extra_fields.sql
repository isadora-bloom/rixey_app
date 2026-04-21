-- Add missing vendor fields to match the Google Sheets planning document
-- Run in Supabase SQL Editor
ALTER TABLE vendor_checklist ADD COLUMN IF NOT EXISTS arrival_time TEXT;
ALTER TABLE vendor_checklist ADD COLUMN IF NOT EXISTS departure_time TEXT;
ALTER TABLE vendor_checklist ADD COLUMN IF NOT EXISTS worked_here_before BOOLEAN;
ALTER TABLE vendor_checklist ADD COLUMN IF NOT EXISTS instagram TEXT;
