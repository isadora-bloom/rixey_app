/**
 * Whose call is this?
 *
 * A suggestion, never a filing, and migration 021 exists because a flat name
 * match put a stranger's planning meeting and a critical potato allergy on the
 * wrong couple's record for three weeks. So the failing directions are what is
 * asserted here: never guess when two weddings match, and never call a failed
 * lookup "no match".
 *
 * The plus-one case is the new one. A plus one's surname is usually not
 * written down — it is inherited from their host on read — so a query against
 * last_name could not see them, and a guest who is on the list came back as a
 * stranger.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestWedding } from '../../server/lib/quo-calls.js';

const WEDDINGS = [
  { id: 'w1', couple_names: 'Brooke & Jared' },
  { id: 'w2', couple_names: 'Alyssa & Brett' },
];

/**
 * Enough of a supabase client for the two reads this makes: guests by surname,
 * then plus ones by host.
 */
function fakeSupabase({ bySurname = [], plusOnes = [], fail = null } = {}) {
  return {
    from() {
      const q = { mode: null };
      const builder = {
        select() { return builder; },
        ilike() { q.mode = 'surname'; return builder; },
        in() { q.mode = 'plusOne'; return builder; },
        is() { return builder; },
        then(resolve, reject) {
          if (fail === q.mode) return Promise.resolve({ data: null, error: { message: 'guest lists are down' } }).then(resolve, reject);
          return Promise.resolve({ data: q.mode === 'plusOne' ? plusOnes : bySurname, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

test('a guest on exactly one list is suggested', async () => {
  const supabase = fakeSupabase({ bySurname: [{ id: 'h1', wedding_id: 'w1', first_name: 'Grace', last_name: 'Teeters', is_plus_one: false }] });
  const out = await suggestWedding(supabase, 'Grace Teeters', WEDDINGS);
  assert.equal(out.weddingId, 'w1');
  assert.equal(out.confidence, 70);
});

test('a plus one with no surname of their own is found under their host', async () => {
  const supabase = fakeSupabase({
    // Cole is not here: his last_name is null, so a query on Ashby misses him.
    bySurname: [{ id: 'h1', wedding_id: 'w1', first_name: 'Brooke', last_name: 'Ashby', is_plus_one: false }],
    plusOnes: [{ wedding_id: 'w1', first_name: 'Cole' }],
  });
  const out = await suggestWedding(supabase, 'Cole Ashby', WEDDINGS);
  assert.equal(out.weddingId, 'w1');
  assert.match(out.reason, /on the guest list for Brooke & Jared/);
});

test('a name on two guest lists is a question, not an answer', async () => {
  const supabase = fakeSupabase({
    bySurname: [
      { id: 'h1', wedding_id: 'w1', first_name: 'Grace', last_name: 'Teeters', is_plus_one: false },
      { id: 'h2', wedding_id: 'w2', first_name: 'Grace', last_name: 'Teeters', is_plus_one: false },
    ],
  });
  const out = await suggestWedding(supabase, 'Grace Teeters', WEDDINGS);
  assert.equal(out.weddingId, null);
  assert.match(out.reason, /on 2 guest lists/);
});

test('a host and their own plus one at the same wedding is still one answer', async () => {
  const supabase = fakeSupabase({
    bySurname: [{ id: 'h1', wedding_id: 'w1', first_name: 'Cole', last_name: 'Ashby', is_plus_one: false }],
    plusOnes: [{ wedding_id: 'w1', first_name: 'Cole' }],
  });
  const out = await suggestWedding(supabase, 'Cole Ashby', WEDDINGS);
  assert.equal(out.weddingId, 'w1');
});

test('a failed plus-one lookup says it could not tell', async () => {
  const supabase = fakeSupabase({
    bySurname: [{ id: 'h1', wedding_id: 'w1', first_name: 'Brooke', last_name: 'Ashby', is_plus_one: false }],
    fail: 'plusOne',
  });
  const out = await suggestWedding(supabase, 'Cole Ashby', WEDDINGS);
  assert.equal(out.weddingId, null);
  assert.match(out.reason, /needs a human/);
});

test('a failed guest lookup is not reported as nobody of that name', async () => {
  const out = await suggestWedding(fakeSupabase({ fail: 'surname' }), 'Grace Teeters', WEDDINGS);
  assert.equal(out.weddingId, null);
  assert.match(out.reason, /needs a human/);
});

test('with no name at all nothing is suggested', async () => {
  const out = await suggestWedding(fakeSupabase(), '', WEDDINGS);
  assert.equal(out.weddingId, null);
});

test('a surname that appears in a couple’s own name is a weaker suggestion', async () => {
  const out = await suggestWedding(fakeSupabase(), 'Susan Brett', WEDDINGS);
  assert.equal(out.weddingId, 'w2');
  assert.equal(out.confidence, 55);
});
