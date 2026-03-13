-- Wedding website feature migration
-- Run this in Supabase SQL editor
SET search_path TO public;

-- 1. Partner names on the weddings table (core identity, not website-only)
ALTER TABLE weddings
  ADD COLUMN IF NOT EXISTS partner1_name TEXT,
  ADD COLUMN IF NOT EXISTS partner2_name TEXT;

-- 2. Unified photo library
CREATE TABLE IF NOT EXISTS wedding_photos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id    UUID REFERENCES weddings(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  storage_path  TEXT,           -- kept for deletion from Supabase Storage
  tags          TEXT[] DEFAULT '{}',
  caption       TEXT,
  sort_order    INTEGER DEFAULT 0,
  uploaded_by   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wedding_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON wedding_photos FOR ALL TO service_role USING (true);

-- 3. Wedding party — free-text roles, no gender assumptions
CREATE TABLE IF NOT EXISTS wedding_party (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id         UUID REFERENCES weddings(id) ON DELETE CASCADE,
  guest_id           UUID REFERENCES guests(id) ON DELETE SET NULL,  -- optional link
  name               TEXT NOT NULL,       -- display name
  role               TEXT NOT NULL,       -- free text: "Honour Attendant", "Best Person", etc.
  group_label        TEXT,                -- replaces "side" — uses partner names or custom label
  blurb              TEXT,                -- short description shown on website
  photo_tags         TEXT[],              -- which photo tags to pull their portrait from
  include_on_website BOOLEAN DEFAULT true,
  sort_order         INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wedding_party ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON wedding_party FOR ALL TO service_role USING (true);

-- 4. Website settings & content
CREATE TABLE IF NOT EXISTS wedding_website_settings (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id           UUID REFERENCES weddings(id) ON DELETE CASCADE UNIQUE,
  slug                 TEXT UNIQUE,         -- public URL: /w/slug
  published            BOOLEAN DEFAULT false,
  welcome_message      TEXT,
  our_story            TEXT,
  dress_code           TEXT,                -- "black_tie","cocktail","garden","casual","custom"
  dress_code_note      TEXT,                -- "avoid stilettos on the lawn" etc.
  ceremony_time        TIME,
  reception_time       TIME,
  registry_links       JSONB DEFAULT '[]',  -- [{label, url}]
  unplugged_ceremony   BOOLEAN DEFAULT false,
  kids_policy          TEXT,
  plus_one_policy      TEXT,
  signature_cocktail   TEXT,
  faq_items            JSONB DEFAULT '[]',  -- [{question, answer}]
  -- Section visibility toggles
  show_story           BOOLEAN DEFAULT true,
  show_wedding_party   BOOLEAN DEFAULT true,
  show_dress_code      BOOLEAN DEFAULT true,
  show_schedule        BOOLEAN DEFAULT true,
  show_transport       BOOLEAN DEFAULT true,
  show_accommodations  BOOLEAN DEFAULT true,
  show_registry        BOOLEAN DEFAULT true,
  show_faq             BOOLEAN DEFAULT true,
  show_gallery         BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wedding_website_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON wedding_website_settings FOR ALL TO service_role USING (true);
