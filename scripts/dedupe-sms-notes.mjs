/**
 * Remove duplicate SMS planning notes, keeping the oldest of each.
 *
 * The Quo sync read what it had already imported with one unpaginated select.
 * PostgREST stops at 1000 rows and the table holds 1,448, so 448 already-
 * imported messages looked new on every run. The marker insert is protected by
 * a unique index and failed harmlessly, but the planning note insert was not,
 * so the run on 17 August re-created 216 notes couples can read.
 *
 * Both holes are closed in server/index.js. This clears what already got in.
 *
 * A duplicate here means: same wedding, same category, byte-identical content,
 * and NOT the earliest such row. Two genuinely identical texts months apart
 * collapse to one, which is the deliberate trade: the second copy carries no
 * information the first does not, and a couple reading their own notes back
 * should not see "Thank you!!" five times.
 *
 *   node scripts/dedupe-sms-notes.mjs              # dry run
 *   node scripts/dedupe-sms-notes.mjs --apply
 *   node scripts/dedupe-sms-notes.mjs --since 2026-08-17T14:00:00   # this run only
 *   node scripts/dedupe-sms-notes.mjs --restore backups/sms-dupes-<stamp>.json
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
const sinceIdx = process.argv.indexOf('--since');
const SINCE = sinceIdx > -1 ? process.argv[sinceIdx + 1] : null;
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

const notes = await all('planning_notes', '*', q => q.eq('category', 'sms_message'));
console.log(`sms_message notes: ${notes.length}`);

// Oldest first, so the survivor of each group is the original.
notes.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

const keptFirst = new Set();
const doomed = [];
for (const n of notes) {
  const key = `${n.wedding_id}|${n.content}`;
  if (!keptFirst.has(key)) { keptFirst.add(key); continue; }
  // Only ever delete the later copy, never the first.
  if (SINCE && String(n.created_at) < SINCE) continue;
  doomed.push(n);
}

console.log(`distinct (wedding, content): ${keptFirst.size}`);
console.log(`later copies to remove:      ${doomed.length}${SINCE ? ` (created on or after ${SINCE})` : ''}`);
console.log(`leaving:                     ${notes.length - doomed.length}`);

if (doomed.length) {
  const byDay = {};
  for (const n of doomed) {
    const d = String(n.created_at).slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
  }
  console.log('\nby the day the copy was created:');
  for (const [d, c] of Object.entries(byDay).sort()) console.log(`  ${d}  ${c}`);
  console.log('\nexamples:');
  for (const n of doomed.slice(0, 6)) console.log(`  ${String(n.content).slice(0, 90).replace(/\s+/g, ' ')}`);
}

if (!doomed.length) process.exit(0);

if (!APPLY) {
  console.log('\nDry run. Nothing deleted. Re-run with --apply.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'backups'), { recursive: true });
const backupPath = resolve(root, 'backups', `sms-dupes-${stamp}.json`);
writeFileSync(backupPath, JSON.stringify(doomed, null, 2), 'utf8');
console.log(`\nBacked up ${doomed.length} rows to ${backupPath}`);

let deleted = 0;
for (let i = 0; i < doomed.length; i += 100) {
  const ids = doomed.slice(i, i + 100).map(n => n.id);
  const { error } = await db.from('planning_notes').delete().in('id', ids);
  if (error) {
    console.error(`\nStopped after ${deleted}: ${error.message}`);
    console.error(`Everything is still in ${backupPath}.`);
    process.exit(1);
  }
  deleted += ids.length;
}
console.log(`Done. ${deleted} removed. Undo with:`);
console.log(`  node scripts/dedupe-sms-notes.mjs --restore backups/sms-dupes-${stamp}.json`);
