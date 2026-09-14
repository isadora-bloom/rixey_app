/**
 * The venue's unfinished table layout must not reach the couple.
 *
 * For months the admin planner showed "In progress, not visible to client"
 * over a row the couple's planner reads directly, and once the planner started
 * autosaving, every keystroke on an already-sent layout was published about a
 * second and a half later. There is no screen that shows this happening, which
 * is exactly why it lasted: both sides look right on their own.
 *
 * So the assertions here are mostly about what must NOT be written. A save is
 * placed by who sent it; nothing in the body decides it.
 *
 * Run with: npm run test:unit
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  saveTableLayout, readTableLayout, discardDraft,
  normaliseLayout, DRAFT_STORAGE_MISSING,
} from '../../server/lib/table-layout-draft.js';

const WEDDING = '11111111-1111-4111-8111-111111111111';

const LAYOUT = {
  weddingId: WEDDING,
  userId: '44444444-4444-4444-8444-444444444444',
  guestCount: 120,
  tableShape: 'round',
  guestsPerTable: 8,
  headTable: true,
  headTableSize: 10,
  headTableSided: 'two',
  sweetheartTable: false,
  cocktailTables: 4,
  kidsTable: false,
  kidsCount: 0,
  linenColor: 'ivory',
  napkinColor: 'sage',
  linenVenueChoice: false,
  runnerStyle: 'greenery',
  chargersOn: true,
  checkeredDanceFloor: true,
  loungeArea: true,
  centerpieceNotes: 'Low greenery',
  layoutNotes: 'Bar on the terrace side',
  linenNotes: 'Ivory, not white',
  extraTables: { cake: { selected: true } },
};

/**
 * Enough of a supabase client to record what a route tried to write.
 *
 * `rows` is the one wedding_tables row, or null for a wedding nobody has saved
 * yet. Every call is recorded in `calls` so a test can assert on the keys that
 * were sent, which is the point: a key that is absent is a column that was left
 * alone.
 */
function fakeSupabase({ row = null, calls = [] } = {}) {
  let current = row;
  const client = {
    calls,
    get row() { return current; },
    from(table) {
      const builder = {
        _op: null,
        _payload: null,
        update(payload) {
          builder._op = 'update';
          builder._payload = payload;
          return builder;
        },
        insert(payload) {
          builder._op = 'insert';
          builder._payload = payload;
          return builder;
        },
        upsert(payload) {
          builder._op = 'upsert';
          builder._payload = payload;
          return builder;
        },
        eq() { return builder; },
        select() { return builder; },
        limit() { return builder; },
        async single() {
          record();
          if (builder._op === 'upsert') return { data: current, error: null };
          if (!current) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
          return { data: current, error: null };
        },
        then(resolve, reject) {
          // The builder is awaited without .single() for updates and inserts.
          record();
          const answer = builder._op === 'update'
            ? { data: current ? [{ wedding_id: WEDDING }] : [], error: null }
            : { data: [{ wedding_id: WEDDING }], error: null };
          return Promise.resolve(answer).then(resolve, reject);
        },
      };

      function record() {
        if (builder._recorded) return;
        builder._recorded = true;
        if (!builder._op) return;
        calls.push({ table, op: builder._op, payload: builder._payload });
        if (builder._op === 'upsert') current = { ...(current || {}), ...builder._payload };
        if (builder._op === 'insert') current = { ...(current || {}), ...builder._payload };
        if (builder._op === 'update' && current) current = { ...current, ...builder._payload };
      }

      return builder;
    },
  };
  return client;
}

/** The keys written across every call, which is what "touched" means here. */
function writtenKeys(calls) {
  return calls.flatMap(c => Object.keys(c.payload || {}));
}

describe('an admin autosave', () => {
  test('writes the draft and touches nothing the couple reads', async () => {
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING, guest_count: 80 }, calls });

    const result = await saveTableLayout(db, { body: { ...LAYOUT, isDraft: true }, admin: true, draftStorage: true });

    assert.equal(result.status, 200);
    assert.equal(result.body.savedTo, 'draft');
    assert.ok(result.body.draftUpdatedAt);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].op, 'update');
    assert.deepEqual(Object.keys(calls[0].payload).sort(), ['draft', 'draft_updated_at']);
    assert.equal(calls[0].payload.draft.guestCount, 120);
    // The couple's layout is exactly where it was.
    assert.equal(db.row.guest_count, 80);
    assert.equal(result.notifyCouple, false);
  });

  test('a body claiming isDraft false is still the caller talking, not the flag', async () => {
    // isDraft undefined is what a plain autosave sends once the client stops
    // guessing. Anything other than an explicit false is a draft.
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING }, calls });

    const result = await saveTableLayout(db, { body: { ...LAYOUT, isDraft: undefined }, admin: true, draftStorage: true });

    assert.equal(result.body.savedTo, 'draft');
    assert.ok(!writtenKeys(calls).includes('guest_count'));
  });

  test('creates the row with nothing but the draft when the couple has never saved', async () => {
    const calls = [];
    const db = fakeSupabase({ row: null, calls });

    const result = await saveTableLayout(db, { body: LAYOUT, admin: true, draftStorage: true });

    assert.equal(result.status, 200);
    const insert = calls.find(c => c.op === 'insert');
    assert.ok(insert, 'the row is created');
    assert.deepEqual(Object.keys(insert.payload).sort(), ['draft', 'draft_updated_at', 'wedding_id']);
  });

  test('is refused with a sentence when migration 037 is not there', async () => {
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING, guest_count: 80 }, calls });

    const result = await saveTableLayout(db, { body: LAYOUT, admin: true, draftStorage: false });

    assert.equal(result.status, 409);
    assert.equal(result.body.error, DRAFT_STORAGE_MISSING);
    // The important half: a refused save wrote nothing at all.
    assert.equal(calls.length, 0);
    assert.equal(db.row.guest_count, 80);
  });
});

describe('Send to Client', () => {
  test('copies the layout onto the live columns and clears the draft', async () => {
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING, draft: { guestCount: 120 } }, calls });

    const result = await saveTableLayout(db, { body: { ...LAYOUT, isDraft: false }, admin: true, draftStorage: true });

    assert.equal(result.status, 200);
    assert.equal(result.body.savedTo, 'live');
    assert.ok(result.body.sentToClientAt);
    const upsert = calls.find(c => c.op === 'upsert');
    assert.equal(upsert.payload.guest_count, 120);
    assert.equal(upsert.payload.is_draft, false);
    assert.equal(upsert.payload.draft, null);
    assert.equal(upsert.payload.draft_updated_at, null);
    assert.ok(upsert.payload.sent_to_client_at);
    // Rixey publishing to a couple is not a couple asking for a floor plan.
    assert.equal(result.notifyCouple, false);
  });

  test('still works before 037, minus the columns that do not exist', async () => {
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING }, calls });

    const result = await saveTableLayout(db, { body: { ...LAYOUT, isDraft: false }, admin: true, draftStorage: false });

    assert.equal(result.status, 200);
    const upsert = calls.find(c => c.op === 'upsert');
    assert.equal(upsert.payload.guest_count, 120);
    assert.equal(upsert.payload.is_draft, false);
    assert.ok(!('draft' in upsert.payload));
    assert.ok(!('sent_to_client_at' in upsert.payload));
    assert.equal(result.body.sentToClientAt, null);
  });

  test('the response carries no draft key back to the browser', async () => {
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING, draft: { guestCount: 1 }, draft_updated_at: 'then' }, calls });

    const result = await saveTableLayout(db, { body: { ...LAYOUT, isDraft: false }, admin: true, draftStorage: true });

    assert.ok(!('draft' in result.body.tables));
    assert.ok(!('draft_updated_at' in result.body.tables));
  });
});

describe('the couple', () => {
  test('writes the live columns and never touches the draft', async () => {
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING, draft: { guestCount: 200 } }, calls });

    const result = await saveTableLayout(db, { body: { ...LAYOUT, isDraft: false }, admin: false, draftStorage: true });

    assert.equal(result.status, 200);
    assert.equal(result.body.savedTo, 'live');
    const written = writtenKeys(calls);
    assert.ok(!written.includes('draft'));
    assert.ok(!written.includes('draft_updated_at'));
    assert.ok(!written.includes('sent_to_client_at'));
    assert.equal(result.notifyCouple, true);
  });

  test('keeps their own in-progress flag', async () => {
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING }, calls });

    await saveTableLayout(db, { body: { ...LAYOUT, isDraft: true }, admin: false, draftStorage: true });

    const upsert = calls.find(c => c.op === 'upsert');
    assert.equal(upsert.payload.is_draft, true);
  });

  test('a save with no draft storage goes through as it always did', async () => {
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING }, calls });

    const result = await saveTableLayout(db, { body: LAYOUT, admin: false, draftStorage: false });

    assert.equal(result.status, 200);
    assert.equal(calls.find(c => c.op === 'upsert').payload.guest_count, 120);
  });

  test('a save with no wedding is refused rather than upserting a null row', async () => {
    const calls = [];
    const db = fakeSupabase({ row: null, calls });

    const result = await saveTableLayout(db, { body: { guestCount: 10 }, admin: false });

    assert.equal(result.status, 400);
    assert.equal(calls.length, 0);
  });
});

describe('reading a layout', () => {
  test('a couple is never sent the draft', async () => {
    const db = fakeSupabase({ row: {
      wedding_id: WEDDING, guest_count: 80, is_draft: true,
      draft: { guestCount: 250 }, draft_updated_at: 'then', sent_to_client_at: 'before',
    } });

    const result = await readTableLayout(db, { weddingId: WEDDING, admin: false });

    assert.equal(result.status, 200);
    assert.deepEqual(Object.keys(result.body), ['tables']);
    assert.ok(!JSON.stringify(result.body).includes('250'));
    assert.ok(!('draft' in result.body.tables));
    assert.ok(!('draft_updated_at' in result.body.tables));
    // Their own flag is theirs and stays.
    assert.equal(result.body.tables.is_draft, true);
  });

  test('an admin gets the draft alongside the live layout', async () => {
    const db = fakeSupabase({ row: {
      wedding_id: WEDDING, guest_count: 80,
      draft: { guestCount: 250 }, draft_updated_at: 'then', sent_to_client_at: 'before',
    } });

    const result = await readTableLayout(db, { weddingId: WEDDING, admin: true });

    assert.equal(result.body.tables.guest_count, 80);
    assert.equal(result.body.draft.guestCount, 250);
    assert.equal(result.body.draft_updated_at, 'then');
    assert.equal(result.body.sent_to_client_at, 'before');
    assert.ok(!('draft' in result.body.tables));
  });

  test('a wedding with no row answers with nothing rather than an error', async () => {
    const db = fakeSupabase({ row: null });

    const result = await readTableLayout(db, { weddingId: WEDDING, admin: true });

    assert.equal(result.status, 200);
    assert.equal(result.body.tables, null);
    assert.equal(result.body.draft, null);
  });
});

describe('discarding a draft', () => {
  test('nulls the draft and leaves the live columns alone', async () => {
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING, guest_count: 80, draft: { guestCount: 250 } }, calls });

    const result = await discardDraft(db, { weddingId: WEDDING, draftStorage: true });

    assert.equal(result.status, 200);
    assert.deepEqual(Object.keys(calls[0].payload).sort(), ['draft', 'draft_updated_at']);
    assert.equal(db.row.guest_count, 80);
  });

  test('says so when there is no draft storage to clear', async () => {
    const calls = [];
    const db = fakeSupabase({ row: { wedding_id: WEDDING }, calls });

    const result = await discardDraft(db, { weddingId: WEDDING, draftStorage: false });

    assert.equal(result.status, 409);
    assert.equal(calls.length, 0);
  });
});

describe('the draft payload', () => {
  test('keeps the planner shape and drops routing and the flag', async () => {
    const layout = normaliseLayout({ ...LAYOUT, isDraft: true, nonsense: 1 });

    assert.equal(layout.guestCount, 120);
    assert.equal(layout.linenNotes, 'Ivory, not white');
    assert.deepEqual(layout.extraTables, { cake: { selected: true } });
    for (const key of ['weddingId', 'userId', 'isDraft', 'nonsense']) {
      assert.ok(!(key in layout), `${key} has no business in a draft`);
    }
  });

  test('an empty planner still round-trips extraTables', async () => {
    assert.deepEqual(normaliseLayout({}).extraTables, {});
  });
});
