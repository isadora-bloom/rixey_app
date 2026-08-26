/**
 * Put the contact detail Rixey already holds onto the vendor it belongs to.
 *
 * It is all there, just never on the vendor: 127 bookings carry whatever the
 * couple typed into vendor_contact, the planning documents carry name-email-
 * phone-website strings, and 371 lines were pulled out of contracts months ago
 * and filed against a wedding. None of it reached the vendor record, because
 * until migration 030 there was no vendor record to reach.
 *
 * Three things this is careful about, two of which it learned the hard way.
 *
 * A contract has the couple's details on it as well as the vendor's, and 111
 * of those extracted lines are the couple. "Client: Sarah Lemon - Phone: (757)
 * 761-2742" on a vendor record means Rixey rings a bride to ask about linens.
 * Those lines are skipped and counted.
 *
 * A contract also mentions other companies. The first run of this wrote
 * Sammy's email address onto Bride and Joy and another caterer's onto Court's
 * Kitchen, from perfectly well-formed lines, because a contract note is filed
 * against a wedding and a vendor TYPE rather than against a vendor. So a
 * contract can no longer put anything ON a record. It is stored as evidence,
 * shown with its source, and adopted with a click if Isadora agrees. Only a
 * booking or a planning document, which name their vendor, fill a field.
 *
 * And what is left over after the email and the phone number have been taken
 * out is usually a person, but not always: an early pass produced contacts
 * called "Provider admin" and "Official Signing". A wrong name is worse than
 * an empty field, because it reads as something somebody checked.
 *
 * Nothing already filled in is overwritten. Everything found is kept in
 * vendor_contact_evidence with its source, so the number on the record can be
 * traced and the alternatives are still there when it turns out to be wrong.
 *
 *   node scripts/backfill-vendor-contacts.mjs               # dry run
 *   node scripts/backfill-vendor-contacts.mjs --apply
 *   node scripts/backfill-vendor-contacts.mjs --restore backups/vendor-contacts-<stamp>.json
 *
 * Needs migrations 030 and 031, and link-booked-vendors to have run.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractContactBits, isAboutTheCouple } from '../shared/contact-bits.js';
import { normalizePhone, formatPhone } from '../shared/phone.js';
import { isSameVendor } from '../shared/vendor-names.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const APPLY = process.argv.includes('--apply');
const restoreIdx = process.argv.indexOf('--restore');
const RESTORE = restoreIdx > -1 ? process.argv[restoreIdx + 1] : null;

async function all(table, columns, tweak = q => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tweak(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

// ── restore ──────────────────────────────────────────────────────────────────

if (RESTORE) {
  const backup = JSON.parse(readFileSync(resolve(root, RESTORE), 'utf8'));
  console.log(`Restoring from ${RESTORE}`);
  for (const v of backup.vendors) {
    const { error } = await db.from('vendors')
      .update({ contact: v.contact, email: v.email, phone: v.phone, website: v.website, instagram: v.instagram })
      .eq('id', v.id);
    if (error) { console.error(`  ${v.id}: ${error.message}`); process.exit(1); }
  }
  console.log(`  ${backup.vendors.length} vendors put back`);
  const { error } = await db.from('vendor_contact_evidence').delete().in('id', backup.evidenceIds);
  if (error) { console.error(`  evidence: ${error.message}`); process.exit(1); }
  console.log(`  ${backup.evidenceIds.length} pieces of evidence removed`);
  process.exit(0);
}

// ── read ─────────────────────────────────────────────────────────────────────

const vendors = await all('vendors', '*');
const bookings = await all('vendor_checklist', 'id, vendor_id, wedding_id, vendor_name, vendor_type, vendor_contact, instagram');
const notes = await all('planning_notes', 'id, wedding_id, category, content, source_message',
  q => q.in('category', ['vendor_contact', 'vendor']));
const documents = await all('wedding_documents', 'id, wedding_id, sections');
const weddings = await all('weddings', 'id, couple_names');
const weddingById = new Map(weddings.map(w => [w.id, w]));

if (!vendors.length || !('aliases' in vendors[0])) {
  console.error('Run migration 030 first.');
  process.exit(1);
}
const vendorById = new Map(vendors.map(v => [v.id, v]));
const live = vendors.filter(v => !v.merged_into);

let linked = bookings.filter(b => b.vendor_id).length;
if (!linked) {
  if (APPLY) {
    console.error('No booking has a vendor yet. Run scripts/link-booked-vendors.mjs --apply first,');
    console.error('or contact detail cannot be attributed to anyone.');
    process.exit(1);
  }
  // A preview before the linking step has run, so the numbers can be looked at
  // before anything is committed to. Matched here with the same rule the
  // linking uses, so this is what it will do, not an approximation of it.
  console.log('Bookings are not linked to vendors yet, so this is a preview:');
  console.log('names matched in memory with the same rule link-booked-vendors uses.');
  for (const b of bookings) {
    const name = String(b.vendor_name || '').trim();
    if (!name) continue;
    const hit = live.find(v => [v.name, ...(v.aliases || [])].some(n => isSameVendor(n, name)));
    if (hit) b.vendor_id = hit.id;
  }
  linked = bookings.filter(b => b.vendor_id).length;
}

console.log(`${vendors.length} vendors, ${bookings.length} bookings (${linked} linked), ${notes.length} vendor notes, ${documents.length} planning documents\n`);

// ── gather ───────────────────────────────────────────────────────────────────

const evidence = new Map();   // `${vendorId}|${kind}|${key}` -> row
const skipped = { couple: 0, ambiguous: 0, unlinkedType: 0, noVendor: 0 };
const unparsed = [];

const keyFor = (kind, value) => {
  if (kind === 'phone') return normalizePhone(value) || value.toLowerCase();
  if (kind === 'person') return value.toLowerCase().replace(/\s+/g, ' ');
  return String(value).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
};

function record(vendorId, kind, value, source, sourceDetail, weddingId) {
  if (!vendorId || !value) return;
  const key = `${vendorId}|${kind}|${keyFor(kind, value)}`;
  const existing = evidence.get(key);
  if (existing) {
    existing.seen_count++;
    // Keep the first-seen spelling, but remember every place it turned up.
    if (!existing.sources.includes(source)) existing.sources.push(source);
    return;
  }
  evidence.set(key, {
    vendor_id: vendorId,
    kind,
    value: String(value).trim(),
    value_key: keyFor(kind, value),
    source,
    source_detail: sourceDetail,
    wedding_id: weddingId || null,
    seen_count: 1,
    sources: [source],
  });
}

function harvest(vendorId, text, source, sourceDetail, weddingId) {
  if (!text || !String(text).trim()) return;
  if (isAboutTheCouple(text)) { skipped.couple++; return; }
  const bits = extractContactBits(text, vendorById.get(vendorId)?.name);
  bits.emails.forEach(e => record(vendorId, 'email', e, source, sourceDetail, weddingId));
  // Stored the way a screen shows it, so the record does not read 7033616216.
  bits.phones.forEach(p => record(vendorId, 'phone', formatPhone(p) || p, source, sourceDetail, weddingId));
  bits.websites.forEach(w => record(vendorId, 'website', w, source, sourceDetail, weddingId));
  bits.handles.forEach(h => record(vendorId, 'instagram', h, source, sourceDetail, weddingId));
  if (bits.person) record(vendorId, 'person', bits.person, source, sourceDetail, weddingId);
  // Never dropped silently. Somebody should be able to see what was not
  // understood, because that is where the next fix comes from.
  if (bits.unparsed.length) unparsed.push({ source, sourceDetail, bits: bits.unparsed });
}

// 1. The bookings. Tied straight to a vendor, so the strongest of the three.
for (const b of bookings) {
  if (!b.vendor_id) { if (b.vendor_contact) skipped.noVendor++; continue; }
  const who = weddingById.get(b.wedding_id)?.couple_names || 'a wedding';
  harvest(b.vendor_id, b.vendor_contact, 'booking', `booked for ${who}`, b.wedding_id);
  if (b.instagram) record(b.vendor_id, 'instagram', String(b.instagram).replace(/^@/, ''), 'booking', `booked for ${who}`, b.wedding_id);
}

// 2. The planning documents. Matched on the vendor name written in the
//    document, through the same rule the rest of the app uses.
for (const doc of documents) {
  const rows = Array.isArray(doc.sections?.vendors) ? doc.sections.vendors : [];
  for (const row of rows) {
    const name = String(row.vendor_name || '').trim();
    if (!name) continue;
    const match = live.find(v => [v.name, ...(v.aliases || [])].some(n => isSameVendor(n, name)));
    if (!match) { skipped.noVendor++; continue; }
    const who = weddingById.get(doc.wedding_id)?.couple_names || 'a wedding';
    harvest(match.id, row.vendor_contact, 'document', `planning document for ${who}`, doc.wedding_id);
  }
}

// 3. The contract extractions. Filed against a wedding and a vendor TYPE, so
//    only usable where that pair names exactly one booking.
const byWeddingType = new Map();
for (const b of bookings) {
  if (!b.vendor_id) continue;
  const k = `${b.wedding_id}|${String(b.vendor_type || '').toLowerCase()}`;
  if (!byWeddingType.has(k)) byWeddingType.set(k, []);
  byWeddingType.get(k).push(b);
}

for (const n of notes) {
  const m = /^Extracted from (.+?) contract:/.exec(n.source_message || '');
  if (!m) continue;
  const candidates = byWeddingType.get(`${n.wedding_id}|${m[1].toLowerCase()}`) || [];
  // Two different reasons to walk away, and they mean different things: one is
  // "that wedding had two caterers", the other is "no booking of that type is
  // linked yet". Counting them together would hide the second behind the first.
  if (!candidates.length) { skipped.unlinkedType++; continue; }
  if (candidates.length > 1) { skipped.ambiguous++; continue; }
  const who = weddingById.get(n.wedding_id)?.couple_names || 'a wedding';
  harvest(candidates[0].vendor_id, n.content, 'contract_note', `contract for ${who}`, n.wedding_id);
}

// ── what it found ────────────────────────────────────────────────────────────

const rows = [...evidence.values()];
const byKind = k => rows.filter(r => r.kind === k).length;
console.log(`${rows.length} distinct details across ${new Set(rows.map(r => r.vendor_id)).size} vendors`);
console.log(`  ${byKind('email')} emails · ${byKind('phone')} phones · ${byKind('website')} websites · ${byKind('instagram')} instagram · ${byKind('person')} contact names`);
console.log(`skipped: ${skipped.couple} lines that were the couple's details, ${skipped.ambiguous} contract notes on a wedding with two of that vendor type, ${skipped.unlinkedType} whose booking is not linked, ${skipped.noVendor} with no vendor at all`);

// What goes ON the record, as opposed to what is merely known.
//
// Only a booking or a planning document, because those name their vendor. A
// contract note names a wedding and a vendor TYPE, and a contract mentions
// other companies: the first pass put Sammy's email onto Bride and Joy, and
// another caterer's onto Court's Kitchen, both from perfectly well-formed
// lines. So contract evidence is kept and shown, with its source, and adopted
// with a click. It is not written to the record by a script that cannot tell.
const APPLIES = new Set(['booking', 'document']);
const RANK = { booking: 3, document: 2, contract_note: 1 };
const best = (vendorId, kind) => rows
  .filter(r => r.vendor_id === vendorId && r.kind === kind && r.sources.some(src => APPLIES.has(src)))
  .sort((a, b) => b.seen_count - a.seen_count || RANK[b.source] - RANK[a.source])[0];

const FIELD_FOR = { email: 'email', phone: 'phone', website: 'website', instagram: 'instagram', person: 'contact' };
const fills = [];
for (const v of live) {
  const patch = {};
  for (const [kind, field] of Object.entries(FIELD_FOR)) {
    if (v[field]) continue;                 // never overwrite what is already there
    const pick = best(v.id, kind);
    if (pick) patch[field] = pick.value;
  }
  if (Object.keys(patch).length) fills.push({ vendor: v, patch });
}

const countField = f => fills.filter(x => x.patch[f]).length;
console.log(`\n${fills.length} vendors gain something they did not have:`);
console.log(`  ${countField('email')} emails · ${countField('phone')} phones · ${countField('website')} websites · ${countField('instagram')} instagram · ${countField('contact')} contact names`);

const already = live.filter(v => v.email || v.phone).length;
console.log(`(${already} already had an email or phone and are left alone)`);

const contractOnly = rows.filter(r => !r.sources.some(src => APPLIES.has(src)));
console.log(`${contractOnly.length} details come only from a contract. Stored and shown on the vendor, not written to the record: a contract names a wedding, not reliably a vendor.`);

console.log('\nA few, to check:');
fills.slice(0, 12).forEach(f => console.log(`  ${f.vendor.name}: ${Object.entries(f.patch).map(([k, val]) => `${k}=${val}`).join('  ')}`));

// Disagreements are worth more attention than the fills.
const conflicts = live.map(v => ({
  v,
  emails: rows.filter(r => r.vendor_id === v.id && r.kind === 'email'),
  phones: rows.filter(r => r.vendor_id === v.id && r.kind === 'phone'),
})).filter(c => c.emails.length > 1 || c.phones.length > 1);

if (conflicts.length) {
  console.log(`\n${conflicts.length} vendors have more than one number or address on file. All of them are kept; the record uses the most corroborated:`);
  conflicts.slice(0, 10).forEach(c => {
    const show = list => list.map(r => `${r.value} (${r.seen_count}x, ${r.sources.join('+')})`).join(' | ');
    console.log(`  ${c.v.name}`);
    if (c.emails.length > 1) console.log(`     emails: ${show(c.emails)}`);
    if (c.phones.length > 1) console.log(`     phones: ${show(c.phones)}`);
  });
}

if (unparsed.length) {
  console.log(`\n${unparsed.length} fields had something in them nothing could be made of. Not applied, listed so they are not simply lost:`);
  unparsed.slice(0, 10).forEach(u => console.log(`  [${u.source}] ${u.bits.join(' / ').slice(0, 100)}`));
  if (unparsed.length > 10) console.log(`  ... and ${unparsed.length - 10} more`);
}

if (!APPLY) {
  console.log('\nDry run. Nothing written. Add --apply.');
  process.exit(0);
}

// ── write ────────────────────────────────────────────────────────────────────

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'backups'), { recursive: true });
const backupPath = resolve(root, 'backups', `vendor-contacts-${stamp}.json`);
const backup = {
  vendors: live.map(v => ({ id: v.id, contact: v.contact, email: v.email, phone: v.phone, website: v.website, instagram: v.instagram })),
  evidenceIds: [],
};
writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(`\nBacked up to backups/vendor-contacts-${stamp}.json`);

for (const r of rows) {
  const { data, error } = await db.from('vendor_contact_evidence').upsert({
    vendor_id: r.vendor_id,
    kind: r.kind,
    value: r.value,
    value_key: r.value_key,
    source: r.source,
    source_detail: r.source_detail,
    wedding_id: r.wedding_id,
    seen_count: r.seen_count,
    last_seen: new Date().toISOString(),
  }, { onConflict: 'vendor_id,kind,value_key' }).select('id').single();
  if (error) { console.error(`  evidence for ${vendorById.get(r.vendor_id)?.name}: ${error.message}`); process.exit(1); }
  backup.evidenceIds.push(data.id);
}
writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(`  ${rows.length} pieces of evidence stored`);

for (const f of fills) {
  const { error } = await db.from('vendors').update(f.patch).eq('id', f.vendor.id);
  if (error) { console.error(`  ${f.vendor.name}: ${error.message}`); process.exit(1); }
}
console.log(`  ${fills.length} vendors filled in`);

console.log('\nTo undo:');
console.log(`  node scripts/backfill-vendor-contacts.mjs --restore backups/vendor-contacts-${stamp}.json`);
