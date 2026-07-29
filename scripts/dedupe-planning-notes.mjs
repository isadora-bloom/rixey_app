/**
 * Removes duplicate planning notes left behind by the broken Zoom dedup.
 *
 * processed_zoom_meetings.participant_names is text[], but the sync sent a
 * joined string, so every insert failed with "malformed array literal" and was
 * only console.error'd. Dedup was dead from 2026-03-06 and each sync re-imported
 * every meeting in the trailing 30-day window. 19 meetings produced 47
 * transcript notes, some six deep, plus duplicated extracted notes underneath.
 *
 * Keeps the OLDEST copy of each (wedding_id, category, content) group, since
 * that is the one anything else may already reference.
 *
 *   node scripts/dedupe-planning-notes.mjs           # dry run, prints what it would delete
 *   node scripts/dedupe-planning-notes.mjs --apply   # actually deletes
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });

const apply = process.argv.includes('--apply');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let all = [];
for (let from = 0; ; from += 1000) {
  // Sort by id as well as created_at. A batch import gives many rows the same
  // timestamp, and with ties alone the page boundaries shift between runs, so
  // duplicates land in a different page each time and the pass never converges.
  const { data, error } = await sb
    .from('planning_notes')
    .select('id, wedding_id, category, content, source_message, created_at')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + 999);
  if (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }
  all = all.concat(data);
  if (data.length < 1000) break;
}

console.log(`Scanned ${all.length} planning notes`);

// Pass 1: Rixey's own outbound SMS templates. Each of these is a genuinely
// distinct message, so they are not duplicates in the strict sense, but 50
// copies of "Thanks for texting! We will text you back ASAP!" filed against one
// couple is not planning information. Any outbound body sent verbatim to more
// than one couple is a template.
const outbound = all.filter(
  (n) => n.category === 'sms_message' && String(n.content).startsWith('[SMS from Rixey]')
);
// Two couples is not enough on its own: "Sounds good!" and "Perfect, thank
// you!" are real replies that happen to be identical. A machine sends the same
// text to several couples AND sends it often, so require both.
const MIN_COUPLES = 2;
const MIN_OCCURRENCES = 5;

const weddingsPerBody = new Map();
const countPerBody = new Map();
for (const note of outbound) {
  const body = note.content.replace(/^\[SMS from Rixey\]\s*/, '').trim();
  if (!weddingsPerBody.has(body)) weddingsPerBody.set(body, new Set());
  weddingsPerBody.get(body).add(note.wedding_id);
  countPerBody.set(body, (countPerBody.get(body) || 0) + 1);
}
const templateBodies = new Set(
  [...weddingsPerBody]
    .filter(([body, weddings]) =>
      weddings.size >= MIN_COUPLES && countPerBody.get(body) >= MIN_OCCURRENCES)
    .map(([body]) => body)
);
const templateNotes = outbound.filter((n) =>
  templateBodies.has(n.content.replace(/^\[SMS from Rixey\]\s*/, '').trim())
);
const templateIds = new Set(templateNotes.map((n) => n.id));

// Pass 2: true duplicates — the same note filed against the same wedding more
// than once, from the broken Zoom dedup and from re-imports.
const keep = new Map();
const drop = [...templateNotes];
for (const note of all) {
  if (templateIds.has(note.id)) continue;
  const key = `${note.wedding_id}|${note.category}|${note.content}`;
  if (keep.has(key)) drop.push(note);
  else keep.set(key, note);
}

console.log(`\nOutbound SMS templates recognised: ${templateBodies.size}`);
for (const body of [...templateBodies].slice(0, 8)) {
  const n = templateNotes.filter(
    (t) => t.content.replace(/^\[SMS from Rixey\]\s*/, '').trim() === body
  ).length;
  console.log(`  x${n}  "${body.replace(/\s+/g, ' ').slice(0, 70)}"`);
}

if (drop.length === 0) {
  console.log('No duplicates found.');
  process.exit(0);
}

const byCategory = {};
for (const d of drop) byCategory[d.category] = (byCategory[d.category] || 0) + 1;

console.log(`\n${drop.length} duplicate note(s) to remove, by category:`);
for (const [cat, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${n}`);
}

console.log('\nSample of what would go:');
for (const d of drop.slice(0, 10)) {
  console.log(`  [${d.category}] ${d.created_at.slice(0, 10)} ${String(d.content).replace(/\s+/g, ' ').slice(0, 90)}`);
}

if (!apply) {
  console.log('\nDry run. Re-run with --apply to delete.');
  process.exit(0);
}

let deleted = 0;
for (let i = 0; i < drop.length; i += 100) {
  const batch = drop.slice(i, i + 100).map((d) => d.id);
  const { error } = await sb.from('planning_notes').delete().in('id', batch);
  if (error) {
    console.error('Delete failed:', error.message);
    process.exit(1);
  }
  deleted += batch.length;
  console.log(`  deleted ${deleted}/${drop.length}`);
}
console.log(`\nDone. Removed ${deleted} duplicate note(s), kept ${keep.size}.`);
