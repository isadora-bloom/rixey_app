/**
 * The database-error mapper.
 *
 * `dbErrorToResponse` is pure: no Express, no Supabase client, just an error
 * shape in and a `{ status, body }` shape out. That is what most of these
 * tests check. `sendDbError` is the one-line wrapper the global handler
 * calls; a fake `res` (same pattern as wedding-access.test.mjs) is enough to
 * exercise it without a real server.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbErrorToResponse, sendDbError } from '../../server/lib/db-error.js';

function fakeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
  };
  return res;
}

// ── 22P02 invalid_text_representation ───────────────────────────────────────

test('22P02 names the type when the message carries one but no column', () => {
  const { status, body } = dbErrorToResponse({
    code: '22P02',
    message: 'invalid input syntax for type uuid: "not-a-uuid"',
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'A field had the wrong shape');
  assert.equal(body.field, 'uuid');
});

test('22P02 prefers a named column over the type when both are present', () => {
  const { status, body } = dbErrorToResponse({
    code: '22P02',
    message: 'invalid input syntax for type integer: "abc"',
    details: 'column "guest_count" of relation "weddings"',
  });
  assert.equal(status, 400);
  assert.equal(body.field, 'guest_count');
});

test('22P02 falls back to null rather than throwing when nothing parses', () => {
  const { status, body } = dbErrorToResponse({ code: '22P02', message: 'malformed array literal' });
  assert.equal(status, 400);
  assert.equal(body.field, null);
});

// ── 23502 not_null_violation ─────────────────────────────────────────────────

test('23502 names the required column', () => {
  const { status, body } = dbErrorToResponse({
    code: '23502',
    message: 'null value in column "email" violates not-null constraint',
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'email is required');
  assert.equal(body.column, 'email');
});

test('23502 with no parsable column still answers, generically', () => {
  const { status, body } = dbErrorToResponse({ code: '23502', message: 'not-null constraint failed' });
  assert.equal(status, 400);
  assert.equal(body.error, 'A field is required');
  assert.equal(body.column, null);
});

// ── 23505 unique_violation ───────────────────────────────────────────────────

test('23505 names the constraint', () => {
  const { status, body } = dbErrorToResponse({
    code: '23505',
    message: 'duplicate key value violates unique constraint "wedding_guests_wedding_id_email_key"',
  });
  assert.equal(status, 409);
  assert.equal(body.error, 'That already exists');
  assert.equal(body.constraint, 'wedding_guests_wedding_id_email_key');
});

// ── 23503 foreign_key_violation ──────────────────────────────────────────────

test('23503 names the constraint and uses the "still refers to" wording', () => {
  const { status, body } = dbErrorToResponse({
    code: '23503',
    message: 'update or delete on table "vendor_checklist" violates foreign key constraint "vendor_contracts_vendor_id_fkey" on table "vendor_contracts"',
  });
  assert.equal(status, 409);
  assert.equal(body.error, 'Something still refers to that record');
  assert.equal(body.constraint, 'vendor_contracts_vendor_id_fkey');
});

// ── PGRST116 no rows ─────────────────────────────────────────────────────────

test('PGRST116 is a plain 404', () => {
  const { status, body } = dbErrorToResponse({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
  assert.equal(status, 404);
  assert.deepEqual(body, { error: 'Not found' });
});

// ── anything else ────────────────────────────────────────────────────────────

test('an unknown code is a generic 500 carrying a request id', () => {
  const { status, body } = dbErrorToResponse({ code: '55P03', message: 'lock not available' });
  assert.equal(status, 500);
  assert.equal(body.error, 'Something went wrong');
  assert.equal(typeof body.requestId, 'string');
  assert.ok(body.requestId.length > 0);
});

test('no code at all is also a generic 500, not a throw', () => {
  const { status, body } = dbErrorToResponse(new Error('boom'));
  assert.equal(status, 500);
  assert.equal(body.error, 'Something went wrong');
});

test('a passed-in requestId is used rather than a fresh one', () => {
  const { body } = dbErrorToResponse({ code: 'XX000', message: 'internal error' }, { requestId: 'fixed-id' });
  assert.equal(body.requestId, 'fixed-id');
});

// ── sendDbError, the Express-facing wrapper ─────────────────────────────────

test('sendDbError sends the mapped status and body', () => {
  const res = fakeRes();
  sendDbError(res, { code: 'PGRST116', message: 'no rows' });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Not found' });
});

test('sendDbError uses a requestId handed in, so a caller\'s own log line matches the response', () => {
  const res = fakeRes();
  const originalError = console.error;
  console.error = () => {};
  try {
    sendDbError(res, new Error('boom'), { requestId: 'handler-generated-id' });
  } finally {
    console.error = originalError;
  }
  assert.equal(res.body.requestId, 'handler-generated-id');
});

test('sendDbError still answers with a requestId on an unmapped error, and does not throw', () => {
  const res = fakeRes();
  const originalError = console.error;
  console.error = () => {}; // this case logs by design; keep the test output clean
  try {
    sendDbError(res, new Error('everything is on fire'));
  } finally {
    console.error = originalError;
  }
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Something went wrong');
  assert.equal(typeof res.body.requestId, 'string');
});
