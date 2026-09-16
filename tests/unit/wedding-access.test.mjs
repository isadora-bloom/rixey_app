/**
 * Who may touch which wedding.
 *
 * This middleware had two bugs that a test would have caught on the day and
 * neither of which shows up in any screen: it preferred a wedding id the
 * request stated over the row actually being edited, so a couple could send
 * PUT /api/guests/<another couple's guest id>?weddingId=<their own> and rename
 * a stranger's guest; and it allowed the request whenever a lookup failed, so
 * a database blip switched authorisation off for everybody and said nothing.
 *
 * Both are asserted here in the negative, which is the only useful direction:
 * the failing cases are the ones that cost something.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWeddingAccess,
  assertWeddingMember,
  weddingIdFrom,
  rowLookupFor,
  matchesPrefix,
  matchesAnyPrefix,
  ADMIN_PREFIXES,
} from '../../server/middleware/weddingAccess.js';

const OURS   = '11111111-1111-4111-8111-111111111111';
const THEIRS = '22222222-2222-4222-8222-222222222222';
const GUEST  = '33333333-3333-4333-8333-333333333333';  // a guest of THEIRS
const COUPLE = '44444444-4444-4444-8444-444444444444';  // a signed-in user

/**
 * Enough of a supabase client to answer the three reads this middleware does.
 *
 * `fail` names a table whose read should error, which is how the fail-closed
 * cases are set up. Everything is built per call so one test cannot warm a
 * cache for the next.
 */
function fakeSupabase({ rows = {}, profiles = {}, weddings = [OURS, THEIRS], fail = null } = {}) {
  return {
    from(table) {
      const builder = {
        _table: table,
        _id: null,
        select() { return builder; },
        eq(_col, value) { builder._id = value; return builder; },
        async maybeSingle() {
          if (fail === table) return { data: null, error: { message: `${table} is down` } };
          if (table === 'profiles') return { data: profiles[builder._id] || null, error: null };
          const table_rows = rows[table] || {};
          return { data: table_rows[builder._id] || null, error: null };
        },
        // `.from('weddings').select('id')` is awaited without maybeSingle.
        then(resolve, reject) {
          if (fail === table) return resolve({ data: null, error: { message: `${table} is down` } });
          return Promise.resolve({ data: weddings.map(id => ({ id })), error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

/** Run the middleware once and report what it did. */
async function run(supabase, req) {
  const middleware = createWeddingAccess(supabase);
  let allowed = false;
  let status = null;
  let body = null;
  const res = {
    status(code) { status = code; return res; },
    json(payload) { body = payload; return res; },
  };
  await middleware({ method: 'PUT', baseUrl: '/api', body: {}, query: {}, ...req }, res, () => { allowed = true; });
  return { allowed, status, body };
}

// ── weddingIdFrom ────────────────────────────────────────────────────────────

test('weddingIdFrom reads the body, then the query, then a lone path uuid', () => {
  assert.equal(weddingIdFrom({ body: { weddingId: OURS }, path: '/guests' }), OURS);
  assert.equal(weddingIdFrom({ body: { wedding_id: OURS }, path: '/guests' }), OURS);
  assert.equal(weddingIdFrom({ body: {}, query: { weddingId: OURS }, path: '/guests' }), OURS);
  assert.equal(weddingIdFrom({ body: {}, path: `/budget/${OURS}` }), OURS);
});

test('weddingIdFrom will not guess between two uuids in one path', () => {
  assert.equal(weddingIdFrom({ body: {}, path: `/weddings/${OURS}/guests/${GUEST}` }), null);
});

test('weddingIdFrom rejects a value that is not a uuid', () => {
  assert.equal(weddingIdFrom({ body: { weddingId: 'all' }, path: '/guests' }), null);
});

// ── rowLookupFor ─────────────────────────────────────────────────────────────

test('rowLookupFor maps a known resource to its table', () => {
  assert.deepEqual(rowLookupFor(`/guests/${GUEST}`), { table: 'wedding_guests', id: GUEST });
});

test('rowLookupFor covers wedding-photos, which it used to miss', () => {
  assert.deepEqual(rowLookupFor(`/wedding-photos/${GUEST}`), { table: 'wedding_photos', id: GUEST });
});

test('rowLookupFor treats the wedding route as the wedding itself', () => {
  assert.deepEqual(rowLookupFor(`/weddings/${OURS}`), { weddingId: OURS });
});

test('rowLookupFor ignores a resource it has no mapping for', () => {
  assert.equal(rowLookupFor(`/budget/${OURS}`), null);
});

// ── prefix matching, on segment boundaries ───────────────────────────────────

test('matchesPrefix requires a boundary when the prefix has no trailing slash', () => {
  assert.equal(matchesPrefix('/api/admin', '/api/admin'), true);
  assert.equal(matchesPrefix('/api/admin/x', '/api/admin'), true);
  assert.equal(matchesPrefix('/api/admin-tools', '/api/admin'), false);
  assert.equal(matchesPrefix('/api/admin-tools/y', '/api/admin'), false);
});

test('matchesPrefix takes a trailing-slash prefix as already stating its own boundary', () => {
  assert.equal(matchesPrefix('/api/w/some-slug', '/api/w/'), true);
  assert.equal(matchesPrefix('/api/wardrobe', '/api/w/'), false);
});

test('matchesAnyPrefix is true for /api/admin/x and false for /api/admin-tools', () => {
  assert.equal(matchesAnyPrefix('/api/admin/x', ADMIN_PREFIXES), true);
  assert.equal(matchesAnyPrefix('/api/admin-tools', ADMIN_PREFIXES), false);
});

test('/api/admin-tools is not swallowed by the /api/admin bypass: a non-member is still refused', async () => {
  // Before the boundary fix, fullPath.startsWith('/api/admin') matched this
  // path too, which skipped the membership check entirely and let anyone
  // through. Route it the ordinary way instead: a stated uuid it does not
  // recognise as a row still resolves to "is this a wedding", and COUPLE
  // does not belong to THEIRS.
  const supabase = fakeSupabase({ ...memberOfOurs });
  const result = await run(supabase, { path: `/admin-tools/${THEIRS}`, userId: COUPLE });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
});

test('/api/admin/x still bypasses the membership check entirely, boundary or not', async () => {
  const supabase = fakeSupabase({ ...memberOfOurs });
  const result = await run(supabase, { path: `/admin/${THEIRS}`, userId: COUPLE });
  assert.equal(result.allowed, true);
});

// ── the row wins over what the request claims ────────────────────────────────

const guestOfTheirs = { rows: { wedding_guests: { [GUEST]: { wedding_id: THEIRS } } } };
const memberOfOurs  = { profiles: { [COUPLE]: { id: COUPLE, wedding_id: OURS, is_admin: false } } };

test('a stated weddingId cannot launder a write to another couple\'s row', async () => {
  const result = await run(fakeSupabase({ ...guestOfTheirs, ...memberOfOurs }), {
    path: `/guests/${GUEST}`,
    query: { weddingId: OURS },       // the caller's own wedding, which is the trick
    userId: COUPLE,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
});

test('the same trick in the body is refused too', async () => {
  const result = await run(fakeSupabase({ ...guestOfTheirs, ...memberOfOurs }), {
    path: `/guests/${GUEST}`,
    body: { wedding_id: OURS },
    userId: COUPLE,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
});

test('a couple editing a row of their own wedding is allowed', async () => {
  const supabase = fakeSupabase({
    rows: { wedding_guests: { [GUEST]: { wedding_id: OURS } } },
    ...memberOfOurs,
  });
  const result = await run(supabase, { path: `/guests/${GUEST}`, userId: COUPLE });
  assert.equal(result.allowed, true);
});

test('the list-by-wedding shape of the same route still works', async () => {
  // GET /api/guests/:weddingId and PUT /api/guests/:id share a prefix. The uuid
  // is looked up as a row first and falls back to the wedding list.
  const supabase = fakeSupabase({ rows: { wedding_guests: {} }, ...memberOfOurs });
  const result = await run(supabase, { method: 'GET', path: `/guests/${OURS}`, userId: COUPLE });
  assert.equal(result.allowed, true);
});

test('and refuses the list of a wedding that is not theirs', async () => {
  const supabase = fakeSupabase({ rows: { wedding_guests: {} }, ...memberOfOurs });
  const result = await run(supabase, { method: 'GET', path: `/guests/${THEIRS}`, userId: COUPLE });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
});

test('a row that does not exist is left to the route to 404', async () => {
  const supabase = fakeSupabase({ rows: { wedding_guests: {} }, ...memberOfOurs });
  const missing = '55555555-5555-4555-8555-555555555555';
  const result = await run(supabase, { path: `/guests/${missing}`, userId: COUPLE });
  assert.equal(result.allowed, true);
});

test('an anonymous caller gets nothing', async () => {
  const result = await run(fakeSupabase({ ...guestOfTheirs }), { path: `/guests/${GUEST}` });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
});

test('an admin may touch any wedding', async () => {
  const supabase = fakeSupabase({
    ...guestOfTheirs,
    profiles: { [COUPLE]: { id: COUPLE, wedding_id: null, is_admin: true } },
  });
  const result = await run(supabase, { path: `/guests/${GUEST}`, userId: COUPLE });
  assert.equal(result.allowed, true);
});

test('a route with no row mapping still reads the body', async () => {
  const supabase = fakeSupabase({ ...memberOfOurs });
  const refused = await run(supabase, { path: '/guests', body: { wedding_id: THEIRS }, userId: COUPLE });
  assert.equal(refused.allowed, false);
  assert.equal(refused.status, 403);

  const allowed = await run(fakeSupabase({ ...memberOfOurs }), {
    path: '/guests', body: { wedding_id: OURS }, userId: COUPLE,
  });
  assert.equal(allowed.allowed, true);
});

// ── failing closed ───────────────────────────────────────────────────────────

test('a failed row lookup refuses rather than waving the request through', async () => {
  const supabase = fakeSupabase({ ...guestOfTheirs, ...memberOfOurs, fail: 'wedding_guests' });
  const result = await run(supabase, { path: `/guests/${GUEST}`, userId: COUPLE });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'access check unavailable');
});

test('a failed weddings read refuses too', async () => {
  const supabase = fakeSupabase({ ...memberOfOurs, fail: 'weddings' });
  const result = await run(supabase, { path: '/budget/' + OURS, userId: COUPLE });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 503);
});

test('a failed profile read refuses, and is not remembered as "no profile"', async () => {
  const supabase = fakeSupabase({ ...guestOfTheirs, ...memberOfOurs, fail: 'profiles' });
  const first = await run(supabase, { path: `/guests/${GUEST}`, userId: COUPLE });
  assert.equal(first.status, 503);

  // The cache used to hold a null profile for fifteen seconds after one blip,
  // so a couple stayed locked out long after the database came back. A fresh
  // client here stands in for the database recovering.
  const healthy = fakeSupabase({ rows: { wedding_guests: { [GUEST]: { wedding_id: OURS } } }, ...memberOfOurs });
  const second = await run(healthy, { path: `/guests/${GUEST}`, userId: COUPLE });
  assert.equal(second.allowed, true);
});

test('audit mode still logs and lets everything through', async () => {
  const before = process.env.WEDDING_ACCESS_MODE;
  process.env.WEDDING_ACCESS_MODE = 'audit';
  try {
    const result = await run(fakeSupabase({ ...guestOfTheirs, ...memberOfOurs }), {
      path: `/guests/${GUEST}`, query: { weddingId: OURS }, userId: COUPLE,
    });
    assert.equal(result.allowed, true);
    assert.equal(result.status, null);

    const failed = await run(
      fakeSupabase({ ...guestOfTheirs, ...memberOfOurs, fail: 'wedding_guests' }),
      { path: `/guests/${GUEST}`, userId: COUPLE },
    );
    assert.equal(failed.allowed, true);
  } finally {
    if (before === undefined) delete process.env.WEDDING_ACCESS_MODE;
    else process.env.WEDDING_ACCESS_MODE = before;
  }
});

// ── assertWeddingMember, for the multipart routes ────────────────────────────

test('assertWeddingMember refuses a caller with no token', async () => {
  const verdict = await assertWeddingMember(fakeSupabase({}), {}, OURS);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 401);
});

test('assertWeddingMember refuses when no wedding is named', async () => {
  const verdict = await assertWeddingMember(fakeSupabase({ ...memberOfOurs }), { userId: COUPLE }, undefined);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 403);
});

test('assertWeddingMember refuses a value that is not a wedding id', async () => {
  const verdict = await assertWeddingMember(fakeSupabase({ ...memberOfOurs }), { userId: COUPLE }, 'undefined');
  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 403);
});

test('assertWeddingMember lets a member in', async () => {
  const verdict = await assertWeddingMember(fakeSupabase({ ...memberOfOurs }), { userId: COUPLE }, OURS);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.why, 'member');
});

test('assertWeddingMember keeps a member out of another wedding', async () => {
  const verdict = await assertWeddingMember(fakeSupabase({ ...memberOfOurs }), { userId: COUPLE }, THEIRS);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 403);
});

test('assertWeddingMember lets an admin in anywhere', async () => {
  const supabase = fakeSupabase({ profiles: { [COUPLE]: { id: COUPLE, wedding_id: null, is_admin: true } } });
  const verdict = await assertWeddingMember(supabase, { userId: COUPLE }, THEIRS);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.why, 'admin');
});

test('assertWeddingMember refuses a signed-in user with no profile', async () => {
  const verdict = await assertWeddingMember(fakeSupabase({}), { userId: COUPLE }, OURS);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 403);
});

test('assertWeddingMember fails closed when the profile read errors', async () => {
  const supabase = fakeSupabase({ ...memberOfOurs, fail: 'profiles' });
  const verdict = await assertWeddingMember(supabase, { userId: COUPLE }, OURS);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 503);
});
