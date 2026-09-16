/**
 * Importing a guest list: what each fault is called, and what an update is
 * allowed to overwrite.
 *
 * Two of these rules have cost data. A blank plus-one column and an absent one
 * looked identical by the time a row reached the server, so re-importing an
 * RSVP export with no plus-one column deleted every plus one at the wedding.
 * And every bad request came back as "weddingId and guests array required",
 * which is wrong about most of the ways an import actually fails.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bulkImportFault, buildImportRow, updatePatch, plusOneKeysPresent,
  plusOneRowPatch, hostMirrorPatch, splitPlusOneName, parseRsvpValue, inChunks,
  BULK_ROW_LIMIT,
} from '../../server/lib/guest-import.js';

test('a missing wedding says so', () => {
  assert.equal(bulkImportFault({ guests: [] }), 'No weddingId');
});

test('guests that is not an array names what arrived instead', () => {
  assert.equal(bulkImportFault({ weddingId: 'w', guests: { a: 1 } }), 'guests must be an array, got object');
  assert.equal(bulkImportFault({ weddingId: 'w', guests: null }), 'guests must be an array, got null');
  assert.equal(bulkImportFault({ weddingId: 'w', guests: 'Sarah' }), 'guests must be an array, got string');
  assert.equal(bulkImportFault({ weddingId: 'w' }), 'guests must be an array, got undefined');
});

test('an oversized file is refused with its size and the cap', () => {
  const guests = Array.from({ length: BULK_ROW_LIMIT + 1 }, () => ({ first_name: 'A' }));
  assert.equal(bulkImportFault({ weddingId: 'w', guests }), `Too many rows: ${BULK_ROW_LIMIT + 1}, the limit is 2000`);
});

test('rows that all parsed to nothing point at the name column', () => {
  const guests = [{ email: 'a@b.c' }, { email: 'd@e.f' }, { email: 'g@h.i' }];
  assert.equal(
    bulkImportFault({ weddingId: 'w', guests, parsed: 0 }),
    'guests was empty after parsing 3 rows (no name column?)',
  );
});

test('an empty file is not mistaken for a mapping problem', () => {
  // Nothing sent at all is still an array, and parsing nothing gives nothing.
  assert.equal(bulkImportFault({ weddingId: 'w', guests: [], parsed: 0 }), 'guests was empty after parsing 0 rows (no name column?)');
});

test('a sound import has no fault', () => {
  assert.equal(bulkImportFault({ weddingId: 'w', guests: [{ first_name: 'Sarah' }], parsed: 1 }), null);
});

test('a plus-one column is detected even when the cell is blank', () => {
  assert.deepEqual(plusOneKeysPresent({ first_name: 'Sarah', plus_one_name: '' }), {
    plus_one_name: true, plus_one_rsvp: false, plus_one_meal_choice: false, plus_one_dietary: false,
  });
});

test('a sheet with no plus-one column cannot delete a plus one', () => {
  const source = { first_name: 'Brooke', last_name: 'Ashby', rsvp: 'yes' };
  const patch = updatePatch(buildImportRow(source, 'w'), source);
  for (const field of ['plus_one_name', 'plus_one_rsvp', 'plus_one_meal_choice', 'plus_one_dietary']) {
    assert.equal(field in patch, false, `${field} should be left alone`);
  }
  assert.equal(patch.rsvp, 'yes');
  // The name matched, so it is not rewritten.
  assert.equal('first_name' in patch, false);
  assert.equal('wedding_id' in patch, false);
});

test('a sheet that does say "no plus one" takes the plus one away', () => {
  const source = { first_name: 'Brooke', plus_one_name: 'No' };
  const patch = updatePatch(buildImportRow(source, 'w'), source);
  assert.equal(patch.plus_one_name, null);
  assert.equal('plus_one_rsvp' in patch, false, 'the sheet had no RSVP column for them');
});

test('a plus one named in the sheet is written', () => {
  const source = { first_name: 'Brooke', plus_one_name: 'Cole', plus_one_rsvp: 'Attending' };
  const patch = updatePatch(buildImportRow(source, 'w'), source);
  assert.equal(patch.plus_one_name, 'Cole');
  assert.equal(patch.plus_one_rsvp, 'yes');
});

test('a bare yes grants a plus one without naming one', () => {
  const row = buildImportRow({ first_name: 'Kevan', plus_one_name: 'yes' }, 'w');
  assert.equal(row.plus_one_name, '+1');
});

test('a column of Yes and No does not produce a guest called No', () => {
  const row = buildImportRow({ first_name: 'Kevan', plus_one: 'No' }, 'w');
  assert.equal(row.plus_one_name, null);
});

test('a plus one keeps the answer they gave when their host is saved again', () => {
  const host = { id: 'h1', wedding_id: 'w', party_id: 'h1', plus_one_rsvp: 'pending', plus_one_meal_choice: 'Beef', plus_one_dietary: null };
  const existing = { rsvp: 'yes', meal_choice: 'Fish', dietary_restrictions: 'coeliac' };
  const patch = plusOneRowPatch(host, existing);
  assert.equal('rsvp' in patch, false);
  assert.equal('meal_choice' in patch, false);
  assert.equal('dietary_restrictions' in patch, false);
  assert.equal(patch.plus_one_of, 'h1');
  assert.equal(patch.is_plus_one, true);
});

test('a plus one who has answered nothing takes the host’s answers', () => {
  const host = { id: 'h1', wedding_id: 'w', plus_one_rsvp: 'yes', plus_one_meal_choice: 'Beef', plus_one_dietary: 'coeliac' };
  const patch = plusOneRowPatch(host, { rsvp: 'pending', meal_choice: null, dietary_restrictions: '' });
  assert.equal(patch.rsvp, 'yes');
  assert.equal(patch.meal_choice, 'Beef');
  assert.equal(patch.dietary_restrictions, 'coeliac');
  assert.equal(patch.party_id, 'h1');
});

test('a plus one being created takes everything the host said about them', () => {
  const host = { id: 'h1', wedding_id: 'w', party_id: 'p', plus_one_rsvp: 'no', plus_one_meal_choice: null, plus_one_dietary: null };
  const patch = plusOneRowPatch(host, null);
  assert.equal(patch.rsvp, 'no');
  assert.equal(patch.meal_choice, null);
  assert.equal(patch.party_id, 'p');
});

test('editing a plus one’s row writes back to their host’s columns', () => {
  const patch = hostMirrorPatch({ first_name: 'Cole', last_name: null, rsvp: 'yes', meal_choice: 'Fish', dietary_restrictions: 'coeliac' });
  assert.equal(patch.plus_one_name, 'Cole');
  assert.equal(patch.plus_one_rsvp, 'yes');
  assert.equal(patch.plus_one_meal_choice, 'Fish');
  assert.equal(patch.plus_one_dietary, 'coeliac');
});

test('a plus one nobody has named yet leaves the host’s column as it was', () => {
  const patch = hostMirrorPatch({ first_name: null, last_name: null, rsvp: 'yes' });
  assert.equal('plus_one_name' in patch, false);
  assert.equal(patch.plus_one_rsvp, 'yes');
});

test('a single name leaves the surname to be inherited', () => {
  assert.deepEqual(splitPlusOneName('Cole', true), { first_name: 'Cole', last_name: null });
  assert.deepEqual(splitPlusOneName('Cole McClanahan', true), { first_name: 'Cole', last_name: 'McClanahan' });
  // A placeholder is kept exactly as the couple typed it.
  assert.deepEqual(splitPlusOneName('+1', false), { first_name: '+1', last_name: null });
});

test('RSVP wording is read the way people write it', () => {
  assert.equal(parseRsvpValue('Attending'), 'yes');
  assert.equal(parseRsvpValue('Declined'), 'no');
  assert.equal(parseRsvpValue('Maybe'), 'maybe');
  assert.equal(parseRsvpValue(''), 'pending');
  assert.equal(parseRsvpValue(null), 'pending');
});

test('work is done in batches, in order, and every item is run', async () => {
  const seen = [];
  const out = await inChunks([1, 2, 3, 4, 5], 2, async n => { seen.push(n); return n * 2; });
  assert.deepEqual(out, [2, 4, 6, 8, 10]);
  assert.equal(seen.length, 5);
});
