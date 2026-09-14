-- Close the ingestion gaps: say where a sync row came from, and clear out the
-- tables nothing writes to.
--
-- From the ingestion matrix in AUDIT-2026-09-14.md. Three separate small
-- things, all of them about information that is written and then cannot be
-- found again.
--
-- ## sheet_sync_log.source
--
-- Two importers write to this table: the Google Sheet diff and the document
-- diff, which reuses the sheet executor wholesale. The rows are identical
-- afterwards, so the Sheet Sync panel shows a document import as the last time
-- the sheet was synced, and a venue reading "synced 10 minutes ago" is being
-- told something untrue about a sheet nobody has touched in a fortnight.
-- 'sheet' or 'document', written on every apply.
--
-- Left nullable on purpose. Every row already in the table was written before
-- anyone was recording this, and inventing a value for them would be a guess
-- presented as a fact. Null means "written before we started saying".
--
-- ## vendors.logo_url
--
-- Already there on production per the audit. The ADD ... IF NOT EXISTS is here
-- so a fresh database built from the migration folder matches, and is a no-op
-- against the live one.
--
-- ## The dead tables
--
-- feature_gaps, recipes and scheduled_reminders exist in production and no
-- line of code reads or writes any of them. recipes in particular is a decoy:
-- the bar planner uses bar_recipes, and somebody searching the schema for
-- where a recipe goes finds the wrong table first.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

-- ── Which importer wrote this row ──────────────────────────────────────────

ALTER TABLE public.sheet_sync_log
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.sheet_sync_log.source IS
  'sheet | document. Which importer applied this row. Null on rows written before September 2026, which is not the same as "sheet".';

-- The sync-log route reads one wedding, newest first, and pages. Without this
-- that is a sequential scan of a table that only ever grows.
CREATE INDEX IF NOT EXISTS sheet_sync_log_wedding_applied_idx
  ON public.sheet_sync_log (wedding_id, applied_at DESC);

-- ── A vendor's logo ────────────────────────────────────────────────────────

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS logo_url text;

-- ── Tables nothing writes to ───────────────────────────────────────────────
--
-- Dropped last, so if one of these turns out to have a dependency the rest of
-- the migration has already landed.

DROP TABLE IF EXISTS public.feature_gaps;
DROP TABLE IF EXISTS public.recipes;
DROP TABLE IF EXISTS public.scheduled_reminders;
