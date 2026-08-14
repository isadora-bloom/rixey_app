-- Lock the weddings table, without breaking sign-up.
--
-- All 47 weddings were readable with the public anon key, including every
-- event_code — which is the credential someone types to join a wedding. Anyone
-- could list them and sign into any couple's portal.
--
-- This could not be done until the browser stopped reading the table before
-- sign-in. Two client queries did that: a date-availability check that
-- selected event_code and couple_names, and the event-code lookup itself. Both
-- now go through /api/join/* on the server (see the same commit), which
-- answers the question without handing back the rest of the row.
--
-- ## What stays working
--
-- Signed-in reads are permitted by policy rather than by code changes:
--   Dashboard loads the couple's own wedding
--   WeddingParty reads partner names
--   createWedding.js inserts a new wedding at sign-up
--
-- anon loses everything. authenticated keeps the grants, and RLS narrows them
-- to the wedding that person actually belongs to.
--
-- ## Run 018 before this one
--
-- 018 is the urgent one — it covers gmail_tokens and zoom_tokens.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

REVOKE ALL ON public.weddings FROM anon;

ALTER TABLE public.weddings ENABLE ROW LEVEL SECURITY;

-- Read: only the wedding your profile points at.
DROP POLICY IF EXISTS "Members read their own wedding" ON public.weddings;
CREATE POLICY "Members read their own wedding" ON public.weddings
  FOR SELECT TO authenticated
  USING (id IN (SELECT wedding_id FROM public.profiles WHERE id = auth.uid()));

-- Create: signing up and starting a wedding. created_by must be you, so a
-- wedding cannot be created in someone else's name.
DROP POLICY IF EXISTS "Users create their own wedding" ON public.weddings;
CREATE POLICY "Users create their own wedding" ON public.weddings
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Update: same scope as read. The venue edits through the server, which uses
-- the service-role key and is not subject to any of this.
DROP POLICY IF EXISTS "Members update their own wedding" ON public.weddings;
CREATE POLICY "Members update their own wedding" ON public.weddings
  FOR UPDATE TO authenticated
  USING (id IN (SELECT wedding_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (id IN (SELECT wedding_id FROM public.profiles WHERE id = auth.uid()));

COMMENT ON COLUMN public.weddings.event_code IS
  'The code someone types to join this wedding. Treat as a credential: never expose it through an unauthenticated path. Exchanged for a wedding id by POST /api/join/lookup, which is rate limited.';

-- After running, this should return zero rows from an anonymous client:
--   curl "$SUPABASE_URL/rest/v1/weddings?select=event_code" -H "apikey: $ANON_KEY"
