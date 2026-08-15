-- People the venue is meeting who do not have a wedding yet.
--
-- Everything in this system hangs off wedding_id. Emails, texts, Zoom calls,
-- planning notes, recordings — all of it keys on a wedding, which is fine right
-- up until the most commercially important conversation of the lot: the tour,
-- where somebody decides whether to book at all.
--
-- Today that conversation happens with nothing in front of you. Calendly holds
-- the booking, the enquiry sits in Gmail, and there is nowhere to write down
-- what was said. Sixteen upcoming meetings and the portal knows about none of
-- them.
--
-- ## What an enquiry is
--
-- A person, before they are a wedding. It carries what Calendly already
-- collects — both partners, phone, the date they are hoping for, guest numbers,
-- where they heard about Rixey — and every answer verbatim in `answers`,
-- because the form changes and a column per question would rot.
--
-- When they book, `wedding_id` is filled in and the enquiry stays. It is the
-- record of how that couple arrived, which is otherwise lost the moment the
-- wedding exists.
--
-- ## Why the recorder changes shape here
--
-- walkthroughs already does record → transcribe → organise → file, and it works.
-- Rather than build that twice, wedding_id becomes nullable and an enquiry_id
-- appears beside it. A tour is recorded by exactly the same code as a final
-- walkthrough. The parser's suggestions have nowhere to go until they book, so
-- for an enquiry they stay on the enquiry until conversion carries them over.
--
-- The CHECK is what stops a recording belonging to nobody, which is the state
-- this whole system keeps finding itself in.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

CREATE TABLE IF NOT EXISTS public.enquiries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who booked. Their partner is just as real, and Calendly asks for them.
  name               text NOT NULL,
  email              text,
  phone              text,
  partner_name       text,
  partner_email      text,

  source             text NOT NULL DEFAULT 'calendly',   -- calendly | manual | email
  calendly_event_uri text,
  meeting_kind       text,          -- "Rixey Manor Venue Tour", "1hr Planning Meeting", …
  meeting_at         timestamptz,
  meeting_location   text,

  -- What they told the booking form. Kept as columns where we ask every time,
  -- and whole in `answers` because the questions change.
  preferred_date     text,
  guest_estimate     text,
  heard_about        text,
  -- The two questions that decide how a tour should be run: which package they
  -- came in wanting, and whether they have already priced it up themselves.
  package_interest   text,
  used_calculator    text,
  answers            jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- upcoming → met → booked or lost. Nothing is deleted: a couple who did not
  -- book is the most useful record there is for working out why.
  status             text NOT NULL DEFAULT 'upcoming',
  outcome_notes      text,

  -- Filled in when they book. The enquiry stays either way.
  wedding_id         uuid REFERENCES public.weddings(id) ON DELETE SET NULL,
  converted_at       timestamptz,

  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- One row per Calendly booking. The sync runs repeatedly and must update rather
-- than pile up duplicates, so this is what it conflicts on.
CREATE UNIQUE INDEX IF NOT EXISTS enquiries_calendly_event_idx
  ON public.enquiries (calendly_event_uri) WHERE calendly_event_uri IS NOT NULL;

CREATE INDEX IF NOT EXISTS enquiries_meeting_at_idx ON public.enquiries (meeting_at);
CREATE INDEX IF NOT EXISTS enquiries_status_idx ON public.enquiries (status);
CREATE INDEX IF NOT EXISTS enquiries_email_idx ON public.enquiries (lower(email));

COMMENT ON TABLE public.enquiries IS
  'A person before they are a wedding. Tours and first calls, which had nowhere to live because every other table keys on wedding_id.';
COMMENT ON COLUMN public.enquiries.answers IS
  'Every Calendly question and answer verbatim. The booking form changes; a column per question would rot.';
COMMENT ON COLUMN public.enquiries.wedding_id IS
  'Set when they book. The enquiry is kept afterwards as the record of how that couple arrived.';

-- ── Let the recorder belong to an enquiry instead of a wedding ──────────────

ALTER TABLE public.walkthroughs ALTER COLUMN wedding_id DROP NOT NULL;
ALTER TABLE public.walkthroughs
  ADD COLUMN IF NOT EXISTS enquiry_id uuid REFERENCES public.enquiries(id) ON DELETE CASCADE;

ALTER TABLE public.walkthrough_media ALTER COLUMN wedding_id DROP NOT NULL;
ALTER TABLE public.walkthrough_items ALTER COLUMN wedding_id DROP NOT NULL;

-- A recording that belongs to nobody is the failure this whole table exists to
-- prevent, so it is a constraint rather than a convention.
ALTER TABLE public.walkthroughs DROP CONSTRAINT IF EXISTS walkthroughs_belongs_to_someone;
ALTER TABLE public.walkthroughs ADD CONSTRAINT walkthroughs_belongs_to_someone
  CHECK (wedding_id IS NOT NULL OR enquiry_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS walkthroughs_enquiry_idx
  ON public.walkthroughs (enquiry_id, occurred_on DESC);

-- Venue-side only, same rule as 018 and 021: revoke first so a careless policy
-- later cannot re-open it. Reached only through the server's service-role key.
REVOKE ALL ON public.enquiries FROM anon;
REVOKE ALL ON public.enquiries FROM authenticated;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
