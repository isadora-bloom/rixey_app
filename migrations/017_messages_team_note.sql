-- Team notes in a couple's Sage thread: the column has never existed.
--
-- add_team_note_column.sql sat unrun in the repo root — the third of these,
-- after section_finalisations and day_of_media. Two server endpoints insert
-- is_team_note (the check-in message and the admin "inject a note" tool) and
-- both fail on 42703; two components style a message differently when it is a
-- team note, and that has never once rendered.
--
-- Found by scripts/audit-loose-sql.mjs, which now checks every loose add_*.sql
-- in the repo root against the live schema so this class stops recurring.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_team_note BOOLEAN DEFAULT false;

COMMENT ON COLUMN messages.is_team_note IS
  'A message written by the venue team into the couple''s Sage thread, rather than by Sage. Rendered differently in both the couple and admin views.';
