-- Guest Management Tables
-- Run in Supabase SQL Editor

-- Add plated_meal setting to weddings table
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS plated_meal BOOLEAN DEFAULT false;

-- Main guest records
CREATE TABLE IF NOT EXISTS wedding_guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  rsvp TEXT DEFAULT 'pending',
  dietary_restrictions TEXT,
  meal_choice TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  -- Plus one fields
  plus_one_name TEXT,
  plus_one_rsvp TEXT DEFAULT 'pending',
  plus_one_meal_choice TEXT,
  plus_one_dietary TEXT,
  -- Table assignment (populated by table canvas in phase 2)
  table_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tag options per wedding (couple-defined, up to ~8)
CREATE TABLE IF NOT EXISTS guest_tag_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#9CA3AF',
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal options per wedding (used only when plated_meal = true)
CREATE TABLE IF NOT EXISTS guest_meal_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wedding_guests_wedding ON wedding_guests(wedding_id);
CREATE INDEX IF NOT EXISTS idx_guest_tag_options_wedding ON guest_tag_options(wedding_id);
CREATE INDEX IF NOT EXISTS idx_guest_meal_options_wedding ON guest_meal_options(wedding_id);

-- RLS
ALTER TABLE wedding_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_tag_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_meal_options ENABLE ROW LEVEL SECURITY;

-- Policies: wedding_guests
CREATE POLICY "Users can view guests for their wedding" ON wedding_guests
  FOR SELECT USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert guests for their wedding" ON wedding_guests
  FOR INSERT WITH CHECK (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update guests for their wedding" ON wedding_guests
  FOR UPDATE USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete guests for their wedding" ON wedding_guests
  FOR DELETE USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));

-- Policies: guest_tag_options
CREATE POLICY "Users can view tag options for their wedding" ON guest_tag_options
  FOR SELECT USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert tag options for their wedding" ON guest_tag_options
  FOR INSERT WITH CHECK (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update tag options for their wedding" ON guest_tag_options
  FOR UPDATE USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete tag options for their wedding" ON guest_tag_options
  FOR DELETE USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));

-- Policies: guest_meal_options
CREATE POLICY "Users can view meal options for their wedding" ON guest_meal_options
  FOR SELECT USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert meal options for their wedding" ON guest_meal_options
  FOR INSERT WITH CHECK (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update meal options for their wedding" ON guest_meal_options
  FOR UPDATE USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete meal options for their wedding" ON guest_meal_options
  FOR DELETE USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
