/**
 * Find data couples can write that nobody at the venue can read.
 *
 * The alignment worksheets were the case that prompted this. Sixteen couples
 * answered questions about their priorities, their guest rules and who was
 * paying, and the only code that ever read worksheet_priorities,
 * worksheet_guest_rules or worksheet_budget_alignment was the couple's own
 * form. Three columns, filled in for months, that the venue could not see.
 *
 * Nothing failed. No error, no empty state, no clue. A feature that quietly
 * goes one way looks identical to a feature nobody has used, which is why it
 * survived so long and why it wants a test rather than vigilance.
 *
 * ## How it decides
 *
 * Matching on table names does not work: the browser talks in API paths, and
 * the admin page renders components that live in src/components rather than
 * under an admin folder. A first version of this check did match on table names
 * and reported ten failures, nine of which were fine. A noisy audit gets
 * ignored, which is the fault it is meant to catch.
 *
 * So it resolves what the admin pages actually pull in, one import deep, and
 * asks whether any of those files calls the endpoint that reads the data.
 *
 * Run: node scripts/audit-unsurfaced.mjs
 * Exits non-zero when a couple can fill something in that the venue cannot see.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, resolve } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** The venue's own screens. Anything they import counts as venue-visible. */
const ADMIN_ENTRIES = [
  'src/pages/Admin.jsx',
  'src/pages/admin/AdminWeddingProfile.jsx',
  'src/pages/admin/AdminWeddingList.jsx',
  'src/pages/admin/WeddingCompleteness.jsx',
];

/**
 * One row per thing a couple can fill in.
 *
 * `endpoint` is what the couple's side saves through, which is also what a
 * venue screen would have to call to read it back. Add a row when you add a
 * couple-facing form. The list is the contract, and it is deliberately manual:
 * a form nobody remembered to add here is exactly the form that goes unread.
 */
const SURFACES = [
  { name: 'Alignment worksheets', endpoint: '/api/worksheets' },
  { name: 'Table setup', endpoint: '/api/tables' },
  { name: 'Floor plan', endpoint: '/api/table-layouts' },
  { name: 'Ceremony order', endpoint: '/api/ceremony-order' },
  { name: 'Borrow catalogue picks', endpoint: '/api/borrow-selections' },
  { name: 'Inspiration gallery', endpoint: '/api/inspo' },
  { name: 'Wedding party', endpoint: '/api/wedding-party' },
  { name: 'Bedroom assignments', endpoint: '/api/bedrooms' },
  { name: 'Shuttle schedule', endpoint: '/api/shuttle' },
  { name: 'Timeline', endpoint: '/api/timeline' },
  { name: 'Allergy registry', endpoint: '/api/allergies' },
  { name: 'Guest list', endpoint: '/api/guests' },
  { name: 'Planning checklist', endpoint: '/api/checklist' },
  { name: 'Open questions', endpoint: '/api/uncertain-questions' },
];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const all = new Map();
for (const f of walk(join(ROOT, 'src'))) {
  try { all.set(relative(ROOT, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')); } catch { /* skip */ }
}

/** Resolve a relative import to a real file we hold. */
function resolveImport(fromPath, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(join(ROOT, fromPath)), spec);
  const rel = relative(ROOT, base).replace(/\\/g, '/');
  for (const cand of [rel, `${rel}.jsx`, `${rel}.js`, `${rel}/index.jsx`, `${rel}/index.js`]) {
    if (all.has(cand)) return cand;
  }
  return null;
}

// The admin screens, plus everything they import. One level is enough: a
// component that renders a section is where the fetch lives.
const visible = new Set();
for (const entry of ADMIN_ENTRIES) {
  if (!all.has(entry)) continue;
  visible.add(entry);
  const text = all.get(entry);
  for (const m of text.matchAll(/^\s*import\s+[^'"]*from\s+['"]([^'"]+)['"]/gm)) {
    const target = resolveImport(entry, m[1]);
    if (target) visible.add(target);
  }
}

const venueText = [...visible].map(p => all.get(p) || '').join('\n');
const coupleText = [...all.entries()]
  .filter(([p]) => !visible.has(p))
  .map(([, t]) => t)
  .join('\n');

const problems = [];
for (const s of SURFACES) {
  const usedAtAll = venueText.includes(s.endpoint) || coupleText.includes(s.endpoint);
  if (!usedAtAll) continue;                       // not built, not a fault
  if (!venueText.includes(s.endpoint)) problems.push(s);
}

console.log(`Admin screens pull in ${visible.size} files. Checked ${SURFACES.length} couple-facing surfaces.\n`);

if (!problems.length) {
  console.log('  Every surface a couple can fill in has somewhere the venue reads it.');
  process.exit(0);
}

console.log('  Couples can fill these in, and no venue screen reads them:\n');
for (const p of problems) {
  console.log(`  ${p.name.padEnd(28)} ${p.endpoint}`);
}
console.log('\nFilling one in produces no signal on the venue side, which is');
console.log('indistinguishable from nobody having filled it in.');
console.log('Either give it somewhere to be read, or stop asking couples for it.');
process.exit(1);
