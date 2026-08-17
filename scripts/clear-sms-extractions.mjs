/**
 * Clear the notes extracted from text messages, so they can be redone.
 *
 * These are identifiable and nothing else writes them: extraction from an SMS
 * sets source_message to "SMS: <first 120 chars>". The raw
 * "[SMS from client] ..." notes are category sms_message and are NOT touched.
 *
 * Written because the first backfill produced 855 notes from 341 texts, about
 * half of them the same observation worded twice (two jobs ran over the same
 * messages at once) and much of the rest padding from a prompt built for
 * meeting transcripts. Both are fixed; this clears the output so the re-run is
 * a clean set rather than a third layer on top.
 *
 *   node scripts/clear-sms-extractions.mjs
 *   node scripts/clear-sms-extractions.mjs --apply
 *   node scripts/clear-sms-extractions.mjs --restore backups/sms-extractions-<stamp>.json
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

const rows = await all('planning_notes', '*', q => q.like('source_message', 'SMS: %'));

// Belt and braces: never touch the raw message notes, whatever the source label
// says. Those are the couple's own words and are not reproducible.
const doomed = rows.filter(r => r.category !== 'sms_message');
const protectedRows = rows.length - doomed.length;

console.log(`notes whose source is a text message: ${rows.length}`);
console.log(`  raw "[SMS from ...]" notes, left alone: ${protectedRows}`);
console.log(`  extracted notes to clear:              ${doomed.length}`);

const perSource = {};
for (const r of doomed) perSource[r.source_message] = (perSource[r.source_message] || 0) + 1;
const counts = Object.values(perSource);
if (counts.length) {
  console.log(`  from ${counts.length} distinct texts, ${(doomed.length / counts.length).toFixed(2)} notes each`);
}
const statuses = {};
for (const r of doomed) statuses[r.status] = (statuses[r.status] || 0) + 1;
console.log(`  by status: ${JSON.stringify(statuses)}`);

// Anything a human has already acted on is not ours to delete.
const acted = doomed.filter(r => r.status && r.status !== 'pending');
if (acted.length) {
  console.log(`\n${acted.length} have been reviewed already (status is not "pending").`);
  console.log('Those are kept: re-running would ask about them again and lose the decision.');
}
const finalDoomed = doomed.filter(r => !r.status || r.status === 'pending');
console.log(`\nto delete: ${finalDoomed.length}`);

if (!finalDoomed.length) process.exit(0);

if (!APPLY) {
  console.log('\nDry run. Nothing deleted. Re-run with --apply.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'backups'), { recursive: true });
const backupPath = resolve(root, 'backups', `sms-extractions-${stamp}.json`);
writeFileSync(backupPath, JSON.stringify(finalDoomed, null, 2), 'utf8');
console.log(`Backed up ${finalDoomed.length} rows to ${backupPath}`);

let deleted = 0;
for (let i = 0; i < finalDoomed.length; i += 100) {
  const ids = finalDoomed.slice(i, i + 100).map(n => n.id);
  const { error } = await db.from('planning_notes').delete().in('id', ids);
  if (error) {
    console.error(`\nStopped after ${deleted}: ${error.message}`);
    console.error(`Everything is still in ${backupPath}.`);
    process.exit(1);
  }
  deleted += ids.length;
}
console.log(`Done. ${deleted} removed. Undo with:`);
console.log(`  node scripts/clear-sms-extractions.mjs --restore backups/sms-extractions-${stamp}.json`);
