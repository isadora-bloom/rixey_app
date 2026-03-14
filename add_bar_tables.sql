-- Bar planning tables
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.bar_shopping_list (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    UUID NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  item_name     TEXT NOT NULL,
  quantity      NUMERIC,
  unit          TEXT,
  category      TEXT DEFAULT 'other', -- beer, wine, spirits, mixers, garnish, other
  checked       BOOLEAN DEFAULT false,
  notes         TEXT,
  from_calculator BOOLEAN DEFAULT false,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bar_recipes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    UUID NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  source_type   TEXT DEFAULT 'url', -- url, upload, manual
  source_url    TEXT,
  ingredients   JSONB DEFAULT '[]', -- [{name, quantity, unit, per_serving}]
  servings_basis INT DEFAULT 1,     -- ingredient quantities are per this many servings
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
