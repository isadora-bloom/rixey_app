/**
 * Give the contracts already on file a vendor, a date, and a place in a chain.
 *
 * 103 rows were written before any of that existed. They have a filename, the
 * extracted text, and the day they were uploaded, so every one of them looks
 * like a separate agreement. Sarah and Kevan have MUA Contract.pdf twice, a
 * minute apart, and five filename-and-wedding pairs across the table are
 * doubled up.
 *
 * This reads the vendor and the date off the text that is already stored, so
 * no PDF is sent anywhere and nothing is re-uploaded, then chains each
 * wedding's contracts per vendor by the date on the page.
 *
 * Dry run by default. Nothing is deleted, ever: a superseded contract keeps its
 * row and gains a pointer to the one that replaced it.
 *
 *   node scripts/backfill-contract-versions.mjs            # say what it would do
 *   node scripts/backfill-contract-versions.mjs --apply    # do it
 *   node scripts/backfill-contract-versions.mjs --apply --limit 10
 *
 * Requires migration 033. Run it first, or every write fails on a missing
 * column and the script says so rather than half-finishing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { vendorKey } from '../shared/vendor-names.js';
import { byNewestFirst, contractKey } from '../shared/contract-versions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i === -1 || line.trim().startsWith('#')) continue;
  const key = line.slice(0, i).trim();
  if (!process.env[key]) process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const apply = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg === -1 ? Infinity : Number(process.argv[limitArg + 1]);

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

/** Same question the server asks, on text that is already stored. */
async function readFacts(text, filename) {
  const empty = { vendorName: null, vendorType: null, documentDate: null };
  if (!String(text || '').trim()) return empty;
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `This is the text of a document sent to a wedding venue, filename "${filename}".

Return ONLY a JSON object, no commentary:
{"vendorName": "<the business that issued this, as written, or null>",
 "vendorType": "<one of: photographer, videographer, caterer, florist, dj, band, officiant, cake, hair, makeup, coordinator, rentals, transportation, other, or null>",
 "documentDate": "<YYYY-MM-DD, or null>"}

vendorName is the company that WROTE this document, not the couple and not the venue. The venue is Rixey Manor; never return that.

documentDate is the date THIS VERSION of the agreement was drawn up or signed. It is not the wedding date, not a delivery or pickup date, and not a payment due date. If the only dates on the page are event dates, return null.

Document text:
${String(text).slice(0, 20000)}`,
    }],
  });
  const match = response.content[0].text.trim().match(/\{[\s\S]*\}/);
  if (!match) return empty;
  const parsed = JSON.parse(match[0]);
  const clean = v => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim() : null);
  const date = clean(parsed.documentDate);
  return {
    vendorName: clean(parsed.vendorName),
    vendorType: clean(parsed.vendorType),
    documentDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  };
}

const { data: rows, error } = await db
  .from('contracts')
  .select('id, wedding_id, filename, extracted_text, created_at, vendor_name, document_date')
  .order('created_at', { ascending: true });

if (error) {
  if (error.code === '42703') {
    console.error('Migration 033 has not been run yet. Apply it, then run this again.');
    process.exit(1);
  }
  console.error('Could not read the contracts:', error.message);
  process.exit(1);
}

console.log(`${rows.length} contracts on file. ${apply ? 'APPLYING' : 'Dry run, nothing will be written.'}`);

// ── Step one: who sent it, and when was it written ──────────────────────────
const enriched = [];
let read = 0, skipped = 0;

for (const row of rows) {
  if (enriched.length >= limit) break;
  if (row.vendor_name) {
    // Already done on a previous run, or filed by the server since.
    enriched.push(row);
    skipped++;
    continue;
  }
  try {
    const facts = await readFacts(row.extracted_text, row.filename);
    const updated = { ...row, vendor_name: facts.vendorName, document_date: facts.documentDate };
    enriched.push(updated);
    read++;
    console.log(
      `  ${row.filename.slice(0, 52).padEnd(52)} ${facts.vendorName || '(no vendor found)'}`
      + `${facts.documentDate ? ` · ${facts.documentDate}` : ' · no date on it'}`,
    );

    if (apply) {
      const { error: updErr } = await db.from('contracts').update({
        vendor_name: facts.vendorName,
        vendor_key: facts.vendorName ? vendorKey(facts.vendorName) : null,
        vendor_type: facts.vendorType,
        document_date: facts.documentDate,
      }).eq('id', row.id);
      // A row that did not save must not then be chained, or the chain points
      // at a vendor the database does not agree it has.
      if (updErr) throw new Error(`could not save: ${updErr.message}`);
    }
  } catch (e) {
    console.error(`  ${row.filename}: ${e.message}`);
    enriched.push(row);
  }
}

console.log(`\nRead ${read}, already had a vendor ${skipped}.`);

// ── Step two: chain each vendor's contracts on one wedding ──────────────────
const groups = new Map();
for (const row of enriched) {
  const key = contractKey(row);
  if (key === null) continue;             // no vendor, so nothing to chain to
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}

const chains = [...groups.values()].filter(g => g.length > 1);
console.log(`\n${chains.length} vendor line(s) have more than one contract:`);

let linked = 0;
for (const group of chains) {
  const sorted = [...group].sort(byNewestFirst);   // newest first
  const current = sorted[0];
  console.log(`\n  ${current.vendor_name}: ${sorted.length} versions`);
  console.log(`    current  ${current.filename.slice(0, 60)} (${current.document_date || 'no date, uploaded ' + String(current.created_at).slice(0, 10)})`);

  // Walk oldest to newest so each one points at the version that replaced it.
  for (let i = sorted.length - 1; i > 0; i--) {
    const older = sorted[i];
    const newer = sorted[i - 1];
    // Same file, same date, uploaded twice is a duplicate. Same vendor with a
    // later date is a revision. Both end up behind the current one; only one
    // of them is worth a second look.
    const duplicate = older.filename === newer.filename
      && String(older.document_date || '') === String(newer.document_date || '');
    console.log(
      `    ${duplicate ? 'duplicate' : 'replaced '} ${older.filename.slice(0, 58)}`
      + ` (${older.document_date || 'no date'})`
      + (duplicate ? ', the same file twice' : ` → ${newer.filename.slice(0, 40)}`),
    );
    linked++;
    if (apply) {
      const version = sorted.length - i;
      const { error: e1 } = await db.from('contracts')
        .update({ version, superseded_by: newer.id }).eq('id', older.id);
      if (e1) { console.error(`      could not retire it: ${e1.message}`); continue; }
      const { error: e2 } = await db.from('contracts')
        .update({ version: version + 1, supersedes_id: older.id }).eq('id', newer.id);
      if (e2) console.error(`      could not link the newer one: ${e2.message}`);
    }
  }
}

console.log(
  `\n${apply ? 'Done.' : 'Dry run finished, nothing was written.'}`
  + ` ${linked} contract(s) ${apply ? 'now sit' : 'would sit'} behind a newer version.`
  + (apply ? '' : '\nRun again with --apply to make these changes.'),
);
