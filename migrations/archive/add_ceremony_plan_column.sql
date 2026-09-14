-- Add ceremony_plan column to table_layouts
-- Run in Supabase SQL Editor
ALTER TABLE table_layouts ADD COLUMN IF NOT EXISTS ceremony_plan JSONB DEFAULT '{"rows": []}';
