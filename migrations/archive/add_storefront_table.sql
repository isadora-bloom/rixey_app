-- Rixey Picks: affiliate product recommendations
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS storefront_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,
  category TEXT NOT NULL,
  pick_name TEXT NOT NULL,
  pick_type TEXT,
  description TEXT,
  affiliate_link TEXT,
  image_url TEXT,
  color_options TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storefront_category ON storefront_items(category);
CREATE INDEX IF NOT EXISTS idx_storefront_active ON storefront_items(is_active);

-- No RLS needed — public read, backend writes via service role key
-- But enable RLS with a permissive read policy for safety
ALTER TABLE storefront_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active storefront items"
  ON storefront_items FOR SELECT
  USING (is_active = true);
