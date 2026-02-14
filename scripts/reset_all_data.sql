-- ⚠️ WARNING: This will DELETE ALL DATA from your database!
-- Only run this if you want to start completely fresh.
-- This does NOT delete the tables themselves, just the data.

-- Delete in order to respect foreign key constraints

-- New feature tables
DELETE FROM planning_checklist;
DELETE FROM inspo_gallery;
DELETE FROM couple_photos;
DELETE FROM vendor_checklist;

-- Communication sync tables
DELETE FROM processed_zoom_meetings;
DELETE FROM processed_quo_messages;
DELETE FROM processed_emails;

-- Planning data
DELETE FROM planning_notes;
DELETE FROM contracts;

-- Messages
DELETE FROM messages;

-- Admin notifications
DELETE FROM admin_notifications;

-- OAuth tokens
DELETE FROM gmail_tokens;
DELETE FROM zoom_tokens;

-- Profiles (references weddings, so delete before weddings)
DELETE FROM profiles;

-- Weddings (parent table)
DELETE FROM weddings;

-- Also clear auth.users if you want to remove login accounts
-- (Uncomment the line below if needed - requires admin privileges)
-- DELETE FROM auth.users;

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- To clear storage buckets, go to Supabase Dashboard > Storage
-- and manually delete files from:
--   - vendor-contracts
--   - inspo-gallery
--   - couple-photos
-- Or use this SQL to list what's in storage:
-- SELECT * FROM storage.objects;

-- To delete all storage objects (uncomment if needed):
-- DELETE FROM storage.objects WHERE bucket_id IN ('vendor-contracts', 'inspo-gallery', 'couple-photos');
