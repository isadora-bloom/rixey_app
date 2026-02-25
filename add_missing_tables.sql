-- =============================================================
-- RIXEY PORTAL: Missing Tables Migration
-- Run this in Supabase SQL Editor
-- All CREATE TABLE/INDEX use IF NOT EXISTS — safe to re-run.
-- Policies use exception blocks so re-running won't error.
-- =============================================================

-- ---------------------------------------------------------------
-- 1. BORROW CATALOG
-- Global item list (not per-wedding). Admin-managed.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS borrow_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_borrow_catalog_category ON borrow_catalog(category);

-- ---------------------------------------------------------------
-- 2. WEDDING BUDGET
-- One row per wedding, categories stored as JSONB.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wedding_budget (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL UNIQUE REFERENCES weddings(id) ON DELETE CASCADE,
  total_budget DECIMAL(10,2) DEFAULT 0,
  is_shared BOOLEAN DEFAULT false,
  categories JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wedding_budget_wedding ON wedding_budget(wedding_id);

ALTER TABLE wedding_budget ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own budget" ON wedding_budget
    FOR SELECT USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own budget" ON wedding_budget
    FOR UPDATE USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin full access budget" ON wedding_budget FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------
-- 3. WEDDING STAFFING
-- One row per wedding, staffing estimate + totals.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wedding_staffing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL UNIQUE REFERENCES weddings(id) ON DELETE CASCADE,
  answers JSONB DEFAULT '{}',
  friday_bartenders INT DEFAULT 0,
  friday_extra_hands INT DEFAULT 0,
  friday_total INT DEFAULT 0,
  saturday_bartenders INT DEFAULT 0,
  saturday_extra_hands INT DEFAULT 0,
  saturday_total INT DEFAULT 0,
  total_staff INT DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wedding_staffing_wedding ON wedding_staffing(wedding_id);

ALTER TABLE wedding_staffing ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own staffing" ON wedding_staffing
    FOR SELECT USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own staffing" ON wedding_staffing
    FOR UPDATE USING (wedding_id IN (SELECT wedding_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin full access staffing" ON wedding_staffing FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------
-- 4. PLANNING NOTES
-- Extracted from Sage conversations, contracts, emails, Zoom, etc.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planning_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'note',
  content TEXT NOT NULL,
  source_message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planning_notes_wedding ON planning_notes(wedding_id);
CREATE INDEX IF NOT EXISTS idx_planning_notes_category ON planning_notes(wedding_id, category);

ALTER TABLE planning_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin full access planning notes" ON planning_notes FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------
-- 5. SAGE CHAT MESSAGES
-- Conversation history between user and Sage.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'sage')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own messages" ON messages
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin full access messages" ON messages FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------
-- 6. GMAIL TOKENS  (single-row, replaced on re-auth)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry_date BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 7. PROCESSED EMAILS  (dedup — prevents double-processing)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id TEXT NOT NULL UNIQUE,
  wedding_id UUID REFERENCES weddings(id) ON DELETE SET NULL,
  from_email TEXT,
  subject TEXT,
  body_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_emails_msg_id ON processed_emails(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_processed_emails_wedding ON processed_emails(wedding_id);

-- ---------------------------------------------------------------
-- 8. PROCESSED QUO MESSAGES  (SMS/calls via OpenPhone/Quo)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_quo_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quo_message_id TEXT NOT NULL UNIQUE,
  wedding_id UUID REFERENCES weddings(id) ON DELETE SET NULL,
  phone_number TEXT,
  direction TEXT,
  body_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_quo_msg_id ON processed_quo_messages(quo_message_id);
CREATE INDEX IF NOT EXISTS idx_processed_quo_wedding ON processed_quo_messages(wedding_id);

-- ---------------------------------------------------------------
-- 9. ZOOM TOKENS  (single-row, replaced on re-auth)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zoom_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry_date BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 10. PROCESSED ZOOM MEETINGS  (dedup — prevents double-processing)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_zoom_meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zoom_meeting_id TEXT NOT NULL UNIQUE,
  wedding_id UUID REFERENCES weddings(id) ON DELETE SET NULL,
  meeting_topic TEXT,
  participant_names TEXT,
  transcript_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_zoom_meeting_id ON processed_zoom_meetings(zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_processed_zoom_wedding ON processed_zoom_meetings(wedding_id);

-- =============================================================
-- STORAGE BUCKETS
-- Create these manually in Supabase Dashboard > Storage
-- if they don't already exist:
--
--   vendor-contracts  private  10 MB  application/pdf, image/*
--   inspo-gallery     private   5 MB  image/*
--   couple-photos     private   5 MB  image/*
--   borrow-catalog    PUBLIC    5 MB  image/*   ← must be public (uses getPublicUrl)
-- =============================================================
