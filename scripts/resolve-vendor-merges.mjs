/**
 * Answer the merge questions that evidence can answer.
 *
 * The import left 42 pairs of vendor names it would not decide between. Ten of
 * them are not really questions: the two records share an actual email address
 * or phone number. "Yiselle Santos" and "Yisell Santos" both hold
 * yisell@yisellsantosmakeup.com. That is not a resemblance between two names,
 * it is the same business.
 *
 * So those get merged, and the other thirty-two are left alone for a person,
 * because they turn on things a script cannot know: whether Briarley Images
 * and Rachele Patterson are a studio and its owner or two photographers,
 * whether Gateau Warrenton is the same Gateau.
 *
 * Nothing is merged on a name alone. The evidence has to be a contact detail
 * the two records already share, and the run prints which one it was.
 *
 *   node scripts/resolve-vendor-merges.mjs                 # dry run
 *   node scripts/resolve-vendor-merges.mjs --apply
 *
 * Merges go through the API rather than the tables, so the alias-keeping,
 * booking-repointing and category-union logic stays in one place.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const API = process.env.RIXEY_API_URL || 'https://rixeyapp-production.up.railway.app';
const TEST_ADMIN_EMAIL = 'test-admin@rixey.invalid';
const TEST_ADMIN_PASSWORD = 'RixeyAdmin2029!';

const APPLY = process.argv.includes('--apply');

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

async function all(table, columns, tweak = q => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tweak(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const { data: session, error: signInError } = await anon.auth.signInWithPassword({
  email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD,
});
if (signInError) {
  console.error(`Could not sign in as ${TEST_ADMIN_EMAIL}: ${signInError.message}`);
  console.error('Run scripts/seed_test_users.mjs if the account is missing.');
  process.exit(1);
}
const token = session.session.access_token;

// ── gather ───────────────────────────────────────────────────────────────────

const questions = await all('vendor_merge_review', '*', q => q.eq('status', 'open'));
const vendors = await all('vendors', '*');
const evidence = await all('vendor_contact_evidence', '*');
const bookings = await all('vendor_checklist', 'vendor_id, wedding_id');

const byId = new Map(vendors.map(v => [v.id, v]));
const evBy = new Map();
for (const e of evidence) {
  if (e.dismissed) continue;
  if (!evBy.has(e.vendor_id)) evBy.set(e.vendor_id, []);
  evBy.get(e.vendor_id).push(e);
}
const weddingsFor = new Map();
for (const b of bookings) {
  if (!b.vendor_id) continue;
  if (!weddingsFor.has(b.vendor_id)) weddingsFor.set(b.vendor_id, new Set());
  weddingsFor.get(b.vendor_id).add(b.wedding_id);
}

// A contact detail is only evidence of sameness if it identifies the business.
// A shared address would not do: two caterers can work out of one kitchen.
const IDENTIFYING = new Set(['email', 'phone', 'website']);
const detailsOf = id => (evBy.get(id) || [])
  .filter(e => IDENTIFYING.has(e.kind))
  .map(e => ({ key: `${e.kind}:${e.value_key}`, kind: e.kind, value: e.value }));

/**
 * Which of the two should survive, and why. Printed rather than decided
 * silently, because the surviving name is what every couple then sees.
 */
function chooseSurvivor(a, b, shared) {
  const weddings = v => weddingsFor.get(v.id)?.size || 0;
  const profile = v => Boolean(v.bio || (v.photos || []).length);

  if (a.is_recommended !== b.is_recommended) {
    const win = a.is_recommended ? a : b;
    return { keep: win, drop: win === a ? b : a, why: 'the one you recommend to couples' };
  }
  if (profile(a) !== profile(b)) {
    const win = profile(a) ? a : b;
    return { keep: win, drop: win === a ? b : a, why: 'the one with a profile they wrote themselves' };
  }
  if (weddings(a) !== weddings(b)) {
    const win = weddings(a) > weddings(b) ? a : b;
    return { keep: win, drop: win === a ? b : a, why: `the one with more weddings (${weddings(win)})` };
  }

  const own = ownSpelling(a, b, shared);
  if (own) return { keep: own, drop: own === a ? b : a, why: 'the spelling they use in their own address' };

  const win = a.name.length >= b.name.length ? a : b;
  return { keep: win, drop: win === a ? b : a, why: 'the fuller name' };
}

const flat = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Which of the two names the vendor writes in their own email or web address.
 * That is what separates Yisell from Yiselle: one of those is a typo somebody
 * at Rixey made, and the other is on her own domain.
 */
function ownSpelling(a, b, shared) {
  const domainText = shared.filter(s => s.kind !== 'phone').map(s => s.value.toLowerCase()).join(' ');
  if (!domainText) return null;
  const aIn = domainText.includes(flat(a.name));
  const bIn = domainText.includes(flat(b.name));
  if (aIn === bIn) return null;
  return aIn ? a : b;
}

const decided = [];
const forAHuman = [];

for (const q of questions) {
  const a = byId.get(q.vendor_id);
  const b = byId.get(q.candidate_id);
  if (!a || !b || a.merged_into || b.merged_into) continue;

  const da = detailsOf(a.id);
  const db_ = detailsOf(b.id);
  const shared = da.filter(x => db_.some(y => y.key === x.key));

  if (shared.length) {
    const choice = chooseSurvivor(a, b, shared);
    // Being recommended has to win, because the merge does not carry a
    // recommendation across and dropping the recommended row would take that
    // vendor out of the directory. But it says nothing about spelling. Where
    // the row we are keeping is the one with the typo in it, keep the row and
    // correct the name.
    const own = ownSpelling(a, b, shared);
    const rename = own && own !== choice.keep && flat(own.name) !== flat(choice.keep.name)
      ? own.name
      : null;
    decided.push({ q, ...choice, a, b, shared, rename });
  } else {
    forAHuman.push({
      q, a, b,
      both: da.length > 0 && db_.length > 0,
    });
  }
}

// ── report ───────────────────────────────────────────────────────────────────

console.log(`${questions.length} open questions\n`);
console.log(`${decided.length} answered by a contact detail the two records already share:\n`);
for (const d of decided) {
  console.log(`  keep "${d.keep.name}"  <-  "${d.drop.name}"`);
  console.log(`      shares ${d.shared.map(s => `${s.kind} ${s.value}`).join(', ')}`);
  console.log(`      kept because it is ${d.why}`);
  if (d.rename) console.log(`      and renamed to "${d.rename}", which is the spelling on their own address`);
}

const leaning = forAHuman.filter(f => f.both);
console.log(`\n${forAHuman.length} left for you.`);
if (leaning.length) {
  console.log(`  ${leaning.length} of those have contact details on BOTH sides and share none, which leans towards separate:`);
  leaning.forEach(f => console.log(`    "${f.a.name}"  vs  "${f.b.name}"`));
}
console.log(`  ${forAHuman.length - leaning.length} have too little on file to say either way.`);

if (!APPLY) {
  console.log('\nDry run. Nothing merged. Add --apply.');
  process.exit(0);
}

// ── merge ────────────────────────────────────────────────────────────────────

let done = 0, failed = 0;
for (const d of decided) {
  const res = await fetch(`${API}/api/venue-vendors/${d.keep.id}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ candidate_id: d.drop.id }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`  FAILED ${d.keep.name} <- ${d.drop.name}: ${body.error || res.status}`);
    failed++;
    // A run of failures is one broken thing, not ten bad merges.
    if (failed >= 3 && done === 0) {
      console.error('\nThree failures and nothing merged. Stopping.');
      break;
    }
    continue;
  }
  console.log(`  merged "${d.drop.name}" into "${d.keep.name}"`);
  done++;

  if (d.rename) {
    // The merge put the dropped spelling into aliases, and the rename then
    // makes it the name. An alias identical to the name is noise on the
    // screen, so drop it and keep the one being replaced instead.
    const { data: after, error: readErr } = await db
      .from('vendors').select('aliases').eq('id', d.keep.id).single();
    if (readErr) console.error(`      could not read aliases back: ${readErr.message}`);
    const aliases = [...new Set([...(after?.aliases || []), d.keep.name])]
      .filter(n => flat(n) !== flat(d.rename));

    const r = await fetch(`${API}/api/venue-vendors/${d.keep.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: d.rename, aliases }),
    });
    if (r.ok) console.log(`      renamed to "${d.rename}", keeping "${d.keep.name}" as an alias`);
    else console.error(`      could not rename: ${r.status}`);
  }
}

console.log(`\n${done} merged, ${failed} failed.`);
console.log('Nothing is deleted: the merged row keeps its portal link and points at the survivor.');
console.log(`${forAHuman.length} questions still open in the Vendors screen.`);
