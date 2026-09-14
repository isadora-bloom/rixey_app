/**
 * Which wedding a typed sentence is about.
 *
 * The cases that matter are the ones where it must refuse: two Alyssas in the
 * book, a sentence with no name in it at all. A wedding picked wrongly here is
 * a confident answer about the wrong couple, which reads exactly like a right
 * one.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchWedding, trimQuestion, tokenise } from '../../shared/wedding-match.js';

const WEDDINGS = [
  {
    id: 'w-johnson',
    couple_names: 'Alyssa & Brett Johnson',
    partner1_name: 'Alyssa Johnson',
    partner2_name: 'Brett Johnson',
    project_name: null,
    wedding_date: '2026-09-19',
    archived: false,
  },
  {
    id: 'w-beaudoin',
    couple_names: 'Christiane & Jarred',
    partner1_name: 'Christiane Beaudoin',
    partner2_name: 'Jarred Lyle',
    project_name: null,
    wedding_date: '2026-10-03',
    archived: false,
  },
  {
    id: 'w-pike',
    couple_names: 'Melissa Pike & Tom Pike',
    partner1_name: 'Melissa Pike',
    partner2_name: 'Tom Pike',
    project_name: null,
    wedding_date: '2026-11-14',
    archived: false,
  },
  {
    id: 'w-whitmore',
    couple_names: 'Alyssa & Dan Whitmore',
    partner1_name: 'Alyssa Carr',
    partner2_name: 'Dan Whitmore',
    project_name: null,
    wedding_date: '2027-04-10',
    archived: false,
  },
  {
    id: 'w-trent',
    couple_names: 'Nadia & Oscar Trent',
    partner1_name: 'Nadia Trent',
    partner2_name: 'Oscar Trent',
    project_name: null,
    wedding_date: '2024-06-08',
    archived: true,
  },
];

test('a first name nobody else uses is enough', () => {
  const m = matchWedding('how many guests does melissa have', WEDDINGS);
  assert.equal(m.wedding.id, 'w-pike');
  assert.deepEqual(m.candidates, []);
});

test('a surname on its own resolves, and resolves with confidence', () => {
  const m = matchWedding('who is doing the flowers for the pikes', WEDDINGS);
  assert.equal(m.wedding.id, 'w-pike');
  assert.equal(m.confidence, 'high');
});

test('both halves of the couple', () => {
  const m = matchWedding('what time is the ceremony for christiane and jarred', WEDDINGS);
  assert.equal(m.wedding.id, 'w-beaudoin');
  assert.equal(m.question, 'what time is the ceremony');
});

test("a possessive is the same name, melissa's and melissas both", () => {
  assert.equal(matchWedding("tell me the caterer for melissa's wedding", WEDDINGS).wedding.id, 'w-pike');
  assert.equal(matchWedding('tell me the caterer for melissas wedding', WEDDINGS).wedding.id, 'w-pike');
});

test('two Alyssas come back as a question, not an answer', () => {
  const m = matchWedding('tell me the caterer for alyssas wedding', WEDDINGS);
  assert.equal(m.wedding, null);
  assert.equal(m.confidence, 'low');
  assert.deepEqual(m.candidates.map(w => w.id).sort(), ['w-johnson', 'w-whitmore']);
});

test('a surname breaks the tie between the two Alyssas', () => {
  const m = matchWedding('tell me the caterer for alyssa whitmore', WEDDINGS);
  assert.equal(m.wedding.id, 'w-whitmore');
  assert.equal(m.confidence, 'high');
});

test('no name at all matches nothing and offers nothing', () => {
  const m = matchWedding('what time does the bar close', WEDDINGS);
  assert.equal(m.wedding, null);
  assert.deepEqual(m.candidates, []);
  assert.equal(m.confidence, 'none');
});

test('an archived wedding answers only when no live one can', () => {
  const m = matchWedding('how many guests did nadia have', WEDDINGS);
  assert.equal(m.wedding.id, 'w-trent');
});

test('a live wedding beats an archived one with the same surname', () => {
  const withLiveTrent = [
    ...WEDDINGS,
    { id: 'w-live-trent', couple_names: 'Priya & Sam Trent', partner1_name: 'Priya Trent', partner2_name: 'Sam Trent', archived: false },
  ];
  assert.equal(matchWedding('the bar plan for the trents', withLiveTrent).wedding.id, 'w-live-trent');
});

test('the question is what is left when the name and the scaffolding go', () => {
  const m = matchWedding('tell me the caterer for alyssas wedding', WEDDINGS);
  assert.equal(m.question, 'the caterer');
});

test('trimming stops before it eats the question', () => {
  // Nothing but a name: there is no question left, so the original stands.
  assert.equal(matchWedding('melissa', WEDDINGS).question, 'melissa');
  // A name in the middle of a sentence stays where it is.
  assert.equal(matchWedding('how many guests does melissa have', WEDDINGS).question, 'how many guests does melissa have');
});

test('trimQuestion leaves a sentence with no name in it alone', () => {
  assert.equal(trimQuestion('what time does the bar close', []), 'what time does the bar close');
});

test('tokenise drops the short words and the punctuation', () => {
  assert.deepEqual(tokenise("Alyssa's wedding — is it on?"), ['alyssa', 'wedding']);
});

test('an empty wedding list is not a crash', () => {
  const m = matchWedding('anything at all', []);
  assert.equal(m.wedding, null);
  assert.deepEqual(m.candidates, []);
});
