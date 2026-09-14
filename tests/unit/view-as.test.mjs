/**
 * "View as couple" is read-only, and has to stay that way.
 *
 * The whole feature is Grace looking at a couple's live portal while on the
 * phone to them. Every screen under it is the couple's real one, wired to the
 * couple's real data, with a venue token behind it that the server will happily
 * accept for any wedding. The single thing standing between that and Grace
 * overwriting a guest list by leaning on a keyboard is the guard in
 * ViewAsContext, plus a handful of gates in Dashboard on the effects that write
 * without being asked.
 *
 * None of that can be exercised here: the files are JSX and these tests run on
 * plain node. So this reads them, the way scripts/audit-nav-parity.mjs reads the
 * menus, and fails if a gate goes missing. A source check is a weak test of
 * behaviour and a decent test of intent, and intent is what erodes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

const viewAsContext = read('src/context/ViewAsContext.jsx');
const dashboard = read('src/pages/Dashboard.jsx');
const weddingProfile = read('src/pages/admin/AdminWeddingProfile.jsx');

test('only reads are let through while viewing as the couple', () => {
  const methods = viewAsContext.match(/const READ_METHODS = new Set\(\[([^\]]*)\]\)/);
  assert.ok(methods, 'READ_METHODS is gone from ViewAsContext');
  const allowed = methods[1].match(/'([A-Z]+)'/g).map(s => s.replaceAll("'", ''));
  assert.deepEqual(
    allowed.sort(),
    ['GET', 'HEAD', 'OPTIONS'],
    'a method that can change data has been added to the read list',
  );
});

test('the only write allowed through is the admin keeping their own session', () => {
  const allow = viewAsContext.match(/const ALWAYS_ALLOWED = \[([^\]]*)\]/);
  assert.ok(allow, 'ALWAYS_ALLOWED is gone from ViewAsContext');
  assert.equal(
    allow[1].trim(),
    '/\\/auth\\/v1\\//',
    'the view-as allow-list has grown past Supabase auth, which is the one exception it may have',
  );
});

test('the guard is taken down again when the view-as session ends', () => {
  assert.match(
    viewAsContext,
    /if \(window\.fetch === guardedFetch\) window\.fetch = original/,
    'nothing restores the original fetch, so the whole app would stay read-only',
  );
});

test('Dashboard never sends a welcome message on the venue behalf', () => {
  assert.match(
    dashboard,
    /if \(viewAs\) return\s*\n\s*if \(!loadingMessages && !loadFailed && !welcomeSent/,
    'the welcome-message effect is no longer gated on viewAs; opening a quiet '
    + "wedding would post a message into the couple's own chat",
  );
});

test('Dashboard does not show the couple their photo prompt to the venue', () => {
  assert.match(
    dashboard,
    /\{needsPhoto && !viewAs && \(/,
    'the couple-photo overlay is no longer gated on viewAs',
  );
});

test('Sage sending is refused during view-as', () => {
  const guarded = [...dashboard.matchAll(/if \(viewAs\) \{ toastError\(READ_ONLY_MESSAGE\); return \}/g)];
  assert.ok(
    guarded.length >= 3,
    `expected sendMessage, sendWithFile and saveProfile to refuse during view-as, found ${guarded.length} guards`,
  );
});

test('the wedding profile renders the real Dashboard, not a second copy of it', () => {
  assert.match(
    weddingProfile,
    /import Dashboard from '\.\.\/Dashboard'/,
    "AdminWeddingProfile no longer imports the couple's Dashboard, so something "
    + 'else is drawing the couple view and will drift from it',
  );
  assert.match(weddingProfile, /<ViewAsProvider value=\{viewAsValue\}>/);
});
