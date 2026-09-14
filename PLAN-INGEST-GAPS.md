# Plan: close every ingestion gap

Source: the "Ingestion matrix" section of `AUDIT-2026-09-14.md` (20 ranked
gaps) plus the tier-two list from the same audit (dead tables, accommodations
with no writer, staff sign-off with no caller, Calendly manual-only, CSV
double import, vendor photo delete, reorder columns never set, logo_url,
knowledge-base description, unused routes, InspoGallery isAdmin, media delete
swallowing failure, no window.onerror). Isadora: fix all of them.

Same rules as the earlier plans: own your files, explicit staging, no pushes,
plain commit messages, British spelling, no em dashes, apiFetch for writes,
loadJson + LoadError for reads, every Supabase read checks its error, page
big tables, audit green before reporting.

## Route contracts (agreed now, built by W1, consumed by W2 and W3)

| Route | Shape |
|---|---|
| `GET /api/planning-notes/couple/:weddingId` | member-scoped; confirmed/added notes only; `{ id, category, content, created_at }`; no `source_message`, no pending. |
| `GET /api/contracts/:weddingId` | existing route gains `download_url` (one-hour signed URL from `vendor-contracts`) when `storage_path` is set. Admin upload path now stores the file in `vendor-contracts` and sets `storage_path`. |
| `GET /api/admin/documents/:weddingId` | gains `download_url` (signed, one hour) exactly as the couple route. |
| `GET /api/admin/sync-log/:weddingId?source=sheet\|document` | rows from `sheet_sync_log` newest first, paged, filtered by `source` when migration 036 is applied, else by `op_type` prefix. |
| `GET /api/admin/onboarding/:weddingId` | the five booleans plus `onboarding_dismissed`. |
| `PATCH /api/client-errors/:id` | accepts `{ status, notes }`. |
| `POST /api/finalisations/:weddingId` | accepts `role: 'staff'` from an admin token and sets `staff_finalised`. |
| `GET/POST/PUT/DELETE /api/admin/accommodations[/:id]` | CRUD for the accommodations table. |
| `POST /api/guests/bulk` | body `{ guests, mode: 'add'\|'update' }`; `update` upserts on `(wedding_id, lower(first_name), lower(last_name))` and returns `{ added, updated, skipped }`. |
| `POST /api/vendor-portal/:token/logo` | multipart, one image, sets `vendors.logo_url` (bucket `vendor-photos`). |
| `POST /api/bar-recipes/extract-url` and `extract-upload` | now SAVE the `bar_recipes` row and return `{ recipe, saved: true }`; the client no longer posts a second time. |
| `GET /api/walkthroughs/:weddingId/media` (or wherever media is listed) | includes `transcript_error`. |
| `GET /api/notifications/...` | includes `email_sent`. |
| `GET /api/zoom/transcripts?weddingId=` | existing; W1 adds the `weddingId` filter and `match_reason`, `match_confidence`, `matched_by`, `participant_names`, `meeting_topic`, `processed_at`; transcript text truncated to 20k chars. |
| `GET /api/communication-pulse/:weddingId` | existing; W1 confirms shape and documents it in the route comment. |
| `POST /api/admin/enquiries/sync` | existing Calendly import; W1 adds an hourly cron at :50 through `runScheduledSync('calendly', ...)`. |

Migration `036_ingestion_gaps.sql` (W1 writes, Isadora applies; code
tolerates absence): `DROP TABLE IF EXISTS feature_gaps, recipes,
scheduled_reminders`; `ALTER TABLE sheet_sync_log ADD COLUMN IF NOT EXISTS
source text`; `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS logo_url text`
(only if missing); index on `sheet_sync_log (wedding_id, applied_at DESC)`.

## Agents, one wave

### W1 server, Opus
Owns `server/index.js`, `server/lib/**`, `migrations/036_ingestion_gaps.sql`,
`migrations/APPLIED.md` (one row), `tests/unit/*` for pure helpers. Every
route in the table above, plus: caller sweep `needs_review` key mismatch;
walkthrough media delete returns 500 when storage removal fails; remove
`/api/google-debug` and `/api/sheet-sync-apply-debug`; put
`/api/quo/clear-processed` behind an explicit `confirm: true` body; rate-limit
and log `DELETE /api/vendor-portal/:token/photos`; `enquiries.outcome_notes`
accepted by PATCH (already) and returned by GET; `sheet_sync_log.source` set
on every apply (`'sheet'` or `'document'`); knowledge-base `description`
returned by the list route.

### W2 admin client, Sonnet
Owns `src/pages/Admin.jsx`, `src/pages/admin/**`, `src/components/admin/**`,
`src/components/{ContractPanel,DocumentSyncPanel,SheetSyncPanel,WalkthroughNotes,
CrashReports,VendorsAdmin,KnowledgeBaseAdmin,VenueSettings}.jsx` (ContractPanel
lives under pages/admin), new `src/components/admin/{ZoomTranscriptsPanel,
WebsiteReadOnlyTab,AccommodationsAdmin,CommunicationPulseCard}.jsx`.
Items: contract download link; document download link; sync history in both
sync panels (from `/api/admin/sync-log`); review-queue select built from
`candidates` with `confidence`; walkthrough `transcript_error` rendered and
the poll stopped; crash-report resolve dialog gets a notes field; onboarding
booleans in `WeddingCompleteness`; vendor photo thumbnails beside the publish
toggle, `logo_url` shown; website prose read-only tab (welcome, story,
proposal, FAQ, things to do, plus a "preview site" link) registered under key
`website-builder` on the venue side (that key exists; replace the current
panel content); `contactMessageCount` passed into `weddingTabs`; staff
sign-off: mount `SectionFinaliser` with `role="staff"` on finalisable venue
tabs; borrow selections listed by name; Zoom transcripts panel under the
Meetings & Walkthroughs tab; `outcome_notes` textarea in ToursPanel;
communication-pulse card on the wedding Overview; accommodations editor
under the Settings view; knowledge-base `description` shown.

### W3 couple client and shared components, Sonnet
Owns `src/pages/Dashboard.jsx`, `src/pages/dashboard/**`, `shared/sections.js`
(add key `rixey-notes`, label "Notes from Rixey", group Plan, couple side,
icon `StickyNote`), `src/main.jsx`, `src/pages/VendorPortal.jsx`,
`src/components/{CoupleNotes(new),NotificationBell,InspoGallery,PhotoBucket,
DayOfMemories,GuestList,BarPlanner,SectionFinaliser}.jsx`,
`scripts/audit-nav-parity.mjs` only if the new key needs it.
Items: CoupleNotes section reading `/api/planning-notes/couple/:weddingId`
(grouped by category, newest first, empty state "Rixey has not filed anything
yet"); NotificationBell shows a "not emailed" mark when `email_sent` is false
on a row that should have been; InspoGallery honours `isAdmin` (venue sees
no delete on couple uploads unless admin flag); up/down reorder controls in
InspoGallery, PhotoBucket and DayOfMemories writing `display_order` /
`sort_order` through the existing PUT routes; GuestList CSV import offers
"Add new only" or "Update matching" and shows added/updated/skipped;
BarPlanner stops posting the recipe a second time and uses `saved: true`;
VendorPortal logo upload; `window.onerror` in main.jsx reporting through
`reportError`; SectionFinaliser accepts `role="staff"` (label "Rixey has
checked this").

### Gate
Merge W1, then W3, then W2 (W2 last so the venue tab for `website-builder`
lands after the registry change). Build, audit, unit tests, push, smoke
(extend the smoke script for the couple notes route: own 200, other 403).
