-- Audit log for the Sheet Sync admin tool.
-- Every decision Grace (or any admin) makes inside the Sync from Sheet panel is recorded here:
--   - skip / use-portal entries are logged as decisions but executed=false
--   - import-sheet entries are logged with executed=true (or executed=false + error if the write failed)
-- The combination of (wedding_id, entry_id) keeps the latest decision for that field, so re-running
-- the diff and re-deciding is a fully-supported flow.

CREATE TABLE IF NOT EXISTS sheet_sync_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  entry_id      text NOT NULL,
  choice        text NOT NULL CHECK (choice IN ('import-sheet', 'use-portal', 'skip')),
  op_type       text,
  table_name    text,
  executed      boolean NOT NULL DEFAULT false,
  error         text,
  applied_by    uuid REFERENCES auth.users(id),
  applied_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sheet_sync_log_wedding_idx ON sheet_sync_log (wedding_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS sheet_sync_log_entry_idx ON sheet_sync_log (wedding_id, entry_id, applied_at DESC);

ALTER TABLE sheet_sync_log ENABLE ROW LEVEL SECURITY;

-- Admins can read/insert; nobody else can touch it.
DROP POLICY IF EXISTS sheet_sync_log_admin_read ON sheet_sync_log;
CREATE POLICY sheet_sync_log_admin_read ON sheet_sync_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS sheet_sync_log_admin_insert ON sheet_sync_log;
CREATE POLICY sheet_sync_log_admin_insert ON sheet_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
