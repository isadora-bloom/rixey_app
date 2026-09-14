# Applied Migrations

All migrations are applied manually via `run-migration.ts` (never auto-applied on deploy). Each row records the date from the file's header comment.

| Migration | Date | Status |
|-----------|------|--------|
| 000_baseline.sql | (pending orchestrator dump) | pending |
| 001_add_missing_constraints.sql | | applied |
| 002_fix_rls_policies.sql | | applied |
| 003_inspo_gallery_category.sql | | applied |
| 004_website_new_columns.sql | | applied |
| 005_website_all_columns.sql | | applied |
| 006_wedding_details_extras.sql | | applied |
| 007_wedding_website_rsvp_config.sql | | applied |
| 008_sheet_sync_log.sql | | applied |
| 009_uncertain_question_client_alerts.sql | | applied |
| 010_walkthroughs.sql | | applied |
| 011_enquiries_table.sql | | applied |
| 012_shared_couples.sql | | applied |
| 013_vendor_merge_tracking.sql | | applied |
| 014_activity_log_created_at.sql | | applied |
| 015_vendor_search_refactor.sql | | applied |
| 016_wedding_access_control.sql | | applied |
| 017_planning_notes_approval.sql | | applied |
| 018_rls_enforcer_base.sql | | applied |
| 019_rls_grants.sql | | applied |
| 020_rls_grants_final.sql | | applied |
| 021_sync_job_tracking.sql | | applied |
| 022_tours_table.sql | | applied |
| 023_enquiries_join_table.sql | | applied |
| 024_vendor_offers_live_window.sql | | applied |
| 025_guest_metadata.sql | | applied |
| 026_photo_context.sql | | applied |
| 027_couple_portal_schema.sql | | applied |
| 028_seating_notes.sql | | applied |
| 029_vendor_profiles_live.sql | | applied |
| 030_vendor_aliases.sql | | applied |
| 031_wedding_guest_custom_fields.sql | | applied |
| 032_check_guest_party_model.sql | | applied |
| 033_notification_refactor.sql | | applied |
| 034_couple_profile_fix.sql | | applied |
| 035_extraction_markers.sql | 2026-09-14 | **pending: needs running by Isadora**. The server boots without it and logs one `[035] migration 035 not applied` line per gated behaviour (extraction markers, source-keyed note dedup, transcript_error, parsed_with_model, messages.flagged). |
