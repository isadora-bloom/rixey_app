/**
 * Put the Laperriere RSVP where it belongs.
 *
 * On 18 August an RSVP was submitted from blaperriere5@gmail.com and landed on
 * Andy's row instead of Brandi's. The RSVP search had started returning a plus
 * one's own row id, while the form is built so that one submission covers the
 * whole party, so the party's answer was written onto the plus one and Brandi
 * was left reading "pending" after she had already replied.
 *
 * The search is fixed. This corrects the one submission that went through while
 * it was wrong. Isadora confirmed with the couple that both are attending.
 *
 * What the submission actually contained, and where each part belongs:
 *
 *   rsvp: yes                 → the party's answer. Brandi, and Andy.
 *   dietary_restrictions      → the form asks the person answering. Brandi.
 *   rsvp_extras.email         → her address, sitting on his row.
 *
 * Andy keeps rsvp yes and loses the details that were never his.
 *
 *   node scripts/fix-laperriere-rsvp.mjs
 *   node scripts/fix-laperriere-rsvp.mjs --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const APPLY = process.argv.includes('--apply');

const ANDY_ID = '58d67ace-7dfb-41ec-a26d-a9a3b374c796';

const { data: andy, error: ae } = await db.from('wedding_guests').select('*').eq('id', ANDY_ID).maybeSingle();
if (ae) { console.error(ae.message); process.exit(1); }
if (!andy) { console.error('That plus-one row is gone. Nothing to do.'); process.exit(1); }

const { data: brandi, error: be } = await db.from('wedding_guests').select('*').eq('id', andy.plus_one_of).maybeSingle();
if (be || !brandi) { console.error('Could not read the host row.'); process.exit(1); }

console.log('now:');
console.log(`  ${brandi.first_name} ${brandi.last_name}  rsvp=${brandi.rsvp}  dietary=${JSON.stringify(brandi.dietary_restrictions)}  extras=${JSON.stringify(brandi.rsvp_extras)}  plus_one_rsvp=${brandi.plus_one_rsvp}`);
console.log(`  ${andy.first_name} (+1)   rsvp=${andy.rsvp}  dietary=${JSON.stringify(andy.dietary_restrictions)}  extras=${JSON.stringify(andy.rsvp_extras)}`);

// Nothing here is invented: every value moved is one the submission carried.
const brandiUpdate = {
  rsvp: 'yes',
  // The mirror the guest list and the print pack still read.
  plus_one_rsvp: 'yes',
  dietary_restrictions: brandi.dietary_restrictions || andy.dietary_restrictions || null,
  rsvp_extras: { ...(brandi.rsvp_extras || {}), ...(andy.rsvp_extras || {}) },
  updated_at: new Date().toISOString(),
};
const andyUpdate = {
  rsvp: 'yes',
  // Her email and her dietary answer were never his to hold.
  rsvp_extras: {},
  dietary_restrictions: null,
  updated_at: new Date().toISOString(),
};

console.log('\nafter:');
console.log(`  ${brandi.first_name} ${brandi.last_name}  rsvp=${brandiUpdate.rsvp}  dietary=${JSON.stringify(brandiUpdate.dietary_restrictions)}  extras=${JSON.stringify(brandiUpdate.rsvp_extras)}  plus_one_rsvp=${brandiUpdate.plus_one_rsvp}`);
console.log(`  ${andy.first_name} (+1)   rsvp=${andyUpdate.rsvp}  dietary=null  extras={}`);

if (!APPLY) {
  console.log('\nDry run. Nothing written. Re-run with --apply.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'backups'), { recursive: true });
writeFileSync(resolve(root, 'backups', `laperriere-rsvp-${stamp}.json`), JSON.stringify({ brandi, andy }, null, 2), 'utf8');
console.log(`\nBacked up both rows.`);

for (const [label, id, patch] of [['Brandi', brandi.id, brandiUpdate], ['Andy', andy.id, andyUpdate]]) {
  const { error } = await db.from('wedding_guests').update(patch).eq('id', id);
  if (error) { console.error(`${label} failed: ${error.message}`); process.exit(1); }
  console.log(`  ${label} updated`);
}

const { data: check, error: checkErr } = await db.from('wedding_guests').select('*').in('id', [brandi.id, andy.id]);
if (checkErr) { console.error(`could not read the rows back: ${checkErr.message}`); process.exit(1); }
console.log('\nverified:');
for (const g of check) console.log(`  ${g.first_name} ${g.last_name || '(+1)'}  rsvp=${g.rsvp}  extras=${JSON.stringify(g.rsvp_extras)}`);
