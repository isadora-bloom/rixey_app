-- Walkthroughs: one place to dump what was said in the room, and a record of
-- where each piece of it ended up.
--
-- A final walkthrough generates a stream of small decisions — the arbor moves,
-- they want the cocktail hour on the patio, three more high chairs, chase the
-- florist about delivery time. Today that lives in someone's head, a phone
-- note, or a text to Grace. Anything that never gets retyped is lost.
--
-- Two tables, and the split matters:
--
--   walkthroughs      the raw capture. Sacred. Never rewritten by the parser,
--                     never trimmed. If the AI mis-reads it, the original is
--                     still there word for word.
--   walkthrough_items what the parser made of it, one row per proposed change,
--                     each carrying the exact source text it came from and,
--                     once applied, exactly what it wrote and where.
--
-- Nothing is ever written to a real planning table without a row here saying
-- who accepted it and when, so any value in the portal can be traced back to
-- the sentence in the room that caused it.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

CREATE TABLE IF NOT EXISTS walkthroughs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  kind          text NOT NULL DEFAULT 'final_walkthrough',
  occurred_on   date NOT NULL DEFAULT CURRENT_DATE,
  attendees     text,
  raw_notes     text NOT NULL DEFAULT '',
  -- What the couple is allowed to see. Written by the venue, not the parser,
  -- and only visible once shared_at is set. The raw notes stay private: the
  -- point of a scratchpad is being able to write "mum is going to be a
  -- problem about the seating" without it appearing in their portal.
  shared_summary text,
  shared_at     timestamptz,
  status        text NOT NULL DEFAULT 'draft',   -- draft | organised | applied
  organised_at  timestamptz,
  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS walkthrough_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  walkthrough_id uuid NOT NULL REFERENCES walkthroughs(id) ON DELETE CASCADE,
  wedding_id     uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  -- The words this came from, quoted back so a reviewer can check the parser
  -- against what was actually said rather than trusting the summary.
  source_text    text NOT NULL,
  kind           text NOT NULL DEFAULT 'note',   -- task | note | detail | decision
  section        text,                            -- a PORTAL_SECTION_KEYS value, or null if unroutable
  summary        text NOT NULL,
  -- The typed payload for whichever section this is bound for. Shape varies by
  -- section, which is why it is jsonb rather than columns.
  proposed       jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence     integer,
  status         text NOT NULL DEFAULT 'proposed', -- proposed | accepted | skipped | applied | failed
  -- Set on apply. applied_table/applied_row_id are the receipt: this is the
  -- row we created or changed, so it can be found again or undone by hand.
  applied_at     timestamptz,
  applied_table  text,
  applied_row_id uuid,
  apply_error    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS walkthroughs_wedding_idx
  ON walkthroughs (wedding_id, occurred_on DESC);

CREATE INDEX IF NOT EXISTS walkthrough_items_walkthrough_idx
  ON walkthrough_items (walkthrough_id, created_at);

-- The review screen only ever asks for what is still waiting on a decision.
CREATE INDEX IF NOT EXISTS walkthrough_items_pending_idx
  ON walkthrough_items (walkthrough_id)
  WHERE status = 'proposed';

COMMENT ON TABLE walkthroughs IS
  'Raw capture from a walkthrough or site visit. raw_notes is never rewritten by the parser; shared_summary is the only part a couple can see, and only once shared_at is set.';
COMMENT ON TABLE walkthrough_items IS
  'One proposed change per row, extracted from a walkthrough. Nothing reaches a real planning table without a row here recording who accepted it and what it wrote.';
COMMENT ON COLUMN walkthrough_items.source_text IS
  'The exact words this was extracted from, so a reviewer can check the parser rather than trust it.';

-- Both tables are admin-only and reached through the service-role API, which
-- bypasses RLS. Enabling it with no policy means a leaked anon key still
-- cannot read a venue's private walkthrough notes.
ALTER TABLE walkthroughs ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkthrough_items ENABLE ROW LEVEL SECURITY;
