#!/usr/bin/env node
/**
 * Work through the backlog of recorded walkthroughs and planning meetings.
 *
 * Isadora records every final walkthrough and most planning calls. The portal
 * transcribes them, turns the transcript into proposed items and files the
 * accepted ones, but that is four buttons per meeting and the recordings piled
 * up: a dozen with nothing done to them, two with a transcript sat unused, and
 * three that were read by the model and produced nothing because the reply was
 * cut off at max_tokens (fixed in server/lib/doc-sync/sections.js and the
 * organise route, 17 September).
 *
 * Every write here is a call to the portal's own admin API, over HTTPS, signed
 * in as a real admin. Nothing writes to a planning table directly. What is read
 * straight from Supabase is only the survey of what needs doing, because there
 * is no route that lists walkthroughs across every wedding.
 *
 * Per meeting, in order:
 *   1. transcribe any recording with no transcript and no failure recorded
 *      (POST /api/admin/walkthrough-media/:id/transcribe)
 *   2. put the transcript into the notes if the notes are empty
 *      (PUT /api/admin/walkthroughs/:id)
 *   3. organise the notes into proposed items
 *      (POST /api/admin/walkthroughs/:id/organise, runs as a job, polled)
 *   4. accept the confident ones and file them
 *      (PUT /api/admin/walkthrough-items/:id, POST /api/admin/walkthroughs/:id/apply)
 *
 * Step 4 is timid where being wrong is expensive. An item that only becomes a
 * pending planning note files at 60, because that is the queue Isadora already
 * reads and a wrong one costs her a delete; an item that writes a structured
 * row needs 80; a vendor contact or an allergy needs 90, because those get
 * acted on before anyone thinks to check them. The rest is left proposed.
 *
 *   node scripts/process-walkthrough-backlog.mjs                  # dry run
 *   node scripts/process-walkthrough-backlog.mjs --apply
 *   node scripts/process-walkthrough-backlog.mjs --apply --steps 1-3
 *   node scripts/process-walkthrough-backlog.mjs --only <walkthrough id>
 *   node scripts/process-walkthrough-backlog.mjs --api http://localhost:3001
 *   node scripts/process-walkthrough-backlog.mjs --apply --force --steps 4-4
 *       go back over every meeting and file anything now over the bar,
 *       without re-reading or re-proposing anything
 *
 * It signs in as a throwaway admin created with a random password and deletes
 * it again in a finally block, the same way scripts/smoke-security.mjs does.
 * Nothing it creates matches a real person.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import fs from 'fs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const APPLY = flag('apply');
const API = value('api', 'https://rixeyapp-production.up.railway.app').replace(/\/$/, '');
const ONLY = value('only', null);
const STEPS = value('steps', '1-4');
const FORCE = flag('force');

const stepWanted = (n) => {
  const [lo, hi] = STEPS.split('-').map(Number);
  return n >= (lo || 1) && n <= (hi || lo || 4);
};

/**
 * How sure the model has to be before an item is filed, by what filing it
 * actually does.
 *
 * An item with no section does not write a structured row at all: the apply
 * route sends it to planning_notes as a pending note, which is the same queue
 * Isadora already reads and clears. The cost of a wrong one there is a note she
 * deletes, so holding those to 80 only moved work from one review queue to
 * another, and 241 of the 384 items from the first pass were exactly that.
 *
 * Anything that writes a real row keeps the higher bar, and a vendor contact or
 * an allergy severity keeps the highest, because those get acted on before
 * anyone thinks to check them.
 */
const ACCEPT_AT = 80;
const NOTE_AT = 60;
const CAREFUL_AT = 90;
const CAREFUL_SECTIONS = new Set(['vendor', 'allergies']);

const TRANSCRIBE_TIMEOUT_MS = 45 * 60 * 1000;
const ORGANISE_TIMEOUT_MS = 60 * 60 * 1000;
const POLL_MS = 15_000;

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !ANON || !SERVICE) {
  console.error('Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const mins = (secs) => secs ? `${Math.round(secs / 60)} min` : '?';
const say = (...a) => console.log(...a);

// ---------------------------------------------------------------- the admin

let token = null;
let throwawayUserId = null;
let credentials = null;

/** Get a fresh access token for the throwaway admin. */
async function signIn() {
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: session, error } = await anon.auth.signInWithPassword(credentials);
  if (error) throw new Error(`Could not sign in as the throwaway admin: ${error.message}`);
  token = session.session.access_token;
}

async function signInAsThrowawayAdmin() {
  const email = `walkthrough-backlog-${Date.now()}@rixey-test.invalid`;
  const password = randomBytes(18).toString('base64url');

  const { data: created, error: createErr } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (createErr) throw new Error(`Could not create the throwaway admin: ${createErr.message}`);
  throwawayUserId = created.user.id;

  const { error: profileErr } = await db.from('profiles').upsert({
    id: throwawayUserId, email, name: 'Walkthrough backlog script', role: 'admin', is_admin: true,
  });
  if (profileErr) throw new Error(`Could not make the throwaway admin an admin: ${profileErr.message}`);

  credentials = { email, password };
  await signIn();
  say(`Signed in as a throwaway admin (${email}).`);
}

async function removeThrowawayAdmin() {
  if (!throwawayUserId) return;

  // Applying a walkthrough writes an activity line naming whoever did it, and
  // that line is a real record of items landing on a real wedding: it stays.
  // The actor on it does not, because the account is about to stop existing
  // and the foreign key would refuse the delete anyway. Left with no actor,
  // which is what the portal already writes for work with no person behind it.
  const { error: actorErr } = await db.from('activity_log').update({ user_id: null }).eq('user_id', throwawayUserId);
  if (actorErr) console.error(`Could not unhook the activity lines: ${actorErr.message}`);

  await db.from('profiles').delete().eq('id', throwawayUserId);
  const { error } = await db.auth.admin.deleteUser(throwawayUserId);
  if (error) console.error(`Left a throwaway admin behind, delete ${throwawayUserId} by hand: ${error.message}`);
  else say('Throwaway admin deleted.');
}

/**
 * One call to the portal's API. Throws with the server's own words.
 *
 * A Supabase access token lasts an hour and a backlog of ninety-minute
 * meetings takes longer than that, so the first run lost Ashley's second
 * recording and Anne and Chris's whole walkthrough to a 401 an hour in. A 401
 * now means sign in again and have another go, once.
 */
async function api(path, opts = {}) {
  try {
    return await call(path, opts);
  } catch (err) {
    if (err.status !== 401 || !credentials) throw err;
    await signIn();
    return call(path, opts);
  }
}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON, say so below */ }
  if (!res.ok) {
    const detail = json?.error || text.replace(/\s+/g, ' ').slice(0, 200);
    const err = new Error(`${method} ${path} → ${res.status}: ${detail}`);
    err.status = res.status;
    err.isHtml = json === null;
    throw err;
  }
  return json;
}

/**
 * Does the deployed API have the routes and the fix this script needs?
 *
 * Asked to transcribe a recording that already has a transcript, the route
 * refuses with a 409 and says so. A server without the route falls through to
 * the catch-all, which answers 404 "Not found". Nothing is written either way,
 * which is the point of probing with a recording that is already done.
 */
async function deployedHasTheFix(probeMediaId) {
  const path = probeMediaId
    ? `/api/admin/walkthrough-media/${probeMediaId}/transcribe`
    : '/api/admin/walkthrough-media/00000000-0000-0000-0000-000000000000/transcribe';
  try {
    await api(path, { method: 'POST' });
    return true;
  } catch (err) {
    if (err.status === 409) return true;                       // the route, refusing
    if (err.status === 404 && /^not found$/i.test(String(err.message).split(': ').pop())) return false;
    if (err.status === 404 && err.isHtml) return false;
    if (err.status === 404) return true;                       // the route, in its own words
    throw err;
  }
}

// ------------------------------------------------------------- the backlog

/**
 * Every row, not the first thousand.
 *
 * PostgREST stops at a thousand whether or not anyone asked it to, and this
 * backlog put walkthrough_items past that in an afternoon: the second run
 * reported 32 items left on Justin and Katie when there were 74, because the
 * other 42 were off the end of the page.
 */
async function all(table, columns) {
  const rows = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await db.from(table).select(columns).range(from, from + size - 1);
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < size) return rows;
  }
}

async function survey() {
  const [walkthroughs, media, items, weddings] = await Promise.all([
    all('walkthroughs', '*'),
    all('walkthrough_media', '*'),
    all('walkthrough_items', 'id, walkthrough_id, status, confidence, section'),
    all('weddings', 'id, couple_names'),
  ]);
  walkthroughs.sort((a, b) => String(a.occurred_on).localeCompare(String(b.occurred_on)));

  return (walkthroughs || []).map(w => {
    const own = (media || []).filter(m => m.walkthrough_id === w.id);
    const audio = own.filter(m => m.kind === 'audio').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const its = (items || []).filter(i => i.walkthrough_id === w.id);
    return {
      row: w,
      couple: (weddings || []).find(x => x.id === w.wedding_id)?.couple_names || (w.enquiry_id ? 'an enquiry' : 'no wedding'),
      audio,
      items: its,
      counts: its.reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] || 0) + 1 }), {}),
    };
  });
}

/**
 * What needs doing to this one, and why not if not.
 *
 * A meeting whose items are already filed is left completely alone: organising
 * again would propose the same things a second time and Isadora would have to
 * tell them apart from the ones she has already dealt with.
 */
function planFor(w) {
  const notes = String(w.row.raw_notes || '').trim();
  const toTranscribe = w.audio.filter(m => !m.transcript && !m.transcript_error);
  const withTranscript = w.audio.filter(m => m.transcript);
  const plan = { transcribe: toTranscribe, setNotes: false, organise: false, accept: false, skip: null };

  if (ONLY && w.row.id !== ONLY) { plan.skip = 'not the one asked for'; return plan; }
  if (!FORCE && (w.counts.applied || w.counts.skipped)) { plan.skip = 'already dealt with'; return plan; }
  if (!toTranscribe.length && !withTranscript.length && !notes) { plan.skip = 'no recording and no notes'; return plan; }

  plan.setNotes = !notes && (withTranscript.length > 0 || toTranscribe.length > 0);
  plan.organise = !w.counts.proposed || plan.setNotes || plan.transcribe.length > 0;
  plan.accept = true;
  return plan;
}

// ------------------------------------------------------------- the four steps

async function waitForTranscript(mediaId, deadline) {
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const { data } = await db.from('walkthrough_media').select('transcript, transcript_error').eq('id', mediaId).maybeSingle();
    if (data?.transcript) return { ok: true, chars: data.transcript.length };
    if (data?.transcript_error) return { ok: false, error: data.transcript_error };
  }
  return { ok: false, error: 'still going after 45 minutes, left running' };
}

async function step1Transcribe(w, plan, report) {
  for (const m of plan.transcribe) {
    say(`  · transcribing ${mins(m.duration_secs)} of audio (media ${m.id})`);
    if (!APPLY) { report.notes.push(`would transcribe ${mins(m.duration_secs)} of audio`); continue; }
    try {
      await api(`/api/admin/walkthrough-media/${m.id}/transcribe`, { method: 'POST' });
    } catch (err) {
      report.error = `transcribe: ${err.message}`;
      return false;
    }
    const done = await waitForTranscript(m.id, Date.now() + TRANSCRIBE_TIMEOUT_MS);
    if (!done.ok) { report.error = `transcribe: ${done.error}`; return false; }
    say(`    transcribed, ${done.chars.toLocaleString()} chars`);
    m.transcript = 'x'.repeat(done.chars);   // only its length is used from here
  }
  return true;
}

/**
 * The transcript becomes the notes, through the same route the screen uses.
 *
 * Two recordings of one meeting get a heading each. Without one the join reads
 * as a single conversation that jumps in time, and the model sorting it has no
 * way to know the afternoon session is a different room.
 */
function notesFromTranscripts(w, transcripts) {
  if (transcripts.length === 1) return transcripts[0].transcript;
  return transcripts.map((m, i) =>
    `## Recording ${i + 1} of ${transcripts.length} — ${mins(m.duration_secs)}\n\n${m.transcript}`).join('\n\n');
}

async function step2Notes(w, plan, report) {
  if (!plan.setNotes) return true;
  const { data: fresh } = await db.from('walkthrough_media').select('*')
    .eq('walkthrough_id', w.row.id).eq('kind', 'audio').order('created_at');
  const transcripts = (fresh || []).filter(m => m.transcript);
  if (!transcripts.length) {
    // On a dry run the transcription in step one did not actually happen, so
    // there is nothing here yet and that is expected rather than wrong.
    if (!APPLY) { report.notes.push('would set the notes from the new transcript'); return true; }
    report.error = 'no transcript to put in the notes';
    return false;
  }

  const notes = notesFromTranscripts(w, transcripts);
  report.transcriptChars = notes.length;
  say(`  · notes from ${transcripts.length} recording(s), ${notes.length.toLocaleString()} chars`);
  if (!APPLY) { report.notes.push(`would set ${notes.length.toLocaleString()} chars of notes`); return true; }

  try {
    await api(`/api/admin/walkthroughs/${w.row.id}`, { method: 'PUT', body: { raw_notes: notes } });
  } catch (err) { report.error = `notes: ${err.message}`; return false; }
  return true;
}

async function waitForOrganise(id, deadline) {
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    let state;
    try { state = await api(`/api/admin/walkthroughs/${id}/items`); }
    catch { continue; }   // a blip while polling is not a failed run
    if (state.status !== 'organising') return { status: state.status, items: state.items || [] };
  }
  return { status: 'timed out', items: [] };
}

async function step3Organise(w, plan, report) {
  if (!plan.organise) return true;
  if (!APPLY) { report.notes.push('would organise'); return true; }

  let res;
  try { res = await api(`/api/admin/walkthroughs/${w.row.id}/organise`, { method: 'POST' }); }
  catch (err) { report.error = `organise: ${err.message}`; return false; }

  say(`  · organising in ${res.chunks} part(s), job ${res.jobId || 'none'}`);
  const done = await waitForOrganise(w.row.id, Date.now() + ORGANISE_TIMEOUT_MS);
  report.proposed = done.items.length;

  if (done.status === 'draft') {
    // The route words an incomplete read as a draft, on purpose: a part that
    // was cut off or could not be saved means the meeting was not fully read.
    report.error = `organise stopped partway through, ${done.items.length} item(s) saved`;
    return done.items.length > 0;
  }
  if (done.status === 'timed out') { report.error = 'organise still running after an hour'; return false; }
  say(`  · ${done.items.length} item(s) proposed`);
  return true;
}

const barFor = (item) => {
  if (!item.section) return NOTE_AT;
  return CAREFUL_SECTIONS.has(item.section) ? CAREFUL_AT : ACCEPT_AT;
};

const acceptable = (item) => {
  const c = Number(item.confidence);
  if (!Number.isFinite(c)) return false;
  return c >= barFor(item);
};

async function step4AcceptAndApply(w, plan, report) {
  if (!plan.accept) return true;

  let items = w.items;
  if (APPLY) {
    try { items = (await api(`/api/admin/walkthroughs/${w.row.id}/items`)).items || []; }
    catch (err) { report.error = `items: ${err.message}`; return false; }
  }
  const proposed = items.filter(i => i.status === 'proposed');
  report.proposed = items.length;
  report.wasProposed = proposed.length;
  const take = proposed.filter(acceptable);
  report.accepted = take.length;
  report.asNotes = take.filter(i => !i.section).length;
  report.left = proposed.length - take.length;

  if (!take.length) { say(`  · nothing confident enough to file, ${report.left} left for review`); return true; }
  say(`  · accepting ${take.length} of ${proposed.length} (${report.asNotes} as planning notes), leaving ${report.left} for review`);
  if (!APPLY) { report.notes.push(`would accept ${take.length} and apply`); return true; }

  if (!w.row.wedding_id) {
    report.error = 'a tour has no wedding to file into, items left proposed';
    report.accepted = 0;
    report.left = proposed.length;
    return true;
  }

  for (const item of take) {
    try { await api(`/api/admin/walkthrough-items/${item.id}`, { method: 'PUT', body: { status: 'accepted' } }); }
    catch (err) { report.error = `accept: ${err.message}`; return false; }
  }

  try {
    const res = await api(`/api/admin/walkthroughs/${w.row.id}/apply`, { method: 'POST' });
    report.applied = res.applied || 0;
    if (res.failed) report.error = `${res.failed} item(s) would not file`;
    say(`  · filed ${report.applied} item(s)`);
  } catch (err) { report.error = `apply: ${err.message}`; return false; }
  return true;
}

// ------------------------------------------------------------------ the run

function printTable(rows) {
  const head = ['couple', 'date', 'audio', 'transcript', 'items', 'was', 'acc', 'notes', 'filed', 'review', 'error'];
  const body = rows.map(r => [
    r.couple.slice(0, 22), r.date, r.minutes, r.transcriptChars ? r.transcriptChars.toLocaleString() : '-',
    String(r.proposed ?? '-'), String(r.wasProposed ?? '-'), String(r.accepted ?? '-'), String(r.asNotes ?? '-'),
    String(r.applied ?? '-'), String(r.left ?? '-'),
    r.error || (r.skipped ? `skipped: ${r.skipped}` : ''),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map(b => b[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  say('');
  say(line(head));
  say(widths.map(w => '-'.repeat(w)).join('  '));
  for (const b of body) say(line(b));
}

async function main() {
  const health = await fetch(`${API}/api/health`).then(r => r.json()).catch(() => null);
  say(`API ${API} commit ${health?.commit || '?'} node ${health?.node || '?'} transcription ${health?.transcription ? 'on' : 'OFF'}`);
  say(APPLY ? 'APPLY: this writes to the live portal.' : 'DRY RUN: nothing will be written. Pass --apply to do it for real.');
  say(`Steps ${STEPS}. Filing at ${NOTE_AT} for items that only become a planning note, ${ACCEPT_AT} for the rest, ${CAREFUL_AT} for ${[...CAREFUL_SECTIONS].join(' and ')}.`);

  await signInAsThrowawayAdmin();

  const all = await survey();
  const probeMedia = all.flatMap(w => w.audio).find(m => m.transcript)?.id || null;
  const hasFix = await deployedHasTheFix(probeMedia);
  if (!hasFix) {
    say('');
    say('NEEDS DEPLOY: this API does not have POST /api/admin/walkthrough-media/:id/transcribe,');
    say('so it also does not have the chunking fix that stops a long meeting being read in one');
    say('call and coming back cut off at max_tokens. Organising anything long against it would');
    say('repeat the failure that put zero items on Anne & Chris. Deploy first, or point this at');
    say('a server running this branch with --api http://localhost:3001.');
    if (APPLY) { say(''); say('Stopping before anything is written.'); return 2; }
    say('Carrying on with the dry run only.');
  }

  const rows = [];

  for (const w of all) {
    const plan = planFor(w);
    const minutes = w.audio.reduce((n, m) => n + (m.duration_secs || 0), 0);
    const existingTranscript = w.audio.reduce((n, m) => n + (m.transcript?.length || 0), 0);
    const report = {
      couple: w.couple,
      date: w.row.occurred_on,
      minutes: minutes ? mins(minutes) : '-',
      transcriptChars: existingTranscript || String(w.row.raw_notes || '').length || 0,
      proposed: w.counts.proposed ?? 0,
      wasProposed: null, accepted: null, asNotes: null, applied: null, left: null,
      error: null, skipped: plan.skip, notes: [],
    };

    if (plan.skip) { rows.push(report); continue; }

    say('');
    say(`${w.couple} — ${(w.row.kind || '').replace(/_/g, ' ')} on ${w.row.occurred_on} (${w.row.id})`);

    let ok = true;
    if (ok && stepWanted(1)) ok = await step1Transcribe(w, plan, report);
    if (ok && stepWanted(2)) ok = await step2Notes(w, plan, report);
    if (ok && stepWanted(3)) ok = await step3Organise(w, plan, report);
    if (ok && stepWanted(4)) ok = await step4AcceptAndApply(w, plan, report);
    for (const n of report.notes) say(`  · ${n}`);
    rows.push(report);
  }

  printTable(rows);

  const totals = rows.reduce((t, r) => ({
    applied: t.applied + (r.applied || 0),
    left: t.left + (r.left || 0),
    errors: t.errors + (r.error ? 1 : 0),
  }), { applied: 0, left: 0, errors: 0 });
  say('');
  say(`${totals.applied} item(s) filed, ${totals.left} left proposed for review, ${totals.errors} meeting(s) with something wrong.`);
  say('Review the leftovers in the admin: a wedding → Meetings & walkthroughs → open the meeting.');
  return totals.errors ? 1 : 0;
}

let code = 0;
try {
  code = await main();
} catch (err) {
  console.error(`\nStopped: ${err.message}`);
  code = 1;
} finally {
  await removeThrowawayAdmin();
}
process.exit(code);
