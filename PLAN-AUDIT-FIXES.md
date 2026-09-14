# Plan: fixing the 14 Sep audit with parallel agents

Companion to `AUDIT-2026-09-14.md`. Items 1-20 are that file's top 20.
Items 21-30 are promoted from its "also found" list because each is either a
security hole, a silent data problem, or cheap enough to do while an agent is
already in that region. Nothing here has started.

## Items 21-30 (promoted)

21. Notification emails interpolate user text into HTML unescaped
    (`server/index.js:567`; callers 2159, 2193, 6951). Reuse `esc()` from
    `lib/rsvp-confirmation.js`. Agent S3.
22. `?preview=<weddingId>` on the public wedding site skips both the
    published and password gates (`12662-12682`). Honour it only for a
    signed-in member or admin. Agent S1.
23. The global error handler returns raw `err.message` (Postgres column and
    constraint names) to clients (`14420`), and `/api/gmail-callback-debug`
    (`199`) is public. Generic message to the client, full error to the log;
    debug route behind `requireAdmin`. Agent S1.
24. Storage keys use unsanitised filenames (`2774`, `7056`, `4087` sender
    controlled, `10822`) and SVG is allowed into public buckets (`54`). New
    `server/lib/storage-key.js` with `safeStorageKey(name)`; SVG off the
    public-bucket allowlist. Agent S1 writes the helper and the three sites
    it owns; S2 applies it at 4087.
25. Document parse runs as a bare IIFE with no job row; a redeploy mid-parse
    leaves a half-read document that looks unread, and the 429 fallback to
    Haiku is unrecorded (`13288-13337`). Give it a `sync_jobs` row of kind
    `doc-parse` and a `parsed_with_model` column. Agent S2.
26. Gmail files a multi-recipient email to whichever client was searched
    first (`3860-3864`). The one matcher left that guesses. If more than one
    registered address appears in the headers, queue to `ingest_review` with
    the candidates. Agent S2.
27. The repo cannot rebuild the schema: 7 tables have no DDL anywhere, 10
    exist only in `scripts/*.sql`, root `add_*.sql` hold policies later
    dropped by hand. Dump the live schema and policies to
    `migrations/000_baseline.sql`, move the 32 root files to
    `migrations/archive/`, delete the five root one-off vendor scripts.
    Orchestrator does the dump (needs the DB); H1 does the move.
28. Nothing is lazy-loaded; couples download the 775 KB admin chunk and the
    315 KB Konva chunk on first paint. `React.lazy` + `Suspense` for the
    admin route tree and the table planner; `rollup-plugin-visualizer` on
    build. Agent H2.
29. The Anthropic client has no timeout and `/api/chat` inlines every
    contract's full text when the question mentions a contract
    (`378`, `1827-1840`). Set `timeout`, cap each contract's contribution.
    Agent S3.
30. `planning_notes` has no `source_kind`, `source_id` or confidence, and no
    unique constraint, so dedup is exact-string over the whole wedding on
    every save (`1420-1512`). Add the columns and a unique index on
    `(wedding_id, source_kind, source_id, category, content)`; store the
    model's confidence; `savePlanningNotes` dedups on the key. Agent S2, in
    migration 035.

Also folded into S3 without their own number: the unchecked reads that
decide a limit (notification dedup `599`, inspo cap `7046`, walkthrough
re-parent `9390`); vendor edit-token regenerate action (`8078`); orphaned
storage objects on media delete (`12339`, `12441`).

## Shape of the problem

The server is one 14,436-line file. Two agents editing it at once will
conflict, so parallelism comes from splitting by FILE OWNERSHIP, not by
finding. Client work splits cleanly by component. Server work is split into
line regions, run in git worktrees, and merged by the orchestrator, who
resolves the (rare) overlapping hunk.

Rules every agent gets verbatim:
- Work only in the files you own. If a fix needs another file, stop and
  report it; do not touch it.
- Stage explicit paths. Never `git add -A`. Never push. One commit per item,
  message style `fix(area): plain sentence`, British spelling, no em dashes.
- Every Supabase call destructures `error` and acts on it. Every client
  mutation goes through `apiFetch`. Every new read of a table that can pass
  1000 rows uses `.range()`.
- Before reporting: `npm run lint` on touched files, `npm run audit`,
  `npm run test:unit`, all green.
- Report ends with WHERE TO LOOK and WHAT TO TEST (static-now vs needs-DB).

## Model choice

| Model | Use for | Why |
|---|---|---|
| Haiku 4.5 | CI yaml, package.json, eslint config, ratchet scripts, README, env docs, small client tweaks with an exact recipe | Mechanical, fully specified, cheapest by a wide margin. A mistake is visible in lint or a diff. |
| Sonnet 5 | Pattern-following refactors with a clear acceptance test: swapping raw fetch for a helper, moving forms onto `useAutosave`, hover-only to always-visible, unit tests, timezone call sites | Good at "do this 14 times consistently" at a fraction of Opus cost. |
| Opus 5 | Auth and access middleware, the sync/extraction pipeline, anything where a wrong fix is silent | The expensive failure modes are here: a too-strict auth change locks couples out, a too-loose one is the current state. Idempotency bugs produced 992 duplicate notes last time. |
| Fable (this session) | Orchestration, file-ownership map, diff review, worktree merges, destructive operations, deploy, handoff | Holds the whole audit context; the merges and the deletions should not be delegated. |

Rough cost ordering: Haiku < Sonnet < Opus by roughly 3x per step each way.
The plan spends Opus on two agents only.

## Wave 0, orchestrator only, ~45 min

1. **Get the go on deletions**, then delete with a JSON backup to `backups/`:
   7 "Playwright & Test" weddings (15 Apr), 7 `playwright-*@rixey-test.invalid`
   users, `rls-v-*@rixey.invalid`, `test-couple` + "Test & Couple" wedding,
   `test-admin`. Script: `scripts/cleanup-test-accounts.mjs --dry-run` first.
   (Item 1.)
2. `git checkout -b audit-sep14` from `master`. Confirm no sync job is
   running before any later push (`/api/admin/sync-jobs?limit=5`).
3. Dump the live schema and policies to `migrations/000_baseline.sql`
   (`supabase db dump --linked --schema public` plus a policies query), read
   it through once, commit it. (Item 27, the half that needs the database.)
4. Write the agreed API contract both sides will code against without waiting
   on each other:
   - `POST /api/join/complete` body `{ event_code, partner1_name, partner2_name, email }`,
     auth required, server validates the code, creates the profile with the
     service role, returns `{ wedding_id }`. (Item 18.)
   - `GET /api/sage-messages/all?since=<ISO>` returns only messages after
     `since`. (Item 14.)
   - `GET /api/admin/sync-status` returns per kind `{ last_finished_at,
     last_status, last_error, running }`. (Item 12.)
5. Spawn wave 1.

## Wave 1, five agents in parallel, worktrees, ~2 h

### S1 server-auth, Opus
Owns `server/middleware/weddingAccess.js`, `server/middleware/auth.js`, and
`server/index.js` regions 130-420 (limiters, mounts), 1524-1560 (`/api/chat`
head), 2254 (`/api/welcome`), 2682 (`/api/chat-with-file`), 10413
(`/api/sage-messages`), 10800-10890 (manor-assets), 12143-12160
(extract-url), 12317-12360 (wedding-photos), 12734-12800 (join), 14373
(seating import head), 2472, 7036, 7248 (multipart route heads), 50-100
(multer allowlists), 199 (debug route), 12660-12685 (public site preview),
14400-14436 (global error handler), new `server/lib/storage-key.js`.

Items 2, 3, 4, 5, 18 (server half), 22, 23, 24.
- `app.set('trust proxy', 1)` before the limiters.
- `requireAuth` on chat, welcome, chat-with-file, sage-messages; drop the
  body `userId` fallback; `sage-messages` takes `user_id` from the token and
  refuses `sender: 'sage'` from a non-admin.
- `requireAdmin` on manor-assets POST/PUT/DELETE. Add
  `'wedding-photos': 'wedding_photos'` to `ROW_TABLES`.
- weddingAccess: when the path matches a `ROW_TABLES` route, resolve the
  wedding from the row and ignore body/query. Fail closed (503) on lookup
  errors in enforce mode. Do not cache a null profile on error.
- Multipart routes: add a post-multer membership check helper
  `assertWeddingMember(req, weddingId)` and call it in the four handlers.
- extract-url: `requireAuth`, allow only http(s), resolve host and reject
  private ranges.
- `POST /api/join/complete` per the contract.
Tests: `tests/unit/wedding-access.test.mjs` for `weddingIdFrom`, row-over-body,
fail-closed. Plus a `docs/security-smoke.md` with the curl calls that must
now return 401/403.

### C1 couple-loaders, Sonnet
Owns `src/utils/api.js` (add `loadJson`: throws on `!res.ok`, returns parsed
body), `src/components/{GuestList,AllergyRegistry,ClientInbox,PlanningChecklist,
InspoGallery,PhotoBucket,BorrowCatalog,WebsiteBuilder,TimelineBuilder,
BudgetTracker,VendorChecklist}.jsx`, `src/pages/Dashboard.jsx`.

Items 7, 9 (couple half), 15 (client dates: Dashboard 76/173 end-of-day,
PlanningChecklist 330, VendorChecklist 374 via `formatDateOnly`), 19
(PlanningChecklist hover-only; Dashboard HEIC overlay: honest copy, a
"do this later" link), Dashboard welcome-on-failed-load (405/492).
- Shared `LoadError` panel with Retry, used by every converted loader.
- Autosave/Save must not arm until a load has succeeded (`hasLoadedRef` set
  only on success).
Acceptance: `grep -c 'fetch(\`${API_URL}' ` on owned files = 0.

### C2 couple-autosave-phone, Sonnet
Owns `src/components/{RehearsalDinner,TableLayoutPlanner,BarPlanner,
CeremonyOrder,WeddingParty,MakeupSchedule,DecorInventory,RsvpSettings,
ShuttleSchedule}.jsx`, `src/pages/dashboard/DashboardNav.jsx`.

Items 8, 19 (remaining), plus the small ones from the "also found" list in
those files: BarPlanner seeded from real wedding fields (pass
`wedding.guest_count` etc from Dashboard is C1's file, so C2 reads them via
existing props and labels the fallback as a placeholder), ShuttleSchedule
time parsing with a visible message, WeddingParty `p1Draft ?? partner1`,
RsvpSettings real `<button role="switch">`, CeremonyOrder up/down buttons
beside drag, DashboardNav select rendered from `NAV_ITEMS`.
Acceptance: no `group-hover:opacity-100` on an edit/delete control in owned
files; all three Save-button sections on `useAutosave`.

### A1 admin-client, Sonnet
Owns `src/pages/Admin.jsx`, `src/pages/admin/*`, `src/components/{AdminInbox,
UpcomingMeetings,KnowledgeBaseAdmin,DirectMessagesPanel,WalkthroughNotes}.jsx`,
`src/pages/Login.jsx`.

Items 9 (admin half: the ten `allSettled` calls and the four panels onto
`apiFetch` + toast), 16, 17, 18 (client: show the insert error, call
`/api/join/complete`, "Link to this wedding" action on the unlinked banner
calling a `PATCH /api/admin/profiles/:id` that S1 adds; if S1 has not landed
it, the button can ship behind the existing route check), 19 (links editor
into the profile Overview; internal-note delete always visible + confirm),
12 (UI half: "Sync history" panel reading `/api/admin/sync-jobs?limit=20`,
review-queue count into the header badge, queue block above `mainView`),
14 (client half: `loadData` passes `?since=` 30 days and actions refresh
slices, not everything).
- "Needs attention": drop the keyword list; use the existing LLM judge to set
  a `flagged` boolean at message time (server side is one line in
  `/api/chat`, S1's region: agree the column name `messages.flagged` and A1
  reads it; S1 writes it).
- "Last active": read `last_activity_at` from the weddings list response.
  Server side computes it (S3 in wave 2); until then A1 falls back to the
  current behaviour when the field is absent.
- AdminInbox thread refetch on the 30s tick.

### H1 tooling, Haiku
Owns `.github/workflows/ci.yml` (new), `package.json` scripts,
`server/package.json`, `eslint.config.js`, `scripts/audit-raw-fetch.mjs`
(new, counts raw fetches in `src/`, `--max`), `scripts/audit-unpaginated.mjs`
(new, flags `.from('<big table>')` without `.range`/`.limit`), `.env.example`,
`README.md`, `migrations/APPLIED.md` (skeleton listing 001-034 as applied),
`tests/login.spec.js` (cleanup in `finally`, delete stale `Playwright & Test`
rows at start), `.husky/pre-push` or `simple-git-hooks` running `npm run audit`.

Item 20 minus xlsx, and the file moves in item 27 (`git mv` the 32 root
`.sql` to `migrations/archive/`, `git rm` the five root vendor scripts,
`migrations/APPLIED.md` notes that `000_baseline.sql` is the orchestrator's
dump). Also: `node-cron` into `server/package.json`; remove
`resend` and `nodemailer`; node globals block in eslint so the 75 `no-undef`
disappear; fail startup if `SUPABASE_SERVICE_ROLE_KEY` is absent (one line in
`server/env.js`, which H1 owns).
Acceptance: `npm run audit` includes the two new ratchets; CI file runs lint,
audit, test:unit on push.

### H2 bundle, Haiku
Owns `src/App.jsx` (or wherever the router lives), `vite.config.js`. Item 28:
`React.lazy` + `Suspense` around the admin route tree and
`TableLayoutPlanner`/`TableCanvas`; `rollup-plugin-visualizer` producing
`dist/stats.html` on build. Acceptance: `dist/assets/index-*.js` no longer
pulls the admin or Konva chunks on the couple dashboard (check the preload
tags in `dist/index.html`).

### T1 tests, Sonnet
Owns `tests/unit/*` and `scripts/test-*.mjs`. Convert the four script tests to
`node:test` files; add tests for `shared/guest-names.js`,
`shared/rsvp-fields.js`, `shared/meeting-match.js`, `shared/venue-time.js`.
No app code changes.

### Gate 1 (orchestrator, ~1 h)
Review each worktree diff. Merge in order H1, T1, S1, C1, C2, A1 into
`audit-sep14` (H1 first so its ratchets run against the rest). Run
`npm run audit && npm run lint && npm run test:unit && npm run build`.
Merge to `master` in two pushes: (a) H1 + T1 + S1, smoke-test the security
curls against Railway once it redeploys; (b) the three client lanes, check the
couple dashboard and admin on a phone. Check no sync job is running before
each push.

## Wave 2, three agents in parallel, worktrees, ~2 h

### S2 sync-pipeline, Opus
Owns `server/index.js` regions 1329-1520 (`extractPlanningNotesAI`,
`savePlanningNotes`), 1577-1590 (Sage note context), 3607-4263 (Gmail),
4440-5300 (Quo incl. status), 5369-5900 (Zoom incl. status,
`fileZoomMeeting`, the 5789 date key), 13577-13593 and
`server/lib/transcribe.js` (Deepgram), 13892-14100 (digest + crons),
`migrations/035_extraction_markers.sql` (new).

Also 13280-13340 (document parse).

Items 6, 10, 11, 12 (server half), 13, 25, 26, 30, plus the Zoom transcript
HTTP status check, the weddings-read error at 5516, and `safeStorageKey` at
4087 (item 24).
- Cron for Gmail at :05 and Quo at :35 hourly, each through the same overlap
  guard; `runZoomSync` calls `assertNoOverlappingJob`; cron catch marks the
  job failed.
- Migration 035: `extracted_at`, `extract_error` on the three marker tables;
  partial unique index `sync_jobs(kind) WHERE status='running'`; `flagged`
  boolean on `messages` if S1 did not add it.
- Extraction: markers still written first, but `extracted_at` set only on
  success; a `backfill-extraction` pass re-reads rows where it is null.
  Reprocess refreshes the transcript note only. Quo call branch: `continue`
  on marker error, prior-note check.
- Sage context: `confirmed`/`added` only, reuse `buildWeddingContext`'s
  cleaning and cap.
- Gmail: loop on `nextPageToken` until a page is all-processed or a date
  floor; same for Quo texts and calls.
- Status endpoints return the last `sync_jobs` row per kind; Zoom makes one
  cheap API call. Digest gains "failed syncs 24h" and "review queue N, oldest
  X days"; `createNotification` on a scheduled failure.
Tests: `tests/unit/extraction-markers.test.mjs` using a fake supabase client
for the marker-then-extract ordering.

### S3 server-bounds-time, Sonnet
Owns `server/index.js` regions 2240-2250, 3085-3095, 5250-5255, 6130-6140,
6250-6270, 7690-7710, 8040-8045, 9800-9830, 10530-10545, 10585-10600,
14341-14351, 13797-13800, `/api/admin/weddings` handler, 378 (Anthropic
client), 560-600 (notification email + dedup), 1820-1845 (contract text in
chat), 7040-7050, 8075-8095, 9385-9400, 12335-12345, 12438-12445.

Items 14, 15 (server sites), 21, 29, plus seating-import false `created`, walkthrough
apply ignoring read error, `express.json({ limit: '2mb' })`, `since` support
on `/api/sage-messages/all`, `last_activity_at` on the weddings list
(max across `messages`, `direct_messages`, `activity_log`,
`processed_emails`, `processed_quo_messages`).
Acceptance: `scripts/audit-unpaginated.mjs --max 0`.

### X1 xlsx-swap, Sonnet
Owns `server/index.js` regions 100-125 (spreadsheetUpload) and the two
handlers that call `xlsx` (seating import parse, guest CSV/XLSX import),
`server/package.json`, `package.json`. Replace `xlsx` with `exceljs`; keep
the parsed output shape identical; unit test with a fixture workbook.

### Gate 2 (orchestrator, ~1 h)
Merge S3, X1, S2 (S2 last, largest). Resolve any overlapping hunks by hand.
Isadora or the orchestrator runs migration 035 via the usual
`run-migration.ts` route (no BEGIN/COMMIT). Push to master when no sync job
is running. Watch the first :05 Gmail cron and :35 Quo cron land in
`sync_jobs`.

## Wave 3, orchestrator, ~1 h

- Gmail reconnect in the admin (still owed from August), then one manual
  Gmail sync to prove paging.
- Rotate the Deepgram key (still owed).
- Update `AUDIT-2026-09-14.md` with a status column, write the memory note,
  hand off with WHERE TO LOOK / WHAT TO TEST.
- Delete the `audit-sep14` branch.

## Deferred, deliberately

- Splitting `server/index.js` into routers. Worth doing, but after the fixes
  above land, not alongside them; it would collide with every server lane.
- `party_id` rewrite, vendor linking, Bloom port: unchanged from the parked
  list.
- Lazy-loading the admin bundle: small, safe, any time; Haiku task.

## Timeline

| Wave | Agents | Wall time |
|---|---|---|
| 0 | orchestrator | 45 min |
| 1 | S1 Opus, C1 Sonnet, C2 Sonnet, A1 Sonnet, H1 Haiku, H2 Haiku, T1 Sonnet | ~2 h + 1 h gate |
| 2 | S2 Opus, S3 Sonnet, X1 Sonnet | ~2.5 h + 1 h gate |
| 3 | orchestrator | 1 h |

About one working day of wall time. Ten agents, two on Opus, two on Haiku.

## Coverage check

| Item | Agent | Item | Agent | Item | Agent |
|---|---|---|---|---|---|
| 1 | Wave 0 | 11 | S2 | 21 | S3 |
| 2 | S1 | 12 | S2 + A1 | 22 | S1 |
| 3 | S1 | 13 | S2 | 23 | S1 |
| 4 | S1 | 14 | S3 + A1 | 24 | S1 + S2 |
| 5 | S1 | 15 | C1 + S3 | 25 | S2 |
| 6 | S2 | 16 | A1 | 26 | S2 |
| 7 | C1 | 17 | A1 | 27 | Wave 0 + H1 |
| 8 | C2 | 18 | S1 + A1 | 28 | H2 |
| 9 | C1 + A1 | 19 | C1 + C2 + A1 | 29 | S3 |
| 10 | S2 | 20 | H1 + T1 + X1 | 30 | S2 |
