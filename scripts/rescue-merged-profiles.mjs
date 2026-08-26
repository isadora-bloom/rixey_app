/**
 * Bring back the profiles a merge left behind.
 *
 * The merge carried the contact fields across and nothing else, so a vendor
 * folded into a tidier-named record lost the thing they had actually written.
 * Serendipity's six photos and bio ended up on a row no couple can reach.
 * Gateau's eight photos went out of the directory entirely, because the record
 * they merged into was not one Rixey recommends. Two of the seven profiles
 * Rixey has, gone in a tidy-up meant to make the list cleaner.
 *
 * The merge is fixed. This is for the rows already merged: for each one, the
 * survivor takes whatever it does not already have — bio, photos, offer,
 * availability, the published state, and the recommendation.
 *
 * Nothing is overwritten. If the survivor has its own bio, the merged row's
 * bio stays where it is, on a row that still resolves by its own portal link.
 *
 *   node scripts/rescue-merged-profiles.mjs
 *   node scripts/rescue-merged-profiles.mjs --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function all(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const vendors = await all('vendors', '*');
const byId = new Map(vendors.map(v => [v.id, v]));
const merged = vendors.filter(v => v.merged_into);

console.log(`${merged.length} merged rows to check\n`);

// Where a chain exists, follow it to the row couples actually see.
function survivorOf(v, seen = new Set()) {
  let cur = v;
  while (cur.merged_into && !seen.has(cur.id)) {
    seen.add(cur.id);
    const next = byId.get(cur.merged_into);
    if (!next) return cur;
    cur = next;
  }
  return cur;
}

const TEXT_FIELDS = ['bio', 'special_offer', 'special_expiry', 'availability_note'];

// The day the booked vendors were imported and migration 030 ran. Everything
// in the table before this was a recommendation.
const IMPORT_DAY = '2026-08-26';
const rescues = [];

for (const m of merged) {
  const target = survivorOf(m);
  if (!target || target.id === m.id) continue;

  const patch = {};
  for (const f of TEXT_FIELDS) {
    if (!target[f] && m[f]) patch[f] = m[f];
  }
  if (!(target.photos || []).length && (m.photos || []).length) patch.photos = m.photos;
  if (m.last_vendor_update && (!target.last_vendor_update || m.last_vendor_update > target.last_vendor_update)) {
    patch.last_vendor_update = m.last_vendor_update;
  }
  if (target.is_published == null && m.is_published != null) patch.is_published = m.is_published;
  if (!target.is_recommended && m.is_recommended) patch.is_recommended = true;

  // The recommendation is not stranded, it was destroyed: the merge set
  // is_recommended = false on the losing row, so by the time anyone looks,
  // both rows say false and there is nothing left to copy across.
  //
  // It can still be worked out. Migration 030 set is_recommended = true on
  // every row that existed at the time, and every row created since came from
  // the import with it false. So a merged row older than the import was, by
  // definition, one of the vendors Rixey recommends.
  if (!target.is_recommended && String(m.created_at) < IMPORT_DAY) {
    patch.is_recommended = true;
    patch.recommendedBecause = true;   // reporting only, stripped before write
  }

  if (Object.keys(patch).length) rescues.push({ from: m, to: target, patch });
}

if (!rescues.length) {
  console.log('Nothing stranded. Every merged profile is on the row couples see.');
  process.exit(0);
}

console.log(`${rescues.length} merged row${rescues.length === 1 ? ' has' : 's have'} something the survivor does not:\n`);
for (const r of rescues) {
  const what = Object.entries(r.patch)
    .filter(([k]) => k !== 'recommendedBecause')
    .map(([k, v]) => (k === 'photos' ? `${v.length} photos` : k === 'bio' ? 'bio' : `${k}=${v}`))
    .join(', ');
  if (r.patch.recommendedBecause) {
    console.log(`      (was recommended before the import, so the survivor becomes recommended too)`);
  }
  console.log(`  "${r.from.name}"  ->  "${r.to.name}"`);
  console.log(`      moving across: ${what}`);
}

if (!APPLY) {
  console.log('\nDry run. Nothing written. Add --apply.');
  process.exit(0);
}

let done = 0;
for (const r of rescues) {
  const write = { ...r.patch };
  delete write.recommendedBecause;
  const { error } = await db.from('vendors').update(write).eq('id', r.to.id);
  if (error) { console.error(`  ${r.to.name}: ${error.message}`); process.exit(1); }
  console.log(`  ${r.to.name} now carries ${r.from.name}'s profile`);
  done++;
}
console.log(`\n${done} put right.`);
console.log('The merged rows keep their own copy and their own portal link, so nothing was moved off anything.');
