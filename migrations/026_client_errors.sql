-- A crash in somebody's browser should reach the venue, not just their screen.
--
-- On 18 August the guest list threw on every render, for every couple and for
-- the venue. It stayed broken for twenty hours and the way Rixey found out was
-- a client picking up the phone.
--
-- Everything needed to know sooner already existed and none of it was wired up.
-- ErrorBoundary caught the error, rendered "Something went wrong", and called
-- console.error — into a console nobody at Rixey is looking at. The build was
-- green, the linter was green, the server was healthy, and the one place the
-- failure was visible was the screen of the person it happened to.
--
-- This is the same rule the ingestion work kept running into: information
-- cannot go unsurfaced. A crash that only the person crashing can see is a
-- crash nobody has recorded.
--
-- Deliberately cheap to write to: no auth, since a crash on the sign-in page
-- has no session, and no foreign keys, since the thing reporting is by
-- definition in a bad state and must not fail a second time trying to explain
-- itself. Rate limiting and grouping happen in the endpoint.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

CREATE TABLE IF NOT EXISTS public.client_errors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What broke. `fingerprint` is message + the first frame, so the same fault
  -- hit two hundred times is one row with a count rather than two hundred rows.
  message       text NOT NULL,
  fingerprint   text NOT NULL,
  stack         text,
  component     text,          -- React's component stack, when there is one

  -- Where, and to whom. All best effort: a page that is broken may not know.
  url           text,
  user_agent    text,
  wedding_id    uuid,
  user_email    text,
  release       text,          -- the commit the browser was running

  seen_count    integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),

  -- open → somebody is looking → done. Nothing is deleted: a fault that comes
  -- back is worth knowing was here before.
  status        text NOT NULL DEFAULT 'open',
  notes         text
);

CREATE UNIQUE INDEX IF NOT EXISTS client_errors_fingerprint_idx
  ON public.client_errors (fingerprint);
CREATE INDEX IF NOT EXISTS client_errors_last_seen_idx
  ON public.client_errors (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS client_errors_status_idx
  ON public.client_errors (status, last_seen_at DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
-- Written and read by the server only. A browser reports through the API so the
-- endpoint can rate limit; nothing here is readable by a couple.
CREATE POLICY "service_role_all" ON public.client_errors FOR ALL TO service_role USING (true);

COMMENT ON TABLE public.client_errors IS
  'Crashes that happened in somebody''s browser. Exists because the guest list was broken for twenty hours and a client had to ring up to say so.';
COMMENT ON COLUMN public.client_errors.fingerprint IS
  'message + first stack frame. One row per distinct fault, seen_count for how often, so a storm is one line rather than thousands.';
