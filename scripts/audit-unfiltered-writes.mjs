/**
 * Writes that hand the database whatever the client sent.
 *
 * `.insert({ ...req.body })` works until a form grows a field that is not a
 * column, and then it fails in the vocabulary of Postgres rather than of the
 * person using the app. Grace was told "could not find user id" while saving a
 * rehearsal dinner, because that form had picked up a userId somewhere and
 * rehearsal_dinner has no such column. Every save had failed that way since
 * May, and nothing anywhere said so: the toast named a user id, the table
 * looked empty, and an empty table looks like a feature nobody has used.
 *
 * The fix is server/middleware/table-columns.js — onlyColumns(table, body)
 * keeps the columns and hands back the rest to be logged.
 *
 *   node scripts/audit-unfiltered-writes.mjs
 *   node scripts/audit-unfiltered-writes.mjs --max 4
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const maxIdx = process.argv.indexOf('--max');
const MAX = maxIdx > -1 ? Number(process.argv[maxIdx + 1]) : null;

const SKIP = new Set(['node_modules', '.git', 'dist', 'backups', 'test-results']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

// Spread inline into the object being written.
const WRITE_LITERAL = /\.(insert|update|upsert)\(\s*\{([^}]*)\}/gs;

// The same thing written in two steps: `const payload = { ...req.body }` and
// then `.update(payload)`. The first version of this audit only looked for the
// inline form and found two of the four, which is the sort of comfortable
// number that stops anyone looking any further.
const WRITE_VAR = /\.(insert|update|upsert)\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g;

const CLIENT_SPREAD = /\.\.\.\s*(req\.body|body|fields|rest|updates|payload|other)\b/;

const findings = [];
for (const file of walk(join(root, 'server'))) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const seen = new Set();

  const add = (index, name) => {
    const line = src.slice(0, index).split('\n').length;
    if (seen.has(line)) return;
    const near = lines.slice(Math.max(0, line - 25), line).join('\n');

    // Where did that name come from? Only a client-supplied body counts; a
    // payload the server built itself is not the same risk at all.
    const assigned = new RegExp(
      '(const|let)\\s+(\\{[^}]*\\.\\.\\.\\s*' + name + '\\s*\\}|' + name + ')\\s*=[^;]*req\\.body'
    );
    if (name !== 'req.body' && !assigned.test(near)) return;

    seen.add(line);
    const table = /\.from\(\s*'([^']+)'/.exec(near.split('\n').slice(-8).join('\n'));
    findings.push({
      file: relative(root, file).replace(/\\/g, '/'),
      line,
      table: table ? table[1] : '(table not obvious)',
      snippet: lines[line - 1].trim().slice(0, 90),
    });
  };

  for (const m of src.matchAll(WRITE_LITERAL)) {
    const spread = CLIENT_SPREAD.exec(m[2]);
    if (spread) add(m.index, spread[1]);
  }
  for (const m of src.matchAll(WRITE_VAR)) {
    add(m.index, m[2]);
  }
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

console.log(`Writes that pass the request body straight through: ${findings.length}\n`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  -> ${f.table}`);
  console.log(`      ${f.snippet}`);
}
if (!findings.length) console.log('  none.');

console.log(`
Each of these breaks the first time a form sends a field that is not a column.
Fix shape:

  import { onlyColumns } from './middleware/table-columns.js';
  const { fields, ignored } = onlyColumns('the_table', req.body);
  if (ignored.length) console.log('[endpoint] ignored:', ignored.join(', '));
`);

if (MAX !== null && findings.length > MAX) {
  console.error(`Over budget: ${findings.length} unfiltered writes, limit is ${MAX}.`);
  process.exit(1);
}
