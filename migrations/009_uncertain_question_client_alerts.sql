-- Alert Client: sending a corrected answer back to the couple.
--
-- When Sage is unsure she tells the couple "I've flagged it for the human team
-- to double-check, they'll follow up if there's anything to add". Until now
-- nothing ever did. Isadora could answer the question and file it in the
-- knowledge base, but the couple who asked was never told.
--
-- These columns record that the correction was actually delivered, so the
-- queue can show what is still outstanding rather than looking answered
-- because someone updated the knowledge base.
--
-- No BEGIN/COMMIT: Supabase runs migrations in its own transaction.

ALTER TABLE uncertain_questions
  ADD COLUMN IF NOT EXISTS client_notified_at   timestamptz,
  ADD COLUMN IF NOT EXISTS client_message       text,
  ADD COLUMN IF NOT EXISTS client_message_id    uuid REFERENCES direct_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notified_by          text;

COMMENT ON COLUMN uncertain_questions.client_notified_at IS
  'When the corrected answer was sent to the couple. Null means they are still waiting on the follow-up Sage promised them.';
COMMENT ON COLUMN uncertain_questions.client_message IS
  'The text actually sent to the couple, which may differ from admin_answer — the knowledge base entry is written for Sage, this is written for a person.';
COMMENT ON COLUMN uncertain_questions.client_message_id IS
  'The direct_messages row created for the couple, so the thread can be opened from the queue.';

-- Finding the outstanding ones is the main query this table serves.
CREATE INDEX IF NOT EXISTS uncertain_questions_awaiting_client_idx
  ON uncertain_questions (created_at DESC)
  WHERE client_notified_at IS NULL;
