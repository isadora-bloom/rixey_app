/**
 * Does every API path the frontend calls actually exist on the server?
 *
 * The same failure shape as the schema audits: something is asked for, nothing
 * is there, the error is swallowed or shows as an empty list, and the feature
 * appears to work. admin_notifications was exactly this one level down — the
 * route existed but wrote to a table that did not.
 *
 *   node scripts/audit-api-routes.mjs
 *
 * Read-only, no network, no database.
 */

import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

// ---- what the server serves -------------------------------------------------
const serverFiles = [];
const walkServer = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walkServer(p);
    else if (/\.(js|mjs)$/.test(e)) serverFiles.push(p);
  }
};
walkServer('server');

const routes = [];
for (const f of serverFiles) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/app\.(get|post|put|patch|delete|use)\(\s*['"`]([^'"`]+)['"`]/g)) {
    routes.push({ method: m[1].toUpperCase(), path: m[2] });
  }
}

/** Express path to a matcher, treating :params and app.use prefixes loosely. */
const toRegex = (p, isUse) => {
  const body = p.replace(/:[a-zA-Z0-9_]+/g, '[^/]+').replace(/\//g, '\\/');
  return new RegExp(`^${body}${isUse ? '' : '\\/?$'}`);
};
const matchers = routes.map(r => ({ ...r, re: toRegex(r.path, r.method === 'USE') }));

// ---- what the frontend calls ------------------------------------------------
const srcFiles = [];
const walkSrc = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walkSrc(p);
    else if (/\.(js|jsx)$/.test(e)) srcFiles.push(p);
  }
};
walkSrc('src');

const calls = [];
for (const f of srcFiles) {
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n');
  // `${API_URL}/api/whatever/...` — template literal, so ${...} becomes a wildcard
  for (const m of text.matchAll(/\$\{API_URL\}(\/api\/[^`'"?\s)]*)/g)) {
    const lineNo = text.slice(0, m.index).split('\n').length;
    const path = m[1]
      .replace(/\$\{[^}]*\}/g, ':param')
      .replace(/\/+$/, '');
    calls.push({ file: f.replace(/\\/g, '/'), line: lineNo, path, src: (lines[lineNo - 1] || '').trim().slice(0, 90) });
  }
}

const unmatched = [];
for (const c of calls) {
  const probe = c.path.replace(/:param/g, 'X');
  if (!matchers.some(m => m.re.test(probe))) unmatched.push(c);
}

console.log(`${routes.length} server routes, ${calls.length} frontend call sites.\n`);
if (!unmatched.length) {
  console.log('Every path the frontend calls has a matching route.');
  process.exit(0);
}

console.log(`NO MATCHING SERVER ROUTE (${unmatched.length}):`);
const grouped = {};
for (const u of unmatched) (grouped[u.path] ||= []).push(u);
for (const [path, list] of Object.entries(grouped)) {
  console.log(`\n  ${path}`);
  for (const u of list) console.log(`     ${u.file}:${u.line}  ${u.src}`);
}
console.log(`\n${Object.keys(grouped).length} distinct path(s) with no route.`);
process.exit(1);
