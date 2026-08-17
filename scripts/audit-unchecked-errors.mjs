/**
 * Find Supabase queries that take the data and throw the error away.
 *
 * This is the bug of this codebase. Not one of them, the one. The pattern is
 *
 *     const { data } = await supabase.from('x').select('y')
 *
 * where `error` is never destructured, so a query that failed is
 * indistinguishable from a query that found nothing. What that has cost, all
 * found in the fortnight to 17 August:
 *
 *   - seven features that had never once worked
 *   - the archive button, the call transcripts, the worksheets
 *   - 216 duplicate SMS notes and 992 duplicate email notes, because the read
 *     of "what have I already imported" came back short and nobody was told
 *
 * A short read is the dangerous case and the reason a plain `|| []` is not a
 * fix. PostgREST answers a capped or failed query with something that looks
 * exactly like a small result set.
 *
 * ## What it reports
 *
 * Every `const { ... } = await` destructure of a supabase call that does not
 * take `error`, ranked by how much traffic the surrounding route sees, because
 * changing seventy call sites at once is its own outage and these want doing in
 * tranches.
 *
 * A query is NOT flagged when the destructure includes `error`, or when the
 * call is awaited without destructuring at all (`await supabase...` as a
 * statement), which is its own smell but a different one.
 *
 *   node scripts/audit-unchecked-errors.mjs            # summary
 *   node scripts/audit-unchecked-errors.mjs --list     # every site
 *   node scripts/audit-unchecked-errors.mjs --max 40   # fail over a budget
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LIST = process.argv.includes('--list');
const maxIdx = process.argv.indexOf('--max');
const MAX = maxIdx > -1 ? Number(process.argv[maxIdx + 1]) : null;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'test-results', 'backups', 'playwright-report']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|mjs|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Which read is riskiest, judged by what the answer is used FOR.
 *
 * The first version of this ranked on table and variable names and called
 * sixty-three Sage context reads HIGH. They are not: if the vendor list fails
 * to load, Sage answers with less to go on, which is a worse answer and not a
 * wrong write. A noisy audit gets ignored, which is the fault it exists to
 * catch.
 *
 * The distinction that actually matters is whether the result gates a write. An
 * empty result then means "nothing is there yet", so a failed read writes a
 * duplicate, restarts a version count, or re-initialises a checklist. That is
 * how every real incident in this codebase has gone.
 */
function severityFor(line, context, ahead) {
  const c = `${line} ${context}`.toLowerCase();
  const gatesWrite = /\.(insert|update|upsert|delete)\s*\(/.test(ahead);

  if (gatesWrite) {
    if (/processed|already|existing|dedup|seen|prior|clash|running|count/.test(c)) {
      return { rank: 0, why: 'gates a write — an empty answer writes it again' };
    }
    return { rank: 1, why: 'a write happens nearby and this decides its shape' };
  }
  if (/token|auth|credential|is_admin/.test(c)) {
    return { rank: 1, why: 'auth: a swallowed failure reads as "no access"' };
  }
  if (/count|stats|summary|dashboard|highlight/.test(c)) {
    return { rank: 3, why: 'a failed count renders as zero' };
  }
  return { rank: 2, why: 'context or display: a failed read renders as empty' };
}

const RANK_LABEL = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const findings = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // A destructuring await. The supabase call may run onto later lines, so the
    // next few lines are the context for both the check and the ranking.
    const m = line.match(/const\s*\{([^}]*)\}\s*=\s*await\s/);
    if (!m) continue;

    const window = lines.slice(i, i + 8).join(' ');
    // Only supabase calls. `await fetch`, `await gmail.users...` and the rest
    // have their own error handling and are not this bug.
    if (!/supabase|supabaseAdmin|\.from\(|\.rpc\(|\.storage\./.test(window)) continue;

    const bound = m[1];
    if (/\berror\b/.test(bound)) continue;        // handled
    if (!/\bdata\b|\bcount\b/.test(bound)) continue; // not a read

    // How the answer is used: a write within the next stretch of lines means
    // this read is gating it.
    const ahead = lines.slice(i, i + 25).join(' ');
    const { rank, why } = severityFor(line, window, ahead);
    findings.push({
      file: rel,
      line: i + 1,
      rank,
      why,
      code: line.trim().slice(0, 120),
    });
  }
}

findings.sort((a, b) => a.rank - b.rank || a.file.localeCompare(b.file) || a.line - b.line);

const byFile = {};
for (const f of findings) byFile[f.file] = (byFile[f.file] || 0) + 1;
const byRank = {};
for (const f of findings) byRank[RANK_LABEL[f.rank]] = (byRank[RANK_LABEL[f.rank]] || 0) + 1;

console.log(`Supabase reads that ignore the error: ${findings.length}\n`);
console.log('by severity:');
for (const label of RANK_LABEL) {
  if (byRank[label]) console.log(`  ${label.padEnd(9)} ${byRank[label]}`);
}
console.log('\nby file:');
for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${f}`);
}

if (LIST) {
  let current = null;
  console.log('');
  for (const f of findings) {
    if (f.rank !== current) {
      current = f.rank;
      console.log(`\n=== ${RANK_LABEL[f.rank]} — ${f.why} ===\n`);
    }
    console.log(`${f.file}:${f.line}`);
    console.log(`    ${f.code}`);
  }
} else {
  console.log('\nRun with --list to see every site.');
}

if (MAX !== null && findings.length > MAX) {
  console.error(`\nOver budget: ${findings.length} unchecked reads, limit is ${MAX}.`);
  process.exit(1);
}
