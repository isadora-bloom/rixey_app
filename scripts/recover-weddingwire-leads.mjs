/**
 * Get the WeddingWire prospects out of the test wedding and into Tours.
 *
 * 33 WeddingWire notification emails were filed against "Adam and Soup", a test
 * wedding with no people on it, because the Gmail sync attributed whatever its
 * search returned to whoever it was searching for. Ten real prospects went in
 * there and nobody saw them. One of them, Kellie Phillis, asked what a 50-60
 * guest wedding would cost.
 *
 * The attribution bug is fixed in server/index.js. This recovers what already
 * went wrong:
 *
 *   1. creates an enquiry per prospect, so they appear in the Tours tab, which
 *      is where people who have not booked are supposed to live
 *   2. clears the wrong wedding_id off the notification emails, so they stop
 *      appearing in a test wedding's history
 *
 * Nothing is deleted. The emails stay in processed_emails with wedding_id null.
 *
 *   node scripts/recover-weddingwire-leads.mjs
 *   node scripts/recover-weddingwire-leads.mjs --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const APPLY = process.argv.includes('--apply');

async function all(table, columns, filter = q => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

/**
 * The prospect's name, from WeddingWire's own subject lines.
 *
 * They come in three shapes and nothing else:
 *   "📩 NAME sent you a new message"
 *   "📩 NAME is waiting to hear back from you!"
 *   "📩 NAME says: ..."
 * Anything that does not match is left alone rather than guessed at — a wrong
 * name on a lead is worse than no lead, because it gets used in a reply.
 */
function prospectName(subject) {
  const s = String(subject || '').replace(/^\s*📩\s*/, '').trim();
  const m =
    s.match(/^(.+?)\s+sent you a new message/i) ||
    s.match(/^(.+?)\s+is waiting to hear back from you/i) ||
    s.match(/^(.+?)\s+says:/i);
  return m ? m[1].trim() : null;
}

/**
 * What the prospect actually wrote, minus WeddingWire's wrapper.
 *
 * Everything from "For: Rixey Manor" onwards is legal boilerplate, tracking
 * links and a copyright notice. Left in, it drowns the two sentences that
 * matter and makes the lead unreadable in the Tours list.
 */
function prospectMessage(body) {
  const b = String(body || '').replace(/\s+/g, ' ').trim();
  const m = b.match(/Check out their message:\s*(.+)$/i) || b.match(/says:\s*(.+)$/i);
  return (m ? m[1] : b)
    .replace(/^(Actively Inquiring|Messaged You First)\s*/i, '')
    .split(/\s*For:\s*Rixey Manor/i)[0]
    .split(/\s*By replying, you agree/i)[0]
    .trim()
    .slice(0, 800);
}

/**
 * The details WeddingWire attaches under "<name>'s wedding details".
 *
 * This is the part worth having and the part that was buried: a phone number
 * means Isadora can ring them, and a date and guest count decide whether the
 * enquiry is worth chasing at all. Labels are all-caps and colon-separated, and
 * each value runs to the next label.
 */
const DETAIL_LABELS = [
  'EVENT DATE', 'GUEST COUNT', 'PHONE NUMBER', 'BUDGET',
  'WEDDING STYLE', 'WEDDING VISION', 'EMAIL',
];

function weddingDetails(body) {
  const b = String(body || '').replace(/\s+/g, ' ');
  const out = {};
  for (const label of DETAIL_LABELS) {
    // Stop at the next known label, or at the privacy boilerplate.
    const stop = DETAIL_LABELS.filter(l => l !== label).join('|');
    const re = new RegExp(`${label}:\\s*(.+?)(?=\\s+(?:${stop}):|\\s+Privacy Policy|\\s+©|$)`, 'i');
    const m = b.match(re);
    if (m && m[1].trim()) out[label] = m[1].trim().slice(0, 300);
  }
  return out;
}

/** A polite no is still an answer, and worth not chasing as a live lead. */
function looksLikeDecline(text) {
  return /(reach out if we decide|decided to (go|move) (with|forward with) another|no longer|chosen another venue|going in a different direction)/i.test(text || '');
}

const emails = await all('processed_emails', '*');
const ww = emails.filter(e =>
  String(e.from_email || '').toLowerCase().includes('weddingwire') ||
  String(e.subject || '').toLowerCase().includes('weddingwire')
);

console.log(`WeddingWire emails: ${ww.length}`);

const byName = new Map();
const unparsed = [];
for (const e of ww) {
  const name = prospectName(e.subject);
  if (!name) { unparsed.push(e); continue; }
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(e);
}

console.log(`prospects found: ${byName.size}`);
console.log(`emails that are not a prospect message (reviews, digests): ${unparsed.length}`);
for (const e of unparsed) console.log(`   kept as-is: ${e.subject}`);

// Do not create an enquiry for somebody already in there under any source.
const weddings = await all('weddings', 'id, couple_names');
const existing = await all('enquiries', 'id, name, email, source');
const existingNames = new Set(existing.map(e => String(e.name || '').toLowerCase().trim()));

const toCreate = [];
for (const [name, rows] of byName) {
  if (existingNames.has(name.toLowerCase())) {
    console.log(`   already an enquiry, skipping: ${name}`);
    continue;
  }
  rows.sort((a, b) => String(a.processed_at).localeCompare(String(b.processed_at)));
  const first = rows[0];
  const message = rows.map(r => prospectMessage(r.body_text)).find(Boolean) || '';

  // Merge details across every notification about this person: the first may
  // carry the phone number and a later one the budget.
  const details = {};
  for (const r of rows) Object.assign(details, weddingDetails(r.body_text));

  const declined = looksLikeDecline(message);

  toCreate.push({
    name,
    phone: details['PHONE NUMBER'] || null,
    email: details['EMAIL'] || null,
    source: 'weddingwire',
    meeting_kind: 'Enquiry (WeddingWire)',
    // They never booked anything, so there is no meeting. whenLabel renders
    // this as "no date", which is the truth.
    meeting_at: null,
    preferred_date: details['EVENT DATE'] || null,
    guest_estimate: details['GUEST COUNT'] || null,
    heard_about: 'WeddingWire',
    // The questions WeddingWire asks are not the ones Calendly asks, and they
    // change. Kept verbatim rather than forced into columns.
    answers: Object.entries(details).map(([question, answer]) => ({ question, answer })),
    // A polite no is marked as such rather than sitting in the live list for
    // ever. Nothing is deleted and "Undo" is one click in the Tours tab.
    status: declined ? 'lost' : 'upcoming',
    outcome_notes: declined ? 'Replied via WeddingWire that they are evaluating other options.' : null,
    notes: [
      message && `Their message: ${message}`,
      `Arrived via WeddingWire ${String(first.processed_at).slice(0, 10)}.`,
      rows.length > 1 ? `${rows.length} notifications about this prospect.` : null,
      'Recovered from emails that had been filed against a test wedding.',
    ].filter(Boolean).join('\n'),
  });
}

/**
 * Does this prospect look like somebody who has since booked?
 *
 * Reported, never acted on. Linking an enquiry to the wrong wedding is the same
 * class of mistake as the one that caused all this, and the Tours tab already
 * has a suggestion flow built for exactly this decision. So this only says
 * "worth a look" and leaves the judgement where it belongs.
 */
const firstNames = w => String(w.couple_names || '')
  .toLowerCase().split(/\s*(?:&|and)\s*|\s+/).filter(t => t.length > 2);

console.log('\nmay already have booked (not linked automatically — check in Tours):');
let flagged = 0;
for (const e of toCreate) {
  const tokens = String(e.name).toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const hit = weddings.find(w => {
    const wt = firstNames(w);
    return tokens.some(t => wt.includes(t));
  });
  if (hit) { console.log(`   ${e.name}  →  ${hit.couple_names}`); flagged++; }
}
if (!flagged) console.log('   none');

console.log(`\nenquiries to create: ${toCreate.length}`);
for (const e of toCreate) {
  const bits = [
    e.preferred_date && `wants ${e.preferred_date}`,
    e.guest_estimate && `${e.guest_estimate} guests`,
    e.phone && `☎ ${e.phone}`,
    e.status === 'lost' ? 'MARKED NOT PROCEEDING' : null,
  ].filter(Boolean);
  console.log(`\n  ${e.name}${bits.length ? `  —  ${bits.join(' · ')}` : ''}`);
  const msg = (e.notes.split('\n')[0] || '').replace(/^Their message: /, '');
  if (msg) console.log(`      "${msg.slice(0, 150)}"`);
  const extra = (e.answers || []).filter(a => !['PHONE NUMBER', 'EVENT DATE', 'GUEST COUNT'].includes(a.question));
  for (const a of extra) console.log(`      ${a.question}: ${a.answer.slice(0, 110)}`);
}

const misfiled = ww.filter(e => e.wedding_id);
console.log(`\nnotification emails currently filed against a wedding: ${misfiled.length}`);
const wIds = [...new Set(misfiled.map(e => e.wedding_id))];
for (const id of wIds) {
  const w = weddings.find(x => x.id === id);
  console.log(`   ${misfiled.filter(e => e.wedding_id === id).length}x  ${w?.couple_names || id}`);
}

if (!APPLY) {
  console.log('\nDry run. Nothing written. Re-run with --apply.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'backups'), { recursive: true });
writeFileSync(resolve(root, 'backups', `weddingwire-emails-${stamp}.json`), JSON.stringify(ww, null, 2), 'utf8');
console.log(`\nBacked up ${ww.length} emails.`);

if (toCreate.length) {
  const { data, error } = await db.from('enquiries').insert(toCreate).select('id, name');
  if (error) { console.error('Could not create enquiries:', error.message); process.exit(1); }
  console.log(`Created ${data.length} enquiries.`);
}

// Only the notification emails. A review notification is not a couple's email
// either, so it goes too; it belongs to the venue, not to a wedding.
const ids = ww.filter(e => e.wedding_id).map(e => e.id);
if (ids.length) {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await db.from('processed_emails')
      .update({ wedding_id: null }).in('id', ids.slice(i, i + 100));
    if (error) { console.error('Could not clear wedding_id:', error.message); process.exit(1); }
  }
  console.log(`Cleared the wrong wedding_id off ${ids.length} emails.`);
}
console.log('\nDone. Check the Tours tab.');
