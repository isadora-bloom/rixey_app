/**
 * Changes to a couple's wedding that leave no trace in the activity log.
 *
 * Corinna told us twice, over three days, that her wedding party was not on her
 * website. It was the section's own toggle. We could not see when that toggle
 * had been set, or by whom, or what it had been before, because saving website
 * settings wrote nothing to `activity_log` — her wedding had 122 entries and not
 * one of them was about her website. The answer came from reading code and
 * guessing at a history instead of looking it up.
 *
 * The gap was never one endpoint. Most tables logged their DELETE and nothing
 * else, so the feed recorded a couple removing one bridesmaid and stayed silent
 * while they added thirty eight.
 *
 * Scope is decided by the table, not the route. The first version of this audit
 * only counted handlers that mentioned `wedding_id`, which quietly skipped every
 * edit-by-id PUT and reported 44 where the real number was 82. That is the sort
 * of comfortable figure that stops anyone looking further, so: any route that
 * writes a table with a wedding_id column is in scope, whoever calls it. The
 * venue editing on a couple's behalf is exactly the case worth tracing — it was
 * an admin-side save that finally moved Corinna's toggle.
 *
 * MACHINERY is the list of tables that are bookkeeping rather than the wedding,
 * each with its reason. ROW_ACTIVITY in server/lib/activity-rows.js is the list
 * of tables that log per row.
 *
 *   node scripts/audit-activity-logging.mjs
 *   node scripts/audit-activity-logging.mjs --list
 *   node scripts/audit-activity-logging.mjs --max 0
 */
import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { TABLE_COLUMNS } from '../server/middleware/table-columns.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const LIST = argv.includes('--list');
const maxIdx = argv.indexOf('--max');
const MAX = maxIdx > -1 ? Number(argv[maxIdx + 1]) : null;

const src = readFileSync(join(root, 'server', 'index.js'), 'utf8');

/** Tables that carry a wedding_id, so a row of them belongs to one wedding. */
const WEDDING_SCOPED = new Set(
  Object.entries(TABLE_COLUMNS).filter(([, cols]) => cols.includes('wedding_id')).map(([t]) => t)
);

/**
 * Wedding-scoped tables that are still not the wedding, and why. A line in a
 * couple's feed saying "we processed an email" is noise; a line saying they
 * changed their shuttle times is not.
 */
const MACHINERY = {
  activity_log:              'the feed itself',
  client_errors:             'crash telemetry',
  contact_messages:          'ingested calls and emails, not something a person did in the portal',
  direct_messages:           'logged as message_sent where the message is sent',
  enquiries:                 'pre-booking pipeline, before there is a wedding to narrate',
  notifications:             'read receipts on the feed, not events in it',
  planning_notes:            'ingestion writes these; the extraction logs its own run',
  processed_emails:          'ingestion bookkeeping',
  processed_quo_messages:    'ingestion bookkeeping',
  processed_zoom_meetings:   'ingestion bookkeeping',
  profiles:                  'accounts, not wedding data',
  sheet_sync_log:            'sync bookkeeping',
  uncertain_questions:       "Sage's own queue; the answer is logged as sage_answer_sent",
  usage_logs:                'token accounting',
  vendor_contact_evidence:   'derived by the tracer, not entered by anyone',
  walkthrough_items:         'derived from a walkthrough; the apply step logs walkthrough_applied',
  walkthrough_media:         'derived from a walkthrough',
  walkthroughs:              'the recording itself; applying it logs walkthrough_applied',
  section_finalisations:     'a couple marking a section done is already its own surface',
  onboarding_progress:       'progress through sign-up, not a change to the wedding',
};

/** Routes that are not a person changing a wedding at all. */
const NOT_A_CHANGE = [
  [/^\/api\/auth\//, 'authentication'],
  [/^\/api\/join\//, 'sign-up, before there is a wedding to attribute it to'],
  [/^\/api\/health/, 'health check'],
  [/^\/api\/webhooks?\//, 'inbound webhook'],
  [/\/(read|mark-read|seen)\b/, 'marking something read'],
  [/^\/api\/(gmail|zoom|quo|calendly|deepgram)\//, 'integration plumbing; the sync logs its own run'],
  [
    /^\/api\/admin\/documents\/:id\/parse$/,
    'reads a document already on file and writes back what it found; the upload is the event',
  ],
  [
    /^\/api\/venue-vendors-unlinked\/:bookingId$/,
    'links an existing booking to a directory entry. Nothing about the wedding changes, only which vendor record it points at',
  ],
];

const ROUTE = /\bapp\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
const routes = [];
for (const m of src.matchAll(ROUTE)) {
  routes.push({
    method: m[1].toUpperCase(),
    path: m[2],
    start: m.index,
    line: src.slice(0, m.index).split('\n').length,
  });
}
/**
 * A route's body ends at the next thing declared at the left margin, not at the
 * next route.
 *
 * Slicing route-to-route folds any helper declared between two of them into the
 * one above. That put `saveContract`'s insert on /api/welcome, which does not
 * write contracts itself, and sent me looking through a 252-line handler for a
 * write that was never in it. A helper that writes is logged in the helper.
 */
const NEXT_TOP_LEVEL = /^(app\.|async function |function |const |let |var |class |\/\*\*)/m;
for (let i = 0; i < routes.length; i++) {
  const from = routes[i].start;
  const until = routes[i + 1]?.start ?? src.length;
  const rest = src.slice(from, until);
  // Skip the route's own opening line before looking for the next declaration.
  const afterFirstLine = rest.indexOf('\n') + 1;
  const m = NEXT_TOP_LEVEL.exec(rest.slice(afterFirstLine));
  routes[i].body = m ? rest.slice(0, afterFirstLine + m.index) : rest;
}

const MUTATES = /\.(insert|update|upsert|delete)\(/;

/**
 * Which tables a handler writes to.
 *
 * The mutation has to be in the same chain as the `.from()`, so the scan stops
 * at the end of the statement. A fixed window of characters instead of that
 * boundary read straight past the semicolon and paired a `.from('contracts')`
 * read with the next statement's insert, which put /api/welcome and
 * /api/chat-with-file on the list twice over for writes neither of them makes.
 */
function tablesWritten(body) {
  const out = new Set();
  for (const m of body.matchAll(/\.from\(\s*['"`]([a-z_]+)['"`]\s*\)/g)) {
    const after = body.slice(m.index + m[0].length);
    const end = after.indexOf(';');
    const chain = end === -1 ? after.slice(0, 400) : after.slice(0, end);
    if (MUTATES.test(chain)) out.add(m[1]);
  }
  return [...out];
}

const findings = [];
let inScope = 0;
for (const r of routes) {
  if (r.method === 'GET') continue;
  const written = tablesWritten(r.body).filter((t) => WEDDING_SCOPED.has(t) && !MACHINERY[t]);
  if (!written.length) continue;
  if (NOT_A_CHANGE.some(([re]) => re.test(r.path))) continue;
  inScope++;
  if (/logActivity\(|logRow\(|logBurst\(/.test(r.body)) continue;
  findings.push({ ...r, tables: written });
}

console.log(`Wedding-scoped mutating routes: ${inScope}`);
console.log(`Of those, changes that write no activity entry: ${findings.length}\n`);

if (findings.length) {
  const byTable = new Map();
  for (const f of findings) {
    const key = f.tables[0];
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key).push(f);
  }
  for (const [table, group] of [...byTable].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${table}  (${group.length})`);
    if (LIST) for (const f of group) console.log(`      ${f.method.padEnd(6)} ${f.path}   server/index.js:${f.line}`);
  }
  if (!LIST) console.log('\n  Run with --list for the routes.');
  console.log(`
Fix shape, after the write has succeeded:

  await logRow('decor_inventory', 'added', data, req.userId);

for a row-per-thing table listed in server/lib/activity-rows.js, or logActivity
directly when the wording needs to say something particular:

  await logActivity(weddingId, req.userId, 'website_updated', 'turned off Wedding Party');

logActivity folds the same type and wording inside ten minutes into one entry,
so an autosave will not flood the feed. The details line is read back to the
couple and to the venue as a sentence, so write it as one.

A table that is bookkeeping rather than the wedding belongs in MACHINERY in this
file, with its reason, rather than being left to look like an oversight.`);
}

if (MAX !== null && findings.length > MAX) {
  console.error(`\nFAIL: ${findings.length} unlogged, over the ceiling of ${MAX}.`);
  process.exit(1);
}
