/**
 * Committing a seating chart onto the guest list.
 *
 * The bug this exists to stop: a chart line naming a plus one used to land on
 * their host's row. "Cole" was matched to Brooke, so Brooke was renamed Cole,
 * her notes were replaced with his and Cole himself was never seated. The
 * chart looked like it had worked.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSeatingIndex, planSeating, seatingPayload, commitSeatingToGuests, nameKey,
} from '../../server/lib/seating-import.js';

// Post-025: a plus one has a row of their own. Cole's surname is not stored,
// so he reads as "Cole Ashby", inherited from Brooke.
const PERSON_MODEL = [
  { id: 'h1', wedding_id: 'w', party_id: 'h1', is_plus_one: false, first_name: 'Brooke', last_name: 'Ashby',
    plus_one_name: 'Cole', notes: 'Bride’s sister', table_assignment: 'Table 1' },
  { id: 'p1', wedding_id: 'w', party_id: 'h1', is_plus_one: true, plus_one_of: 'h1', first_name: 'Cole', last_name: null,
    table_assignment: null },
  { id: 'h2', wedding_id: 'w', party_id: 'h2', is_plus_one: false, first_name: 'Grace', last_name: 'Teeters',
    plus_one_name: null, rsvp: 'yes' },
];

// Pre-025: the same wedding before the plus one had a row.
const PARTY_MODEL = [
  { id: 'h1', wedding_id: 'w', first_name: 'Brooke', last_name: 'Ashby', plus_one_name: 'Cole', notes: 'Bride’s sister' },
  { id: 'h2', wedding_id: 'w', first_name: 'Grace', last_name: 'Teeters', plus_one_name: null },
];

const chart = guests => [{ table_name: 'Table 4', guests }];

test('a plus one is indexed under their inherited surname, on their own row', () => {
  const index = buildSeatingIndex(PERSON_MODEL);
  assert.deepEqual(index.get('cole ashby'), { rowId: 'p1', isPlusOne: true, sharesRow: false });
});

test('a plus one is also indexed under the bare name the couple typed', () => {
  const index = buildSeatingIndex(PERSON_MODEL);
  assert.equal(index.get('cole').rowId, 'p1');
});

test('before 025 a plus one shares their host row and can only be seated', () => {
  const index = buildSeatingIndex(PARTY_MODEL);
  assert.deepEqual(index.get('cole ashby'), { rowId: 'h1', isPlusOne: true, sharesRow: true });
  // The host on that same row is still a person in full.
  assert.deepEqual(index.get('brooke ashby'), { rowId: 'h1', isPlusOne: false, sharesRow: false });
});

test('a chart line naming a plus one moves the plus one, not the host', () => {
  const plan = planSeating(chart([
    { first_name: 'Cole', last_name: 'Ashby', table_assignment: 'Table 4', notes: 'Coming with Brooke' },
  ]), buildSeatingIndex(PERSON_MODEL));

  assert.equal(plan.inserts.length, 0, 'nobody new: Cole is already on the list');
  assert.equal(plan.writes.length, 1);
  assert.equal(plan.writes[0].rowId, 'p1');
  assert.equal(plan.writes[0].payload.table_assignment, 'Table 4');
  // Brooke is untouched: not written at all, so her table and her notes stand.
  assert.equal(plan.writes.some(w => w.rowId === 'h1'), false);
});

test('a host keeps the notes the chart gave them, and the chart does not rewrite names', () => {
  const plan = planSeating(chart([
    { first_name: 'Brooke', last_name: 'Ashby', table_assignment: 'Table 4', notes: 'Toast at 8' },
    { first_name: 'Cole', last_name: 'Ashby', table_assignment: 'Table 4' },
  ]), buildSeatingIndex(PERSON_MODEL));

  const brooke = plan.writes.find(w => w.rowId === 'h1');
  assert.equal(brooke.payload.notes, 'Toast at 8');
  assert.equal(brooke.payload.table_assignment, 'Table 4');
  // Matched by name, so the name is already right. Writing it back would turn
  // Cole's inherited surname into a stored one.
  assert.equal('first_name' in brooke.payload, false);
  assert.equal('last_name' in brooke.payload, false);

  const cole = plan.writes.find(w => w.rowId === 'p1');
  assert.equal(cole.payload.table_assignment, 'Table 4');
  assert.equal('notes' in cole.payload, false, 'Brooke’s note is hers, not his');
});

test('an empty chart cell leaves what is already recorded alone', () => {
  const payload = seatingPayload({ first_name: 'Grace', last_name: 'Teeters', table_assignment: 'Table 2', rsvp: null, notes: null });
  assert.equal('rsvp' in payload, false);
  assert.equal('notes' in payload, false);
  assert.equal(payload.table_assignment, 'Table 2');
});

test('a name on the chart that matches nobody is added, heading its own party', () => {
  const plan = planSeating(chart([
    { first_name: 'Ada', last_name: 'Nweke', table_assignment: 'Table 4', rsvp: 'yes' },
  ]), buildSeatingIndex(PERSON_MODEL));
  assert.equal(plan.inserts.length, 1);
  const row = plan.inserts[0].row;
  assert.equal(row.first_name, 'Ada');
  assert.equal(row.id, row.party_id);
  assert.equal(row.rsvp, 'yes');
});

test('the same person charted at two tables keeps the first and says so', () => {
  const plan = planSeating([
    { table_name: 'Table 1', guests: [{ first_name: 'Grace', last_name: 'Teeters', table_assignment: 'Table 1' }] },
    { table_name: 'Table 9', guests: [{ first_name: 'Grace', last_name: 'Teeters', table_assignment: 'Table 9' }] },
  ], buildSeatingIndex(PERSON_MODEL));
  assert.equal(plan.writes.length, 1);
  assert.equal(plan.writes[0].payload.table_assignment, 'Table 1');
  assert.match(plan.warnings.join(' '), /Grace Teeters is charted at both Table 1 and Table 9\. Left as Table 1\./);
});

test('names are compared with the spacing and case tidied up', () => {
  assert.equal(nameKey('  Cole   ASHBY '), 'cole ashby');
});

/** Enough of a supabase client to answer this module's reads and writes. */
function fakeSupabase({ rows, failUpdateFor = null, pageSize = 1000 } = {}) {
  const calls = { updates: [], inserts: [] };
  const client = {
    calls,
    from() {
      const q = { _op: null, _payload: null, _id: null, _wedding: null };
      const builder = {
        select() { q._op = q._op || 'select'; return builder; },
        update(payload) { q._op = 'update'; q._payload = payload; return builder; },
        insert(payload) { q._op = 'insert'; q._payload = payload; return builder; },
        eq(col, value) { if (col === 'id') q._id = value; else q._wedding = value; return builder; },
        async range(from, to) {
          const page = rows.slice(from, Math.min(to + 1, from + pageSize));
          return { data: page, error: null };
        },
        then(resolve, reject) {
          if (q._op === 'update') {
            calls.updates.push({ id: q._id, wedding: q._wedding, payload: q._payload });
            if (failUpdateFor && failUpdateFor === q._id) {
              return Promise.resolve({ data: null, error: { message: 'row is locked' } }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        },
      };
      // insert(...).select('id') resolves to the inserted rows.
      const origSelect = builder.select;
      builder.select = (...args) => {
        if (q._op === 'insert') {
          calls.inserts.push(q._payload);
          return Promise.resolve({ data: q._payload.map(r => ({ id: r.id })), error: null });
        }
        return origSelect(...args);
      };
      return builder;
    },
  };
  return client;
}

test('committing seats the plus one and never touches the host', async () => {
  const supabase = fakeSupabase({ rows: PERSON_MODEL });
  const result = await commitSeatingToGuests(supabase, 'w', chart([
    { first_name: 'Cole', last_name: 'Ashby', table_assignment: 'Table 4' },
  ]), false);

  assert.deepEqual(result.warnings, []);
  assert.equal(result.updated, 1);
  assert.equal(result.created, 0);
  const touched = supabase.calls.updates.map(u => u.id);
  assert.deepEqual(touched, ['p1']);
});

test('a write that fails is reported and not counted', async () => {
  const supabase = fakeSupabase({ rows: PERSON_MODEL, failUpdateFor: 'p1' });
  const result = await commitSeatingToGuests(supabase, 'w', chart([
    { first_name: 'Cole', last_name: 'Ashby', table_assignment: 'Table 4' },
  ]), false);
  assert.equal(result.updated, 0);
  assert.match(result.warnings[0], /could not be seated: row is locked/);
});

test('a failed read of the guest list stops the commit rather than reseating nobody', async () => {
  const supabase = {
    from: () => ({
      select: () => ({ eq: () => ({ range: async () => ({ data: null, error: { message: 'timeout' } }) }) }),
    }),
  };
  await assert.rejects(
    () => commitSeatingToGuests(supabase, 'w', chart([]), false),
    /Could not read the guest list: timeout/,
  );
});
