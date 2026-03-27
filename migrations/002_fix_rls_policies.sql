-- Migration: Fix RLS policy security holes
-- Several tables have overly permissive policies that negate user-scoped access

-- ============ uncertain_questions ============
-- Currently: FOR ALL USING (true) — any authenticated user can read/modify all
-- Fix: Only admins should access this table

DROP POLICY IF EXISTS "Allow all for authenticated" ON uncertain_questions;
DROP POLICY IF EXISTS "uncertain_questions_all" ON uncertain_questions;

CREATE POLICY "uncertain_questions_admin_only"
  ON uncertain_questions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- ============ usage_logs ============
-- Currently: FOR ALL USING (true) — any user can see all API usage
-- Fix: Admin-only

DROP POLICY IF EXISTS "Allow all for authenticated" ON usage_logs;
DROP POLICY IF EXISTS "usage_logs_all" ON usage_logs;

CREATE POLICY "usage_logs_admin_only"
  ON usage_logs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- ============ activity_log ============
-- Currently: GRANT ALL TO authenticated with no RLS
-- Fix: Users see their own wedding's activity, admins see all

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_user" ON activity_log;
DROP POLICY IF EXISTS "activity_log_admin" ON activity_log;

CREATE POLICY "activity_log_user"
  ON activity_log FOR SELECT
  USING (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE profiles.id = auth.uid())
  );

CREATE POLICY "activity_log_admin"
  ON activity_log FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- ============ wedding_borrow_selections ============
-- Currently: GRANT ALL TO authenticated with no RLS policies
-- Fix: Users access their own wedding's selections, admins see all

ALTER TABLE wedding_borrow_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "borrow_selections_user" ON wedding_borrow_selections;
DROP POLICY IF EXISTS "borrow_selections_admin" ON wedding_borrow_selections;

CREATE POLICY "borrow_selections_user"
  ON wedding_borrow_selections FOR ALL
  USING (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE profiles.id = auth.uid())
  );

CREATE POLICY "borrow_selections_admin"
  ON wedding_borrow_selections FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- ============ direct_messages ============
-- Fix: Remove any overly permissive policy, keep user-scoped + admin

DROP POLICY IF EXISTS "Allow all for authenticated" ON direct_messages;

-- Users can read/write their own wedding's messages
CREATE POLICY IF NOT EXISTS "direct_messages_user"
  ON direct_messages FOR ALL
  USING (
    wedding_id IN (SELECT wedding_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- Admins can access all messages
CREATE POLICY IF NOT EXISTS "direct_messages_admin"
  ON direct_messages FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );
