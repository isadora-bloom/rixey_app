-- Make a sync say what it did, and ask when it does not know.
--
-- Two problems, one shape. Both came out of Daniel and Griffin's onboarding
-- going missing on 14 August.
--
-- ## A sync that stops has no way to say so
--
-- The Zoom sync ran, wrote nine meetings, and died before reaching the two
-- newest. Nothing recorded that. The admin panel showed no error, the couple's
-- page showed no highlights, and an empty page looks exactly like a couple who
-- has not had a meeting yet. It was only noticed because a human remembered
-- being on the call.
--
-- sync_jobs gives every run a row: when it started, how far it got, what it
-- covered, and what killed it. "9 of 11, stopped" is a visible fact instead of
-- a blank screen.
--
-- ## A sync that cannot tell whose meeting it is guesses anyway
--
-- Matching was a flat name -> wedding map, so the last wedding to load owned
-- any shared first name. Anne Throckmorton's planning meeting was filed under
-- Chris & Emily, because that wedding has a family profile for Anne Bradel and
-- "anne" was the only word they shared. 148 planning notes went with it,
-- including a critical potato allergy, and sat there looking perfectly normal.
-- Chris & Emily's portal and Sage could read all of it.
--
-- ingest_review is where a meeting goes when the evidence is not good enough:
-- a first and last name, both halves of the couple, or a name with the wedding
-- date. Anything weaker becomes a question rather than a guess.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL,                     -- 'zoom' | 'gmail' | 'quo'
  status        text NOT NULL DEFAULT 'running',   -- running | finished | failed
  trigger       text NOT NULL DEFAULT 'manual',    -- manual | scheduled
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  heartbeat_at  timestamptz NOT NULL DEFAULT now(),
  total         integer NOT NULL DEFAULT 0,
  processed     integer NOT NULL DEFAULT 0,
  matched       integer NOT NULL DEFAULT 0,
  needs_review  integer NOT NULL DEFAULT 0,
  failed        integer NOT NULL DEFAULT 0,
  last_item     text,
  last_error    text,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS sync_jobs_kind_started_idx ON public.sync_jobs (kind, started_at DESC);

COMMENT ON TABLE public.sync_jobs IS
  'One row per ingestion run. Exists so a run that stops halfway is visible instead of looking like a run that had nothing to do.';
COMMENT ON COLUMN public.sync_jobs.heartbeat_at IS
  'Bumped as each item completes. A running job whose heartbeat is stale was killed rather than finished, which is otherwise indistinguishable.';

CREATE TABLE IF NOT EXISTS public.ingest_review (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source              text NOT NULL,               -- 'zoom' for now
  external_id         text NOT NULL,               -- zoom meeting uuid
  title               text,
  occurred_at         timestamptz,
  excerpt             text,
  suggested_wedding_id uuid REFERENCES public.weddings(id) ON DELETE SET NULL,
  confidence          integer NOT NULL DEFAULT 0,
  reason              text,
  candidates          jsonb NOT NULL DEFAULT '[]'::jsonb,
  status              text NOT NULL DEFAULT 'open', -- open | resolved | ignored
  resolved_wedding_id uuid REFERENCES public.weddings(id) ON DELETE SET NULL,
  resolved_by         uuid,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ingest_review_source_external_idx
  ON public.ingest_review (source, external_id);

COMMENT ON TABLE public.ingest_review IS
  'Items the ingestion could not confidently attribute. A question for a human rather than a guess written to a couple''s record.';

-- Provenance on the meeting itself, so a filing decision can be argued with
-- later instead of taken on faith.
ALTER TABLE public.processed_zoom_meetings
  ADD COLUMN IF NOT EXISTS match_confidence integer,
  ADD COLUMN IF NOT EXISTS match_reason     text,
  ADD COLUMN IF NOT EXISTS matched_by       text;   -- 'auto' | 'admin' | 'legacy'

COMMENT ON COLUMN public.processed_zoom_meetings.match_reason IS
  'Why this meeting was attributed to this wedding, in words. Anne Throckmorton''s meeting spent three weeks on the wrong couple because nothing recorded the reasoning.';

-- Venue-side only. Same rule as migration 018: revoke first, then RLS, so a
-- careless policy later cannot re-open them. Reached only through the server,
-- which uses the service-role key and is unaffected.
REVOKE ALL ON public.sync_jobs FROM anon;
REVOKE ALL ON public.sync_jobs FROM authenticated;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ingest_review FROM anon;
REVOKE ALL ON public.ingest_review FROM authenticated;
ALTER TABLE public.ingest_review ENABLE ROW LEVEL SECURITY;
