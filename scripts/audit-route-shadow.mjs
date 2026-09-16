#!/usr/bin/env node
// Finds Express routes that can never be reached because an earlier route
// with a parameter on the same method already matches their path.
//
//   app.delete('/api/guests/:id', ...)     // declared first
//   app.delete('/api/guests/all', ...)     // never reached: "all" is an :id
//
// Express matches in declaration order, so the literal route must come first.
// This shape reached production on 15 Sep 2026 and the smoke test caught it
// after deploy; this catches it before. Static, no server needed.
//
//   node scripts/audit-route-shadow.mjs [--max N] [file]
import fs from 'fs';

const args = process.argv.slice(2);
const maxIdx = args.indexOf('--max');
const max = maxIdx > -1 ? Number(args[maxIdx + 1]) : 0;
const file = args.find(a => !a.startsWith('--') && a !== String(max)) || 'server/index.js';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const routes = [];
const re = /^\s*app\.(get|post|put|patch|delete|all)\(\s*['"`]([^'"`]+)['"`]/;
lines.forEach((l, i) => { const m = l.match(re); if (m) routes.push({ method: m[1], path: m[2], line: i + 1 }); });

// Does `pattern` (may contain :params) match the literal `path`?
function matches(pattern, path) {
  const a = pattern.split('/'), b = path.split('/');
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg.startsWith(':') ? b[i].length > 0 : seg === b[i]);
}

const shadowed = [];
for (let j = 0; j < routes.length; j++) {
  const later = routes[j];
  if (later.path.includes(':')) continue;             // only literal routes can be shadowed this way
  for (let i = 0; i < j; i++) {
    const earlier = routes[i];
    if (earlier.method !== later.method && earlier.method !== 'all') continue;
    if (!earlier.path.includes(':')) continue;
    if (matches(earlier.path, later.path)) {
      shadowed.push({ later, earlier });
      break;
    }
  }
}

console.log(`Routes shadowed by an earlier parameter route: ${shadowed.length} (budget ${max})`);
for (const { later, earlier } of shadowed) {
  console.log(`  ${file}:${later.line}  ${later.method.toUpperCase()} ${later.path}  is never reached; ${earlier.method.toUpperCase()} ${earlier.path} at line ${earlier.line} matches it first`);
}
if (shadowed.length > max) {
  console.log('  Move the literal route above the parameter route.');
  process.exit(1);
}
