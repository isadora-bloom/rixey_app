-- Notifications table for Rixey Portal
-- Stores persistent in-app notifications for both admin and clients
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin', 'client')),
  recipient_id UUID,  -- NULL for admin (single admin), client user_id for client
  type TEXT NOT NULL CHECK (type IN (
    'new_message',        -- New message from client or admin
    'client_activity',    -- Client updated timeline/tables/vendors/etc.
    'escalation',         -- Escalation keywords detected in messages
    'sage_uncertain',     -- Sage flagged a question it couldn't answer
    'checklist_item_added', -- Admin added a checklist item for the couple
    'vendor_update',      -- Admin updated vendor recommendations
    'planning_reminder'   -- Upcoming task reminder
  )),
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_admin
  ON notifications(recipient_type, is_read, created_at DESC)
  WHERE recipient_type = 'admin';

CREATE INDEX IF NOT EXISTS idx_notifications_client
  ON notifications(wedding_id, recipient_type, is_read, created_at DESC)
  WHERE recipient_type = 'client';

CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications(created_at DESC);

-- RLS: Enable row-level security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admin can read all notifications (admin is authenticated via custom auth, not RLS)
-- Service role (backend) bypasses RLS so no policies needed for backend access

-- Clients can read their own notifications (by wedding_id + recipient_type)
CREATE POLICY "Clients can read their own notifications"
  ON notifications FOR SELECT
  USING (
    recipient_type = 'client'
    AND wedding_id IN (
      SELECT id FROM weddings WHERE id = notifications.wedding_id
    )
  );

-- Service role handles all writes (backend only creates/updates notifications)
-- No client insert/update policies — only backend can create notifications
