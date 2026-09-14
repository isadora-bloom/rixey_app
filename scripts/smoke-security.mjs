#!/usr/bin/env node
/**
 * Security smoke test against a deployed API, with its own throwaway fixtures.
 *
 * docs/security-smoke.md is the human version. This one needs no tokens
 * pasted from a browser: it creates two couples on two weddings with random
 * passwords, signs them in, runs every check, and deletes everything again in
 * a finally block. Nothing it creates matches a real person.
 *
 *   node scripts/smoke-security.mjs                # against production
 *   node scripts/smoke-security.mjs http://localhost:3001
 *
 * Exit 1 if any check gets the wrong status.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import fs from 'fs';

const API = (process.argv[2] || 'https://rixeyapp-production.up.railway.app').replace(/\/$/, '');
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const URL_ = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) { console.error('Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const stamp = Date.now();
const fx = { users: [], weddings: [], guests: [], photos: [] };
const results = [];

async function must(p, what) { const { data, error } = await p; if (error) throw new Error(`${what}: ${error.message}`); return data; }

async function makeCouple(label) {
  const email = `smoke-${label}-${stamp}@rixey-test.invalid`;
  const password = randomBytes(18).toString('base64url');
  const u = await must(admin.auth.admin.createUser({ email, password, email_confirm: true }), 'createUser');
  fx.users.push(u.user.id);
  const w = await must(admin.from('weddings').insert({
    couple_names: `Smoke & Test ${label.toUpperCase()}`, wedding_date: '2031-01-01',
    event_code: `SMK${label.toUpperCase()}${String(stamp).slice(-4)}`,
  }).select('id').single(), 'wedding insert');
  fx.weddings.push(w.id);
  await must(admin.from('profiles').upsert({ id: u.user.id, email, wedding_id: w.id, role: 'couple', name: `Smoke ${label}` }), 'profile upsert');
  const g = await must(admin.from('wedding_guests').insert({ wedding_id: w.id, first_name: 'Smoke', last_name: label }).select('id').single(), 'guest insert');
  fx.guests.push(g.id);
  const p = await must(admin.from('wedding_photos').insert({ wedding_id: w.id, url: 'https://example.invalid/smoke.jpg', storage_path: `smoke/${stamp}-${label}.jpg` }).select('id').single(), 'photo insert');
  fx.photos.push(p.id);
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const s = await must(anon.auth.signInWithPassword({ email, password }), 'sign in');
  return { id: u.user.id, wedding: w.id, guest: g.id, photo: p.id, token: s.session.access_token };
}

async function check(name, expect, url, { method = 'GET', token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  let status;
  try {
    const res = await fetch(`${API}${url}`, { method, headers, body });
    status = res.status;
  } catch (err) { status = `ERR ${err.message}`; }
  const ok = Array.isArray(expect) ? expect.includes(status) : status === expect;
  results.push({ name, expect, status, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(status).padEnd(4)} expected ${Array.isArray(expect) ? expect.join('/') : expect}  ${name}`);
}

async function cleanup() {
  const ids = fx.users;
  if (ids.length) await admin.from('messages').delete().in('user_id', ids);
  if (fx.weddings.length) {
    for (const t of ['wedding_guests', 'wedding_photos', 'activity_log', 'onboarding_progress', 'notifications', 'usage_logs']) {
      await admin.from(t).delete().in('wedding_id', fx.weddings);
    }
    await admin.from('profiles').update({ wedding_id: null }).in('wedding_id', fx.weddings);
    await admin.from('weddings').delete().in('id', fx.weddings);
  }
  if (ids.length) {
    await admin.from('profiles').delete().in('id', ids);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
}

try {
  const health = await fetch(`${API}/api/health`).then(r => r.json()).catch(() => null);
  console.log(`API ${API} commit ${health?.commit || '?'} node ${health?.node || '?'}\n`);

  const A = await makeCouple('a');
  const B = await makeCouple('b');

  // Item 2: Sage endpoints need a token; a couple cannot write into another thread.
  await check('chat without a token', 401, '/api/chat', { method: 'POST', json: { message: 'what vendors have we booked', userId: B.id } });
  await check('welcome without a token', 401, '/api/welcome', { method: 'POST', json: {} });
  await check('sage-messages without a token', 401, '/api/sage-messages', { method: 'POST', json: { user_id: B.id, content: 'forged', sender: 'sage' } });
  await check('sage-messages into another thread', 403, '/api/sage-messages', { method: 'POST', token: A.token, json: { user_id: B.id, content: 'forged', sender: 'sage' } });
  await check('sage-messages into own thread', [200, 201], '/api/sage-messages', { method: 'POST', token: A.token, json: { content: 'smoke test', sender: 'user' } });

  // Item 3a: brand assets.
  await check('manor-assets GET stays public', 200, '/api/manor-assets');
  const fd = new FormData(); fd.append('title', 'smoke'); fd.append('file', new Blob(['x'], { type: 'image/png' }), 'x.png');
  await check('manor-assets POST without a token', 401, '/api/manor-assets', { method: 'POST', form: fd });
  await check('manor-assets DELETE as a couple', 403, `/api/manor-assets/${A.photo}`, { method: 'DELETE', token: A.token });

  // Items 3b and 4: the row decides the wedding.
  await check('edit another couple\'s guest, naming own wedding in the query', 403, `/api/guests/${B.guest}?weddingId=${A.wedding}`, { method: 'PUT', token: A.token, json: { first_name: 'smoke' } });
  await check('delete another couple\'s guest, naming own wedding in the body', 403, `/api/guests/${B.guest}`, { method: 'DELETE', token: A.token, json: { wedding_id: A.wedding } });
  await check('delete another couple\'s photo', 403, `/api/wedding-photos/${B.photo}`, { method: 'DELETE', token: A.token });
  await check('list own guests still works', 200, `/api/guests/${A.wedding}`, { token: A.token });
  await check('edit own guest still works', 200, `/api/guests/${A.guest}`, { method: 'PUT', token: A.token, json: { first_name: 'Smoke' } });
  await check('list another couple\'s guests', 403, `/api/guests/${B.wedding}`, { token: A.token });

  // Item 3c: multipart routes.
  const fd2 = new FormData(); fd2.append('weddingId', B.wedding); fd2.append('action', 'parse'); fd2.append('file', new Blob(['a,b'], { type: 'text/csv' }), 'x.csv');
  await check('seating import without a token', 401, '/api/seating/import', { method: 'POST', form: fd2 });
  const fd3 = new FormData(); fd3.append('weddingId', B.wedding); fd3.append('action', 'parse'); fd3.append('file', new Blob(['a,b'], { type: 'text/csv' }), 'x.csv');
  await check('seating import into another wedding', 403, '/api/seating/import', { method: 'POST', token: A.token, form: fd3 });

  // Item 3d: SSRF.
  await check('extract-url without a token', 401, '/api/bar-recipes/extract-url', { method: 'POST', json: { url: 'http://169.254.169.254/latest/meta-data/' } });
  await check('extract-url to a private address', [400, 403], '/api/bar-recipes/extract-url', { method: 'POST', token: A.token, json: { url: 'http://169.254.169.254/latest/meta-data/' } });

  // Parity routes added 14 Sep: member-scoped by the path uuid.
  await check('own documents list', 200, `/api/documents/${A.wedding}`, { token: A.token });
  await check('another couple\'s documents', 403, `/api/documents/${B.wedding}`, { token: A.token });
  await check('documents without a token', [401, 403], `/api/documents/${B.wedding}`);
  await check('own completeness', 200, `/api/completeness/${A.wedding}`, { token: A.token });
  await check('another couple\'s completeness', 403, `/api/completeness/${B.wedding}`, { token: A.token });

  // Item 23: debug route gated.
  await check('gmail-callback-debug without a token', [401, 403], '/api/gmail-callback-debug');
  await check('health stays public', 200, '/api/health');
} catch (err) {
  console.error('\nsetup failed:', err.message);
  results.push({ name: 'setup', ok: false });
} finally {
  await cleanup().catch(err => console.error('cleanup failed:', err.message));
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
