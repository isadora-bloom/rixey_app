/**
 * Which of the loose add_*.sql files in the repo root were ever run?
 *
 * Two of them turned out never to have been applied, and each was a whole
 * feature that silently did nothing for months: section_finalisations (every
 * "mark this finalised" tick failed) and day_of_media (every wedding-day photo
 * upload failed). Nothing distinguishes those files from the thirty that were
 * applied, so there was no way to know without checking each by hand.
 *
 * This parses every CREATE TABLE and ALTER TABLE ... ADD COLUMN out of them and
 * asks the live database whether the result actually exists.
 *
 *   node scripts/audit-loose-sql.mjs
 *
 * Read-only.
 */

import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Needs Supabase env vars'); process.exit(2); }

const spec = await (await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
})).json();
const schema = Object.fromEntries(
  Object.entries(spec.definitions || {}).map(([t, d]) => [t, new Set(Object.keys(d.properties || {}))])
);

const files = readdirSync('.').filter(f => /^(add_|seed_).*\.sql$/i.test(f)).sort();

const applied = [], partial = [], unrun = [], unknown = [];

for (const file of files) {
  const sql = readFileSync(file, 'utf8');

  const tables = [...sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/gi)]
    .map(m => m[1]);
  const columns = [...sql.matchAll(/ALTER TABLE\s+(?:public\.)?["']?([a-zA-Z0-9_]+)["']?[\s\S]{0,200}?ADD COLUMN(?:\s+IF NOT EXISTS)?\s+["']?([a-zA-Z0-9_]+)["']?/gi)]
    .map(m => ({ table: m[1], col: m[2] }));

  const checks = [];
  for (const t of tables) checks.push({ what: `table ${t}`, ok: !!schema[t] });
  for (const c of columns) {
    checks.push({ what: `${c.table}.${c.col}`, ok: !!schema[c.table]?.has(c.col) });
  }

  if (!checks.length) { unknown.push({ file, note: 'no CREATE TABLE or ADD COLUMN found (policies, seed data, or an unparsed form)' }); continue; }

  const missing = checks.filter(c => !c.ok);
  if (!missing.length) applied.push({ file, checks: checks.length });
  else if (missing.length === checks.length) unrun.push({ file, missing: missing.map(m => m.what) });
  else partial.push({ file, missing: missing.map(m => m.what), total: checks.length });
}

const line = (s) => console.log(`  ${s}`);

console.log(`${files.length} loose SQL files in the repo root, checked against the live schema.\n`);

if (unrun.length) {
  console.log(`NEVER RUN — nothing they create exists (${unrun.length}):`);
  for (const u of unrun) { line(`${u.file}`); u.missing.forEach(m => line(`     missing: ${m}`)); }
  console.log();
}
if (partial.length) {
  console.log(`PARTIALLY APPLIED — some of it is missing (${partial.length}):`);
  for (const p of partial) { line(`${p.file}  (${p.missing.length} of ${p.total} missing)`); p.missing.forEach(m => line(`     missing: ${m}`)); }
  console.log();
}
if (unknown.length) {
  console.log(`CANNOT TELL — needs a human eye (${unknown.length}):`);
  for (const u of unknown) line(`${u.file}  — ${u.note}`);
  console.log();
}
console.log(`APPLIED — everything they create exists (${applied.length}):`);
line(applied.map(a => a.file).join(', ') || 'none');

const bad = unrun.length + partial.length;
console.log(`\n${bad === 0 ? 'Nothing outstanding.' : `${bad} file(s) need attention.`}`);
process.exit(bad ? 1 : 0);
