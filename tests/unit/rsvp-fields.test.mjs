/**
 * shared/rsvp-fields.js: the field mapping for RSVP submissions.
 *
 * One definition of the extra RSVP questions, used by RSVP Settings, the
 * wedding website, and everything that reads the answers back. They drifted
 * once already: the settings page offered a dietary toggle the form never
 * consulted.
 *
 * shuttleRequests' party-vs-person parity is covered in
 * tests/unit/guest-party-model.test.mjs; this file covers it plus everything
 * else exported here.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  plusOneExtraKey, isFieldOn, sendsConfirmation, describeExtras, shuttleRequests,
} from '../../shared/rsvp-fields.js';

test('a per-person answer is stored under plus_one_<extra>', () => {
  assert.equal(plusOneExtraKey('shuttle'), 'plus_one_shuttle');
});

test('a field explicitly set on is on', () => {
  assert.equal(isFieldOn({ fields: { ask_phone: true } }, 'ask_phone'), true);
});

test('a field explicitly set off is off, even if its default is on', () => {
  assert.equal(isFieldOn({ fields: { ask_dietary: false } }, 'ask_dietary'), false);
});

test('with no config at all, a field falls back to its own default', () => {
  assert.equal(isFieldOn({}, 'ask_dietary'), true);
  assert.equal(isFieldOn({}, 'ask_phone'), false);
  assert.equal(isFieldOn(null, 'ask_dietary'), true);
});

test('an unknown field key is off', () => {
  assert.equal(isFieldOn({ fields: {} }, 'not_a_real_field'), false);
});

test('confirmation emails default to on', () => {
  assert.equal(sendsConfirmation({}), true);
  assert.equal(sendsConfirmation(null), true);
});

test('confirmation emails can be switched off', () => {
  assert.equal(sendsConfirmation({ fields: { send_confirmation: false } }), false);
});

test('describeExtras returns nothing for an empty or missing blob', () => {
  assert.deepEqual(describeExtras(null, {}), []);
  assert.deepEqual(describeExtras({}, {}), []);
  assert.deepEqual(describeExtras([], {}), []);
});

test('a plain answer is labelled from RSVP_FIELDS', () => {
  const out = describeExtras({ phone: '555-1234' }, {});
  assert.deepEqual(out, [{ key: 'phone', label: 'Phone number', short: 'Phone', value: '555-1234' }]);
});

test('a per-person answer is labelled with the plus one\'s name', () => {
  const out = describeExtras({ shuttle: 'Yes', plus_one_shuttle: 'No' }, {}, { plusOneName: 'Tom Whitfield' });
  const plusOneRow = out.find(o => o.key === 'plus_one_shuttle');
  assert.equal(plusOneRow.label, 'Shuttle preference — Tom Whitfield');
  assert.equal(plusOneRow.value, 'No');
});

test('with no plus one name known, the generic "plus one" is used', () => {
  const out = describeExtras({ plus_one_shuttle: 'Yes' }, {});
  assert.equal(out[0].label, 'Shuttle preference — plus one');
});

test('a custom question answer is labelled from custom_questions by index', () => {
  const out = describeExtras({ custom_0: 'Vegetarian' }, { custom_questions: [{ label: 'Any special requests?' }] });
  assert.deepEqual(out, [{ key: 'custom_0', label: 'Any special requests?', short: 'Any special requests?', value: 'Vegetarian' }]);
});

test('a deleted custom question still shows its answer, under a generic label', () => {
  const out = describeExtras({ custom_2: 'answer' }, { custom_questions: [] });
  assert.equal(out[0].label, 'Custom question 3');
});

test('an answer to a question nobody defined is still shown', () => {
  const out = describeExtras({ some_odd_key: 'val' }, {});
  assert.equal(out[0].label, 'some_odd_key');
});

test('a blank answer is not shown at all', () => {
  assert.deepEqual(describeExtras({ phone: '   ' }, {}), []);
});

test('shuttleRequests: a guest tagged Shuttle with no explicit answer still takes a seat', () => {
  const guests = [
    { id: 'h1', first_name: 'Grace', last_name: 'Teeters', rsvp: 'yes', tags: ['Shuttle'] },
  ];
  const seats = shuttleRequests(guests);
  assert.equal(seats.length, 1);
  assert.equal(seats[0].name, 'Grace Teeters');
  assert.equal(seats[0].viaTag, true);
});

test('shuttleRequests: a person-model row tagged Shuttle takes a seat, marked via the tag', () => {
  // At least one is_plus_one row is what tips usesPersonModel into the
  // post-025 branch; Grace's own party has none.
  const guests = [
    { id: 'h1', party_id: 'h1', is_plus_one: false, first_name: 'Grace', last_name: 'Teeters', rsvp: 'yes', tags: ['shuttle'] },
    { id: 'h2', party_id: 'h2', is_plus_one: false, first_name: 'Sarah', last_name: 'Alexander', rsvp: 'yes' },
    { id: 'p2', party_id: 'h2', is_plus_one: true, plus_one_of: 'h2', first_name: 'Tom', last_name: 'Whitfield', rsvp: 'no' },
  ];
  const seats = shuttleRequests(guests);
  assert.deepEqual(seats.map(s => s.name), ['Grace Teeters']);
  assert.equal(seats[0].viaTag, true);
});

test('shuttleRequests: an explicit answer is not marked as coming via the tag', () => {
  const guests = [
    { id: 'h1', first_name: 'Grace', last_name: 'Teeters', rsvp: 'yes', rsvp_extras: { shuttle: 'Yes' }, tags: ['Shuttle'] },
  ];
  assert.equal(shuttleRequests(guests)[0].viaTag, false);
});
