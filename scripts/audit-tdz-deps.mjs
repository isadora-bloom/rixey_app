#!/usr/bin/env node
// Finds hook dependency arrays that name a const/function declared LATER in
// the same file. Those arrays are evaluated during render, so this throws
// "Cannot access X before initialization" in a built bundle.
import fs from 'fs';
import path from 'path';
const args = process.argv.slice(2);
const maxIdx = args.indexOf('--max');
const max = maxIdx > -1 ? Number(args[maxIdx + 1]) : 0;
const root = args.find(a => !a.startsWith('--') && a !== String(max)) || 'src';
const files = [];
const walk = d => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.jsx?$/.test(n)) files.push(p); } };
walk(root);
let total = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const declLine = new Map();
  lines.forEach((l, i) => {
    const m = l.match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/) || l.match(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m && !declLine.has(m[1])) declLine.set(m[1], i + 1);
  });
  lines.forEach((l, i) => {
    const m = l.match(/\}\s*,\s*\[([^\]]*)\]\s*\)/);
    if (!m) return;
    const deps = m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => s.split(/[.?[]/)[0]);
    for (const d of deps) {
      const at = declLine.get(d);
      if (at && at > i + 1) { total++; console.log(`${f.replace(/\\/g, '/')}:${i + 1}  dep '${d}' declared at line ${at}`); }
    }
  });
}
console.log(`Hook dependency arrays naming a later-declared identifier: ${total} (budget ${max})`);
if (total > max) { console.log('  Each of these throws "Cannot access X before initialization" in the built bundle (BarPlanner, 14 Sep 2026). Move the hook below the declaration.'); process.exit(1); }
