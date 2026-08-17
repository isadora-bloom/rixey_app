/**
 * Remove email notes that exist more times than the emails justify.
 *
 * The Gmail sync read "what have I already imported" with one unpaginated
 * select. PostgREST caps at 1000, processed_emails held 1,270, so 270 emails
 * looked new on every run. gmail_message_id is unique so the marker insert
 * failed harmlessly and its error was stepped over, while the note insert had
 * no guard at all. Both holes are closed; this clears what got through.
 *
 * ## Why this needs no cutoff
 *
 * The SMS equivalent needed a date range, because two identical texts months
 * apart are genuinely two texts and nothing distinguishes them from a
 * re-import. Email is different: gmail_message_id is unique, so every stored
 * email is stored exactly once, and the note the importer writes from it is a
 * pure function of that row.
 *
 * So the correct number of notes for a given content is the number of stored
 * emails that produce it — usually one, occasionally more when two different
 * emails really do render identically. Anything above that count is surplus,
 * provably, with no judgement involved. The oldest copies are kept.
 *
 * Notes with no matching email row are left alone: the email may have been
 * deleted, or the note written in a format the importer no longer uses, and
 * either way this cannot tell whether it is a duplicate.
 *
 *   node scripts/dedupe-email-notes.mjs
 *   node scripts/dedupe-email-notes.mjs --apply
 *   node scripts/dedupe-email-notes.mjs --restore backups/email-note-dupes-<stamp>.json
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
  const rows = JSON.parse(readFileSync(resolve(root, RESTORE), 'utf8'));
  console.log(`Restoring ${rows.length} notes`);
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from('planning_notes').insert(rows.slice(i, i + 200));
    if (error) { console.error('Restore failed:', error.message); process.exit(1); }
  }
  console.log('Restored.');
  process.exit(0);
}

const emails = await all('processed_emails', 'gmail_message_id, wedding_id, from_email, subject, body_text');
const notes = await all('planning_notes', '*', q => q.eq('category', 'email'));

// How many stored emails would produce each note content. Mirrors the importer:
//   `[Email: ${subject}]\nFrom: ${fromEmail}\n\n${body.substring(0, 5000)}`
const justified = new Map();
for (const e of emails) {
  if (!e.wedding_id || !e.body_text) continue;
  const content = `[Email: ${e.subject}]\nFrom: ${e.from_email}\n\n${String(e.body_text).substring(0, 5000)}`;
  const key = `${e.wedding_id}|${content}`;
  justified.set(key, (justified.get(key) || 0) + 1);
}

const grouped = new Map();
for (const n of notes) {
  const key = `${n.wedding_id}|${n.content}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(n);
}

const doomed = [];
let unmatched = 0;
let legitimateExtras = 0;

for (const [key, rows] of grouped) {
  const allowed = justified.get(key);
  if (!allowed) { unmatched += rows.length; continue; }
  if (allowed > 1) legitimateExtras += allowed - 1;
  if (rows.length <= allowed) continue;
  // Oldest first, so the survivors are the originals.
  rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  doomed.push(...rows.slice(allowed));
}

console.log(`email notes:            ${notes.length}`);
console.log(`  no matching email row, left alone: ${unmatched}`);
console.log(`  extra copies justified by two emails rendering the same: ${legitimateExtras}`);
console.log(`\nsurplus to remove: ${doomed.length}`);

if (doomed.length) {
  const byDay = {};
  for (const n of doomed) byDay[String(n.created_at).slice(0, 10)] = (byDay[String(n.created_at).slice(0, 10)] || 0) + 1;
  console.log('\nby the day the surplus copy was written:');
  for (const [d, c] of Object.entries(byDay).sort()) console.log(`  ${d}  ${c}`);
}

if (!doomed.length) process.exit(0);

if (!APPLY) {
  console.log('\nDry run. Nothing deleted. Re-run with --apply.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'backups'), { recursive: true });
const backupPath = resolve(root, 'backups', `email-note-dupes-${stamp}.json`);
writeFileSync(backupPath, JSON.stringify(doomed, null, 2), 'utf8');
console.log(`\nBacked up ${doomed.length} notes.`);

let removed = 0;
for (let i = 0; i < doomed.length; i += 100) {
  const batch = doomed.slice(i, i + 100).map(n => n.id);
  const { error } = await db.from('planning_notes').delete().in('id', batch);
  if (error) {
    console.error(`\nStopped after ${removed}: ${error.message}`);
    console.error(`Everything is still in ${backupPath}.`);
    process.exit(1);
  }
  removed += batch.length;
}

console.log(`Done. ${removed} removed. Undo with:`);
console.log(`  node scripts/dedupe-email-notes.mjs --restore backups/email-note-dupes-${stamp}.json`);
