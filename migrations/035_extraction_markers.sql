-- Make an extraction that failed say so, and give a planning note a source.
--
-- Two problems, one cause: nothing recorded what happened to an item after its
-- processed-marker row was written.
--
-- ## A failed extraction looked exactly like an empty one
--
-- extractPlanningNotesAI caught every error and returned [], including a 429
-- and a 529. The marker row was already written, so the email, text, call or
-- meeting was marked imported with no notes and nothing anywhere said the
-- model had been asked and had not answered. Those losses are permanent: a
-- later sync skips the item because the marker says it is done.
--
-- extracted_at and extract_error split "read it, found nothing" from "could
-- not read it". A row with extract_error set is a row a backfill can pick up.
--
-- ## Dedup paged the whole wedding's notes on every save
--
-- savePlanningNotes read every planning_note for the weddings in the batch
-- (16,849 rows and growing, in 1000-row pages) and compared exact strings,
-- because a note had no idea where it came from. source_kind and source_id say
-- which email, text, call, meeting or document produced it, so the check is a
-- handful of rows rather than the table, and the unique index below makes a
-- second copy impossible rather than merely unlikely.
--
-- The index is on md5(content), not content. A zoom_transcript note holds a
-- whole meeting and a btree entry is capped at 2704 bytes, so indexing the
-- text itself would refuse to store exactly the notes that matter most.
-- Because it is an expression index, and partial as well, PostgREST cannot
-- infer it for .upsert({ onConflict }) — that combination answers 42P10. So
-- the server dedups with a targeted read and treats 23505 from this index as
-- the backstop it is, rather than as an error. See
-- [[feedback-supabase-service-role-scope]].
--
-- ## What is NOT here, deliberately
--
-- A partial unique index on sync_jobs(kind) WHERE status = 'running' was
-- considered and left out. Every sync opens its job row before it runs, and a
-- process killed mid-run leaves that row 'running' for ever — which is the
-- very failure this audit is fixing. With such an index in place that stale
-- row would refuse every later sync of that kind with a constraint violation
-- and no way through from the admin panel. assertNoOverlappingJob does the same
-- job in code, where a stale heartbeat can be reasoned about.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

-- ── Extraction outcome on the three marker tables ───────────────────────────

ALTER TABLE public.processed_emails
  ADD COLUMN IF NOT EXISTS extracted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS extract_error text;

ALTER TABLE public.processed_quo_messages
  ADD COLUMN IF NOT EXISTS extracted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS extract_error text;

ALTER TABLE public.processed_zoom_meetings
  ADD COLUMN IF NOT EXISTS extracted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS extract_error text;

COMMENT ON COLUMN public.processed_emails.extract_error IS
  'Why the planning-note extraction failed for this item. Null with extracted_at set means it ran and found nothing, which is a different answer.';

CREATE INDEX IF NOT EXISTS processed_emails_extract_error_idx
  ON public.processed_emails (processed_at DESC) WHERE extract_error IS NOT NULL;
CREATE INDEX IF NOT EXISTS processed_quo_messages_extract_error_idx
  ON public.processed_quo_messages (processed_at DESC) WHERE extract_error IS NOT NULL;
CREATE INDEX IF NOT EXISTS processed_zoom_meetings_extract_error_idx
  ON public.processed_zoom_meetings (processed_at DESC) WHERE extract_error IS NOT NULL;

-- ── Where a planning note came from, and how sure the model was ─────────────

ALTER TABLE public.planning_notes
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_id   text,
  ADD COLUMN IF NOT EXISTS confidence  numeric;

COMMENT ON COLUMN public.planning_notes.source_kind IS
  'email | sms | call | zoom | document | chat. With source_id it names the one item this note was read out of.';
COMMENT ON COLUMN public.planning_notes.confidence IS
  '0 to 1, the model''s own reading of how firmly the source states this. A note at 0.3 is a guess that should not be read back to a couple as fact.';

CREATE UNIQUE INDEX IF NOT EXISTS planning_notes_source_key_idx
  ON public.planning_notes (wedding_id, source_kind, source_id, category, md5(content))
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS planning_notes_source_lookup_idx
  ON public.planning_notes (wedding_id, source_kind, source_id)
  WHERE source_id IS NOT NULL;

-- ── A recording that could not be transcribed ───────────────────────────────
--
-- transcript stayed null whether Deepgram had never been asked or had been
-- asked and refused, so a failed key looked identical to a queue.

ALTER TABLE public.walkthrough_media
  ADD COLUMN IF NOT EXISTS transcript_error text;

-- ── Which model read a document ────────────────────────────────────────────
--
-- The parser falls back from Sonnet to Haiku on a 429 or a 529 and said so
-- nowhere, so a document read by the cheaper model is indistinguishable from
-- one read properly.

ALTER TABLE public.wedding_documents
  ADD COLUMN IF NOT EXISTS parsed_with_model text;

-- ── Notification types are open-ended now ──────────────────────────────────
--
-- The CHECK list was written in February and the code has passed it
-- 'help_request' ever since, which it does not contain. A constraint that the
-- application already violates is not protecting anything; it only decides
-- which new notification silently fails to save. 'sync_failed' is the one this
-- migration needs.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- ── Escalation flag on a message ───────────────────────────────────────────
--
-- Agreed with the auth lane: the LLM judge sets it at message time and the
-- admin list reads it, instead of keyword-matching "help", "late" and "lost".
-- Harmless if that lane already added it.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
