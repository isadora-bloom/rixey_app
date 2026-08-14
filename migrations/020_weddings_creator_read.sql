-- Let someone read the wedding they just created.
--
-- 019 gave weddings a SELECT policy scoped to "the wedding your profile points
-- at". Correct for every later read, and wrong for the first one: at sign-up
-- the wedding is inserted BEFORE the profile that links to it, so for that
-- instant the creator is not yet a member of their own wedding.
--
-- createWedding.js does .insert(...).select().single(), and PostgREST has to
-- pass the SELECT policy to hand the new row back. It could not, so the insert
-- succeeded and the read failed, `wedding` came back null, weddingId was null,
-- and the profile link, checklist seeding and admin notification all silently
-- did nothing. A new couple would have finished sign-up with an account
-- attached to no wedding — exactly the state Brittany Lamback has been stuck
-- in since July.
--
-- Caught by signing up as a disposable user against a test wedding rather than
-- by waiting for a real couple to hit it.
--
-- SELECT policies are OR'd, so this widens the rule: your own wedding, or one
-- you created. Both are yours.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

DROP POLICY IF EXISTS "Creators read weddings they made" ON public.weddings;
CREATE POLICY "Creators read weddings they made" ON public.weddings
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());
