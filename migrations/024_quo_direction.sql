-- Which way a text went.
--
-- OpenPhone says "incoming" and "outgoing". Every comparison in server/index.js
-- said "inbound" and "outbound", so none of them ever matched, and nothing said
-- so. The count at the time of writing: 466 incoming, 534 outgoing, and 827
-- planning notes every single one of which claims to be "[SMS from Rixey]".
-- Four hundred and sixty-six of those are the couple's own words, filed as the
-- venue's.
--
-- The code now normalises at the boundary. This fixes what is already stored.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

-- 1. One vocabulary in the table.
UPDATE public.processed_quo_messages SET direction = 'inbound'  WHERE direction = 'incoming';
UPDATE public.processed_quo_messages SET direction = 'outbound' WHERE direction = 'outgoing';

-- 2. Re-label the planning notes that carry the wrong attribution.
--
-- Matched on wedding and exact body, and only where every message with that
-- body for that wedding agrees on direction. A body sent both ways is left
-- alone rather than guessed at: a note attributed to nobody is worse than one
-- that is merely unchanged, and these are readable by the couple.
WITH agreed AS (
  SELECT wedding_id, body_text, MIN(direction) AS direction
  FROM public.processed_quo_messages
  WHERE body_text IS NOT NULL AND body_text <> ''
  GROUP BY wedding_id, body_text
  HAVING COUNT(DISTINCT direction) = 1
)
UPDATE public.planning_notes n
SET content = '[SMS from client] ' || a.body_text,
    source_message = 'From client text: ' || COALESCE(
      (SELECT phone_number FROM public.processed_quo_messages m
       WHERE m.wedding_id = n.wedding_id AND m.body_text = a.body_text LIMIT 1), '')
FROM agreed a
WHERE n.category = 'sms_message'
  AND n.wedding_id = a.wedding_id
  AND a.direction = 'inbound'
  AND n.content = '[SMS from Rixey] ' || a.body_text;

-- 3. A note of what is left, for whoever reads the migration output.
DO $$
DECLARE
  wrong_way integer;
BEGIN
  SELECT COUNT(*) INTO wrong_way FROM public.processed_quo_messages
  WHERE direction NOT IN ('inbound', 'outbound');
  IF wrong_way > 0 THEN
    RAISE NOTICE 'processed_quo_messages still has % rows with an unexpected direction', wrong_way;
  END IF;
END $$;

-- 4. Stop it drifting again. The application normalises, so anything else
--    reaching this column is a new writer that has not been told.
ALTER TABLE public.processed_quo_messages
  DROP CONSTRAINT IF EXISTS processed_quo_messages_direction_check;
ALTER TABLE public.processed_quo_messages
  ADD CONSTRAINT processed_quo_messages_direction_check
  CHECK (direction IN ('inbound', 'outbound'));

COMMENT ON COLUMN public.processed_quo_messages.direction IS
  'inbound = from the couple, outbound = from Rixey. OpenPhone''s own words are "incoming"/"outgoing"; normaliseDirection() in server/index.js translates on the way in. Do not store the provider''s vocabulary here.';
