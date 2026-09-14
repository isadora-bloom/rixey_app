/**
 * Which importer wrote a row, and what happens before the column exists.
 *
 * Migration 036 is applied by hand, so this code runs against a database
 * without it for however long that takes. The one thing that must never happen
 * is a sheet_sync_log insert carrying a `source` key the table does not have:
 * PostgREST refuses the whole batch, and the batch is the audit trail for an
 * import that has already written to a couple's file.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { detectMigration036, has036, setMigration036, syncSourcePatch } from '../../server/lib/migration-036.js';
import { applyChoices } from '../../server/lib/sheet-diff/apply.js';

/** A client that answers 42703 for the columns named, and fine for the rest. */
function fakeProbe(missing = []) {
  return {
    from(table) {
      return {
        select(column) {
          return {
            limit() {
              return Promise.resolve(missing.includes(`${table}.${column}`)
                ? { data: null, error: { code: '42703', message: `column ${table}.${column} does not exist` } }
                : { data: [], error: null });
            },
          };
        },
      };
    },
  };
}

/** Enough of a client for applyChoices: records the audit insert and nothing else. */
function fakeApplyClient(inserts) {
  return {
    from(table) {
      return {
        insert(rows) {
          inserts.push({ table, rows });
          return Promise.resolve({ data: rows, error: null });
        },
        select() {
          return {
            eq() { return this; },
            limit() { return Promise.resolve({ data: [], error: null }); },
          };
        },
      };
    },
  };
}

describe('the 036 probe', () => {
  test('a missing column switches its behaviour off and says which one', async () => {
    const lines = [];
    const answer = await detectMigration036(fakeProbe(['sheet_sync_log.source']), l => lines.push(l));

    assert.equal(answer.syncSource, false);
    assert.equal(answer.vendorLogo, true);
    assert.equal(has036('syncSource'), false);
    assert.equal(has036('vendorLogo'), true);
    assert.ok(lines.some(l => l.includes('sheet_sync_log.source')), 'the log line names the column');
  });

  test('a probe that fails for some other reason assumes the column is there', async () => {
    const client = {
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: null, error: { code: '57014', message: 'canceling statement' } }) }) }),
    };
    const answer = await detectMigration036(client, () => {});
    assert.equal(answer.syncSource, true, 'a timed-out probe must not switch a feature off');
  });

  test('every column present switches everything on', async () => {
    const answer = await detectMigration036(fakeProbe([]), () => {});
    assert.deepEqual(answer, { syncSource: true, vendorLogo: true });
  });
});

describe('syncSourcePatch', () => {
  test('nothing at all when the column is missing', () => {
    assert.equal(syncSourcePatch('document', { applied: false }), null);
  });

  test('the field when it is there', () => {
    assert.deepEqual(syncSourcePatch('document', { applied: true }), { source: 'document' });
  });

  test('nothing for a caller that named no source', () => {
    assert.equal(syncSourcePatch(null, { applied: true }), null);
  });

  test('it reads the probe when the caller does not say', () => {
    setMigration036('syncSource', false);
    assert.equal(syncSourcePatch('sheet'), null);
    setMigration036('syncSource', true);
    assert.deepEqual(syncSourcePatch('sheet'), { source: 'sheet' });
  });
});

describe('applyChoices stamps the source', () => {
  const decisions = [{ entryId: 'e1', choice: 'skip', op: { type: 'noop', table: 'planning_notes' } }];

  test('no source key at all without 036', async () => {
    const inserts = [];
    await applyChoices({
      supabase: fakeApplyClient(inserts), weddingId: 'w1', decisions,
      source: 'document', recordSource: false,
    });
    assert.equal(inserts.length, 1);
    assert.equal('source' in inserts[0].rows[0], false, 'a key the table has not got fails the whole insert');
  });

  test('the source it was given, with 036', async () => {
    const inserts = [];
    await applyChoices({
      supabase: fakeApplyClient(inserts), weddingId: 'w1', decisions,
      source: 'document', recordSource: true,
    });
    assert.equal(inserts[0].rows[0].source, 'document');
  });

  test('sheet is the default, so an unchanged caller still says something true', async () => {
    const inserts = [];
    await applyChoices({
      supabase: fakeApplyClient(inserts), weddingId: 'w1', decisions, recordSource: true,
    });
    assert.equal(inserts[0].rows[0].source, 'sheet');
  });

  test('a failed op is logged with the source on it too', async () => {
    const inserts = [];
    const client = fakeApplyClient(inserts);
    // An unsupported op type is the cheapest way to reach the catch branch.
    await applyChoices({
      supabase: client, weddingId: 'w1',
      decisions: [{ entryId: 'e2', choice: 'import-sheet', op: { type: 'nonsense' } }],
      source: 'document', recordSource: true,
    });
    assert.equal(inserts[0].rows[0].executed, false);
    assert.equal(inserts[0].rows[0].source, 'document');
  });
});
