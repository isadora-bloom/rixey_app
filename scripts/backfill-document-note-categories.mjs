/**
 * Give the older document notes the category their heading already implies.
 *
 * Notes imported from a planning document are categorised from the document's
 * own headings, but that only started with the categoriser. Everything imported
 * before it is typed as plain `note`: 134 of the 396 document notes, including
 * a whole reception timeline and every contract term, all sitting in the
 * general pile where the category filters cannot reach them.
 *
 * The heading is still there. Each note reads "Reception: doors open at 6",
 * because the importer writes `${heading}: ${detail}`, so the category can be
 * re-derived from the note itself with no guessing.
 *
 * Uses categoryForHeading from the importer rather than a copy of its rules,
 * so a backfilled note and a freshly imported one land in the same place.
 *
 *   node scripts/backfill-document-note-categories.mjs
 *   node scripts/backfill-document-note-categories.mjs --apply
 *   node scripts/backfill-document-note-categories.mjs --restore backups/doc-categories-<stamp>.json
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { categoryForHeading } from '../server/lib/doc-sync/diff.js';

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
  console.log(`Restoring the previous category on ${rows.length} notes`);
  for (const r of rows) {
    const { error } = await db.from('planning_notes').update({ category: r.category }).eq('id', r.id);
    if (error) { console.error(`Failed on ${r.id}: ${error.message}`); process.exit(1); }
  }
  console.log('Restored.');
  process.exit(0);
}

const notes = await all('planning_notes', 'id, wedding_id, category, content',
  q => q.like('source_message', '%uploaded planning document%'));

console.log(`notes imported from documents: ${notes.length}`);

/**
 * The heading a note was written with.
 *
 * The importer writes "<heading>: <detail>". A colon inside the detail is
 * common ("Timeline — Saturday: doors 6:00"), so only the first one counts, and
 * a heading longer than a heading plausibly is means the line had no heading at
 * all and just happens to contain a colon.
 */
function headingOf(content) {
  const m = String(content || '').match(/^([^:\n]{3,60}):\s/);
  return m ? m[1].trim() : null;
}

const changes = [];
const noHeading = [];
const alreadyRight = [];

for (const n of notes) {
  const heading = headingOf(n.content);
  if (!heading) { noHeading.push(n); continue; }
  const should = categoryForHeading(heading);
  if (should === n.category) { alreadyRight.push(n); continue; }
  // Only ever promote out of the general pile. A note somebody has since
  // recategorised by hand is not ours to overrule, and `note` is the only value
  // that means "nobody has decided".
  if (n.category !== 'note') continue;
  if (should === 'note') continue;
  changes.push({ ...n, heading, should });
}

console.log(`  already correctly categorised: ${alreadyRight.length}`);
console.log(`  no heading to work from:       ${noHeading.length}`);
console.log(`  still plain "note":            ${notes.filter(n => n.category === 'note').length}`);
console.log(`\nto recategorise: ${changes.length}`);

const summary = {};
for (const c of changes) {
  const k = `${c.heading} → ${c.should}`;
  summary[k] = (summary[k] || 0) + 1;
}
for (const [k, v] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(3)}  ${k}`);
}

const stuck = changes.length
  ? notes.filter(n => n.category === 'note' && !changes.find(c => c.id === n.id))
  : notes.filter(n => n.category === 'note');
if (stuck.length) {
  console.log(`\nleft as "note" because no rule matches their heading: ${stuck.length}`);
  const heads = {};
  for (const n of stuck) {
    const h = headingOf(n.content) || '(no heading)';
    heads[h] = (heads[h] || 0) + 1;
  }
  for (const [h, c] of Object.entries(heads).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(c).padStart(3)}  ${h}`);
  }
}

if (!changes.length) process.exit(0);

if (!APPLY) {
  console.log('\nDry run. Nothing changed. Re-run with --apply.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'backups'), { recursive: true });
const backupPath = resolve(root, 'backups', `doc-categories-${stamp}.json`);
writeFileSync(backupPath, JSON.stringify(changes.map(c => ({ id: c.id, category: c.category })), null, 2), 'utf8');
console.log(`\nBacked up the previous category of ${changes.length} notes.`);

// One update per category rather than per note: same result, far fewer calls.
const byCategory = {};
for (const c of changes) (byCategory[c.should] ||= []).push(c.id);

let done = 0;
for (const [category, ids] of Object.entries(byCategory)) {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await db.from('planning_notes')
      .update({ category }).in('id', ids.slice(i, i + 100));
    if (error) {
      console.error(`\nStopped after ${done}: ${error.message}`);
      console.error(`Previous categories are in ${backupPath}.`);
      process.exit(1);
    }
    done += Math.min(100, ids.length - i);
  }
  console.log(`  ${category}: ${ids.length}`);
}

console.log(`\nDone. ${done} recategorised. Undo with:`);
console.log(`  node scripts/backfill-document-note-categories.mjs --restore backups/doc-categories-${stamp}.json`);
