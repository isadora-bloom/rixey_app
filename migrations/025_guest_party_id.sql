-- One row per person, joined by party_id.
--
-- A wedding_guests row has always been a PARTY, not a person. The plus one is
-- four columns on the host's row — plus_one_name, plus_one_rsvp,
-- plus_one_meal_choice, plus_one_dietary — with no id of their own. Every
-- surface that needed a headcount had to remember to flatten, and most of them
-- forgot at least once: seven of eleven weddings once had summary buckets that
-- did not sum to their own total.
--
-- What a plus one still cannot have, which is the real cost:
--
--   an email, a phone number, an address, a table, a tag, or a note. 363
--   parties hold a phone number and 352 hold tags, and none of that can attach
--   to the 307 people who are somebody's plus one.
--
-- And 538 rows carry plus_one_rsvp = 'pending' for a plus one who does not
-- exist, because the column has a default and no plus one to belong to.
--
-- This migration is additive on purpose. It adds the columns and points every
-- existing row at itself as its own party. It does NOT create the plus-one
-- person rows: that needs the placeholder rules in shared/guest-names.js, and a
-- second copy of those rules written in SQL would drift from the first. The
-- rows are created by scripts/migrate-plus-ones-to-people.mjs, which imports
-- them.
--
-- Nothing is dropped. plus_one_* stay exactly as they are until the read
-- surfaces have moved over, so this migration cannot break a running app.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

ALTER TABLE public.wedding_guests
  ADD COLUMN IF NOT EXISTS party_id uuid,
  ADD COLUMN IF NOT EXISTS is_plus_one boolean NOT NULL DEFAULT false,
  -- Who this person is a plus one OF, for display: "Guest of Sarah Alexander".
  -- Derivable from party_id, kept because the head of a party is not otherwise
  -- distinguishable from its only member.
  ADD COLUMN IF NOT EXISTS plus_one_of uuid REFERENCES public.wedding_guests(id) ON DELETE CASCADE;

-- Every existing row is the head of its own party.
UPDATE public.wedding_guests SET party_id = id WHERE party_id IS NULL;

ALTER TABLE public.wedding_guests ALTER COLUMN party_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS wedding_guests_party_idx
  ON public.wedding_guests (party_id);
CREATE INDEX IF NOT EXISTS wedding_guests_wedding_person_idx
  ON public.wedding_guests (wedding_id, is_plus_one);

-- A plus one must say whose. A party head must not.
ALTER TABLE public.wedding_guests DROP CONSTRAINT IF EXISTS wedding_guests_plus_one_shape;
ALTER TABLE public.wedding_guests ADD CONSTRAINT wedding_guests_plus_one_shape
  CHECK (
    (is_plus_one = false AND plus_one_of IS NULL)
    OR
    (is_plus_one = true AND plus_one_of IS NOT NULL)
  );

COMMENT ON COLUMN public.wedding_guests.party_id IS
  'The party this person belongs to. A party head points at itself. Two people at the same wedding with the same party_id arrived together.';
COMMENT ON COLUMN public.wedding_guests.is_plus_one IS
  'True when this row is somebody''s plus one rather than an invited guest in their own right. A plus one with no first_name is one the couple granted but has not named — they count, they are not named, and they display as "Guest".';
COMMENT ON COLUMN public.wedding_guests.plus_one_of IS
  'The guest who was granted this plus one. Their surname is inherited on read when this row has none; it is never written, so correcting the host corrects them.';
