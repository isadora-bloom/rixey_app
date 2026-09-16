/**
 * shared/guest-names.js: the two rules a plus one is named by.
 *
 * Isadora's rules, both load-bearing: a blank plus_one_name means no plus one,
 * never inferred from anything else on the row; and a plus one with no
 * surname of their own inherits the host's, derived on read and never
 * written, so fixing the host's surname fixes theirs too.
 *
 * The party-vs-person migration parity (usesPersonModel, toParties, allPeople,
 * dietaryNotes, headcount) is covered in tests/unit/guest-party-model.test.mjs.
 * This file covers every other exported function directly.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isNamedPerson, guestFullName, plusOneFullName, hasPlusOne, UNNAMED_PLUS_ONE,
  parsePlusOneCell, plusOneDisplayName, partyMembers, personDisplayName,
  dietaryNotInRegistry, normaliseName,
} from '../../shared/guest-names.js';

test('an accented name folds onto its plain spelling', () => {
  assert.equal(normaliseName('Zoë'), 'zoe');
  assert.equal(normaliseName('José'), 'jose');
  assert.equal(normaliseName('Zoë'), normaliseName('zoe'));
  assert.equal(normaliseName('José'), normaliseName('jose'));
});

test('folding survives however the accent was typed', () => {
  // Precomposed U+00E9 and e followed by a combining acute are the same name.
  assert.equal(normaliseName('José'), normaliseName('José'));
});

test('normalising a name drops case, punctuation and repeated spaces', () => {
  assert.equal(normaliseName('  TOM   WHITFIELD! '), 'tom whitfield');
  assert.equal(normaliseName("O'Brien-Smith"), 'o brien smith');
});

test('normalising keeps letters that are not Latin rather than deleting them', () => {
  assert.equal(normaliseName('Анна'), 'анна');
  assert.equal(normaliseName('中村'), '中村');
});

test('normalising nothing gives an empty string rather than throwing', () => {
  assert.equal(normaliseName(null), '');
  assert.equal(normaliseName(undefined), '');
  assert.equal(normaliseName(''), '');
});

test('a real name is a named person', () => {
  assert.equal(isNamedPerson('Tom'), true);
  assert.equal(isNamedPerson('Justin **'), true);
});

test('a placeholder is never a named person', () => {
  assert.equal(isNamedPerson('+1'), false);
  assert.equal(isNamedPerson('X'), false);
  assert.equal(isNamedPerson('TBD'), false);
  assert.equal(isNamedPerson('Hubby'), false);
  assert.equal(isNamedPerson('Maybe'), false);
});

test('nothing at all is not a named person', () => {
  assert.equal(isNamedPerson(''), false);
  assert.equal(isNamedPerson(null), false);
  assert.equal(isNamedPerson('..'), false);
});

test('a full name joins first and last', () => {
  assert.equal(guestFullName({ first_name: 'Tom', last_name: 'Whitfield' }), 'Tom Whitfield');
});

test('a full name with no surname is just the first name', () => {
  assert.equal(guestFullName({ first_name: 'Tom' }), 'Tom');
});

test('a guest with no name at all is an empty string', () => {
  assert.equal(guestFullName({}), '');
});

test('a plus one given as a first name only inherits the host surname', () => {
  assert.equal(plusOneFullName('Tom', 'Alexander'), 'Tom Alexander');
});

test('a plus one already carrying two words is taken as written', () => {
  assert.equal(plusOneFullName('Tom Whitfield', 'Alexander'), 'Tom Whitfield');
});

test('a placeholder plus one is returned as written, not inherited into', () => {
  assert.equal(plusOneFullName('+1', 'Alexander'), '+1');
});

test('a blank plus one name has no full name', () => {
  assert.equal(plusOneFullName('', 'Alexander'), '');
});

test('with no host surname to inherit, the first name stands alone', () => {
  assert.equal(plusOneFullName('Tom', ''), 'Tom');
});

test('a plus one is only granted when plus_one_name says so', () => {
  assert.equal(hasPlusOne({ plus_one_name: 'Tom' }), true);
});

test('a blank plus_one_name is never read as a granted plus one', () => {
  assert.equal(hasPlusOne({ plus_one_name: '' }), false);
  assert.equal(hasPlusOne({ plus_one_name: null }), false);
  assert.equal(hasPlusOne({ plus_one_name: '   ' }), false);
  assert.equal(hasPlusOne({}), false);
});

test('a blank spreadsheet cell means no plus one', () => {
  assert.deepEqual(parsePlusOneCell(''), { granted: false, name: null });
  assert.deepEqual(parsePlusOneCell('   '), { granted: false, name: null });
});

test('an explicit no means no plus one', () => {
  assert.deepEqual(parsePlusOneCell('No'), { granted: false, name: null });
  assert.deepEqual(parsePlusOneCell('n/a'), { granted: false, name: null });
  assert.deepEqual(parsePlusOneCell('-'), { granted: false, name: null });
});

test('a bare yes grants one without a name', () => {
  assert.deepEqual(parsePlusOneCell('Yes'), { granted: true, name: UNNAMED_PLUS_ONE });
  assert.deepEqual(parsePlusOneCell('1'), { granted: true, name: UNNAMED_PLUS_ONE });
});

test('a real name in the cell is taken as written', () => {
  assert.deepEqual(parsePlusOneCell('Tom Whitfield'), { granted: true, name: 'Tom Whitfield' });
});

test('a couple\'s own marker like ".." is granted but effectively unnamed', () => {
  // Emptiness is judged before tidying, so ".." is someone the couple granted
  // a plus one to and then gave up describing, not nothing at all.
  assert.deepEqual(parsePlusOneCell('..'), { granted: true, name: UNNAMED_PLUS_ONE });
});

test('a couple\'s own marker like "X" is kept as written', () => {
  assert.deepEqual(parsePlusOneCell('X'), { granted: true, name: 'X' });
});

test('the display name for a real plus one inherits the host surname', () => {
  const guest = { plus_one_name: 'Tom', last_name: 'Alexander' };
  assert.equal(plusOneDisplayName(guest), 'Tom Alexander');
});

test('the display name for an unnamed plus one is always Guest, never a placeholder', () => {
  const guest = { plus_one_name: '+1', last_name: 'Alexander' };
  assert.equal(plusOneDisplayName(guest), 'Guest');
});

test('the display name for no plus one is blank', () => {
  assert.equal(plusOneDisplayName({}), '');
});

test('a party with no plus one expands to one person', () => {
  const members = partyMembers({ id: 'h1', first_name: 'Grace', last_name: 'Teeters', rsvp: 'yes' });
  assert.equal(members.length, 1);
  assert.equal(members[0].isPlusOne, false);
  assert.equal(members[0].host, null);
});

test('a party with a plus one expands to two people, and the plus one knows their host', () => {
  const guest = { id: 'h1', first_name: 'Sarah', last_name: 'Alexander', rsvp: 'yes',
    plus_one_name: 'Tom', plus_one_rsvp: 'yes' };
  const members = partyMembers(guest);
  assert.equal(members.length, 2);
  assert.equal(members[0].name, 'Sarah Alexander');
  assert.equal(members[1].name, 'Tom Alexander');
  assert.equal(members[1].isPlusOne, true);
  assert.equal(members[1].host, 'Sarah Alexander');
});

test('an RSVP left blank reads as pending, not as an empty string', () => {
  const members = partyMembers({ id: 'h1', first_name: 'Grace', last_name: 'Teeters' });
  assert.equal(members[0].rsvp, 'pending');
});

test('a party-model host row displays under their own name regardless of a head row', () => {
  const row = { is_plus_one: false, first_name: 'Sarah', last_name: 'Alexander' };
  assert.equal(personDisplayName(row, null), 'Sarah Alexander');
});

test('a person-model plus one with no surname inherits the head\'s', () => {
  const row = { is_plus_one: true, first_name: 'Cole', last_name: null };
  const head = { last_name: 'Ashby' };
  assert.equal(personDisplayName(row, head), 'Cole Ashby');
});

test('a person-model plus one who gave their own surname keeps it', () => {
  const row = { is_plus_one: true, first_name: 'Tom', last_name: 'Whitfield' };
  const head = { last_name: 'Alexander' };
  assert.equal(personDisplayName(row, head), 'Tom Whitfield');
});

test('a person-model plus one granted but never named is Guest', () => {
  const row = { is_plus_one: true, first_name: null, last_name: null };
  assert.equal(personDisplayName(row, { last_name: 'Knizner' }), 'Guest');
});

test('a person-model plus one named only with a placeholder is Guest', () => {
  const row = { is_plus_one: true, first_name: 'X', last_name: null };
  assert.equal(personDisplayName(row, { last_name: 'Knizner' }), 'Guest');
});

test('dietary notes already in the registry, by name, are left out', () => {
  const guests = [
    { id: 'h1', first_name: 'Tom', last_name: 'Whitfield', dietary_restrictions: 'coeliac' },
  ];
  const registry = [{ guest_name: 'Tom Whitfield' }];
  assert.deepEqual(dietaryNotInRegistry(guests, registry), []);
});

test('matching against the registry ignores case and punctuation', () => {
  const guests = [
    { id: 'h1', first_name: 'Tom', last_name: 'Whitfield', dietary_restrictions: 'coeliac' },
  ];
  const registry = [{ guest_name: "TOM WHITFIELD!" }];
  assert.deepEqual(dietaryNotInRegistry(guests, registry), []);
});

test('an accented guest already in the registry is not surfaced as missing', () => {
  const guests = [
    { id: 'h1', first_name: 'Zoë', last_name: 'Martín', dietary_restrictions: 'coeliac' },
  ];
  const registry = [{ guest_name: 'Zoe Martin' }];
  assert.deepEqual(dietaryNotInRegistry(guests, registry), []);
});

test('a dietary note with nobody of that name in the registry is surfaced', () => {
  const guests = [
    { id: 'h1', first_name: 'Grace', last_name: 'Teeters', dietary_restrictions: 'no shellfish' },
  ];
  const registry = [{ guest_name: 'Tom Whitfield' }];
  const missing = dietaryNotInRegistry(guests, registry);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].name, 'Grace Teeters');
});
