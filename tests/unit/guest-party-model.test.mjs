/**
 * The party model and the person model must agree about who is coming.
 *
 * Migration 025 changes a plus one from four columns on their host's row into a
 * row of their own. The schema change and the code deploy cannot land at the
 * same instant, so shared/guest-names.js has to read both shapes and give the
 * same answer either way. If it does not, a plus one is either counted twice or
 * not at all, which is the exact class of bug the model change exists to end.
 *
 * Converted from scripts/test-guest-party-model.mjs; every assertion there has
 * a test here.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allPeople, headcount, dietaryNotes, usesPersonModel, toParties,
} from '../../shared/guest-names.js';
import { shuttleRequests } from '../../shared/rsvp-fields.js';

// The same four parties, described both ways.
const PARTY_MODEL = [
  { id: 'h1', wedding_id: 'w', first_name: 'Sarah', last_name: 'Alexander', rsvp: 'yes',
    plus_one_name: 'Tom Whitfield', plus_one_rsvp: 'yes', plus_one_dietary: 'coeliac' },
  { id: 'h2', wedding_id: 'w', first_name: 'Brooke', last_name: 'Ashby', rsvp: 'yes',
    plus_one_name: 'Cole', plus_one_rsvp: 'pending' },
  { id: 'h3', wedding_id: 'w', first_name: 'Kevan', last_name: 'Knizner', rsvp: 'no',
    plus_one_name: '+1', plus_one_rsvp: 'no' },
  { id: 'h4', wedding_id: 'w', first_name: 'Grace', last_name: 'Teeters', rsvp: 'yes',
    plus_one_name: null, plus_one_rsvp: 'pending', dietary_restrictions: 'no shellfish' },
];

const PERSON_MODEL = [
  { id: 'h1', wedding_id: 'w', party_id: 'h1', is_plus_one: false, first_name: 'Sarah', last_name: 'Alexander', rsvp: 'yes' },
  { id: 'p1', wedding_id: 'w', party_id: 'h1', is_plus_one: true, plus_one_of: 'h1', first_name: 'Tom', last_name: 'Whitfield', rsvp: 'yes', dietary_restrictions: 'coeliac' },
  { id: 'h2', wedding_id: 'w', party_id: 'h2', is_plus_one: false, first_name: 'Brooke', last_name: 'Ashby', rsvp: 'yes' },
  // No surname recorded: inherited from the host on read, never written.
  { id: 'p2', wedding_id: 'w', party_id: 'h2', is_plus_one: true, plus_one_of: 'h2', first_name: 'Cole', last_name: null, rsvp: 'pending' },
  { id: 'h3', wedding_id: 'w', party_id: 'h3', is_plus_one: false, first_name: 'Kevan', last_name: 'Knizner', rsvp: 'no' },
  // Granted but never named. A real person, not a name.
  { id: 'p3', wedding_id: 'w', party_id: 'h3', is_plus_one: true, plus_one_of: 'h3', first_name: null, last_name: null, rsvp: 'no' },
  { id: 'h4', wedding_id: 'w', party_id: 'h4', is_plus_one: false, first_name: 'Grace', last_name: 'Teeters', rsvp: 'yes', dietary_restrictions: 'no shellfish' },
];

test('party model is not mistaken for the person model', () => {
  assert.equal(usesPersonModel(PARTY_MODEL), false);
});

test('person model is detected', () => {
  assert.equal(usesPersonModel(PERSON_MODEL), true);
});

test('an empty list does not claim to be the person model', () => {
  assert.equal(usesPersonModel([]), false);
});

test('the party model headcount is right', () => {
  // Sarah, Tom, Brooke and Grace say yes; Kevan and his unnamed plus one
  // decline; Cole has not answered.
  assert.deepEqual(headcount(PARTY_MODEL), { total: 7, attending: 4, declined: 2, maybe: 0, pending: 1 });
});

test('the person model headcount matches the party model exactly', () => {
  assert.deepEqual(headcount(PERSON_MODEL), headcount(PARTY_MODEL));
});

test('the party model names the same seven people correctly', () => {
  const names = allPeople(PARTY_MODEL).map(p => p.name).sort();
  assert.deepEqual(names,
    ['Brooke Ashby', 'Cole Ashby', 'Grace Teeters', 'Guest', 'Kevan Knizner', 'Sarah Alexander', 'Tom Whitfield']);
});

test('the person model names match the party model names', () => {
  const namesParty = allPeople(PARTY_MODEL).map(p => p.name).sort();
  const namesPerson = allPeople(PERSON_MODEL).map(p => p.name).sort();
  assert.deepEqual(namesPerson, namesParty);
});

test('a surname that was written is taken as written', () => {
  const byName = Object.fromEntries(allPeople(PERSON_MODEL).map(p => [p.name, p]));
  assert.equal(byName['Tom Whitfield']?.isPlusOne, true);
});

test('a plus one with no surname inherits the host\'s', () => {
  const byName = Object.fromEntries(allPeople(PERSON_MODEL).map(p => [p.name, p]));
  assert.equal(!!byName['Cole Ashby'], true);
});

test('a plus one never named displays as Guest', () => {
  const byName = Object.fromEntries(allPeople(PERSON_MODEL).map(p => [p.name, p]));
  assert.equal(!!byName['Guest'], true);
});

test('the unnamed plus one still counts towards declined', () => {
  assert.equal(headcount(PERSON_MODEL).declined, 2);
});

test('a plus one knows whose party they are in', () => {
  const byName = Object.fromEntries(allPeople(PERSON_MODEL).map(p => [p.name, p]));
  assert.equal(byName['Cole Ashby']?.host, 'Brooke Ashby');
});

test('a host is never marked as somebody\'s plus one', () => {
  const byName = Object.fromEntries(allPeople(PERSON_MODEL).map(p => [p.name, p]));
  assert.equal(byName['Sarah Alexander']?.isPlusOne, false);
});

test('dietary notes reach the kitchen in the party model', () => {
  const diet = dietaryNotes(PARTY_MODEL).map(d => `${d.name}: ${d.note}`).sort();
  assert.deepEqual(diet, ['Grace Teeters: no shellfish', 'Tom Whitfield: coeliac']);
});

test('dietary notes match between the two models', () => {
  const dietParty = dietaryNotes(PARTY_MODEL).map(d => `${d.name}: ${d.note}`).sort();
  const dietPerson = dietaryNotes(PERSON_MODEL).map(d => `${d.name}: ${d.note}`).sort();
  assert.deepEqual(dietPerson, dietParty);
});

test('the person model groups into four parties', () => {
  assert.equal(toParties(PERSON_MODEL).length, 4);
});

test('the head of a party is never marked as the plus one', () => {
  assert.ok(toParties(PERSON_MODEL).every(p => !p.head.is_plus_one));
});

test('Sarah\'s party has two people', () => {
  assert.equal(toParties(PERSON_MODEL).find(p => p.head.id === 'h1').members.length, 2);
});

test('nobody is counted twice mid-migration', () => {
  // The state right after the backfill, before plus_one_* are dropped: the host
  // still carries plus_one_name AND the person row exists.
  const DURING = [
    { id: 'h1', wedding_id: 'w', party_id: 'h1', is_plus_one: false, first_name: 'Sarah', last_name: 'Alexander', rsvp: 'yes',
      plus_one_name: 'Tom Whitfield', plus_one_rsvp: 'yes', plus_one_dietary: 'coeliac' },
    { id: 'p1', wedding_id: 'w', party_id: 'h1', is_plus_one: true, plus_one_of: 'h1', first_name: 'Tom', last_name: 'Whitfield', rsvp: 'yes', dietary_restrictions: 'coeliac' },
  ];
  assert.equal(headcount(DURING).total, 2);
  assert.equal(dietaryNotes(DURING).length, 1);
});

test('in the party model each person carries their host\'s row, so seating reads the host\'s table for everyone', () => {
  // PrintView seats one person at a time from p.row.table_assignment. Before
  // 025 a plus one shares their host's row and therefore their table.
  const seated = allPeople(PARTY_MODEL.map(g => ({ ...g, table_assignment: 'Table 1' })));
  assert.equal(seated.filter(p => p.row?.table_assignment === 'Table 1').length, 7);
});

test('in the person model a plus one can be seated apart from their host', () => {
  // After 025 a plus one has their own row and can be moved without moving
  // whoever invited them.
  const seated = allPeople(PERSON_MODEL.map(g => ({ ...g, table_assignment: g.is_plus_one ? 'Table 2' : 'Table 1' })));
  assert.deepEqual(
    seated.filter(p => p.row?.table_assignment === 'Table 2').map(p => p.name).sort(),
    ['Cole Ashby', 'Guest', 'Tom Whitfield'],
  );
  assert.equal(seated.length, 7);
});

test('a shuttle seat per person, counted once, in the party model', () => {
  // A shuttle is a real minibus with real seats: walking the rows AND
  // expanding each host's plus_one_* counts every plus one twice. Their
  // answer still arrives on the host's extras, under plus_one_shuttle,
  // because one RSVP covers the party.
  const SHUTTLE_PARTY = [
    { id: 'h1', first_name: 'Sarah', last_name: 'Alexander', rsvp: 'yes',
      plus_one_name: 'Tom Whitfield', plus_one_rsvp: 'yes',
      rsvp_extras: { shuttle: 'Yes', plus_one_shuttle: 'Yes' } },
    { id: 'h2', first_name: 'Grace', last_name: 'Teeters', rsvp: 'yes',
      rsvp_extras: { shuttle: 'No' } },
  ];
  assert.deepEqual(shuttleRequests(SHUTTLE_PARTY).map(r => r.name).sort(), ['Sarah Alexander', 'Tom Whitfield']);
});

test('the same two seats, not four, in the person model', () => {
  const SHUTTLE_PERSON = [
    { id: 'h1', party_id: 'h1', is_plus_one: false, first_name: 'Sarah', last_name: 'Alexander', rsvp: 'yes',
      rsvp_extras: { shuttle: 'Yes', plus_one_shuttle: 'Yes' } },
    { id: 'p1', party_id: 'h1', is_plus_one: true, plus_one_of: 'h1', first_name: 'Tom', last_name: 'Whitfield', rsvp: 'yes',
      rsvp_extras: {} },
    { id: 'h2', party_id: 'h2', is_plus_one: false, first_name: 'Grace', last_name: 'Teeters', rsvp: 'yes',
      rsvp_extras: { shuttle: 'No' } },
  ];
  const seats = shuttleRequests(SHUTTLE_PERSON);
  assert.deepEqual(seats.map(r => r.name).sort(), ['Sarah Alexander', 'Tom Whitfield']);
  const tom = seats.find(r => r.name === 'Tom Whitfield');
  assert.equal(tom?.isPlusOne, true);
  assert.equal(tom?.host, 'Sarah Alexander');
});

test('a plus one who declined the shuttle takes no seat', () => {
  const SHUTTLE_PERSON = [
    { id: 'h1', party_id: 'h1', is_plus_one: false, first_name: 'Sarah', last_name: 'Alexander', rsvp: 'yes',
      rsvp_extras: { shuttle: 'Yes', plus_one_shuttle: 'Yes' } },
    { id: 'p1', party_id: 'h1', is_plus_one: true, plus_one_of: 'h1', first_name: 'Tom', last_name: 'Whitfield', rsvp: 'no',
      rsvp_extras: {} },
  ];
  assert.deepEqual(shuttleRequests(SHUTTLE_PERSON).map(r => r.name), ['Sarah Alexander']);
});
