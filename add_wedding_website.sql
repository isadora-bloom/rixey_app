-- Wedding website feature migration
-- Run this in Supabase SQL editor

-- 1. Partner names on the weddings table (core identity, not website-only)
ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS partner1_name TEXT,
  ADD COLUMN IF NOT EXISTS partner2_name TEXT;

-- 2. Unified photo library
CREATE TABLE IF NOT EXISTS public.wedding_photos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id    UUID REFERENCES public.weddings(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  storage_path  TEXT,
  tags          TEXT[] DEFAULT '{}',
  caption       TEXT,
  sort_order    INTEGER DEFAULT 0,
  uploaded_by   UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wedding_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.wedding_photos FOR ALL TO service_role USING (true);

-- 3. Wedding party
CREATE TABLE IF NOT EXISTS public.wedding_party (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id         UUID REFERENCES public.weddings(id) ON DELETE CASCADE,
  guest_id           UUID REFERENCES public.wedding_guests(id) ON DELETE SET NULL,
  member_name        TEXT NOT NULL,
  role               TEXT NOT NULL,
  group_label        TEXT,
  blurb              TEXT,
  include_on_website BOOLEAN DEFAULT true,
  sort_order         INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wedding_party ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.wedding_party FOR ALL TO service_role USING (true);

-- 4. Website settings & content
CREATE TABLE IF NOT EXISTS public.wedding_website_settings (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_id           UUID REFERENCES public.weddings(id) ON DELETE CASCADE UNIQUE,
  slug                 TEXT UNIQUE,
  published            BOOLEAN DEFAULT false,
  welcome_message      TEXT,
  our_story            TEXT,
  dress_code           TEXT,
  dress_code_note      TEXT,
  ceremony_time        TIME,
  reception_time       TIME,
  registry_links       JSONB DEFAULT '[]',
  unplugged_ceremony   BOOLEAN DEFAULT false,
  kids_policy          TEXT,
  plus_one_policy      TEXT,
  signature_cocktail   TEXT,
  faq_items            JSONB DEFAULT '[]',
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

ALTER TABLE public.wedding_website_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.wedding_website_settings FOR ALL TO service_role USING (true);
