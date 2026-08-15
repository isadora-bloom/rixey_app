-- "This might be a couple you already have."
--
-- The first Calendly sync brought in 38 bookings and matched 13 to existing
-- couples on email. Two it should have matched and could not:
--
--   Samantha Sheads booked her final walkthrough as sheadsaamantha@gmail.com.
--   The portal has sheadssamantha@gmail.com. One letter. A walkthrough for a
--   wedding four weeks away appeared in the list as a stranger.
--
--   "Griffin and Daniel" booked their onboarding from jperry32@gmu.edu, a
--   university address belonging to neither of them. No email overlap at all,
--   while the name is an exact match for the couple.
--
-- Both are obvious to a person and invisible to an exact match. The answer is
-- not to loosen the matching: a wrong auto-match puts a stranger's tour on a
-- real couple's record, silently, which is the failure this codebase has spent
-- the week digging out of.
--
-- So it suggests, and a human confirms. Same rule as the Zoom review queue.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS suggested_wedding_id uuid REFERENCES public.weddings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suggestion_reason text,
  ADD COLUMN IF NOT EXISTS suggestion_dismissed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.enquiries.suggested_wedding_id IS
  'A wedding this enquiry is probably about, on a near-miss email or a name match. Never acted on automatically: a wrong guess files a stranger''s meeting onto a real couple.';
COMMENT ON COLUMN public.enquiries.suggestion_dismissed IS
  'Set when someone says no, so the same wrong guess is not offered every sync.';
