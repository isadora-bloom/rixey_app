-- Wedding Timeline preferences
CREATE TABLE IF NOT EXISTS wedding_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL UNIQUE REFERENCES weddings(id) ON DELETE CASCADE,
  timeline_data JSONB DEFAULT '[]', -- Array of {event, time, duration, notes}
  ceremony_start TIME,
  reception_start TIME,
  reception_end TIME,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table/Seating preferences
CREATE TABLE IF NOT EXISTS wedding_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL UNIQUE REFERENCES weddings(id) ON DELETE CASCADE,
  guest_count INT,
  table_shape TEXT, -- 'round', 'rectangular', 'farm', 'mixed'
  guests_per_table INT DEFAULT 8,
  head_table BOOLEAN DEFAULT false,
  head_table_size INT,
  sweetheart_table BOOLEAN DEFAULT false,
  cocktail_tables INT DEFAULT 0,
  kids_table BOOLEAN DEFAULT false,
  kids_count INT DEFAULT 0,
  layout_notes TEXT,
  linen_color TEXT,
  napkin_color TEXT,
  table_numbers_style TEXT,
  centerpiece_notes TEXT,
  seating_data JSONB DEFAULT '[]', -- For future drag-drop seating chart
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wedding_timeline_wedding ON wedding_timeline(wedding_id);
CREATE INDEX idx_wedding_tables_wedding ON wedding_tables(wedding_id);

-- Enable RLS
ALTER TABLE wedding_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE wedding_tables ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wedding_timeline
CREATE POLICY "Users can view own timeline" ON wedding_timeline
  FOR SELECT USING (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert own timeline" ON wedding_timeline
  FOR INSERT WITH CHECK (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own timeline" ON wedding_timeline
  FOR UPDATE USING (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin full access timeline" ON wedding_timeline
  FOR ALL USING (true);

-- RLS Policies for wedding_tables
CREATE POLICY "Users can view own tables" ON wedding_tables
  FOR SELECT USING (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert own tables" ON wedding_tables
  FOR INSERT WITH CHECK (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own tables" ON wedding_tables
  FOR UPDATE USING (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin full access tables" ON wedding_tables
  FOR ALL USING (true);
