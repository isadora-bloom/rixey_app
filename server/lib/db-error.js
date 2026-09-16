/**
 * Turn a Postgres/PostgREST error into something a couple can read.
 *
 * Before this, the 111 places that caught a database error mostly did
 * `res.status(500).json({ error: e.message })`, which hands the browser
 * whatever Postgres said: a raw constraint name, a column, sometimes the
 * value that broke it. It reads as a crash, not as "you left the phone
 * number blank", and it leaks the shape of the schema to anyone watching
 * the network tab.
 *
 * `dbErrorToResponse` is the pure half: given an error object (a Supabase/
 * PostgREST error carries `code`, `message`, `details`/`detail`, `hint`,
 * sometimes `column`/`constraint` directly), it returns `{ status, body }`
 * with no I/O and no Express dependency, so it is trivial to unit test.
 * `sendDbError` is the thin Express-facing wrapper the route handlers call.
 *
 * Known codes:
 *   22P02  invalid_text_representation  — a field had the wrong shape
 *   23502  not_null_violation           — a required column was left out
 *   23505  unique_violation             — that row already exists
 *   23503  foreign_key_violation        — something still points at the row
 *   PGRST116  PostgREST "no rows"       — .single()/.maybeSingle() found none
 * Anything else is a plain 500, logged in full against a request id so it
 * can be found later without the couple having to describe what happened.
 */

import crypto from 'node:crypto';

function newRequestId() {
  return crypto.randomBytes(4).toString('hex');
}

/** First `column "name"` mentioned in any of the given strings, if any. */
function parseColumn(...texts) {
  for (const text of texts) {
    const m = /column "([^"]+)"/.exec(text || '');
    if (m) return m[1];
  }
  return null;
}

/** First `constraint "name"` mentioned in any of the given strings, if any. */
function parseConstraint(...texts) {
  for (const text of texts) {
    const m = /constraint "([^"]+)"/.exec(text || '');
    if (m) return m[1];
  }
  return null;
}

/**
 * Postgres's own wording for a bad literal is
 * `invalid input syntax for type uuid: "not-a-uuid"`, with no column named at
 * all — the value is the only thing on offer. Pull out the type and the
 * value when both are there; either alone is still worth reporting.
 */
function parseInvalidInput(...texts) {
  for (const text of texts) {
    const withValue = /invalid input syntax for type (\w+): "([^"]*)"/.exec(text || '');
    if (withValue) return { type: withValue[1], value: withValue[2] };
    const typeOnly = /invalid input syntax for type (\w+)/.exec(text || '');
    if (typeOnly) return { type: typeOnly[1], value: null };
  }
  return null;
}

/**
 * @param {any} err
 * @param {{ requestId?: string }} [opts]
 * @returns {{ status: number, body: Record<string, unknown> }}
 */
export function dbErrorToResponse(err, opts = {}) {
  const code = err?.code;
  const message = err?.message || '';
  const details = err?.details || err?.detail || '';

  switch (code) {
    case '22P02': {
      const invalid = parseInvalidInput(message, details);
      const field = err?.column || parseColumn(message, details) || invalid?.type || null;
      return { status: 400, body: { error: 'A field had the wrong shape', field } };
    }
    case '23502': {
      const column = err?.column || parseColumn(message, details);
      return {
        status: 400,
        body: { error: `${column || 'A field'} is required`, column: column || null },
      };
    }
    case '23505': {
      const constraint = err?.constraint || parseConstraint(message, details);
      return { status: 409, body: { error: 'That already exists', constraint: constraint || null } };
    }
    case '23503': {
      const constraint = err?.constraint || parseConstraint(message, details);
      return {
        status: 409,
        body: { error: 'Something still refers to that record', constraint: constraint || null },
      };
    }
    case 'PGRST116':
      return { status: 404, body: { error: 'Not found' } };
    default: {
      const requestId = opts.requestId || newRequestId();
      return { status: 500, body: { error: 'Something went wrong', requestId } };
    }
  }
}

/**
 * Express-facing wrapper. Logs the full error against the same request id
 * the caller sees, only for the unmapped (500) case — the mapped cases are
 * expected shapes, not incidents, and logging every unique-constraint hit
 * would just be noise.
 *
 * `opts.requestId` lets a caller that already generated one for its own log
 * line (the global handler does, to log every unhandled error regardless of
 * shape) hand it in, so the id printed in the log and the id returned to the
 * browser are the same string rather than two.
 */
export function sendDbError(res, err, opts = {}) {
  const requestId = opts.requestId || newRequestId();
  const { status, body } = dbErrorToResponse(err, { requestId });
  if (status === 500) {
    console.error(`[${requestId}] Database error:`, err?.stack || err);
  }
  return res.status(status).json(body);
}
