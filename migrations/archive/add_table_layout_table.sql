-- Table layout for canvas (one per wedding for now)
CREATE TABLE IF NOT EXISTS table_layouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL UNIQUE REFERENCES weddings(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Reception Layout',
  elements JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_layouts_wedding ON table_layouts(wedding_id);

ALTER TABLE table_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view layout for their wedding" ON table_layouts
  FOR SELECT USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert layout for their wedding" ON table_layouts
  FOR INSERT WITH CHECK (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update layout for their wedding" ON table_layouts
  FOR UPDATE USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
