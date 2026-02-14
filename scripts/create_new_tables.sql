-- Rixey Portal: New Feature Tables
-- Run this in Supabase SQL Editor

-- Vendor Checklist
CREATE TABLE IF NOT EXISTS vendor_checklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  vendor_type TEXT NOT NULL,
  vendor_name TEXT,
  vendor_contact TEXT,
  contract_uploaded BOOLEAN DEFAULT false,
  contract_url TEXT,
  contract_date DATE,
  notes TEXT,
  is_booked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspo Gallery (max 20 images per wedding enforced at API level)
CREATE TABLE IF NOT EXISTS inspo_gallery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INT DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Couple Photo (one per wedding, enforced by UNIQUE constraint)
CREATE TABLE IF NOT EXISTS couple_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL UNIQUE REFERENCES weddings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planning Checklist
CREATE TABLE IF NOT EXISTS planning_checklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  task_text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  completed_via TEXT, -- 'manual' or 'sage'
  category TEXT,
  due_date DATE,
  display_order INT DEFAULT 0,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vendor_checklist_wedding ON vendor_checklist(wedding_id);
CREATE INDEX IF NOT EXISTS idx_inspo_gallery_wedding ON inspo_gallery(wedding_id);
CREATE INDEX IF NOT EXISTS idx_planning_checklist_wedding ON planning_checklist(wedding_id);
CREATE INDEX IF NOT EXISTS idx_planning_checklist_category ON planning_checklist(wedding_id, category);

-- Enable Row Level Security (RLS)
ALTER TABLE vendor_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspo_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_checklist ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendor_checklist
-- Users can view/modify vendors for their own wedding
CREATE POLICY "Users can view vendors for their wedding" ON vendor_checklist
  FOR SELECT USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert vendors for their wedding" ON vendor_checklist
  FOR INSERT WITH CHECK (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update vendors for their wedding" ON vendor_checklist
  FOR UPDATE USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete vendors for their wedding" ON vendor_checklist
  FOR DELETE USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for inspo_gallery
CREATE POLICY "Users can view inspo for their wedding" ON inspo_gallery
  FOR SELECT USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert inspo for their wedding" ON inspo_gallery
  FOR INSERT WITH CHECK (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update inspo for their wedding" ON inspo_gallery
  FOR UPDATE USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete inspo for their wedding" ON inspo_gallery
  FOR DELETE USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for couple_photos
CREATE POLICY "Users can view couple photo for their wedding" ON couple_photos
  FOR SELECT USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert couple photo for their wedding" ON couple_photos
  FOR INSERT WITH CHECK (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update couple photo for their wedding" ON couple_photos
  FOR UPDATE USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete couple photo for their wedding" ON couple_photos
  FOR DELETE USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for planning_checklist
CREATE POLICY "Users can view checklist for their wedding" ON planning_checklist
  FOR SELECT USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert checklist for their wedding" ON planning_checklist
  FOR INSERT WITH CHECK (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update checklist for their wedding" ON planning_checklist
  FOR UPDATE USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete checklist for their wedding" ON planning_checklist
  FOR DELETE USING (
    wedding_id IN (
      SELECT wedding_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Note: Storage buckets (vendor-contracts, inspo-gallery, couple-photos)
-- need to be created manually in Supabase Dashboard > Storage
-- Settings:
--   vendor-contracts: Private, 10MB limit, accept application/pdf,image/*
--   inspo-gallery: Private, 5MB limit, accept image/*
--   couple-photos: Private, 5MB limit, accept image/*
