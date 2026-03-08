-- Wedding planning tables for Rixey Portal
-- Run this in Supabase SQL editor

-- 1. Wedding Details (one row per wedding, upserted)
CREATE TABLE IF NOT EXISTS wedding_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE UNIQUE,
  wedding_colors TEXT,
  partner1_social TEXT,
  partner2_social TEXT,
  ceremony_location TEXT DEFAULT 'outside',
  arbor_choice TEXT,
  unity_table BOOLEAN DEFAULT false,
  ceremony_notes TEXT,
  seating_method TEXT,
  providing_table_numbers BOOLEAN DEFAULT false,
  providing_charger_plates BOOLEAN DEFAULT false,
  providing_champagne_glasses BOOLEAN DEFAULT false,
  providing_cake_cutter BOOLEAN DEFAULT false,
  providing_cake_topper BOOLEAN DEFAULT false,
  favors_description TEXT,
  reception_notes TEXT,
  send_off_type TEXT,
  send_off_notes TEXT,
  dogs_coming BOOLEAN DEFAULT false,
  dogs_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Allergy Registry (multiple rows per wedding)
CREATE TABLE IF NOT EXISTS allergy_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  allergy TEXT NOT NULL,
  severity TEXT DEFAULT 'moderate',
  caterer_alerted BOOLEAN DEFAULT false,
  staying_overnight BOOLEAN DEFAULT false,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bedroom Assignments
CREATE TABLE IF NOT EXISTS bedroom_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  room_description TEXT,
  guest_friday TEXT,
  guest_saturday TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 4. Ceremony Order
CREATE TABLE IF NOT EXISTS ceremony_order (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
  section TEXT DEFAULT 'processional', -- 'processional', 'family_escort', 'recessional'
  side TEXT DEFAULT 'center',           -- 'brides_side', 'grooms_side', 'center', 'family'
  participant_name TEXT,
  role TEXT,
  walk_with TEXT,
  sort_order INTEGER DEFAULT 0,
  notes TEXT
);

-- 5. Decor Inventory
CREATE TABLE IF NOT EXISTS decor_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
  space_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  source TEXT DEFAULT 'bringing it',
  goes_home_with TEXT,
  leaving_it BOOLEAN DEFAULT false,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 6. Makeup Schedule
CREATE TABLE IF NOT EXISTS makeup_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  role TEXT,
  hair_start_time TEXT,
  makeup_start_time TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 7. Shuttle Schedule
CREATE TABLE IF NOT EXISTS shuttle_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
  run_label TEXT,
  pickup_location TEXT,
  pickup_time TEXT,
  dropoff_location TEXT,
  dropoff_time TEXT,
  seat_count INTEGER,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 8. Rehearsal Dinner (one row per wedding, upserted)
CREATE TABLE IF NOT EXISTS rehearsal_dinner (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE UNIQUE,
  bar_type TEXT,
  location TEXT,
  location_notes TEXT,
  food_type TEXT,
  food_notes TEXT,
  high_chairs_needed BOOLEAN DEFAULT false,
  high_chairs_count INTEGER DEFAULT 0,
  seating_type TEXT DEFAULT 'open',
  linens_source TEXT,
  decor_source TEXT,
  using_disposables BOOLEAN DEFAULT false,
  renting_china BOOLEAN DEFAULT false,
  renting_flatware BOOLEAN DEFAULT false,
  table_layout TEXT,
  guest_count INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: enable and allow authenticated users to manage their own wedding data
ALTER TABLE wedding_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergy_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE bedroom_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceremony_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE decor_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE makeup_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE shuttle_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsal_dinner ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS so the backend can read/write everything
-- Couple can read/write their own wedding's data via their profile link
CREATE POLICY "service_role_all" ON wedding_details FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON allergy_registry FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON bedroom_assignments FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON ceremony_order FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON decor_inventory FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON makeup_schedule FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON shuttle_schedule FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON rehearsal_dinner FOR ALL TO service_role USING (true);
