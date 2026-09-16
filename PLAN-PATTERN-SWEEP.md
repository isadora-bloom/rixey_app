# Plan: the guest-list bug classes, everywhere else

Two read-only sweeps on 15 Sep 2026 (client and server) extrapolated the
seven classes of bug found on the guest list that day across every tab and
route. This wave fixes what they found. Same rules as the earlier plans.

Classes: party-versus-person reads; exports and downloads; imports that
drop rows silently; requests that outlive Railway's ~50 s proxy; route
order; destructive actions with no confirm and no mass action; silent
failure on write; polling with no stop; accents stripped before matching.

Ownership is by file. Where a fix needs a one-line change in another
agent's file (a prop passed from Dashboard.jsx, say), the agent reports the
exact line and the orchestrator applies it at merge.

## Server

### SV1 party-versus-person and guest routes, Opus
`server/index.js` regions: guests routes (GET list ~13637, PUT/DELETE,
bulk ~13963-14110, tags/meal options excluded), `syncPlusOneRow` ~13727,
seating import parse+commit ~17300-17580, `buildWeddingContext` guest read
~3504, tour brief ~16519; `server/lib/doc-sync/diff.js`;
`server/lib/quo-calls.js` ~527; `server/lib/sheet-diff/modules/seating.js`;
`server/lib/sheet-diff/portal-snapshot.js`.
- Seating commit select gains `is_plus_one, party_id, plus_one_of`; page it;
  parse pushes a warning per skipped row; chart JSON error names the fault.
- bulk update mode: omit `plus_one_*` from the patch unless the source row
  carried a plus-one column; chunk writes (batches of 50 upserts) so 800
  guests finish well inside 50 s; explicit cap 2,000 rows with a message;
  400s that say which fault (no wedding / not an array / empty after
  parsing N rows); return `skippedBlankName`; `existingNames` from hosts.
- `syncPlusOneRow`: copy `plus_one_*` onto the person row only when creating
  it; when a plus-one row is edited, mirror back to the host's `plus_one_*`.
- Page every `wedding_guests` read (list route, Sage context, snapshot).
- diff.js: index known names and seating from `allPeople()`.
- Tour brief filters unnamed placeholders; quo-calls surname fallback via
  `plus_one_of`.

### SV2 long requests to jobs, Opus
`server/index.js` regions: Anthropic client ~479, `/api/chat` ~1821 and its
529 fallback ~2367, `/api/extract-contract` ~2849-3030, `/api/chat-with-file`
~3076-3350, limiter mounts ~243-255 and the health routes, vendor contract
IIFE ~8283-8380, inspo IIFE ~8544-8640, `/api/zoom/reextract` ~7794-7870,
Calendly sync ~10827-10940, bar-recipes extract-url ~14506-14530, document
upload ~15888-15990; `server/lib/answer-jobs.js`.
- zoom/reextract, Calendly sync → `backgroundSync`.
- extract-contract → answer-jobs kind `extract-contract` (client waits with
  `awaitAnswerJob`; the couple-facing upload returns 202).
- chat-with-file: answer synchronously with a short client (see below),
  file the document in a job.
- Document upload: store, respond, extract inside the existing doc-parse job.
- Vendor contract and inspo IIFEs get job rows.
- A second Anthropic client for Sage: `timeout: 40_000, maxRetries: 0`.
- `aiLimiter` on every route that spends money; health routes above the
  general limiter; extract-url gets one 20 s budget for all hops.

### SV3 deletes, uploads, apply, Sonnet
`server/index.js` regions: zoom/clear ~7871, forceReprocess ~5690-5710,
internal-notes ~13084-13130, day-of-media delete ~14855, walkthrough delete
~16338, recommended-vendors delete ~9521, vendors delete ~8265, inspo delete
~8710, couple-photo ~8794-8809, manor-assets delete ~12903, documents delete
~16247, tag/meal-option deletes ~14235/14264, vendor-portal photos
~9721-9743, borrow-catalog ~12288, walkthrough apply ~16641, gmail markers
~4426/4588, borrow-selections ~12233, disconnect ~5033, and every bare
`.delete().eq('id', …)` (add `.select()` and 404 on no row);
`server/lib/sheet-diff/apply.js`; new `migrations/038_pattern_sweep.sql`.
- zoom/clear: confirm word, count, refuse on error, per-wedding option.
- forceReprocess requires the same confirm word as clear-processed.
- internal-notes GET and DELETE admin-only.
- Deletes remove their storage objects first (walkthrough, vendor, vendor
  contract, documents) and refuse when removal fails; inspo/couple-photo
  delete the row before the object; couple-photo uploads the new object
  before deleting the old; `safeStorageKey` on vendor photos and borrow
  catalogue; borrow catalogue fails when storage refuses.
- Tag and meal-option deletes clear the value off every guest carrying it.
- Walkthrough apply marks `applying` before the insert.
- apply.js: pin `wedding_id` on delete ops; surface the audit-row failure;
  extend `DEDUP_ON` to every table it writes.
- Gmail marker inserts capture their error and skip on failure.
- Every delete logs `logActivity` with the table, id and caller.
- 038: unique `(wedding_id, text_hash)` on wedding_documents.

### SV4 errors, mounts, validation, Sonnet
`server/middleware/weddingAccess.js`, `server/middleware/validate.js`,
`server/index.js` 77-170 (multer configs) and 17550-17620 (error handler),
plus a new helper `sendDbError(res, err)` defined near the top (~520) but
NOT yet applied to the 111 call sites (the orchestrator applies that
mechanically after merge to avoid conflicts).
- weddingAccess prefixes match on segment boundaries; keep one list of
  admin prefixes shared with the mounts.
- validate.js returns the names of ignored fields.
- Global handler maps all three multer filter messages; size-limit message
  names the cap; JSON 404 for unknown `/api` paths; multer `limits.files`,
  `fields`, `fieldSize` set; day-of-media cap lowered to 100 MB with the
  bucket cap noted.
- `sendDbError`: 22P02 → 400 naming the field, 23502 → 400 naming the
  column, 23505 → 409, 23503 → 409, else generic 500 with the id logged.

## Client

### CL1 party-versus-person, counts, names, Opus
`src/components/{GuestList,StaffingCalculator,BarPlanner,TableLayoutPlanner,
TableCanvas,PhotoBucket,WeddingParty,WebsiteBuilder,UpcomingMeetings,
KnowledgeBaseAdmin}.jsx`, `shared/guest-names.js`, `shared/guest-csv.js`,
their tests.
- StaffingCalculator takes `guestCount` from `headcount()`; BarPlanner,
  TableLayoutPlanner and TableCanvas seed from `headcount()` and show a
  quiet "guest list says N" line when the typed figure differs.
- GuestList: filters over `allPeople()`, plus-one rows get their own table
  select, delete cascades locally, add refetches, tag/meal deletes confirm,
  a checkbox column with Select all / Delete selected (N), "Clear all
  seating".
- PhotoBucket and WeddingParty suggestions from `allPeople()` without
  placeholders; confirms on their deletes; PhotoBucket multi-select delete.
- BarPlanner: confirms, importFromCalculator keeps hand-edited rows, print
  escapes and prints checked items struck through, save button disables
  while saving, delete loops report partial failure.
- TableCanvas: blob download with delayed revoke, anchor appended, layout
  name drawn in; delete confirm.
- WebsiteBuilder: slug transliterates, QR warns when a password is set.
- `shared/guest-names.js`: `normaliseName()` with NFD accent folding, used
  by `norm`, WeddingParty, UpcomingMeetings, KnowledgeBaseAdmin; guest-csv
  header canonicalisation keeps letters from any script.
Report the exact prop lines for Dashboard.jsx and AdminWeddingProfile.jsx.

### CL2 silent failures, polling, downloads, imports, Sonnet
`src/utils/createWedding.js`, `src/utils/answerJobs.js`,
`src/context/RecorderContext.jsx`, `src/pages/{PrintView,Login,
WeddingWebsite,VendorPortal,Dashboard,Admin}.jsx`,
`src/pages/admin/{WeddingCompleteness,ContractPanel,ToursPanel}.jsx`,
`src/components/{VenueSettings,WeddingDetails,WalkthroughNotes,
DocumentSyncPanel,CoupleDocuments,ManorDownloads,DayOfMemories,
SeatingImportDialog,CeremonyOrder,DecorInventory,CeremonyChairPlan,
BudgetTracker,TimelineBuilder,VendorChecklist,OnboardingChecklist,
GuestCareNotes,NotificationBell,UsageStats,StorefrontBrowser,
StorefrontAdmin,WeddingWorksheets}.jsx`.
- createWedding throws on any failure and the sign-up screen shows it.
- VenueSettings, WeddingDetails, WeddingCompleteness: loadJson, never
  autosave after a failed load, completeness scores a failed read "unknown".
- PrintView: no bare catches, `res.ok` on all fetches, phone column and
  wedding date/code in headers, headcount beside the planned figure.
- Every raw read in the list → loadJson with LoadError; Connect buttons and
  archive-past through apiFetch with toasts; Login separates 404 from 5xx;
  WeddingWebsite shows the server's RSVP message; VendorPortal 404 vs 500.
- Polling: WalkthroughNotes give-up clock in a ref and bail on record
  change; Dashboard retry capped at three with a manual Retry; Admin and
  DocumentSyncPanel polls stop on unmount; answerJobs takes an AbortSignal;
  RecorderContext stops the level watcher when the recorder fails to start.
- Downloads: ManorDownloads and DayOfMemories fetch the blob and save it
  (cross-origin `download` is ignored); document/contract buttons read
  "Open"; recording rescue filenames carry the label and couple.
- Imports: SeatingImportDialog filters drops by type; DayOfMemories loop
  continues past a failure and reports which failed; VendorPortal logo
  accept drops SVG; every image upload goes through `shrinkImageForUpload`.
- Confirms on: CeremonyOrder, WalkthroughNotes (audio!), DecorInventory
  item, CeremonyChairPlan, BudgetTracker, TimelineBuilder shuttle/event,
  Admin ignoreReviewItem, ToursPanel suggestion.

### CL3 admin profile bulk actions, Sonnet
`src/pages/admin/AdminWeddingProfile.jsx`, `src/components/ShuttleSchedule.jsx`.
- Pending planning notes: Approve all / Dismiss all per category, with a
  confirm naming the count.
- Uncertain-question delete on the profile tab gets ConfirmDialog.
- ShuttleSchedule: "Clear generated runs" (keeps hand-made ones), confirm.
- Apply CL1's StaffingCalculator prop line if CL1 has reported it by then;
  else the orchestrator does.

## Gate
Merge SV4, SV3, SV1, SV2 (server order chosen so the regions with most
churn land last), then CL1, CL3, CL2. Orchestrator applies `sendDbError`
across the 111 sites with a script, builds, audits, tests, pushes, smokes.
