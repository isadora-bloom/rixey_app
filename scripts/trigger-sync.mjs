/**
 * Drive a sync from the command line, through the real endpoint.
 *
 * The sync buttons live in the admin panel, which is the right place for them.
 * This exists for the one-off backfills where somebody needs to run a job,
 * watch it, and read the job row afterwards without sitting on a screen.
 *
 * Signs in as the seeded test admin from scripts/seed_test_users.mjs rather
 * than as a real person, so nobody's session is disturbed.
 *
 *   node scripts/trigger-sync.mjs quo
 *   node scripts/trigger-sync.mjs quo-backfill --limit 5
 *   node scripts/trigger-sync.mjs --watch-only
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const API = process.env.RIXEY_API_URL || 'https://rixeyapp-production.up.railway.app';
const TEST_ADMIN_EMAIL = 'test-admin@rixey.invalid';
const TEST_ADMIN_PASSWORD = 'RixeyAdmin2029!';

const args = process.argv.slice(2);
const kind = args.find(a => !a.startsWith('--'));
const limitIdx = args.indexOf('--limit');
const limit = limitIdx > -1 ? Number(args[limitIdx + 1]) : null;
const watchOnly = args.includes('--watch-only');

const ROUTES = {
  quo: '/api/quo/sync',
  'quo-backfill': '/api/quo/backfill-extraction',
  zoom: '/api/zoom/sync',
  gmail: '/api/gmail/sync',
};

const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const health = await fetch(`${API}/api/health`).then(r => r.json());
console.log(`server: ${API}`);
console.log(`  commit ${health.commit}  node ${health.node}  nodeOk ${health.nodeOk}\n`);

const { data: session, error: signInError } = await anon.auth.signInWithPassword({
  email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD,
});
if (signInError) {
  console.error(`Could not sign in as ${TEST_ADMIN_EMAIL}: ${signInError.message}`);
  console.error('Run scripts/seed_test_users.mjs if the account is missing.');
  process.exit(1);
}
const token = session.session.access_token;

async function showJob(id) {
  const { data, error } = await admin.from('sync_jobs').select('*').eq('id', id).single();
  if (error) { console.log(`  (could not read the job row: ${error.message})`); return null; }
  if (!data) return null;
  const pct = data.total ? ` (${data.processed}/${data.total})` : '';
  console.log(`  ${data.status}${pct}  matched=${data.matched}  failed=${data.failed}`);
  if (data.last_error) console.log(`  error: ${data.last_error}`);
  return data;
}

if (watchOnly) {
  const { data, error } = await admin.from('sync_jobs').select('*')
    .order('started_at', { ascending: false }).limit(10);
  if (error) { console.error(`Could not read the job list: ${error.message}`); process.exit(1); }
  for (const j of data) {
    console.log(`${j.started_at}  ${j.kind.padEnd(14)} ${j.status.padEnd(9)} ${j.processed}/${j.total} matched=${j.matched} failed=${j.failed}`);
    if (j.detail && Object.keys(j.detail).length) console.log(`  ${JSON.stringify(j.detail)}`);
    if (j.last_error) console.log(`  error: ${j.last_error}`);
  }
  process.exit(0);
}

if (!ROUTES[kind]) {
  console.error(`Unknown sync "${kind}". One of: ${Object.keys(ROUTES).join(', ')}`);
  process.exit(1);
}

const payload = limit ? { limit } : {};
console.log(`POST ${ROUTES[kind]} ${JSON.stringify(payload)}`);

const res = await fetch(`${API}${ROUTES[kind]}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
// Railway answers an unknown route with an HTML 404, and JSON.parse on that
// throws a syntax error that reads like a bug in this script rather than "the
// deploy has not landed yet". Read the text first and say which it is.
const raw = await res.text();
let started;
try {
  started = JSON.parse(raw);
} catch {
  console.error(`${res.status} and not JSON. The route is probably not deployed yet.`);
  console.error(`Server is on commit ${health.commit}; check that is the one that added it.`);
  console.error(raw.slice(0, 200).replace(/\s+/g, ' '));
  process.exit(1);
}
if (!res.ok) {
  console.error(`${res.status}: ${JSON.stringify(started)}`);
  process.exit(1);
}
console.log(`job ${started.jobId} started\n`);

// Poll the job row rather than guessing when it is done. A job that dies is
// reaped on the next boot, so "running" for ever is itself informative.
let last = null;
for (let i = 0; i < 240; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const job = await showJob(started.jobId);
  if (!job) continue;
  last = job;
  if (job.status !== 'running') break;
}

console.log('\nfinal:');
console.log(JSON.stringify(last, null, 2));
