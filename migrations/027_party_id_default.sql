-- Make party_id look after itself.
--
-- Migration 025 added party_id NOT NULL and backfilled every existing row. What
-- it did not do was give new rows a way to fill it in, and a column cannot
-- default to the row's own id. So from the moment 025 ran, every attempt to add
-- a guest failed:
--
--   null value in column "party_id" of relation "wedding_guests"
--   violates not-null constraint
--
-- Adding a guest and importing a CSV were both broken, and the venue found out
-- by trying to add a guest. The endpoints now set it explicitly, but that only
-- covers the two paths somebody remembered. A trigger covers the seed scripts,
-- the test fixtures, anything written straight against the table in the SQL
-- editor, and whatever gets added next.
--
-- A guest with no party is the head of their own: that is what a party of one
-- is. A plus one is inserted with its host's party_id already set, and the
-- trigger leaves anything non-null alone.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

CREATE OR REPLACE FUNCTION public.wedding_guests_default_party()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.party_id IS NULL THEN
    NEW.party_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wedding_guests_default_party_trg ON public.wedding_guests;
CREATE TRIGGER wedding_guests_default_party_trg
  BEFORE INSERT ON public.wedding_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.wedding_guests_default_party();

COMMENT ON FUNCTION public.wedding_guests_default_party() IS
  'Fills party_id with the row''s own id when nothing set it, because a column cannot default to its own id and 025 made it NOT NULL. Without this, inserting a guest fails.';
