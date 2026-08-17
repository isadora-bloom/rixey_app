/**
 * Take the venue's own inbox back out of the weddings it was filed onto.
 *
 * Two venue addresses were registered as couples — isadora@rixeymanor.com as
 * the groom on "Adam and Soup", grace@rixeymanor.com as the bride on
 * "Grace & Joseph" — so the Gmail sync searched Rixey's own mailboxes and filed
 * what it found against those weddings. Furnace repair videos, 2024 tent
 * quotes, forwarded package lists, other couples' proposals.
 *
 * The sync no longer searches venue addresses. This clears what it already did.
 *
 * Deliberately narrow:
 *
 *   - the wedding rows and their profiles are KEPT. They are test weddings and
 *     they are still wanted as test weddings.
 *   - only notes traceable to an email are removed. Zoom notes, contract
 *     extractions and the Sage test conversations ("help im stressing about
 *     alcohol") are real test data and stay.
 *   - the emails themselves are kept in processed_emails with wedding_id
 *     cleared. Nothing is deleted that cannot be re-derived.
 *
 *   node scripts/unfile-venue-email.mjs
 *   node scripts/unfile-venue-email.mjs --apply
 *   node scripts/unfile-venue-email.mjs --restore backups/venue-email-<stamp>.json
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const APPLY = process.argv.includes('--apply');
const restoreIdx = process.argv.indexOf('--restore');
const RESTORE = restoreIdx > -1 ? process.argv[restoreIdx + 1] : null;

const VENUE_DOMAIN = String(process.env.ADMIN_EMAIL || 'info@rixeymanor.com').split('@')[1].toLowerCase();

async function all(table, columns, filter = q => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

if (RESTORE) {
  const backup = JSON.parse(readFileSync(resolve(root, RESTORE), 'utf8'));
  console.log(`Restoring ${backup.notes.length} notes and ${backup.emails.length} email links`);
  for (let i = 0; i < backup.notes.length; i += 200) {
    const { error } = await db.from('planning_notes').insert(backup.notes.slice(i, i + 200));
    if (error) { console.error('Note restore failed:', error.message); process.exit(1); }
  }
  for (const e of backup.emails) {
    const { error } = await db.from('processed_emails').update({ wedding_id: e.wedding_id }).eq('id', e.id);
    if (error) { console.error('Email restore failed:', error.message); process.exit(1); }
  }
  console.log('Restored.');
  process.exit(0);
}

/** Notes the email pipeline wrote, in each of the shapes it has used. */
function fromEmail(sourceMessage) {
  const s = String(sourceMessage || '');
  return s.startsWith('Email:') || s.startsWith('From email on') || s.startsWith('From email "');
}

const profiles = await all('profiles', 'email, wedding_id, name, role');
const weddings = await all('weddings', 'id, couple_names');
const wName = new Map(weddings.map(w => [w.id, w.couple_names]));

const affected = new Map();
for (const p of profiles) {
  const email = String(p.email || '').toLowerCase();
  if (!p.wedding_id || !email.endsWith(`@${VENUE_DOMAIN}`)) continue;
  affected.set(p.wedding_id, { email, name: p.name, role: p.role });
}

console.log(`venue domain: @${VENUE_DOMAIN}`);
console.log(`weddings with a venue address registered as a couple: ${affected.size}`);
for (const [id, p] of affected) {
  console.log(`   ${wName.get(id)}  ←  ${p.email} as ${p.name} (${p.role})`);
}
if (!affected.size) process.exit(0);

const ids = [...affected.keys()];
const notes = await all('planning_notes', '*', q => q.in('wedding_id', ids));
const emails = await all('processed_emails', 'id, wedding_id, from_email, subject', q => q.in('wedding_id', ids));

const doomedNotes = notes.filter(n => fromEmail(n.source_message));
const keptNotes = notes.filter(n => !fromEmail(n.source_message));

console.log(`\nnotes on those weddings: ${notes.length}`);
console.log(`  from an email, to remove: ${doomedNotes.length}`);
console.log(`  kept (zoom, contracts, Sage test chats, anything typed by hand): ${keptNotes.length}`);

const keptBy = {};
for (const n of keptNotes) {
  const s = String(n.source_message || '');
  const k = s.startsWith('Extracted from') ? 'contract extraction'
    : /zoom/i.test(s) ? 'zoom'
    : s ? 'other' : '(none)';
  keptBy[k] = (keptBy[k] || 0) + 1;
}
for (const [k, v] of Object.entries(keptBy)) console.log(`      ${String(v).padStart(4)}  ${k}`);

console.log(`\nemails to unlink (kept, wedding_id cleared): ${emails.length}`);
const bySender = {};
for (const e of emails) bySender[e.from_email] = (bySender[e.from_email] || 0) + 1;
for (const [k, v] of Object.entries(bySender).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${String(v).padStart(4)}  ${k}`);
}

console.log('\nThe wedding rows and their profiles are kept, untouched.');

if (!APPLY) {
  console.log('\nDry run. Nothing changed. Re-run with --apply.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'backups'), { recursive: true });
const backupPath = resolve(root, 'backups', `venue-email-${stamp}.json`);
writeFileSync(backupPath, JSON.stringify({ notes: doomedNotes, emails }, null, 2), 'utf8');
console.log(`\nBacked up ${doomedNotes.length} notes and ${emails.length} email links.`);

let removed = 0;
for (let i = 0; i < doomedNotes.length; i += 100) {
  const batch = doomedNotes.slice(i, i + 100).map(n => n.id);
  const { error } = await db.from('planning_notes').delete().in('id', batch);
  if (error) { console.error(`Stopped after ${removed}: ${error.message}`); process.exit(1); }
  removed += batch.length;
}
console.log(`Removed ${removed} notes.`);

let unlinked = 0;
for (let i = 0; i < emails.length; i += 100) {
  const batch = emails.slice(i, i + 100).map(e => e.id);
  const { error } = await db.from('processed_emails').update({ wedding_id: null }).in('id', batch);
  if (error) { console.error(`Stopped after ${unlinked} unlinked: ${error.message}`); process.exit(1); }
  unlinked += batch.length;
}
console.log(`Unlinked ${unlinked} emails.`);

console.log('\nUndo with:');
console.log(`  node scripts/unfile-venue-email.mjs --restore backups/venue-email-${stamp}.json`);
