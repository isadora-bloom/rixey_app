/**
 * Duplicates a name could never find.
 *
 * The import compared names, so it asked about "Gateau" and "Gateau
 * Warrenton" and never once wondered about "Rachel Patterson" and "Briarley
 * Images - Rachele Patterson", which share nothing a matcher can see. They do
 * share briarleyimages@gmail.com, which is a better argument than any
 * resemblance between two strings.
 *
 * So this comes at it from the other end: two vendors holding the same email
 * address, phone number or web address are worth a question, whatever they are
 * called. Fourteen pairs, none of which had ever been asked about.
 *
 * It also finds the opposite problem. Three of those fourteen were not
 * duplicates at all, they were Rixey's own phone number and info@ address
 * sitting on a vendor record, picked up from a contract where the venue was
 * one of the parties. Fleur Beauty Studio had info@rixeymanor.com as its email
 * address. Those are cleared, not queued: a venue's own number on a vendor is
 * wrong rather than uncertain.
 *
 *   node scripts/find-vendor-duplicates.mjs
 *   node scripts/find-vendor-duplicates.mjs --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function all(table, columns, tweak = q => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tweak(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const vendors = (await all('vendors', '*')).filter(v => !v.merged_into);
const evidence = (await all('vendor_contact_evidence', '*')).filter(e => !e.dismissed);
const questions = await all('vendor_merge_review', 'vendor_id, candidate_id, status');
const settings = await all('venue_settings', '*');

const byId = new Map(vendors.map(v => [v.id, v]));
const asked = new Set(questions.map(q => [q.vendor_id, q.candidate_id].sort().join('|')));

const normWeb = s => String(s || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
const digits = s => String(s || '').replace(/\D/g, '').slice(-10);

// ── the venue's own details ──────────────────────────────────────────────────
//
// Gathered from what the venue actually is, not from a hardcoded list, so it
// keeps working when the number changes.
const adminDomain = String(process.env.ADMIN_EMAIL || 'info@rixeymanor.com').split('@').pop().toLowerCase();
const venueDetails = new Set();
for (const s of settings) {
  if (s.website_url) venueDetails.add(`website:${normWeb(s.website_url)}`);
}
// Rixey is on its own vendor list, so whatever is on that row is the venue's.
const venueRow = vendors.find(v => /^rixey manor$/i.test(v.name));
if (venueRow) {
  if (venueRow.phone && digits(venueRow.phone).length === 10) venueDetails.add(`phone:${digits(venueRow.phone)}`);
  if (venueRow.email) venueDetails.add(`email:${String(venueRow.email).toLowerCase()}`);
}

const isVenueOwned = key =>
  venueDetails.has(key) || (key.startsWith('email:') && key.endsWith(`@${adminDomain}`));

// ── index every identifying detail ───────────────────────────────────────────

const index = new Map();
const add = (key, id) => {
  if (!index.has(key)) index.set(key, new Set());
  index.get(key).add(id);
};

for (const e of evidence) {
  if (['email', 'phone', 'website'].includes(e.kind)) add(`${e.kind}:${e.value_key}`, e.vendor_id);
}
// The row's own fields too: the backfill only recorded evidence for details it
// found in a source, and a hand-typed one has no source.
for (const v of vendors) {
  if (v.email) add(`email:${String(v.email).toLowerCase()}`, v.id);
  if (v.phone && digits(v.phone).length === 10) add(`phone:${digits(v.phone)}`, v.id);
  if (v.website) add(`website:${normWeb(v.website)}`, v.id);
}

// ── pairs ────────────────────────────────────────────────────────────────────

const pairs = new Map();
const contaminated = [];

for (const [key, holders] of index) {
  const ids = [...holders].filter(id => byId.has(id));
  if (ids.length < 2) continue;

  if (isVenueOwned(key)) {
    // Not a duplicate. The venue was a party to a contract and its details
    // came out with the vendor's.
    ids.filter(id => byId.get(id).name.toLowerCase() !== 'rixey manor')
      .forEach(id => contaminated.push({ vendor: byId.get(id), key }));
    continue;
  }

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const k = [ids[i], ids[j]].sort().join('|');
      if (!pairs.has(k)) pairs.set(k, { a: byId.get(ids[i]), b: byId.get(ids[j]), on: [] });
      pairs.get(k).on.push(key);
    }
  }
}

const fresh = [...pairs.values()].filter(p => !asked.has([p.a.id, p.b.id].sort().join('|')));

console.log(`${fresh.length} pairs share a contact detail and have never been asked about:\n`);
fresh.forEach(p => {
  console.log(`  "${p.a.name}"  ==  "${p.b.name}"`);
  console.log(`      both hold ${p.on.join(', ')}`);
});

if (contaminated.length) {
  console.log(`\n${contaminated.length} vendor record${contaminated.length === 1 ? ' holds' : 's hold'} one of Rixey's own contact details, which is wrong rather than uncertain:`);
  contaminated.forEach(c => console.log(`  ${c.vendor.name} — ${c.key}`));
}

if (!APPLY) {
  console.log('\nDry run. Nothing written. Add --apply.');
  console.log('Applying queues the pairs as questions in the Vendors screen and clears the venue details.');
  process.exit(0);
}

// ── write ────────────────────────────────────────────────────────────────────

let queued = 0;
for (const p of fresh) {
  const { error } = await db.from('vendor_merge_review').insert({
    vendor_id: p.a.id,
    candidate_id: p.b.id,
    reason: `Both hold the same ${p.on[0].split(':')[0]}. Names alone would never have raised this.`,
    evidence: { shared: p.on },
  });
  if (error && !/duplicate key/i.test(error.message)) {
    console.error(`  ${p.a.name}: ${error.message}`);
    process.exit(1);
  }
  if (!error) queued++;
}
console.log(`\n${queued} questions queued`);

let cleared = 0;
for (const c of contaminated) {
  const [kind, value] = [c.key.slice(0, c.key.indexOf(':')), c.key.slice(c.key.indexOf(':') + 1)];
  const { error: eErr } = await db.from('vendor_contact_evidence')
    .update({ dismissed: true })
    .eq('vendor_id', c.vendor.id).eq('kind', kind).eq('value_key', value);
  if (eErr) { console.error(`  ${c.vendor.name}: ${eErr.message}`); process.exit(1); }

  // And off the record itself, where it is the value in use.
  const field = { email: 'email', phone: 'phone', website: 'website' }[kind];
  const current = field === 'phone' ? digits(c.vendor[field]) : String(c.vendor[field] || '').toLowerCase();
  const target = field === 'website' ? normWeb(value) : value;
  const currentCmp = field === 'website' ? normWeb(current) : current;
  if (field && currentCmp === target) {
    const { error } = await db.from('vendors').update({ [field]: null }).eq('id', c.vendor.id);
    if (error) { console.error(`  ${c.vendor.name}: ${error.message}`); process.exit(1); }
    console.log(`  cleared ${field} on ${c.vendor.name}`);
  }
  cleared++;
}
console.log(`${cleared} venue details taken off vendor records`);
