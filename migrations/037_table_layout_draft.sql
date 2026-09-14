-- Give the table layout a place for work that is not finished.
--
-- Until now there was one row per wedding in wedding_tables and both sides
-- wrote to it. The admin planner had a banner saying "In progress, not visible
-- to client", which was never true: the couple's planner reads the same row and
-- has never looked at is_draft. Since the planner started autosaving, every
-- keystroke a venue made on a layout it had already sent reached the couple
-- about a second and a half later.
--
-- So the venue's unfinished work needs somewhere else to live. `draft` holds
-- the whole planner payload as the client posts it (camelCase keys, not the
-- column names) so that hydrating the form back from it is a straight read and
-- cannot drift from the live columns' repurposed meanings. The live columns
-- stay exactly what the couple sees.
--
-- draft_updated_at is separate from updated_at on purpose. updated_at means
-- "when the couple's layout last changed", which is what the venue's own
-- dashboards read, and an unsent draft must not move it.
--
-- sent_to_client_at is null for every row written before this, which is not the
-- same as never sent. The planner says "Live for the couple" without a date in
-- that case rather than inventing one.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

ALTER TABLE public.wedding_tables
  ADD COLUMN IF NOT EXISTS draft jsonb,
  ADD COLUMN IF NOT EXISTS draft_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_client_at timestamptz;

COMMENT ON COLUMN public.wedding_tables.draft IS
  'The venue''s unsent table layout, as the planner posts it (camelCase keys). Never read by the couple''s planner. Null once Send to Client has copied it into the live columns.';

COMMENT ON COLUMN public.wedding_tables.draft_updated_at IS
  'When the draft was last autosaved. Deliberately not updated_at, which means "when the couple''s layout changed" and must not move for unsent work.';

COMMENT ON COLUMN public.wedding_tables.sent_to_client_at IS
  'When the venue last pressed Send to Client. Null on rows written before September 2026, which is not the same as never sent.';
