/**
 * Regenerates the COERCE_TO_NULL list in server/middleware/coerce.js from the
 * live PostgREST schema spec. Run after any migration that adds numeric,
 * boolean, date or time columns:
 *
 *   node scripts/generate-coerce-list.mjs
 *
 * Prints the new list and the collision set. It does not write the file for
 * you — paste the output in, so a schema change is always a reviewed diff.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`Schema fetch failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const spec = await res.json();

const RISKY = /^(integer|bigint|smallint|numeric|double precision|real|boolean|date|time)/i;
const TEXTUAL = /^(text|character|varchar|uuid|json)/i;

const risky = new Set();
const textual = new Set();

for (const def of Object.values(spec.definitions || {})) {
  for (const [col, meta] of Object.entries(def.properties || {})) {
    const fmt = meta.format || '';
    if (RISKY.test(fmt)) risky.add(col);
    else if (TEXTUAL.test(fmt)) textual.add(col);
  }
}

// A name that is numeric in one table and text in another can legitimately
// receive "", so it must not be coerced.
const collisions = [...risky].filter((c) => textual.has(c)).sort();
const safe = [...risky].filter((c) => !textual.has(c)).sort();

console.log(`Excluded ${collisions.length} colliding name(s): ${collisions.join(', ') || 'none'}`);
console.log(`\nCOERCE_TO_NULL — ${safe.length} columns:\n`);
console.log(safe.map((c) => `  '${c}',`).join('\n'));
