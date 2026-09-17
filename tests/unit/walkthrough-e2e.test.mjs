/**
 * Turning what was said in a room into rows in the portal.
 *
 * The whole design rests on one rule: every writer in server/lib/walkthrough.js
 * inserts, none of them update. A walkthrough note is a fast, informal capture
 * and the parser reading it is guessing. An extra row someone deletes in two
 * clicks is a nuisance; an overwritten ceremony time or a rewritten vendor
 * contact is data nobody knows they have lost.
 *
 * Converted from scripts/test-walkthrough-e2e.mjs. That script is a live,
 * destructive exercise: it creates a walkthrough, calls the real Anthropic API
 * to organise it, writes and deletes rows in a real Supabase project, and
 * refuses to run against anything but a wedding named "Playwright & Test". It
 * has no assertions of its own to preserve, only printed OK/FAIL/DANGLING
 * receipts, so there is nothing to port as a passing/failing check without a
 * live database and an ANTHROPIC_API_KEY. That whole path is skipped below
 * with the reason; to actually exercise it, run:
 *
 *   node scripts/test-walkthrough-e2e.mjs <a "Playwright & Test" wedding id>
 *
 * (the original script is gone from scripts/ as of this change; recreate it
 * from git history if that manual run is ever needed again).
 *
 * What IS covered here as plain unit tests, because it needs neither: the
 * pure parsing and row-building logic in server/lib/walkthrough.js.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WALKTHROUGH_TARGETS, buildNote, organisePrompt, parseItems } from '../../server/lib/walkthrough.js';

test.skip('full round trip: create, organise via Anthropic, accept, apply, verify, cleanup — needs a live Supabase project, ANTHROPIC_API_KEY, and a disposable "Playwright & Test" wedding row; not coverable as a unit test', () => {});

test('checklist.build files a task with a category, dropping one the model invented', () => {
  const row = WALKTHROUGH_TARGETS.checklist.build({ task_text: 'chase the florist', category: 'Not A Real Category' }, 'w1');
  assert.equal(row.task_text, 'chase the florist');
  assert.equal(row.category, 'Other');
  assert.equal(row.is_completed, false);
});

test('checklist.build keeps a due date that is genuinely in the future', () => {
  const row = WALKTHROUGH_TARGETS.checklist.build({ task_text: 'confirm final headcount', due_date: '2099-01-01' }, 'w1');
  assert.equal(row.due_date, '2099-01-01');
});

test('checklist.build drops a due date that is today or in the past', () => {
  // A due date in the past is always a mis-read, not a deadline: asked to file
  // "decide on the day", the model would otherwise stamp the walkthrough's own
  // date on it, landing as an already-overdue task.
  const row = WALKTHROUGH_TARGETS.checklist.build({ task_text: 'decide on the day', due_date: '2000-01-01' }, 'w1');
  assert.equal(row.due_date, null);
});

test('checklist.build drops a malformed due date', () => {
  const row = WALKTHROUGH_TARGETS.checklist.build({ task_text: 'x', due_date: 'soon' }, 'w1');
  assert.equal(row.due_date, null);
});

test('checklist.valid requires actual task text', () => {
  assert.equal(WALKTHROUGH_TARGETS.checklist.valid({ task_text: 'chase the florist' }), true);
  assert.equal(WALKTHROUGH_TARGETS.checklist.valid({ task_text: '  ' }), false);
  assert.equal(WALKTHROUGH_TARGETS.checklist.valid({}), false);
});

test('allergies.build leaves severity blank unless it was actually said, and flags that it is unconfirmed', () => {
  const row = WALKTHROUGH_TARGETS.allergies.build({ guest_name: 'Uncle Bill', allergy: 'shellfish' }, 'w1');
  assert.equal(row.severity, null);
  assert.match(row.notes, /Severity not confirmed/);
});

test('allergies.build keeps a stated severity and does not add the unconfirmed flag', () => {
  const row = WALKTHROUGH_TARGETS.allergies.build({ guest_name: 'Uncle Bill', allergy: 'shellfish', severity: 'Severe / Anaphylactic', notes: 'carries an EpiPen' }, 'w1');
  assert.equal(row.severity, 'Severe / Anaphylactic');
  assert.equal(row.notes, 'carries an EpiPen');
});

test('allergies.build rejects an invented severity word', () => {
  const row = WALKTHROUGH_TARGETS.allergies.build({ guest_name: 'Uncle Bill', allergy: 'shellfish', severity: 'Extremely Bad' }, 'w1');
  assert.equal(row.severity, null);
});

test('allergies.valid requires both a guest name and the allergy', () => {
  assert.equal(WALKTHROUGH_TARGETS.allergies.valid({ guest_name: 'Uncle Bill', allergy: 'shellfish' }), true);
  assert.equal(WALKTHROUGH_TARGETS.allergies.valid({ guest_name: 'Uncle Bill' }), false);
  assert.equal(WALKTHROUGH_TARGETS.allergies.valid({ allergy: 'shellfish' }), false);
});

test('decor.build defaults an unassigned space rather than leaving it blank', () => {
  const row = WALKTHROUGH_TARGETS.decor.build({ item_name: 'birch arbor' }, 'w1');
  assert.equal(row.space_name, 'Unassigned');
});

test('decor.valid requires an item name', () => {
  assert.equal(WALKTHROUGH_TARGETS.decor.valid({ item_name: 'birch arbor' }), true);
  assert.equal(WALKTHROUGH_TARGETS.decor.valid({}), false);
});

test('bar.build defaults the category to "other" and keeps a stated quantity', () => {
  const row = WALKTHROUGH_TARGETS.bar.build({ item_name: 'local IPA', quantity: 2, unit: 'kegs' }, 'w1');
  assert.equal(row.category, 'other');
  assert.equal(row.quantity, '2');
  assert.equal(row.unit, 'kegs');
});

test('shuttle.valid accepts a run identified by time or place, not only by its label', () => {
  assert.equal(WALKTHROUGH_TARGETS.shuttle.valid({ pickup_time: '11:15 PM' }), true);
  assert.equal(WALKTHROUGH_TARGETS.shuttle.valid({ pickup_location: 'Hampton Inn' }), true);
  assert.equal(WALKTHROUGH_TARGETS.shuttle.valid({}), false);
});

test('vendor.build inserts a second line rather than merging into an existing vendor', () => {
  const row = WALKTHROUGH_TARGETS.vendor.build({ vendor_type: 'Florist', vendor_name: 'Blue Ridge Blooms', vendor_contact: 'Marta 540 555 0198' }, 'w1');
  assert.equal(row.is_booked, false);
  assert.equal(row.vendor_name, 'Blue Ridge Blooms');
});

test('vendor.valid accepts a type alone when there is no name yet', () => {
  assert.equal(WALKTHROUGH_TARGETS.vendor.valid({ vendor_type: 'Florist' }), true);
  assert.equal(WALKTHROUGH_TARGETS.vendor.valid({}), false);
});

test('buildNote falls back to summary or source text and labels where it came from', () => {
  const note = buildNote({ summary: 'They got upset talking about her dad', source_text: 'they got upset...' }, 'w1', 'final walkthrough on 2026-08-07');
  assert.equal(note.content, 'They got upset talking about her dad');
  assert.equal(note.category, 'note');
  assert.equal(note.status, 'pending');
  assert.match(note.source_message, /From final walkthrough on 2026-08-07/);
});

test('organisePrompt names every destination and carries the raw notes through untouched', () => {
  const prompt = organisePrompt({
    rawNotes: 'kegs - 2 local IPA', context: 'Rixey Manor is a wedding venue.',
    kindLabel: 'final walkthrough', occurredOn: '2026-08-07',
  });
  assert.match(prompt, /kegs - 2 local IPA/);
  assert.match(prompt, /final walkthrough at Rixey Manor on 2026-08-07/);
  for (const key of Object.keys(WALKTHROUGH_TARGETS)) {
    assert.ok(prompt.includes(`"${key}"`), `prompt should mention destination "${key}"`);
  }
});

test('parseItems reads the JSON array out of surrounding prose', () => {
  const raw = 'Here you go:\n[{"source_text":"chase the florist","summary":"Chase the florist","kind":"task"}]\nDone.';
  const items = parseItems(raw);
  assert.equal(items.length, 1);
  assert.equal(items[0].summary, 'Chase the florist');
  assert.equal(items[0].kind, 'task');
});

test('parseItems drops an item with neither summary nor source text', () => {
  const items = parseItems('[{"kind":"task"}]');
  assert.equal(items.length, 0);
});

test('parseItems falls back to "note" for an unrecognised kind', () => {
  const items = parseItems('[{"summary":"a stray observation","kind":"speculation"}]');
  assert.equal(items[0].kind, 'note');
});

test('parseItems rejects a section the parser invented', () => {
  const items = parseItems('[{"summary":"x","section":"not_a_real_section"}]');
  assert.equal(items[0].section, null);
});

test('parseItems keeps a section that is genuinely one of the destinations', () => {
  const items = parseItems('[{"summary":"chase the florist","section":"vendor"}]');
  assert.equal(items[0].section, 'vendor');
});

test('parseItems clamps confidence into 0-100 and rounds it', () => {
  const items = parseItems('[{"summary":"a","confidence":150},{"summary":"b","confidence":-10},{"summary":"c","confidence":42.6}]');
  assert.deepEqual(items.map(i => i.confidence), [100, 0, 43]);
});

test('parseItems gives a null confidence when none was returned', () => {
  const items = parseItems('[{"summary":"a"}]');
  assert.equal(items[0].confidence, null);
});

test('parseItems on unparseable text returns an empty list rather than throwing', () => {
  assert.deepEqual(parseItems('not json at all'), []);
  assert.deepEqual(parseItems(''), []);
  assert.deepEqual(parseItems(null), []);
});

test('parseItems ignores a proposed value that is not a plain object', () => {
  const items = parseItems('[{"summary":"a","proposed":["not","an","object"]}]');
  assert.deepEqual(items[0].proposed, {});
});

/**
 * A reply that runs out of room stops mid-object, with no closing bracket. The
 * array parse cannot work on that and used to be the only attempt, so a whole
 * chunk of correctly sorted items went in the bin because the last one was
 * half written. This is what put zero items on three real walkthroughs.
 */
test('parseItems keeps the whole items out of a reply cut off mid-object', () => {
  const truncated = '[{"summary":"chase the florist","section":"checklist","confidence":90},'
    + '{"summary":"Heidi cannot have shellfish","section":"allergies","confidence":85},'
    + '{"summary":"shuttle at 4","sect';
  const items = parseItems(truncated);
  assert.equal(items.length, 2);
  assert.equal(items[0].summary, 'chase the florist');
  assert.equal(items[1].section, 'allergies');
});

test('parseItems is not fooled by a bracket inside a quoted summary', () => {
  const truncated = '[{"summary":"she said \\"the [tent] goes here\\" and left","confidence":70},{"summ';
  const items = parseItems(truncated);
  assert.equal(items.length, 1);
  assert.equal(items[0].summary, 'she said "the [tent] goes here" and left');
});

test('parseItems still prefers the whole array when the reply is complete', () => {
  const items = parseItems('[{"summary":"a"},{"summary":"b"}]');
  assert.deepEqual(items.map(i => i.summary), ['a', 'b']);
});

test('parseItems skips a salvaged fragment that is not an item', () => {
  const truncated = '[{"summary":"a","proposed":{"task_text":"chase"}},{"sum';
  const items = parseItems(truncated);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].proposed, { task_text: 'chase' });
});
