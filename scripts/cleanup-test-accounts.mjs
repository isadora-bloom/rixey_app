#!/usr/bin/env node
/**
 * Remove the test accounts and Playwright leftovers from production.
 *
 * The 14 Sep 2026 audit found seven "Playwright & Test" weddings and seven
 * playwright-* users from April runs that never reached afterAll, the seeded
 * test admin and test couple (passwords in the repo), and an RLS test user.
 *
 *   node scripts/cleanup-test-accounts.mjs            dry run, counts only
 *   node scripts/cleanup-test-accounts.mjs --apply    backs up, then deletes
 *   node scripts/cleanup-test-accounts.mjs --restore backups/<file>.json
 *
 * Order on apply: child rows by wedding_id, child rows by user_id, weddings,
 * profiles, auth users. Every deleted row is written to backups/ first.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { TABLE_COLUMNS } from '../server/middleware/table-columns.js';

const envText = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }
const s = createClient(url, key, { auth: { persistSession: false } });

const APPLY = process.argv.includes('--apply');
const restoreIdx = process.argv.indexOf('--restore');

const EMAIL_MATCH = /^(test-admin|test-couple|rls-v-[0-9]+)@rixey\.invalid$|^playwright-[0-9]+@rixey-test\.invalid$/;
const WEDDING_NAMES = ['Playwright & Test', 'Test & Couple'];

async function pageAll(table, filter) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = s.from(table).select('*').range(from, from + 999);
    q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function main() {
  if (restoreIdx > -1) return restore(process.argv[restoreIdx + 1]);

  const { data: users, error: uErr } = await s.auth.admin.listUsers({ perPage: 1000 });
  if (uErr) throw uErr;
  const testUsers = users.users.filter(u => EMAIL_MATCH.test(u.email || ''));
  const userIds = testUsers.map(u => u.id);

  const { data: weddings, error: wErr } = await s.from('weddings').select('*').in('couple_names', WEDDING_NAMES);
  if (wErr) throw wErr;
  // Belt and braces: any wedding a test profile points at, too.
  const { data: profs, error: pErr } = await s.from('profiles').select('*').in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
  if (pErr) throw pErr;
  const extraWeddingIds = profs.map(p => p.wedding_id).filter(Boolean).filter(id => !weddings.some(w => w.id === id));
  if (extraWeddingIds.length) {
    const { data: extra, error } = await s.from('weddings').select('*').in('id', extraWeddingIds);
    if (error) throw error;
    weddings.push(...extra);
  }
  const weddingIds = weddings.map(w => w.id);

  // Refuse to touch a wedding that a NON-test profile belongs to.
  const { data: allProfs, error: apErr } = await s.from('profiles').select('id, email, wedding_id').in('wedding_id', weddingIds.length ? weddingIds : ['00000000-0000-0000-0000-000000000000']);
  if (apErr) throw apErr;
  const realOwners = allProfs.filter(p => !EMAIL_MATCH.test(p.email || ''));
  if (realOwners.length) {
    console.error('REFUSING: these weddings have non-test profiles attached:');
    for (const p of realOwners) console.error(' ', p.email, '->', p.wedding_id);
    process.exit(2);
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${testUsers.length} auth users, ${weddings.length} weddings`);
  for (const u of testUsers) console.log('  user   ', u.email, u.id);
  for (const w of weddings) console.log('  wedding', w.couple_names, w.wedding_date, w.id);

  const byWedding = Object.entries(TABLE_COLUMNS).filter(([t, cols]) => t !== 'weddings' && t !== 'profiles' && cols.includes('wedding_id')).map(([t]) => t);
  const byUser = Object.entries(TABLE_COLUMNS).filter(([t, cols]) => t !== 'profiles' && cols.includes('user_id') && !cols.includes('wedding_id')).map(([t]) => t);

  const backup = { at: new Date().toISOString(), users: testUsers, weddings, profiles: profs, rows: {} };
  let total = 0;
  for (const t of byWedding) {
    if (!weddingIds.length) break;
    const rows = await pageAll(t, q => q.in('wedding_id', weddingIds));
    if (rows.length) { backup.rows[t] = rows; total += rows.length; console.log(`  ${t}: ${rows.length}`); }
  }
  for (const t of byUser) {
    if (!userIds.length) break;
    const rows = await pageAll(t, q => q.in('user_id', userIds));
    if (rows.length) { backup.rows[t] = (backup.rows[t] || []).concat(rows); total += rows.length; console.log(`  ${t} (by user): ${rows.length}`); }
  }
  console.log(`  child rows total: ${total}`);
  if (!APPLY) { console.log('Dry run only. Re-run with --apply to delete.'); return; }

  fs.mkdirSync('backups', { recursive: true });
  const file = path.join('backups', `test-cleanup-${backup.at.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log('Backup written:', file);

  for (const t of byWedding) {
    if (!backup.rows[t]) continue;
    const { error } = await s.from(t).delete().in('wedding_id', weddingIds);
    if (error) throw new Error(`delete ${t}: ${error.message}`);
  }
  for (const t of byUser) {
    if (!backup.rows[t]) continue;
    const { error } = await s.from(t).delete().in('user_id', userIds);
    if (error) throw new Error(`delete ${t} by user: ${error.message}`);
  }
  if (weddingIds.length) {
    // profiles.wedding_id may reference weddings; clear it first.
    const { error: clr } = await s.from('profiles').update({ wedding_id: null }).in('wedding_id', weddingIds);
    if (clr) throw new Error(`clear profiles.wedding_id: ${clr.message}`);
    const { error } = await s.from('weddings').delete().in('id', weddingIds);
    if (error) throw new Error(`delete weddings: ${error.message}`);
  }
  if (userIds.length) {
    const { error } = await s.from('profiles').delete().in('id', userIds);
    if (error) throw new Error(`delete profiles: ${error.message}`);
    for (const u of testUsers) {
      const { error: dErr } = await s.auth.admin.deleteUser(u.id);
      if (dErr) throw new Error(`delete auth user ${u.email}: ${dErr.message}`);
    }
  }
  console.log('Done. Restore with: node scripts/cleanup-test-accounts.mjs --restore', file);
}

async function restore(file) {
  const b = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const u of b.users) {
    const { error } = await s.auth.admin.createUser({ id: u.id, email: u.email, email_confirm: true, user_metadata: u.user_metadata });
    if (error && !/already/i.test(error.message)) throw error;
  }
  if (b.weddings.length) { const { error } = await s.from('weddings').upsert(b.weddings); if (error) throw error; }
  if (b.profiles.length) { const { error } = await s.from('profiles').upsert(b.profiles); if (error) throw error; }
  for (const [t, rows] of Object.entries(b.rows)) {
    const { error } = await s.from(t).upsert(rows);
    if (error) throw new Error(`restore ${t}: ${error.message}`);
  }
  console.log('Restored (auth users come back without passwords; reset them if needed).');
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
