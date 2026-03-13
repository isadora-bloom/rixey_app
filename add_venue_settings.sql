-- Venue settings — all hardcoded venue info lives here
-- Single row for now; ready for multi-tenant later
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.venue_settings (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_name          TEXT NOT NULL DEFAULT 'Rixey Manor',
  tagline             TEXT,
  address_line1       TEXT,
  address_line2       TEXT,
  google_maps_url     TEXT,
  parking_note        TEXT,
  arrival_note        TEXT,
  cell_service_note   TEXT,
  venue_description   TEXT,
  website_url         TEXT,
  logo_url            TEXT,
  footer_credit       TEXT DEFAULT 'Hosted by Rixey Manor',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.venue_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.venue_settings FOR ALL TO service_role USING (true);

-- Seed with Rixey Manor defaults
INSERT INTO public.venue_settings (
  venue_name, tagline, address_line1, address_line2, google_maps_url,
  parking_note, arrival_note, cell_service_note, venue_description,
  website_url, logo_url, footer_credit
) VALUES (
  'Rixey Manor',
  'Set on 38 acres in the Blue Ridge foothills',
  '6359 Rapidan Rd',
  'Leon, VA 22725',
  'https://maps.google.com/?q=6359+Rapidan+Rd+Leon+VA+22725',
  'Free parking on site. Follow signs from the entrance.',
  'The roads leading in are country roads — allow a little extra time.',
  'Signal can be patchy. Download offline maps before you arrive.',
  'Rixey Manor sits on 38 acres in the Blue Ridge foothills of Virginia.',
  'https://rixeymanor.com',
  null,
  'Hosted by Rixey Manor'
)
ON CONFLICT DO NOTHING;
