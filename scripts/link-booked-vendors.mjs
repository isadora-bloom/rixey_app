/**
 * Give every booking a vendor.
 *
 * `vendor_checklist` holds 268 bookings with the vendor's name as free text.
 * 176 distinct spellings, about 136 actual vendors, and until now no way to
 * ask a question about any of them: not "how many weddings has Sammy's done
 * here", not "show me every contract they have sent", because neither question
 * had a subject. This creates the subject.
 *
 * It clusters the booked names AND the 110 recommendations together in one
 * pass, because the recommendations have their own duplicates. Carpe Donut is
 * in there twice, once under Brunch and once under Food Truck, since there was
 * nowhere to say a vendor does both. There is now.
 *
 * What it will not do is guess. Names merge only when the difference is
 * bookkeeping, or when a person has already ruled on the pair. Anything
 * arguable becomes an open row in vendor_merge_review to be answered in admin.
 * See shared/vendor-names.js. Placeholder rows — five called "Name" from a CSV
 * header, two blank — get no vendor and are reported, because inventing a
 * vendor called Name is worse than a gap.
 *
 * A merged duplicate is never deleted. It keeps its edit_token, in case a
 * vendor is holding a link built from it, and points at what it merged into.
 *
 * It also lifts the storage path out of each contract URL, so a contract can
 * be found by vendor rather than only by wedding.
 *
 *   node scripts/link-booked-vendors.mjs               # dry run, changes nothing
 *   node scripts/link-booked-vendors.mjs --apply
 *   node scripts/link-booked-vendors.mjs --restore backups/vendor-linking-<stamp>.json
 *
 * Needs migration 030.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  isSameVendor, mergeCandidateReason, preferredSpelling,
  isPlaceholderName, categoryForVendorType, tidyCategory, vendorKey,
} from '../shared/vendor-names.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const APPLY = process.argv.includes('--apply');
const restoreIdx = process.argv.indexOf('--restore');
const RESTORE = restoreIdx > -1 ? process.argv[restoreIdx + 1] : null;

// .range() every time. The 1000-row cap has been the recurring bug of this
// project and an unpaginated select here would silently link two thirds of it.
async function all(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

// ── restore ──────────────────────────────────────────────────────────────────

if (RESTORE) {
  const backup = JSON.parse(readFileSync(resolve(root, RESTORE), 'utf8'));
  console.log(`Restoring from ${RESTORE}`);

  for (const row of backup.checklist) {
    const { error } = await db.from('vendor_checklist')
      .update({ vendor_id: row.vendor_id, contract_path: row.contract_path })
      .eq('id', row.id);
    if (error) { console.error(`  ${row.id}: ${error.message}`); process.exit(1); }
  }
  console.log(`  ${backup.checklist.length} bookings put back`);

  if (backup.createdVendorIds.length) {
    const { error } = await db.from('vendors').delete().in('id', backup.createdVendorIds);
    if (error) { console.error(`  vendors: ${error.message}`); process.exit(1); }
    console.log(`  ${backup.createdVendorIds.length} created vendors removed`);
  }

  for (const v of backup.vendors) {
    const { error } = await db.from('vendors').update({
      aliases: v.aliases, categories: v.categories, contact: v.contact,
      instagram: v.instagram, merged_into: v.merged_into, is_recommended: v.is_recommended,
    }).eq('id', v.id);
    if (error) { console.error(`  ${v.id}: ${error.message}`); process.exit(1); }
  }
  console.log(`  ${backup.vendors.length} existing vendors put back`);

  const { error: revErr } = await db.from('vendor_merge_review').delete().eq('status', 'open');
  if (revErr) { console.error(`  review: ${revErr.message}`); process.exit(1); }
  console.log('  open review questions cleared');
  process.exit(0);
}

// ── read ─────────────────────────────────────────────────────────────────────

const checklist = await all('vendor_checklist', '*');
const vendors = await all('vendors', '*');
const weddings = await all('weddings', 'id, couple_names, wedding_date');

// A dry run works fine against the old shape; writing does not.
const migrated = vendors.length > 0 && 'aliases' in vendors[0];
if (APPLY && !migrated) {
  console.error('vendors has no aliases column. Run migration 030 first.');
  process.exit(1);
}
if (!migrated) console.log('(migration 030 has not run yet, so this is a preview of what it would do)');

console.log(`${checklist.length} bookings, ${vendors.length} rows in the directory\n`);

// ── one cluster pass over everything that has a name ─────────────────────────

const placeholders = checklist.filter(r => isPlaceholderName(r.vendor_name));
const named = checklist.filter(r => !isPlaceholderName(r.vendor_name));

const spellings = new Map();
for (const r of named) {
  const n = r.vendor_name.trim();
  if (!spellings.has(n)) spellings.set(n, { name: n, count: 0, rows: [] });
  const e = spellings.get(n);
  e.count++;
  e.rows.push(r);
}

// Nodes are keyed by a string: "v:<id>" for a directory row, "b:<name>" for a
// booked spelling. Both carry every name they answer to.
const nodes = [
  ...vendors.map(v => ({ key: `v:${v.id}`, kind: 'vendor', vendor: v, names: [v.name, ...(v.aliases || [])] })),
  ...[...spellings.values()].map(s => ({ key: `b:${s.name}`, kind: 'booking', spelling: s, names: [s.name] })),
];

const parent = new Map(nodes.map(n => [n.key, n.key]));
const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b); };

for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const hit = nodes[i].names.some(a => nodes[j].names.some(b => isSameVendor(a, b)));
    if (hit) union(nodes[i].key, nodes[j].key);
  }
}

const groups = new Map();
for (const n of nodes) {
  const r = find(n.key);
  if (!groups.has(r)) groups.set(r, []);
  groups.get(r).push(n);
}

// ── work out what each group becomes ─────────────────────────────────────────

// When a group holds more than one directory row, the survivor is the one a
// vendor has actually filled in. Losing six photos to keep a tidier name would
// be a bad trade.
const richness = v =>
  (v.last_vendor_update ? 1000 : 0) + (v.photos || []).length * 10 +
  (v.bio ? 5 : 0) + (v.notes ? 2 : 0) + (v.website ? 1 : 0);

const plan = [];
for (const group of groups.values()) {
  const existing = group.filter(n => n.kind === 'vendor').map(n => n.vendor);
  const bookings = group.filter(n => n.kind === 'booking').map(n => n.spelling);
  const rows = bookings.flatMap(b => b.rows);

  const target = existing.length
    ? [...existing].sort((a, b) => richness(b) - richness(a) || a.name.localeCompare(b.name))[0]
    : null;
  const absorbed = existing.filter(v => v !== target);

  const catCounts = {};
  rows.forEach(r => { const c = categoryForVendorType(r.vendor_type); catCounts[c] = (catCounts[c] || 0) + 1; });
  const bookedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([c]) => c).filter(c => c !== 'Other');
  const existingCats = existing.flatMap(v => (v.categories?.length ? v.categories : [v.category]).filter(Boolean));
  const categories = [...new Set([...existingCats, ...bookedCats].map(tidyCategory))];

  const allNames = [...new Set(group.flatMap(n => n.names))];
  const canonical = target ? target.name : preferredSpelling(bookings);

  plan.push({
    canonical,
    target,
    absorbed,
    bookings,
    rows,
    categories: categories.length ? categories : ['Other'],
    aliases: allNames.filter(n => vendorKey(n) !== vendorKey(canonical)),
    contact: rows.map(r => r.vendor_contact).find(Boolean) || null,
    instagram: rows.map(r => r.instagram).find(Boolean) || null,
  });
}

const created = plan.filter(p => !p.target);
const linkedToExisting = plan.filter(p => p.target && p.rows.length);
const dupes = plan.filter(p => p.absorbed.length);

console.log(`${nodes.length} names collapse to ${plan.length} vendors`);
console.log(`  ${created.length} new records for vendors who have worked here but were never in the directory`);
console.log(`  ${linkedToExisting.length} bookings matched a vendor already in the directory`);
console.log(`  ${dupes.length} duplicate directory rows to merge`);
console.log(`  ${placeholders.length} bookings have no usable name and stay unlinked${placeholders.length ? ` (${[...new Set(placeholders.map(p => p.vendor_name || '(blank)'))].join(', ')})` : ''}`);

if (dupes.length) {
  console.log('\nDirectory rows that are the same vendor:');
  // The name is usually identical, because a vendor who does two things was
  // entered twice under two categories. Show the categories or the line reads
  // as nonsense.
  dupes.forEach(p => console.log(
    `  "${p.target.name}" [${p.target.category}] absorbs ${p.absorbed.map(a => `[${a.category}]`).join(' ')} -> [${p.categories.join(', ')}]`));
}

const collapsed = plan.filter(p => p.bookings.length > 1);
if (collapsed.length) {
  console.log(`\n${collapsed.length} booked names collapsed on the confident rule:`);
  collapsed.forEach(p => console.log(`  ${p.canonical}  <-  ${p.bookings.filter(b => b.name !== p.canonical).map(b => `"${b.name}"`).join(', ')}`));
}

// ── contract paths ───────────────────────────────────────────────────────────

const pathFor = url => {
  const after = String(url || '').split('/vendor-contracts/')[1];
  if (!after) return null;
  try { return decodeURIComponent(after.split('?')[0]); } catch { return after.split('?')[0]; }
};
const needPath = checklist.filter(r => r.contract_url && !r.contract_path);
const contractPaths = new Map(needPath.map(r => [r.id, pathFor(r.contract_url)]));
const unreadable = [...contractPaths.values()].filter(p => !p).length;
console.log(`\n${contractPaths.size - unreadable} contract paths recovered from the stored links${unreadable ? `, ${unreadable} could not be read` : ''}`);

// ── the questions ────────────────────────────────────────────────────────────

const questions = [];
for (let i = 0; i < plan.length; i++) {
  for (let j = i + 1; j < plan.length; j++) {
    const a = plan[i], b = plan[j];
    const namesA = [a.canonical, ...a.aliases];
    const namesB = [b.canonical, ...b.aliases];
    let reason = null, evidence = null;
    outer: for (const na of namesA) {
      for (const nb of namesB) {
        const r = mergeCandidateReason(na, nb);
        if (r) { reason = r; evidence = { a: na, b: nb }; break outer; }
      }
    }
    if (reason) questions.push({ a, b, reason, evidence });
  }
}
console.log(`\n${questions.length} pairs the matcher will not decide on its own:`);
questions.slice(0, 30).forEach(q => console.log(`  "${q.a.canonical}"  vs  "${q.b.canonical}"   ${q.reason}`));
if (questions.length > 30) console.log(`  ... and ${questions.length - 30} more`);

if (!APPLY) {
  console.log('\nDry run. Nothing written. Add --apply.');
  process.exit(0);
}

// ── write ────────────────────────────────────────────────────────────────────

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'backups'), { recursive: true });
const backupPath = resolve(root, 'backups', `vendor-linking-${stamp}.json`);
const backup = {
  checklist: checklist.map(r => ({ id: r.id, vendor_id: r.vendor_id, contract_path: r.contract_path })),
  vendors: vendors.map(v => ({
    id: v.id, aliases: v.aliases, categories: v.categories, contact: v.contact,
    instagram: v.instagram, merged_into: v.merged_into, is_recommended: v.is_recommended,
  })),
  createdVendorIds: [],
};
writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(`\nBacked up to backups/vendor-linking-${stamp}.json`);
console.log('Writing.');

const fail = (what, error) => { console.error(`  ${what}: ${error.message}`); process.exit(1); };

// New records first, so bookings have something to point at.
for (const p of created) {
  const { data, error } = await db.from('vendors').insert({
    name: p.canonical,
    category: p.categories[0],
    categories: p.categories,
    is_recommended: false,
    is_published: null,
    aliases: p.aliases,
    contact: p.contact,
    instagram: p.instagram,
    internal_notes: `Created from ${p.rows.length} booking${p.rows.length === 1 ? '' : 's'} on ${new Date().toISOString().slice(0, 10)}. Worked here; not a recommendation until you say so.`,
  }).select('id').single();
  if (error) fail(`creating "${p.canonical}"`, error);
  p.vendorId = data.id;
  backup.createdVendorIds.push(data.id);
}
writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(`  ${created.length} vendor records created`);

// Then the survivors: aliases, categories, and any contact detail they lacked.
for (const p of plan.filter(x => x.target)) {
  p.vendorId = p.target.id;
  const patch = {
    aliases: p.aliases,
    categories: p.categories,
    category: p.categories[0],
  };
  if (!p.target.contact && p.contact) patch.contact = p.contact;
  if (!p.target.instagram && p.instagram) patch.instagram = p.instagram;
  const { error } = await db.from('vendors').update(patch).eq('id', p.target.id);
  if (error) fail(p.target.name, error);
}
console.log(`  ${plan.filter(x => x.target).length} existing records updated`);

// Duplicates point at the survivor and leave the directory. Kept, not deleted:
// their edit_token may be in a vendor's inbox.
let mergedRows = 0;
for (const p of dupes) {
  for (const a of p.absorbed) {
    const { error } = await db.from('vendors')
      .update({ merged_into: p.target.id, is_recommended: false })
      .eq('id', a.id);
    if (error) fail(`merging ${a.name}`, error);
    mergedRows++;
  }
}
console.log(`  ${mergedRows} duplicate rows merged`);

// Point the bookings at their vendor.
let linked = 0;
for (const p of plan) {
  for (const r of p.rows) {
    const patch = { vendor_id: p.vendorId };
    const cp = contractPaths.get(r.id);
    if (cp) patch.contract_path = cp;
    const { error } = await db.from('vendor_checklist').update(patch).eq('id', r.id);
    if (error) fail(`booking ${r.id}`, error);
    linked++;
  }
}
console.log(`  ${linked} bookings linked`);

// Contract paths on rows whose vendor could not be worked out. The document is
// still a document even when the name on the row is "Name".
let orphanPaths = 0;
for (const r of placeholders) {
  const cp = contractPaths.get(r.id);
  if (!cp) continue;
  const { error } = await db.from('vendor_checklist').update({ contract_path: cp }).eq('id', r.id);
  if (error) fail(`booking ${r.id}`, error);
  orphanPaths++;
}
if (orphanPaths) console.log(`  ${orphanPaths} contract paths saved on unlinked bookings`);

// The questions.
let queued = 0;
for (const q of questions) {
  const { error } = await db.from('vendor_merge_review').insert({
    vendor_id: q.a.vendorId,
    candidate_id: q.b.vendorId,
    reason: q.reason,
    evidence: q.evidence,
  });
  // The pair index stops a repeat run asking the same question twice.
  if (error && !/duplicate key/i.test(error.message)) fail('review', error);
  if (!error) queued++;
}
console.log(`  ${queued} questions queued for review`);

console.log('\nTo undo:');
console.log(`  node scripts/link-booked-vendors.mjs --restore backups/vendor-linking-${stamp}.json`);

const perVendor = plan.map(p => ({ name: p.canonical, weddings: new Set(p.rows.map(r => r.wedding_id)).size }))
  .sort((a, b) => b.weddings - a.weddings).slice(0, 8);
console.log(`\nAcross ${weddings.length} weddings. Most booked:`);
perVendor.forEach(v => console.log(`  ${v.weddings}  ${v.name}`));
