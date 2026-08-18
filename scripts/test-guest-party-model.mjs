/**
 * The party model and the person model must agree about who is coming.
 *
 * Migration 025 changes a plus one from four columns on their host's row into a
 * row of their own. The schema change and the code deploy cannot land at the
 * same instant, so shared/guest-names.js has to read both shapes and give the
 * same answer either way. If it does not, a plus one is either counted twice or
 * not at all, which is the exact class of bug the model change exists to end.
 *
 *   node scripts/test-guest-party-model.mjs
 */
import {
  allPeople, headcount, dietaryNotes, usesPersonModel, toParties,
} from '../shared/guest-names.js';

let failures = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok    ${label}`); return; }
  failures++;
  console.log(`  FAIL  ${label}\n          expected ${e}\n          got      ${a}`);
}

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

console.log('model detection:');
check('party model is not mistaken for the person model', usesPersonModel(PARTY_MODEL), false);
check('person model is detected', usesPersonModel(PERSON_MODEL), true);
check('empty list does not claim to be the person model', usesPersonModel([]), false);

console.log('\nheadcount agrees:');
const hcParty = headcount(PARTY_MODEL);
const hcPerson = headcount(PERSON_MODEL);
// Sarah, Tom, Brooke and Grace say yes; Kevan and his unnamed plus one decline;
// Cole has not answered. Written out because counting it by hand got it wrong
// the first time, which is rather the point of the exercise.
check('party model headcount', hcParty, { total: 7, attending: 4, declined: 2, maybe: 0, pending: 1 });
check('person model matches it exactly', hcPerson, hcParty);

console.log('\nthe same seven people, named the same way:');
const namesParty = allPeople(PARTY_MODEL).map(p => p.name).sort();
const namesPerson = allPeople(PERSON_MODEL).map(p => p.name).sort();
check('party model names', namesParty,
  ['Brooke Ashby', 'Cole Ashby', 'Grace Teeters', 'Guest', 'Kevan Knizner', 'Sarah Alexander', 'Tom Whitfield']);
check('person model names match', namesPerson, namesParty);

console.log('\nthe naming rules survive the change:');
const byName = Object.fromEntries(allPeople(PERSON_MODEL).map(p => [p.name, p]));
check('a surname that was written is taken as written', byName['Tom Whitfield']?.isPlusOne, true);
check('a plus one with no surname inherits the host\'s', !!byName['Cole Ashby'], true);
check('a plus one never named displays as Guest', !!byName['Guest'], true);
check('the unnamed one still counts', headcount(PERSON_MODEL).declined, 2);
check('a plus one knows whose they are', byName['Cole Ashby']?.host, 'Brooke Ashby');
check('a host is not marked as somebody\'s plus one', byName['Sarah Alexander']?.isPlusOne, false);

console.log('\ndietary notes reach the kitchen either way:');
const dietParty = dietaryNotes(PARTY_MODEL).map(d => `${d.name}: ${d.note}`).sort();
const dietPerson = dietaryNotes(PERSON_MODEL).map(d => `${d.name}: ${d.note}`).sort();
check('party model', dietParty, ['Grace Teeters: no shellfish', 'Tom Whitfield: coeliac']);
check('person model matches', dietPerson, dietParty);

console.log('\nparties group correctly:');
check('four parties', toParties(PERSON_MODEL).length, 4);
check('the head is never the plus one', toParties(PERSON_MODEL).every(p => !p.head.is_plus_one), true);
check('Sarah\'s party has two people', toParties(PERSON_MODEL).find(p => p.head.id === 'h1').members.length, 2);

console.log('\nnobody is counted twice mid-migration:');
// The state right after the backfill, before plus_one_* are dropped: the host
// still carries plus_one_name AND the person row exists.
const DURING = [
  { id: 'h1', wedding_id: 'w', party_id: 'h1', is_plus_one: false, first_name: 'Sarah', last_name: 'Alexander', rsvp: 'yes',
    plus_one_name: 'Tom Whitfield', plus_one_rsvp: 'yes', plus_one_dietary: 'coeliac' },
  { id: 'p1', wedding_id: 'w', party_id: 'h1', is_plus_one: true, plus_one_of: 'h1', first_name: 'Tom', last_name: 'Whitfield', rsvp: 'yes', dietary_restrictions: 'coeliac' },
];
check('two people, not three', headcount(DURING).total, 2);
check('one dietary note, not two', dietaryNotes(DURING).length, 1);


console.log('\neach person carries their own row, so seating can read their table:');
// PrintView seats one person at a time from p.row.table_assignment. Before 025
// a plus one shares their host's row and therefore their table; after it they
// have their own and can be moved without moving whoever invited them.
const seatedParty = allPeople(PARTY_MODEL.map(g => ({ ...g, table_assignment: 'Table 1' })));
check('party model: a plus one sits at their host table',
  seatedParty.filter(p => p.row?.table_assignment === 'Table 1').length, 7);

const seatedPerson = allPeople(PERSON_MODEL.map(g => ({ ...g, table_assignment: g.is_plus_one ? 'Table 2' : 'Table 1' })));
check('person model: a plus one can be seated apart from their host',
  seatedPerson.filter(p => p.row?.table_assignment === 'Table 2').map(p => p.name).sort(),
  ['Cole Ashby', 'Guest', 'Tom Whitfield']);
check('nobody is seated twice', seatedPerson.length, 7);

console.log(failures ? `\n${failures} failed` : '\nAll good.');
process.exit(failures ? 1 : 0);
