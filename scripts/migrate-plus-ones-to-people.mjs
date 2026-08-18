/**
 * Give every plus one a row of their own.
 *
 * Migration 025 adds party_id, is_plus_one and plus_one_of. This creates the
 * person rows, and it lives in JavaScript rather than in the migration because
 * deciding what is a name is not a job for a second copy of a regex: it imports
 * isNamedPerson from shared/guest-names.js, the same function the app uses.
 *
 * ## What it writes, and what it deliberately does not
 *
 * A plus one becomes a row with is_plus_one = true, plus_one_of pointing at
 * their host, and the same party_id. Their name is split as written:
 *
 *   "Sarah Whitfield"  → first_name Sarah, last_name Whitfield
 *   "Sarah"            → first_name Sarah, last_name NULL
 *   "+1", "X", "Hubby" → first_name kept as written, last_name NULL,
 *                         and shown as "Guest" because it is not a name
 *
 * The single-name case leaves last_name NULL on purpose. The house rule is that
 * a plus one shares their host's surname unless a different one was recorded,
 * and that is derived on read and never written — of the plus ones that do
 * state a surname, about a third differ from their host, so writing an
 * inherited one would print a wrong name on a place card with nothing left to
 * say it was ever a guess.
 *
 * The placeholder case keeps both the person and the label. "+1" and "Hubby"
 * are not names, so they render as "Guest", but they are stored as typed:
 * first_name is NOT NULL and, more to the point, "Hubby" is the only thing
 * anybody ever recorded about that person and throwing it away would help
 * nobody. The placeholder rules do their work on read, where they can be
 * corrected.
 *
 * rsvp, meal_choice and dietary come across from the plus_one_* columns. The
 * old columns are NOT cleared: until every read surface has moved over, the
 * data has to remain readable both ways. shared/guest-names.js ignores
 * plus_one_* as soon as it sees an is_plus_one row, so nobody is counted twice.
 *
 *   node scripts/migrate-plus-ones-to-people.mjs
 *   node scripts/migrate-plus-ones-to-people.mjs --apply
 *   node scripts/migrate-plus-ones-to-people.mjs --undo
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isNamedPerson, hasPlusOne, guestFullName, headcount, UNNAMED_PLUS_ONE } from '../shared/guest-names.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const APPLY = process.argv.includes('--apply');
const UNDO = process.argv.includes('--undo');

async function all(table, columns, filter = q => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const guests = await all('wedding_guests', '*');
if (!guests.length) { console.log('No guests.'); process.exit(0); }

if (!Object.prototype.hasOwnProperty.call(guests[0], 'is_plus_one')) {
  console.error('Migration 025 has not been run yet: wedding_guests has no is_plus_one column.');
  console.error('Paste migrations/025_guest_party_id.sql into the Supabase SQL editor first.');
  process.exit(1);
}

if (UNDO) {
  const created = guests.filter(g => g.is_plus_one);
  console.log(`Removing ${created.length} plus-one person rows. plus_one_* were never cleared, so the party model returns intact.`);
  if (!APPLY) { console.log('Dry run. Add --apply.'); process.exit(0); }
  for (let i = 0; i < created.length; i += 100) {
    const ids = created.slice(i, i + 100).map(g => g.id);
    const { error } = await db.from('wedding_guests').delete().in('id', ids);
    if (error) { console.error(error.message); process.exit(1); }
  }
  console.log('Undone.');
  process.exit(0);
}

/**
 * Split a written name into first and last, without inventing either.
 *
 * A placeholder keeps whatever the couple typed. first_name is NOT NULL, so it
 * cannot be emptied, and storing the original is better than a blank anyway:
 * "Hubby" says the plus one is a husband, and losing that to store nothing
 * would be throwing away the only thing anybody recorded. It is still not a
 * name, so plusOneDisplayName and personName both render it as "Guest" — the
 * placeholder rules do that job on read, where they can be corrected.
 */
function splitName(raw) {
  const original = String(raw || '').trim();
  const s = original.replace(/^[*.\s]+/, '').replace(/[*.\s]+$/, '').trim();
  // Placeholder: a person, not a name. Kept as written, shown as "Guest".
  if (!s || !isNamedPerson(s)) return { first: original || UNNAMED_PLUS_ONE, last: null };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null }; // surname derived on read
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

const hosts = guests.filter(g => !g.is_plus_one);
const alreadyDone = guests.filter(g => g.is_plus_one);
const toCreate = [];

for (const g of hosts) {
  if (!hasPlusOne(g)) continue;
  // Idempotent: a host who already has a plus-one row is left alone.
  if (alreadyDone.some(p => p.plus_one_of === g.id)) continue;
  const { first, last } = splitName(g.plus_one_name);
  toCreate.push({
    wedding_id: g.wedding_id,
    party_id: g.party_id || g.id,
    is_plus_one: true,
    plus_one_of: g.id,
    first_name: first,
    last_name: last,
    rsvp: g.plus_one_rsvp || 'pending',
    meal_choice: g.plus_one_meal_choice || null,
    dietary_restrictions: g.plus_one_dietary || null,
    // A plus one inherits nothing else. They can hold their own email, phone,
    // table and tags from here on, which is the point of the exercise.
    table_assignment: g.table_assignment || null,
  });
}

const before = headcount(guests);
console.log(`guest rows: ${guests.length}  (hosts ${hosts.length}, plus-one rows already created ${alreadyDone.length})`);
console.log(`hosts with a plus one: ${hosts.filter(hasPlusOne).length}`);
console.log(`person rows to create: ${toCreate.length}`);

const named = toCreate.filter(r => r.first_name && r.last_name).length;
const firstOnly = toCreate.filter(r => isNamedPerson(r.first_name) && !r.last_name).length;
const unnamed = toCreate.filter(r => !isNamedPerson(r.first_name)).length;
console.log(`  full name as written:            ${named}`);
console.log(`  first name only, surname derived: ${firstOnly}`);
console.log(`  granted but never named:          ${unnamed}  (display as "Guest")`);

console.log('\nexamples:');
for (const r of toCreate.slice(0, 6)) {
  const host = hosts.find(h => h.id === r.plus_one_of);
  console.log(`  "${host.plus_one_name}" (guest of ${guestFullName(host)}) → first=${JSON.stringify(r.first_name)} last=${JSON.stringify(r.last_name)}`);
}

console.log(`\nheadcount before: ${JSON.stringify(before)}`);

if (!toCreate.length) { console.log('\nNothing to do.'); process.exit(0); }

if (!APPLY) {
  console.log('\nDry run. Nothing written. Re-run with --apply.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'backups'), { recursive: true });
writeFileSync(resolve(root, 'backups', `guests-before-party-split-${stamp}.json`), JSON.stringify(guests, null, 2), 'utf8');
console.log(`\nBacked up all ${guests.length} guest rows.`);

let made = 0;
for (let i = 0; i < toCreate.length; i += 100) {
  const { error } = await db.from('wedding_guests').insert(toCreate.slice(i, i + 100));
  if (error) { console.error(`Stopped after ${made}: ${error.message}`); process.exit(1); }
  made += Math.min(100, toCreate.length - i);
}
console.log(`Created ${made} person rows.`);

// The whole point is that the headcount does not move. If it does, the split
// invented or lost somebody, which is worth failing loudly over.
const after = headcount(await all('wedding_guests', '*'));
console.log(`headcount after:  ${JSON.stringify(after)}`);
if (after.total !== before.total) {
  console.error(`\nHEADCOUNT CHANGED: ${before.total} → ${after.total}. Undo with --undo --apply and investigate.`);
  process.exit(1);
}
console.log('\nHeadcount unchanged. Undo with:');
console.log('  node scripts/migrate-plus-ones-to-people.mjs --undo --apply');
