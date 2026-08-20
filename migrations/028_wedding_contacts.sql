-- The people who ring and email about a wedding but are not marrying anyone.
--
-- Mothers and mothers-in-law are on the phone to Rixey constantly, and not one
-- word of it has ever reached the couple's file. The reason is narrow and
-- total: both syncs build their lookup from `profiles`, and a profile is a
-- portal login. Mum has no login, so her number maps to no wedding and her
-- address maps to no wedding, so OpenPhone and Gmail are never even asked about
-- her. Nothing failed. Nothing was logged. The call simply never existed as far
-- as the portal is concerned.
--
-- Two tables:
--
--   wedding_contacts   a person attached to a wedding who is not a user. Name,
--                      relationship, phone, email. No auth row, no portal
--                      access, nothing to manage. Filling this in is what makes
--                      their calls and emails file themselves from then on.
--   contact_messages   what they said. One row per call transcript or email,
--                      kept venue-side.
--
-- ## Why these are not planning_notes
--
-- planning_notes is read by the couple's Sage (server/index.js, /api/chat), so
-- anything written there can be quoted back to the couple. That is right for
-- their own calls and wrong for their mother's. The whole value of a call from
-- a mother-in-law is that she says things she would not say in front of them,
-- and "she's worried about the budget" surfacing in their chat window is a real
-- harm, not a tidy feature.
--
-- So a contact message is venue-only by default, and reaching the couple is a
-- deliberate act: shared_with_couple writes a planning note at the moment it is
-- ticked and records which note it wrote, so unticking takes it back out again
-- rather than leaving an orphan.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

CREATE TABLE IF NOT EXISTS public.wedding_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  name          text NOT NULL,
  -- Free text on purpose. "Bride's mother" covers most of it, but the useful
  -- ones are "Ellen's mum, does the flowers" and "stepmother, do not cc Dad",
  -- and a dropdown of six options would lose both.
  relationship  text,
  phone         text,
  -- The same number as `phone`, reduced to ten digits, because that is what
  -- matching compares. Written by the application (normalizePhone in
  -- shared/phone.js) rather than derived here, so there is exactly one
  -- definition of what normalising means.
  phone_digits  text,
  email         text,
  notes         text,
  -- Off for someone recorded for reference rather than ingestion: a vendor, a
  -- neighbour, an ex-planner. Their details stay known, so the unknown-caller
  -- sweep stops asking about them, but nothing gets imported.
  ingest_calls  boolean NOT NULL DEFAULT true,
  ingest_email  boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Real constraints rather than partial unique indexes, so ON CONFLICT can
  -- name them. Postgres treats NULLs as distinct, so contacts with no number or
  -- no address recorded do not collide with each other.
  CONSTRAINT wedding_contacts_wedding_phone_key UNIQUE (wedding_id, phone_digits),
  CONSTRAINT wedding_contacts_wedding_email_key UNIQUE (wedding_id, email)
);

-- Written to run against either state, because an earlier draft of this
-- migration was applied before it was finished: some databases already have
-- wedding_contacts without ingest_email, and a contact_calls table that was
-- superseded by contact_messages. A migration that only ran cleanly on an
-- untouched database would leave those halfway and say nothing.
ALTER TABLE public.wedding_contacts
  ADD COLUMN IF NOT EXISTS relationship  text,
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS phone_digits  text,
  ADD COLUMN IF NOT EXISTS email         text,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS ingest_calls  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ingest_email  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

-- The unique constraints, added separately so a re-run does not error on them.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wedding_contacts_wedding_phone_key') THEN
    ALTER TABLE public.wedding_contacts ADD CONSTRAINT wedding_contacts_wedding_phone_key UNIQUE (wedding_id, phone_digits);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wedding_contacts_wedding_email_key') THEN
    ALTER TABLE public.wedding_contacts ADD CONSTRAINT wedding_contacts_wedding_email_key UNIQUE (wedding_id, email);
  END IF;
END $$;

-- The lookups the syncs do: an address or a number in hand, whose is it.
-- Deliberately not unique across weddings — a planner or a family friend can
-- sit on two at once, and the sync sends an ambiguous match to review rather
-- than picking one.
CREATE INDEX IF NOT EXISTS wedding_contacts_digits_idx
  ON public.wedding_contacts (phone_digits) WHERE phone_digits IS NOT NULL;
CREATE INDEX IF NOT EXISTS wedding_contacts_email_idx
  ON public.wedding_contacts (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS wedding_contacts_wedding_idx
  ON public.wedding_contacts (wedding_id, name);

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id      uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  -- Null when it was filed by hand from the review queue and nobody chose to
  -- remember the number. The transcript is still worth keeping.
  contact_id      uuid REFERENCES public.wedding_contacts(id) ON DELETE SET NULL,
  kind            text NOT NULL DEFAULT 'call',   -- call | email
  -- OpenPhone's call id or Gmail's message id. Unique, and it is the whole
  -- dedup story for this table: run a sync twice and the second run inserts
  -- nothing.
  external_id     text NOT NULL UNIQUE,
  phone_number    text,
  email_address   text,
  -- Who this was, as understood at the time of import. A snapshot, not a join:
  -- renaming a contact later should not rewrite the history of a call.
  contact_name    text,
  direction       text NOT NULL DEFAULT 'inbound',
  occurred_at     timestamptz,
  duration_secs   integer,      -- calls only
  subject         text,         -- emails only
  body            text NOT NULL,
  -- A few lines of what it was about, so a list of fourteen calls can be read
  -- without opening fourteen calls. Venue-side like everything else here.
  summary         text,
  -- Venue-only until someone decides otherwise. See the header.
  shared_with_couple boolean NOT NULL DEFAULT false,
  shared_at       timestamptz,
  -- The planning note sharing created, so unsharing removes exactly that row
  -- instead of guessing by content.
  shared_note_id  uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_messages_kind_check CHECK (kind IN ('call', 'email')),
  CONSTRAINT contact_messages_direction_check CHECK (direction IN ('inbound', 'outbound'))
);

CREATE INDEX IF NOT EXISTS contact_messages_wedding_idx
  ON public.contact_messages (wedding_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_contact_idx
  ON public.contact_messages (contact_id, occurred_at DESC);

-- The superseded table from the earlier draft. Calls and emails share
-- contact_messages now, because they are the same question asked down two
-- different pipes. Dropped only when empty: if anything ever landed in it, it
-- stays and gets said out loud rather than being thrown away quietly.
DO $$
DECLARE
  leftover integer;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_calls') THEN
    EXECUTE 'SELECT count(*) FROM public.contact_calls' INTO leftover;
    IF leftover = 0 THEN
      DROP TABLE public.contact_calls;
      RAISE NOTICE 'dropped the empty contact_calls table, superseded by contact_messages';
    ELSE
      RAISE NOTICE 'contact_calls still holds % row(s), so it has been left in place. Move them into contact_messages by hand.', leftover;
    END IF;
  END IF;
END $$;

-- The review queue already exists for Zoom meetings and emails nobody could
-- place (migration 021). A call from an unrecognised number is the same
-- question, so it goes in the same list rather than growing a second one.
--
-- Two additions. `payload` carries the transcripts while the item waits, so
-- filing it later does not depend on OpenPhone still being reachable, still
-- holding the transcript, or the account still having transcription enabled.
-- `phone_number` is what the queue groups on: eleven calls from one number is
-- one question asked once, not eleven.
ALTER TABLE public.ingest_review
  ADD COLUMN IF NOT EXISTS payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS phone_number text;

CREATE INDEX IF NOT EXISTS ingest_review_phone_idx
  ON public.ingest_review (phone_number) WHERE phone_number IS NOT NULL;

COMMENT ON TABLE public.wedding_contacts IS
  'People attached to a wedding who are not portal users: mothers, mothers-in-law, planners. Their phone number and email are what let the Quo and Gmail syncs file their messages, which they otherwise cannot do at all.';
COMMENT ON COLUMN public.wedding_contacts.phone_digits IS
  'normalizePhone(phone) from shared/phone.js. Ten digits, no country code. Written by the application so normalising has one definition.';
COMMENT ON TABLE public.contact_messages IS
  'Calls and emails with someone who is not the couple. Venue-only unless shared_with_couple is set, because planning_notes is readable by the couple''s Sage and a mother-in-law does not talk on the assumption that it is.';
COMMENT ON COLUMN public.contact_messages.shared_note_id IS
  'The planning note written when this was shared. Kept so unsharing deletes that exact row rather than matching on content.';
COMMENT ON COLUMN public.ingest_review.payload IS
  'Everything needed to file the item without going back to the source. For a call that means the transcript itself: by the time someone answers the queue, the provider may no longer have it.';

-- Venue-side only, same as migration 021: revoke first, then RLS, so a careless
-- policy later cannot re-open them. The server reaches these with the
-- service-role key, which bypasses RLS and is unaffected.
REVOKE ALL ON public.wedding_contacts FROM anon;
REVOKE ALL ON public.wedding_contacts FROM authenticated;
ALTER TABLE public.wedding_contacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.contact_messages FROM anon;
REVOKE ALL ON public.contact_messages FROM authenticated;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
