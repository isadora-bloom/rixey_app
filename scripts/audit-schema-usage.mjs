/**
 * Every table and column the code asks for, checked against the real database.
 *
 * Written after four bugs in one day that were all the same shape: a query
 * asking for something that is not there, an error nobody reads, and a feature
 * that looks fine while doing nothing.
 *
 *   wedding_guest_care    selected guest_name/note_type/notes — no such columns,
 *                         so Sage never saw a single couple's guest care answers
 *   section_finalisations queried by two endpoints and three components — the
 *                         table has never existed, so the feature never worked
 *   wedding_guests        the CSV importer dropped every plus-one column
 *   test cleanup          six of twelve table names were invented
 *
 * None of these threw anywhere a person would see. This finds the rest of them.
 *
 *   node scripts/audit-schema-usage.mjs
 *
 * Read-only. Exits non-zero when something is wrong, so it can be a CI gate.
 */

import 'dotenv/config';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const spec = await (await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
})).json();
const schema = Object.fromEntries(
  Object.entries(spec.definitions || {}).map(([t, d]) => [t, new Set(Object.keys(d.properties || {}))])
);

const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', '.next', '.vercel'].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|jsx|mjs)$/.test(e) && !e.startsWith('_')) files.push(p);
  }
};
for (const d of ['server', 'src', 'shared', 'scripts', 'tests']) {
  try { walk(d); } catch { /* directory may not exist */ }
}

const missingTables = [];
const missingColumns = [];
const KNOWN_NON_TABLES = new Set(['storage']);   // supabase.storage.from('bucket')

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  // .from('table') — optionally followed by .select('a, b, c')
  const re = /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)([\s\S]{0,400})/g;
  let m;
  while ((m = re.exec(text))) {
    const table = m[1];
    if (KNOWN_NON_TABLES.has(table)) continue;
    // storage.from() takes a bucket name, not a table
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (/storage\s*$/.test(before)) continue;

    const lineNo = text.slice(0, m.index).split('\n').length;
    const where = `${file.replace(/\\/g, '/')}:${lineNo}`;

    if (!schema[table]) {
      missingTables.push({ where, table, line: (lines[lineNo - 1] || '').trim().slice(0, 90) });
      continue;
    }

    // The .select() belonging to THIS query only.
    //
    // A fixed lookahead window bled into whatever came next and reported
    // columns from an unrelated statement against the wrong table — it
    // accused walkthrough_items of wanting couple_names, which belonged to a
    // weddings query further down. Cut the window at the first statement
    // terminator or the next .from(), whichever comes first.
    let window = m[2];
    const stop = Math.min(
      ...[window.indexOf(';'), window.indexOf('.from(')]
        .filter(i => i !== -1)
        .concat([window.length])
    );
    window = window.slice(0, stop);

    const sel = window.match(/\.select\(\s*['"`]([^'"`]+)['"`]/);
    if (!sel) continue;
    const raw = sel[1];
    if (raw.trim() === '*' || raw.includes('(')) continue;   // '*' or an embedded join

    for (const part of raw.split(',')) {
      const col = part.trim().split(/[:\s]/)[0].replace(/^"|"$/g, '');
      if (!col || col === '*') continue;
      if (!schema[table].has(col)) {
        missingColumns.push({ where, table, col });
      }
    }
  }
}

console.log(`Checked ${files.length} source files against ${Object.keys(schema).length} live tables.\n`);

if (missingTables.length) {
  console.log(`TABLES THAT DO NOT EXIST (${missingTables.length}):`);
  const grouped = {};
  for (const x of missingTables) (grouped[x.table] ||= []).push(x);
  for (const [t, list] of Object.entries(grouped)) {
    console.log(`\n  ${t}`);
    for (const x of list) console.log(`     ${x.where}  ${x.line}`);
  }
  console.log();
}

if (missingColumns.length) {
  console.log(`COLUMNS THAT DO NOT EXIST (${missingColumns.length}):`);
  const grouped = {};
  for (const x of missingColumns) (grouped[`${x.table}.${x.col}`] ||= []).push(x.where);
  for (const [k, wheres] of Object.entries(grouped)) {
    console.log(`\n  ${k}`);
    for (const w of [...new Set(wheres)]) console.log(`     ${w}`);
  }
  console.log();
}

if (!missingTables.length && !missingColumns.length) {
  console.log('Nothing asks the database for something it does not have.');
  process.exit(0);
}
console.log(`${missingTables.length} bad table reference(s), ${missingColumns.length} bad column reference(s).`);
process.exit(1);
