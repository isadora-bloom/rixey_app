/**
 * Remove the auto-reply and template texts that got into the planning notes.
 *
 * The Quo sync has always had a filter for these, gated on
 * `direction === 'outbound'`, which never matched because OpenPhone says
 * "outgoing". So the filter never fired once and "Thanks for texting! We will
 * text you back ASAP!" is in the notes again, along with every other template.
 *
 * A note is removed only if ALL of these hold:
 *
 *   1. it is category = 'sms_message'
 *   2. its body matches an OUTBOUND message for that same wedding, so nothing a
 *      couple wrote can be caught by a pattern that happens to fit
 *   3. either the body matches a known auto-reply pattern, or it is a template
 *      by the same definition the server uses: sent to at least MIN_COUPLES
 *      couples AND at least MIN_OCCURRENCES times
 *
 * That second threshold matters more than it looks. On distinct-couples alone
 * this wanted to delete "Hey guys! It's Isadora. Just wanted to confirm how many
 * people are coming with you for Bootcamp on Sunday so we can make sure we seat
 * you together", which went to three couples and is a real question with a real
 * answer in it. Isadora sends the same personal message to several couples all
 * the time. Only a machine sends one hundreds of times.
 *
 * Dry run by default. Pass --apply to delete, and every deleted row is written
 * to a JSON file first so this can be put back.
 *
 *   node scripts/cleanup-autoreply-notes.mjs
 *   node scripts/cleanup-autoreply-notes.mjs --apply
 *   node scripts/cleanup-autoreply-notes.mjs --restore backups/autoreply-notes-<stamp>.json
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

// Mirrors autoReplyPatterns in server/index.js.
const AUTO_REPLY_PATTERNS = [
  /^thank you for (reaching out|contacting|calling|your (message|inquiry|interest))/i,
  /^thanks for (reaching out|calling|texting|your (message|inquiry|interest))/i,
  /^we('ve| have) received your/i,
  /^we('ll| will) (get back|be in touch|respond)/i,
  /^this is an automated/i,
  /^you('ve| have) reached rixey manor/i,
  /^hi,? (we('re| are) currently|our team is)/i,
];

/** PostgREST caps every select at 1000 rows whether you ask it to or not. */
async function all(table, columns, filter = q => q) {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(db.from(table).select(columns)).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

async function restore(path) {
  const rows = JSON.parse(readFileSync(path, 'utf8'));
  console.log(`Restoring ${rows.length} notes from ${path}`);
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await db.from('planning_notes').insert(batch);
    if (error) { console.error('Restore failed:', error.message); process.exit(1); }
    console.log(`  ${Math.min(i + 200, rows.length)}/${rows.length}`);
  }
  console.log('Restored. The ids are preserved, so this is the same rows back.');
}

if (RESTORE) {
  await restore(resolve(root, RESTORE));
  process.exit(0);
}

const msgs = await all('processed_quo_messages', 'wedding_id, direction, body_text');
const notes = await all('planning_notes', '*', q => q.eq('category', 'sms_message'));

// Same thresholds as templateBodies in server/index.js. Two definitions of
// "template" is one too many.
const MIN_COUPLES = 2;
const MIN_OCCURRENCES = 5;

// Outbound bodies: which weddings each went to, and how many times in total.
const outboundWeddings = new Map();
const outboundCount = new Map();
for (const m of msgs) {
  if (m.direction !== 'outbound' || !m.body_text) continue;
  const b = m.body_text.trim();
  if (!outboundWeddings.has(b)) outboundWeddings.set(b, new Set());
  outboundWeddings.get(b).add(m.wedding_id);
  outboundCount.set(b, (outboundCount.get(b) || 0) + 1);
}

const doomed = [];
const spared = new Set();
const reasons = { pattern: 0, template: 0 };

for (const n of notes) {
  const content = String(n.content || '');
  const m = content.match(/^\[SMS from (?:Rixey|client)\]\s?([\s\S]*)$/);
  if (!m) continue;
  const body = m[1].trim();
  if (!body) continue;

  const sentTo = outboundWeddings.get(body);
  // Condition 2: it must be something Rixey actually sent, for this wedding.
  if (!sentTo || !sentTo.has(n.wedding_id)) continue;

  const isPattern = AUTO_REPLY_PATTERNS.some(p => p.test(body));
  const isTemplate = sentTo.size >= MIN_COUPLES && (outboundCount.get(body) || 0) >= MIN_OCCURRENCES;
  if (!isPattern && !isTemplate) {
    // Worth naming: it looked like a template on couples alone and was spared
    // by the occurrence threshold. These are the near misses.
    if (sentTo.size >= MIN_COUPLES) spared.add(body);
    continue;
  }

  if (isPattern) reasons.pattern++; else reasons.template++;
  doomed.push(n);
}

console.log(`planning_notes with category = sms_message: ${notes.length}`);
console.log(`to remove: ${doomed.length}`);
console.log(`  matched an auto-reply pattern:            ${reasons.pattern}`);
console.log(`  identical text sent to several weddings:  ${reasons.template}`);
console.log(`leaving: ${notes.length - doomed.length}`);

// The commonest offenders, so the numbers can be sanity-checked before deleting.
const byBody = new Map();
for (const n of doomed) {
  const body = String(n.content).replace(/^\[SMS from (?:Rixey|client)\]\s?/, '').trim();
  byBody.set(body, (byBody.get(body) || 0) + 1);
}
console.log('\nmost frequent:');
for (const [body, count] of [...byBody].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(count).padStart(4)}  ${body.slice(0, 90).replace(/\s+/g, ' ')}`);
}
console.log(`\ndistinct bodies being removed: ${byBody.size}`);

if (spared.size) {
  console.log(`\nsent to several couples but kept, too few times to be a machine (${spared.size}):`);
  for (const body of spared) console.log(`  ${body.slice(0, 100).replace(/\s+/g, ' ')}`);
}

if (!doomed.length) process.exit(0);

if (!APPLY) {
  console.log('\nDry run. Nothing deleted. Re-run with --apply to delete, and a');
  console.log('backup of every row is written before anything goes.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = resolve(root, 'backups');
mkdirSync(backupDir, { recursive: true });
const backupPath = resolve(backupDir, `autoreply-notes-${stamp}.json`);
writeFileSync(backupPath, JSON.stringify(doomed, null, 2), 'utf8');
console.log(`\nBacked up ${doomed.length} rows to ${backupPath}`);

// Batched by id. Deleting by a body match would be a filter written twice, and
// the second copy is where the mistake goes.
let deleted = 0;
for (let i = 0; i < doomed.length; i += 100) {
  const ids = doomed.slice(i, i + 100).map(n => n.id);
  const { error } = await db.from('planning_notes').delete().in('id', ids);
  if (error) {
    console.error(`\nStopped after ${deleted}: ${error.message}`);
    console.error(`Everything is still in ${backupPath}. Restore with --restore.`);
    process.exit(1);
  }
  deleted += ids.length;
  console.log(`  deleted ${deleted}/${doomed.length}`);
}

console.log(`\nDone. ${deleted} removed. To undo:`);
console.log(`  node scripts/cleanup-autoreply-notes.mjs --restore backups/autoreply-notes-${stamp}.json`);
