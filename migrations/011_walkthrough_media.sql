-- Photos and voice notes taken during a walkthrough.
--
-- Half of what happens on a walkthrough is pointing at something. "That
-- corner", "this shade of green", "the gap behind the oak" — none of which
-- survives being typed. A photo taken standing there is the note.
--
-- Audio is stored whether or not anything can read it yet. Rixey has no
-- transcription provider, and picking one is a decision with a bill attached,
-- so recordings are kept as files against the walkthrough and transcript stays
-- null until there is something to fill it. Capturing audio nobody can search
-- is still better than losing what was said in the room.
--
-- Files live in the existing day-of-media bucket under a walkthroughs/ prefix,
-- so no new bucket has to be created by hand before this works.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

CREATE TABLE IF NOT EXISTS walkthrough_media (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  walkthrough_id uuid NOT NULL REFERENCES walkthroughs(id) ON DELETE CASCADE,
  wedding_id     uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  kind           text NOT NULL DEFAULT 'photo',   -- photo | audio
  url            text NOT NULL,
  storage_path   text,
  caption        text,
  duration_secs  integer,
  -- Filled in if and when a transcription provider is wired up. Null means
  -- "not transcribed", never "nothing was said".
  transcript     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS walkthrough_media_walkthrough_idx
  ON walkthrough_media (walkthrough_id, created_at);

COMMENT ON TABLE walkthrough_media IS
  'Photos and voice notes captured during a walkthrough. Audio is kept even when no transcription provider is configured, because the recording is the record.';
COMMENT ON COLUMN walkthrough_media.transcript IS
  'Null means not transcribed yet, not that the recording was empty. Nothing reads audio today.';

ALTER TABLE walkthrough_media ENABLE ROW LEVEL SECURITY;
