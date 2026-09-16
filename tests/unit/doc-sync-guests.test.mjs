/**
 * What an uploaded planning document says about the guest list, against what
 * the portal holds.
 *
 * Both halves read rows before this, and a plus one is not a row: since 025
 * they have one of their own, and before it they have none. So a document
 * naming a plus one was offered as a guest to add, and a document seating one
 * offered to move their host.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentDiff } from '../../server/lib/doc-sync/diff.js';

// Cole is Brooke's plus one, with a row of his own and no surname recorded, so
// he reads as "Cole Ashby" with Brooke's surname inherited.
const PERSON_MODEL = [
  { id: 'h1', wedding_id: 'w', party_id: 'h1', is_plus_one: false, first_name: 'Brooke', last_name: 'Ashby', plus_one_name: 'Cole', table_assignment: 'Table 1' },
  { id: 'p1', wedding_id: 'w', party_id: 'h1', is_plus_one: true, plus_one_of: 'h1', first_name: 'Cole', last_name: null },
  { id: 'h2', wedding_id: 'w', party_id: 'h2', is_plus_one: false, first_name: 'Audrey', last_name: 'Ayala' },
];

const PARTY_MODEL = [
  { id: 'h1', wedding_id: 'w', first_name: 'Brooke', last_name: 'Ashby', plus_one_name: 'Cole', table_assignment: 'Table 1' },
];

const diff = (sections, guests) => buildDocumentDiff({ sections, portal: { wedding_guests: guests } });

test('a plus one already on the list is not offered as a new guest', () => {
  const { entries } = diff({ guests: [{ name: 'Cole Ashby' }] }, PERSON_MODEL);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, 'agree');
  assert.equal(entries[0].applyOp.type, 'noop');
});

test('a guest written surname-first is recognised', () => {
  const { entries } = diff({ guests: [{ name: 'Ayala, Audrey' }] }, PERSON_MODEL);
  assert.equal(entries[0].status, 'agree');
});

test('somebody genuinely new is still offered', () => {
  const { entries } = diff({ guests: [{ name: 'Ada Nweke' }] }, PERSON_MODEL);
  assert.equal(entries[0].status, 'missing');
  assert.equal(entries[0].applyOp.type, 'insert');
});

test('seating a plus one patches their own row, not their host’s', () => {
  const { entries } = diff({ seating: [{ guest_name: 'Cole Ashby', table_name: 'Table 4' }] }, PERSON_MODEL);
  assert.equal(entries[0].applyOp.type, 'patch');
  assert.equal(entries[0].applyOp.match.id, 'p1');
  assert.equal(entries[0].applyOp.patch.table_assignment, 'Table 4');
  // Brooke's own table is not what this compares against.
  assert.equal(entries[0].portalValue, 'no table set');
});

test('before 025 a plus one shares their host’s row and the entry says so', () => {
  const { entries } = diff({ seating: [{ guest_name: 'Cole Ashby', table_name: 'Table 4' }] }, PARTY_MODEL);
  assert.equal(entries[0].applyOp.match.id, 'h1');
  assert.match(entries[0].notes, /no row of their own/);
});

test('a failed guest read is not mistaken for an empty guest list', () => {
  // The portal snapshot reports a failed read as { _error }, which used to
  // throw in here and take the whole diff down with it.
  const { entries } = buildDocumentDiff({
    sections: { guests: [{ name: 'Ada Nweke' }] },
    portal: { wedding_guests: { _error: 'timeout' } },
  });
  assert.equal(entries[0].status, 'missing');
});
