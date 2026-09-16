/**
 * validateBody strips a request down to an allow-list. The bug worth a test
 * is what it used to do with everything else: drop it with nothing said, so
 * a typo'd field name or a stale client looked exactly like a successful
 * write of nothing.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBody } from '../../server/middleware/validate.js';

function fakeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
  };
  return res;
}

function run(allowedFields, body) {
  const req = { body };
  const res = fakeRes();
  let nexted = false;
  validateBody(allowedFields)(req, res, () => { nexted = true; });
  return { req, res, nexted };
}

test('keeps only the allowed fields', () => {
  const { req, nexted } = run(['name', 'email'], { name: 'Ash', email: 'a@b.com', isAdmin: true });
  assert.equal(nexted, true);
  assert.deepEqual(req.body, { name: 'Ash', email: 'a@b.com' });
});

test('names the ignored fields on req, for whatever runs next', () => {
  const { req } = run(['name'], { name: 'Ash', role: 'admin', wedding_id: 'x' });
  assert.deepEqual(req.ignoredFields, ['role', 'wedding_id']);
});

test('an all-ignored body is a 400 that names both the allowed and the ignored fields', () => {
  const { res, nexted } = run(['name', 'email'], { role: 'admin' });
  assert.equal(nexted, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: 'No valid fields provided',
    allowed: ['name', 'email'],
    ignored: ['role'],
  });
});

test('a field explicitly set to undefined is skipped, not kept as a key', () => {
  const { req } = run(['name', 'email'], { name: 'Ash', email: undefined });
  assert.deepEqual(req.body, { name: 'Ash' });
});

test('a field set to null is kept — null is a real value, not a missing one', () => {
  const { req } = run(['notes'], { notes: null });
  assert.deepEqual(req.body, { notes: null });
});

test('a non-object body is refused before any stripping', () => {
  const { res, nexted } = run(['name'], null);
  assert.equal(nexted, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Request body is required');
});
