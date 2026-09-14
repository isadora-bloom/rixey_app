/**
 * The order these three things happen in, and what is written down when the
 * middle one fails.
 *
 * Marker, then extraction, then the outcome. Get that order wrong the other way
 * and a failed marker write duplicates every note the item produces; get the
 * recording wrong and a 429 on a Tuesday is a permanently lost meeting that
 * looks exactly like a meeting nobody said anything useful in.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  importWithMarker, markerExtractionPatch, withSource, normaliseConfidence,
  detectMigration035, has035, setMigration035,
} from '../../server/lib/extraction-markers.js';

/**
 * Enough of a supabase client to record what was asked of it, in order.
 *
 * Every call pushes onto one shared log, which is the whole point: the
 * assertions are about sequence, not about any single call.
 */
function fakeSupabase({ log, failOn = {}, columns = {} } = {}) {
  const calls = log || [];
  return {
    calls,
    from(table) {
      const chain = {
        _table: table,
        insert(row) {
          calls.push({ op: 'insert', table, row });
          return Promise.resolve(failOn[`insert:${table}`]
            ? { data: null, error: failOn[`insert:${table}`] }
            : { data: [row], error: null });
        },
        update(patch) {
          calls.push({ op: 'update', table, patch });
          return {
            eq() {
              return Promise.resolve(failOn[`update:${table}`]
                ? { data: null, error: failOn[`update:${table}`] }
                : { data: null, error: null });
            },
          };
        },
        select(cols) {
          calls.push({ op: 'select', table, cols });
          const missing = columns[table] && !columns[table].includes(cols);
          const result = missing
            ? { data: null, error: { code: '42703', message: `column ${table}.${cols} does not exist` } }
            : { data: [], error: null };
          return { limit: () => Promise.resolve(result), ...result, then: (f) => Promise.resolve(result).then(f) };
        },
      };
      return chain;
    },
  };
}

describe('importWithMarker', () => {
  test('writes the marker before it asks Claude anything', async () => {
    const calls = [];
    const db = fakeSupabase({ log: calls });

    await importWithMarker({
      writeMarker: async () => {
        const { error } = await db.from('processed_emails').insert({ gmail_message_id: 'm1' });
        return { ok: !error, error: error?.message };
      },
      extract: async () => {
        calls.push({ op: 'extract' });
        return { notes: [{ content: 'ceremony at four' }] };
      },
      save: async (notes) => { calls.push({ op: 'save', count: notes.length }); },
      recordOutcome: async ({ error }) => { calls.push({ op: 'record', error }); },
    });

    const order = calls.map(c => c.op);
    assert.deepEqual(order, ['insert', 'extract', 'save', 'record']);
    assert.ok(order.indexOf('insert') < order.indexOf('extract'),
      'the marker has to be in place before the extraction, or a failed marker duplicates the notes');
  });

  test('a marker that did not save stops the item dead', async () => {
    const calls = [];
    const db = fakeSupabase({
      log: calls,
      failOn: { 'insert:processed_quo_messages': { code: '08006', message: 'connection lost' } },
    });

    const out = await importWithMarker({
      writeMarker: async () => {
        const { error } = await db.from('processed_quo_messages').insert({ quo_message_id: 'q1' });
        return { ok: !error, error: error?.message };
      },
      extract: async () => { calls.push({ op: 'extract' }); return { notes: [] }; },
      save: async () => { calls.push({ op: 'save' }); },
    });

    assert.equal(out.status, 'marker-failed');
    assert.equal(out.notes, 0);
    assert.ok(!calls.some(c => c.op === 'extract'),
      'nothing should be extracted for an item that is not marked, or the next run does it all again');
  });

  test('a failed extraction is recorded and does not take the run down with it', async () => {
    setMigration035('markers', true);
    const calls = [];
    const db = fakeSupabase({ log: calls });

    let threw = false;
    let out;
    try {
      out = await importWithMarker({
        extract: async () => ({ notes: [], error: new Error('429 rate limit') }),
        save: async () => { calls.push({ op: 'save' }); },
        recordOutcome: async ({ error }) => {
          const patch = markerExtractionPatch({ error });
          await db.from('processed_emails').update(patch).eq('gmail_message_id', 'm2');
        },
      });
    } catch {
      threw = true;
    }

    assert.equal(threw, false, 'one item failing to extract must not end the whole sync');
    assert.equal(out.status, 'extract-failed');
    assert.match(out.error, /429/);

    const written = calls.find(c => c.op === 'update');
    assert.ok(written, 'the failure has to be written somewhere a backfill can find it');
    assert.match(written.patch.extract_error, /429 rate limit/);
    assert.equal(written.patch.extracted_at, null,
      'extracted_at stays null so the retry pass picks this row up');
    assert.ok(!calls.some(c => c.op === 'save'), 'there is nothing to save when the extraction failed');
  });

  test('an extraction that throws is treated the same as one that returns an error', async () => {
    const out = await importWithMarker({
      extract: async () => { throw new Error('socket hang up'); },
    });
    assert.equal(out.status, 'extract-failed');
    assert.match(out.error, /socket hang up/);
  });

  test('a reprocess does not ask Claude to read a source it has already read', async () => {
    const calls = [];
    const db = fakeSupabase({ log: calls });

    const out = await importWithMarker({
      writeMarker: async () => {
        const { error } = await db.from('processed_zoom_meetings').insert({ zoom_meeting_id: 'z1' });
        return { ok: !error };
      },
      alreadyExtracted: true,
      extract: async () => { calls.push({ op: 'extract' }); return { notes: [{ content: 'again' }] }; },
      save: async () => { calls.push({ op: 'save' }); },
      recordOutcome: async () => { calls.push({ op: 'record' }); },
    });

    assert.equal(out.status, 'extraction-skipped');
    assert.equal(out.notes, 0);
    assert.deepEqual(calls.map(c => c.op), ['insert'],
      'the raw record is refreshed and nothing else — a second reading paraphrases the first into a duplicate');
  });

  test('a source with nothing in it still records that it was read', async () => {
    setMigration035('markers', true);
    const calls = [];
    const db = fakeSupabase({ log: calls });

    const out = await importWithMarker({
      extract: async () => ({ notes: [] }),
      save: async () => { calls.push({ op: 'save' }); },
      recordOutcome: async ({ error }) => {
        await db.from('processed_emails').update(markerExtractionPatch({ error })).eq('id', 'x');
      },
    });

    assert.equal(out.status, 'ok');
    const written = calls.find(c => c.op === 'update');
    assert.equal(written.patch.extract_error, null);
    assert.ok(written.patch.extracted_at, 'read it and found nothing is a different answer from could not read it');
  });
});

describe('markerExtractionPatch', () => {
  test('is nothing at all until migration 035 is applied', () => {
    assert.equal(markerExtractionPatch({ error: 'boom' }, { applied: false }), null);
    assert.equal(markerExtractionPatch({ error: null }, { applied: false }), null);
  });

  test('truncates a long database message rather than refusing the write', () => {
    const patch = markerExtractionPatch({ error: 'x'.repeat(900) }, { applied: true });
    assert.equal(patch.extract_error.length, 500);
  });
});

describe('withSource', () => {
  test('stamps the item a note came from', () => {
    const out = withSource([{ content: 'a' }], 'email', 'msg-1', { applied: true });
    assert.deepEqual(out, [{ content: 'a', source_kind: 'email', source_id: 'msg-1' }]);
  });

  test('leaves the notes alone without 035, because the columns are not there', () => {
    const notes = [{ content: 'a' }];
    assert.deepEqual(withSource(notes, 'email', 'msg-1', { applied: false }), notes);
  });

  test('a source with no id is not a source', () => {
    const notes = [{ content: 'a' }];
    assert.deepEqual(withSource(notes, 'email', null, { applied: true }), notes);
  });
});

describe('normaliseConfidence', () => {
  test('keeps a real number', () => {
    assert.equal(normaliseConfidence(0.8), 0.8);
    assert.equal(normaliseConfidence('0.25'), 0.25);
  });

  test('a model that answered in percent is understood', () => {
    assert.equal(normaliseConfidence(90), 0.9);
  });

  test('a missing confidence stays missing rather than becoming certainty', () => {
    assert.equal(normaliseConfidence(undefined), null);
    assert.equal(normaliseConfidence('very sure'), null);
  });

  test('is clamped at both ends', () => {
    assert.equal(normaliseConfidence(-2), 0);
    assert.equal(normaliseConfidence(400), 1);
  });
});

describe('detectMigration035', () => {
  test('a missing column switches its behaviour off and says which one', async () => {
    const lines = [];
    const db = fakeSupabase({
      columns: {
        processed_emails: ['something_else'],
        planning_notes: ['source_id'],
        walkthrough_media: ['transcript_error'],
        wedding_documents: ['parsed_with_model'],
      },
    });

    await detectMigration035(db, (line) => lines.push(line));

    assert.equal(has035('markers'), false);
    assert.equal(has035('noteSource'), true);
    assert.ok(lines.some(l => l.includes('migration 035 not applied') && l.includes('processed_emails.extracted_at')),
      'the log line has to name the column, or nobody knows what to run');
  });
});
