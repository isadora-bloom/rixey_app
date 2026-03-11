-- Activity Log Table for tracking client actions
-- Run this in Supabase SQL Editor

-- Create activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  activity_type TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for fast lookups by wedding
CREATE INDEX IF NOT EXISTS idx_activity_log_wedding ON activity_log(wedding_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);

-- Add last_activity columns to weddings table
ALTER TABLE weddings
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_activity_type TEXT;

-- Create index for sorting by last activity
CREATE INDEX IF NOT EXISTS idx_weddings_last_activity ON weddings(last_activity DESC);

-- Grant permissions
GRANT ALL ON activity_log TO authenticated;
GRANT ALL ON activity_log TO service_role;
