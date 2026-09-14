# Rixey Portal

Wedding planning portal: a real-time couple interface and admin ops dashboard for managing weddings, vendors, communications, and planning.

The client is a Vite + React application with the server as a separate Node.js express process. Both are deployed automatically on push to master: the client to Vercel (project `rixey-app`), the server to Railway (service `rixeyapp-production`).

## Local Setup

```bash
npm install
npm run dev           # Vite dev server on :5173
npm run server        # Express server on :3001
```

Open http://localhost:5173.

## Environment

See `.env.example` for the full list. Create a `.env` file locally with:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Supabase client credentials
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side Supabase access; **required** to start
- `SUPABASE_URL`: Backend Supabase URL
- `ANTHROPIC_API_KEY`: Claude integration for Sage chat and planning note extraction
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Gmail and Google Calendar sync
- `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`: Zoom transcript ingestion
- `QUO_API_KEY`, `CALENDLY_API_TOKEN`: Third-party integrations
- `DEEPGRAM_API_KEY`: Zoom and tour video transcription
- `EMAIL_FROM_NAME`, `ADMIN_EMAIL`: Email configuration
- `WEDDING_ACCESS_MODE`, `RIXEY_API_URL`, `PORT`: Deployment-specific

On Railway, set these in the project settings. The server will fail to start if `SUPABASE_SERVICE_ROLE_KEY` is missing.

## Quality Gates

Before pushing, run the audit suite:

```bash
npm run audit
```

This runs five checks in sequence:

- `audit:errors`: 69 unchecked-error patterns across server code (e.g., missing `.error` destructure on Supabase calls)
- `audit:nav`: client navigation tree parity (e.g. orphaned routes, mismatched labels)
- `audit:unsurfaced`: messages that reach the DB but never surface to the UI (no toast, no redirect)
- `audit:writes`: `.insert({ ...req.body })` patterns that fail on unknown form fields
- `audit:fetch`: raw `fetch(\`${API_URL}...)` calls bypassing the `apiFetch` error handler (target: 0; C1/A1 agents reduce in parallel)
- `audit:pages`: unbounded `.select()` on large tables (usage_logs, messages, etc.) without `.range()`, `.limit()`, `.single()`, `.maybeSingle()`
- `test:unit`: unit tests on Node modules (shared, server/lib)

All pass green before merge. A pre-push hook runs `npm run audit` automatically (via `simple-git-hooks`).

```bash
npm run lint           # ESLint across src/, server/, scripts/
npm run test:unit      # Node test suite
npm run build          # Vite production bundle
npm test               # Playwright e2e tests
```

## Migrations

Migrations live in `migrations/` as numbered SQL files with no BEGIN/COMMIT wrapper. Applied manually via `run-migration.ts` (never auto-applied on deploy). Each file's header comment records the date applied; the ledger in `migrations/APPLIED.md` lists all applied so far.

Historical one-off SQL files are archived in `migrations/archive/`.

## Documentation

- `CODEBASE_OVERVIEW.md` and `RIXEY_PORTAL_COMPLETE_DOCUMENTATION.md` are historical (Feb 2026).
- `AUDIT-2026-09-14.md` records the 14 Sep audit findings and fix plan.
- `docs/security-smoke.md` lists security-relevant curl commands that must return 401/403.

## Code Structure

- `src/pages/` — top-level routes (Dashboard, Admin, Login)
- `src/components/` — couple and admin UI components
- `src/utils/` — shared utilities (apiFetch, venue-time helpers, etc.)
- `server/index.js` — 14,436-line Express server with all endpoints
- `server/middleware/` — auth, RLS enforcement, multer config
- `server/lib/` — helpers (transcribe, notification email, RSVP confirmation)
- `tests/` — Playwright e2e, unit tests under `tests/unit/`

The server is one large file; client routes are tree-shaken so couples don't download the admin bundle.

## Deploy

Merging to master triggers CI on GitHub Actions (lint, audit, test:unit, build) and automatic deployment:
- Client: Vercel redeploys immediately from the build output
- Server: Railway redeploys from the `server/` directory; reads `.env` from project settings

No secrets are needed in the repo; env vars are set in Vercel and Railway consoles.

Before pushing, confirm no sync job is running: `GET /api/admin/sync-jobs?limit=5`.
