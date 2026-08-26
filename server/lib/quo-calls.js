/**
 * Phone calls with people who are not the couple.
 *
 * The Quo sync has always worked one way: take every `profiles.phone`, ask
 * OpenPhone for that conversation, file what comes back. A profile is a portal
 * login, so the only numbers it has ever asked about are the couple's own.
 *
 * Mothers and mothers-in-law ring constantly. Their numbers are on no profile,
 * so OpenPhone was never asked about them, so those calls did not fail to
 * import — they were never requested. There is no error to find, which is why
 * this went unnoticed: the sync reports success, and success looked identical
 * to a mother who had never phoned.
 *
 * Two ways in, because either one alone leaks:
 *
 *   known numbers    wedding_contacts says whose mum this is, and her calls
 *                    file themselves from then on.
 *   unknown numbers  everything else that has ever called the Rixey line goes
 *                    to the review queue with its transcript attached, so it
 *                    is a question on a screen rather than nothing at all.
 *
 * Everything lands venue-side. See migration 028 for why a mother-in-law's
 * words do not go in planning_notes.
 */

import { normalizePhone, toE164 } from '../../shared/phone.js';

const QUO_API_BASE = 'https://api.openphone.com/v1';

const apiKey = () => process.env.QUO_API_KEY;

/**
 * A GET against OpenPhone that waits out a rate limit instead of reading it as
 * a refusal. 429 is a queue, not a verdict — the same lesson the transcript
 * fetcher learned on 17 August, when treating it as permanent abandoned 28 of
 * 68 calls and reported it as though transcription were switched off.
 */
async function quoGet(path, { attempt = 0 } = {}) {
  const res = await fetch(`${QUO_API_BASE}${path}`, {
    headers: { Authorization: apiKey() },
  });

  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get('retry-after')) * 1000;
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : Math.min(30000, 2000 * (attempt + 1));
    await new Promise(r => setTimeout(r, wait));
    return quoGet(path, { attempt: attempt + 1 });
  }

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* left null; the caller checks ok */ }
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) };
}

/**
 * The transcript of a phone call, which does not come with the call.
 *
 * OpenPhone's /calls list returns metadata only. The old code read
 * `call.transcript` off that list, found nothing every time, and skipped the
 * call. Result: 67 calls found, 0 imported, no error, ever.
 *
 * The transcript lives at /call-transcripts/{callId} and comes back as a
 * dialogue: one entry per speaker turn. Transcription is a paid feature and can
 * be off, in which case this returns nothing for a real reason, and
 * `state.reason` carries that reason up to the job row so it can be read rather
 * than guessed at.
 *
 * Moved here from server/index.js when contacts started needing it too. Two
 * copies of this would have meant two sets of retry behaviour.
 */
export async function fetchCallTranscript(call, state, attempt = 0) {
  // Occasionally a voicemail does carry its own transcript.
  const inline = call.transcript || call.transcription || call.voicemail?.transcript;
  if (inline) return String(inline);

  // Once the account tells us transcription is unavailable, stop asking: it
  // will be unavailable for all of them.
  if (state.reason) return '';

  state.checked++;
  try {
    const res = await fetch(`${QUO_API_BASE}/call-transcripts/${call.id}`, {
      headers: { Authorization: apiKey() },
    });

    if (res.status === 402 || res.status === 403) {
      state.reason = 'Quo has not enabled call transcription on this account, so calls cannot be imported. Texts are unaffected.';
      return '';
    }
    // 404 means this particular call has no transcript (too short, missed, not
    // recorded). Normal, and not a reason to stop asking about the others.
    if (res.status === 404) { state.noTranscript = (state.noTranscript || 0) + 1; return ''; }

    // Rate limiting is not a verdict, it is a queue.
    if (res.status === 429) {
      state.throttled = (state.throttled || 0) + 1;
      const wait = Math.min(30000, 2000 * state.throttled);
      const retryAfter = Number(res.headers.get('retry-after')) * 1000;
      await new Promise(r => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : wait));
      if (attempt < 4) return fetchCallTranscript(call, state, attempt + 1);
      state.giveUps = (state.giveUps || 0) + 1;
      return '';
    }

    if (!res.ok) {
      state.reason = `Quo returned ${res.status} when asked for a call transcript.`;
      return '';
    }

    const body = await res.json();
    const d = body.data || body;
    if (d.status && d.status !== 'completed' && !d.dialogue) {
      state.notReady = (state.notReady || 0) + 1;
      return '';
    }

    // A dialogue is speaker turns. Keep who said what: a call where only one
    // side is legible is worth much less.
    if (Array.isArray(d.dialogue) && d.dialogue.length) {
      const text = d.dialogue
        .map(turn => {
          const who = turn.identifier || turn.userId || 'Speaker';
          const said = String(turn.content || '').trim();
          return said ? `${who}: ${said}` : '';
        })
        .filter(Boolean)
        .join('\n');
      if (text) { state.got++; return text; }
      state.empty = (state.empty || 0) + 1;
      return '';
    }

    const flat = d.transcript || d.text || '';
    if (flat) { state.got++; return String(flat); }
    state.empty = (state.empty || 0) + 1;
    return '';
  } catch (err) {
    state.reason = `Could not reach Quo for call transcripts: ${err.message}`;
    return '';
  }
}

export function newTranscriptState() {
  return { reason: null, checked: 0, got: 0 };
}

/** Whichever timestamp the call actually carries, oldest field last. */
function callTime(call) {
  return call.createdAt || call.answeredAt || call.completedAt || null;
}

function callDuration(call) {
  const secs = call.duration ?? call.durationSeconds ?? call.callDuration;
  return Number.isFinite(Number(secs)) ? Math.round(Number(secs)) : null;
}

/**
 * Is this the machine talking rather than a person?
 *
 * Lifted out of server/index.js so the couple path and the contacts path share
 * one definition. They did not, and the difference showed immediately: the
 * contacts pass had only the learned-template half, so "Thanks for texting! We
 * will text you back ASAP!" landed in a mother's history on the first run —
 * the exact string this repo has already chased out of the planning notes once.
 *
 * Two halves, and both are needed. The patterns catch a template the first time
 * it is ever sent; templateBodies catches the next one nobody wrote a pattern
 * for, because an outbound body already sent verbatim to a different couple is
 * a template by definition.
 */
const AUTO_REPLY_PATTERNS = [
  /^thank you for (reaching out|contacting|calling|your (message|inquiry|interest))/i,
  /^thanks for (reaching out|calling|texting|your (message|inquiry|interest))/i,
  /^we('ve| have) received your/i,
  /^we('ll| will) (get back|be in touch|respond)/i,
  /^this is an automated/i,
  /^you('ve| have) reached rixey manor/i,
  /^hi,? (we('re| are) currently|our team is)/i,
];

export function isAutoReply(body, direction, templateBodies = new Set()) {
  if (direction !== 'outbound') return false;
  const text = String(body || '').trim();
  if (!text) return false;
  return AUTO_REPLY_PATTERNS.some(p => p.test(text)) || templateBodies.has(text);
}

/** OpenPhone says incoming/outgoing. One vocabulary in the database. */
function callDirection(call) {
  const v = String(call.direction || '').toLowerCase();
  return v === 'outgoing' || v === 'outbound' || v === 'sent' ? 'outbound' : 'inbound';
}

/**
 * Everyone recorded against a wedding who is not a user.
 *
 * A number on two weddings is left ambiguous rather than assigned to whichever
 * row loaded last. That is exactly how Anne Throckmorton's planning meeting
 * ended up on Chris & Emily's file for three weeks (migration 021), and a
 * planner or a family friend genuinely can sit on two weddings at once.
 */
export async function loadContactIndex(supabaseAdmin) {
  const contacts = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('wedding_contacts')
      // Everything, rather than a column list. A half-applied migration means a
      // column that does not exist yet, and a named select turns that into a
      // thrown sync rather than a feature that is simply not on yet.
      .select('*')
      .range(from, from + 999);
    if (error) {
      // The table not existing is a migration that has not been run, which is
      // worth saying in those words rather than as a Postgres code. Anything
      // else is a real read failure and must not be mistaken for "no contacts",
      // because that silently reverts to the behaviour this whole file exists
      // to fix.
      // 42P01 no such table, 42703 no such column: both mean migration 028 has
      // not been run here yet, which is "not on" rather than "broken".
      if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code)) {
        console.log(`[contacts] wedding_contacts is not ready yet (${error.message}) — run migration 028`);
        return { contacts: [], byDigits: new Map(), byEmail: new Map(), missing: true };
      }
      throw new Error(`Could not read wedding contacts: ${error.message}`);
    }
    contacts.push(...data);
    if (data.length < 1000) break;
  }

  const byDigits = new Map();
  for (const c of contacts) {
    const digits = c.phone_digits || normalizePhone(c.phone);
    if (!digits) continue;
    const seen = byDigits.get(digits);
    if (seen) {
      if (seen.weddingId !== c.wedding_id) seen.ambiguous = true;
      continue;
    }
    byDigits.set(digits, {
      weddingId: c.wedding_id,
      contactId: c.id,
      name: c.name,
      relationship: c.relationship,
      ingestCalls: c.ingest_calls !== false,
      email: c.email || null,
      ambiguous: false,
    });
  }

  // The same rule for addresses. Gmail matches on these; the ambiguity check
  // matters more here, because a shared family address on two siblings'
  // weddings is not unusual.
  const byEmail = new Map();
  for (const c of contacts) {
    const email = String(c.email || '').trim().toLowerCase();
    if (!email) continue;
    const seen = byEmail.get(email);
    if (seen) {
      if (seen.weddingId !== c.wedding_id) seen.ambiguous = true;
      continue;
    }
    byEmail.set(email, {
      weddingId: c.wedding_id,
      contactId: c.id,
      name: c.name,
      relationship: c.relationship,
      ingestEmail: c.ingest_email !== false,
      email,
      ambiguous: false,
    });
  }

  return { contacts, byDigits, byEmail, missing: false };
}

/** Call ids already on file, all of them. A short read here means re-importing. */
export async function loadImportedCallIds(supabaseAdmin) {
  const ids = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('contact_messages')
      .select('external_id')
      .range(from, from + 999);
    if (error) {
      if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code)) return { ids, missing: true };
      throw new Error(`Could not read which calls are already imported: ${error.message}`);
    }
    for (const row of data) ids.add(row.external_id);
    if (data.length < 1000) break;
  }
  return { ids, missing: false };
}

/** Every call OpenPhone has for one number on one of our lines. */
async function callsWith(phoneNumberId, phoneE164) {
  const res = await quoGet(
    `/calls?phoneNumberId=${phoneNumberId}&participants=${encodeURIComponent(phoneE164)}&maxResults=50`
  );
  if (!res.ok) return { calls: [], error: `Quo returned ${res.status} for calls with ${phoneE164}` };
  const calls = res.json?.data || res.json?.calls || [];
  return { calls: Array.isArray(calls) ? calls : [], error: null };
}

/**
 * Import the calls for one known contact.
 *
 * Venue-side only: a row in contact_calls and nothing in planning_notes. See
 * migration 028. Sharing one with the couple is a separate, deliberate act.
 */
export async function importCallsForContact({
  supabaseAdmin,
  phoneNumberId,
  phoneE164,
  target,
  transcriptState,
  importedIds,
  summarise,
}) {
  const out = { found: 0, imported: 0, skipped: 0, errors: [] };

  const { calls, error } = await callsWith(phoneNumberId, phoneE164);
  if (error) { out.errors.push(error); return out; }
  out.found = calls.length;

  for (const call of calls) {
    if (importedIds.has(call.id)) continue;

    const transcript = await fetchCallTranscript(call, transcriptState);
    if (!transcript) { out.skipped++; continue; }

    const summary = await summarise(transcript, target.name, target.relationship);

    const { error: insErr } = await supabaseAdmin.from('contact_messages').insert({
      wedding_id: target.weddingId,
      contact_id: target.contactId || null,
      kind: 'call',
      external_id: call.id,
      phone_number: phoneE164,
      contact_name: target.name,
      direction: callDirection(call),
      occurred_at: callTime(call),
      duration_secs: callDuration(call),
      body: transcript,
      summary,
    });

    if (insErr) {
      // A duplicate means another run got there first, which is fine and is
      // what the unique constraint is for. Anything else means this call was
      // not stored, and saying so is the difference between a gap you can see
      // and a gap you cannot.
      if (insErr.code === '23505') { importedIds.add(call.id); continue; }
      out.errors.push(`${call.id}: ${insErr.message}`);
      continue;
    }

    importedIds.add(call.id);
    out.imported++;
  }

  return out;
}

/**
 * Import the texts for one known contact.
 *
 * The same shape as the calls above and for the same reason: a mother who texts
 * "can we do 40 chairs not 36" is telling the venue something, and until now
 * nothing asked OpenPhone about her number at all. Filed venue-side, never into
 * planning_notes.
 *
 * `skipBodies` is the template set the sync has already learned — the venue's
 * own machine replies ("Thanks for texting! We will text you back ASAP!") are
 * not a conversation with anybody and should not fill a family's history.
 */
export async function importTextsForContact({
  supabaseAdmin,
  phoneNumberId,
  phoneE164,
  target,
  importedIds,
  summarise,
  skipBodies = new Set(),
}) {
  const out = { found: 0, imported: 0, skipped: 0, errors: [] };

  const res = await quoGet(
    `/messages?phoneNumberId=${phoneNumberId}&participants=${encodeURIComponent(phoneE164)}&maxResults=100`
  );
  if (!res.ok) {
    out.errors.push(`Quo returned ${res.status} for texts with ${phoneE164}`);
    return out;
  }

  const messages = res.json?.data || res.json?.messages || [];
  out.found = Array.isArray(messages) ? messages.length : 0;

  for (const msg of (Array.isArray(messages) ? messages : [])) {
    if (importedIds.has(msg.id)) continue;

    const body = String(msg.body || msg.text || msg.content || '').trim();
    if (!body) { out.skipped++; continue; }

    const direction = callDirection(msg);
    if (isAutoReply(body, direction, skipBodies)) { out.skipped++; continue; }

    // Most texts are a sentence long, and summarise returns null below 200
    // characters, so this costs nothing on the ordinary ones.
    const summary = await summarise(body, target.name, target.relationship);

    const { error: insErr } = await supabaseAdmin.from('contact_messages').insert({
      wedding_id: target.weddingId,
      contact_id: target.contactId || null,
      kind: 'sms',
      external_id: msg.id,
      phone_number: phoneE164,
      contact_name: target.name,
      direction,
      occurred_at: msg.createdAt || msg.sentAt || null,
      body,
      summary,
    });

    if (insErr) {
      if (insErr.code === '23505') { importedIds.add(msg.id); continue; }
      out.errors.push(`${msg.id}: ${insErr.message}`);
      continue;
    }

    importedIds.add(msg.id);
    out.imported++;
  }

  return out;
}

/**
 * Every number that has ever been in a conversation with the Rixey line.
 *
 * OpenPhone will not list calls without being told who they were with, so
 * discovery has to come through /conversations, which does not need that and
 * comes back newest first. Paging stops at the window rather than walking
 * years of history every run.
 */
async function conversationParticipants(phoneNumberId, sinceMs, { maxPages = 40 } = {}) {
  const found = new Map();   // digits -> last activity ms
  let pageToken = null;
  let pages = 0;
  let stoppedEarly = false;

  while (pages < maxPages) {
    const q = `/conversations?phoneNumberId=${phoneNumberId}&maxResults=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await quoGet(q);
    if (!res.ok) return { found, error: `Quo returned ${res.status} listing conversations`, stoppedEarly };
    pages++;

    const rows = res.json?.data || [];
    for (const conv of rows) {
      const activity = conv.lastActivityAt ? Date.parse(conv.lastActivityAt) : 0;
      for (const p of conv.participants || []) {
        const digits = normalizePhone(p);
        if (!digits) continue;
        if (!found.has(digits) || found.get(digits) < activity) found.set(digits, activity);
      }
    }

    // Newest first, so once a page is entirely older than the window there is
    // nothing behind it worth reading.
    const oldest = rows.reduce((min, c) => {
      const t = c.lastActivityAt ? Date.parse(c.lastActivityAt) : 0;
      return t && t < min ? t : min;
    }, Infinity);
    if (oldest !== Infinity && oldest < sinceMs) break;

    pageToken = res.json?.nextPageToken || null;
    if (!pageToken) break;
    if (pages === maxPages) stoppedEarly = true;
  }

  return { found, error: null, stoppedEarly };
}

/** OpenPhone's own address book: number -> the name it shows on the screen. */
async function quoContactNames({ maxPages = 20 } = {}) {
  const byDigits = new Map();
  let pageToken = null;

  for (let page = 0; page < maxPages; page++) {
    const res = await quoGet(`/contacts?maxResults=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    if (!res.ok) break;   // a missing address book costs a name, not the sweep

    for (const c of res.json?.data || []) {
      const f = c.defaultFields || {};
      const name = [f.firstName, f.lastName].filter(Boolean).join(' ').trim() || f.company || '';
      if (!name) continue;
      for (const p of f.phoneNumbers || []) {
        const digits = normalizePhone(p.value);
        if (digits && !byDigits.has(digits)) byDigits.set(digits, name);
      }
    }

    pageToken = res.json?.nextPageToken || null;
    if (!pageToken) break;
  }

  return byDigits;
}

/**
 * Whose call might this be?
 *
 * A suggestion, never a filing. Migration 021 exists because a flat name match
 * put a stranger's planning meeting, and a critical potato allergy, on the
 * wrong couple's record for three weeks. So: the guest list first, because
 * being on it is real evidence, and only ever when exactly one wedding matches.
 */
async function suggestWedding(supabaseAdmin, callerName, weddings) {
  if (!callerName) return { weddingId: null, confidence: 0, reason: 'An unrecognised number, with no name against it in Quo.' };

  const parts = callerName.trim().split(/\s+/);
  const first = parts[0]?.toLowerCase() || '';
  const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

  if (last.length >= 3) {
    const { data: guests, error: guestErr } = await supabaseAdmin
      .from('wedding_guests')
      .select('wedding_id, first_name, last_name')
      .ilike('last_name', last);

    // A lookup that failed is not a surname nobody has. Swallowing it would
    // hand back "no match" with the same face as a real answer, and the caller
    // files the call on that. Say we could not tell.
    if (guestErr) {
      console.error('suggestWedding guest lookup failed:', guestErr.message);
      return { weddingId: null, confidence: 0, reason: 'Could not check the guest lists just now, so this one needs a human.' };
    }

    const hits = (guests || []).filter(g => !first || String(g.first_name || '').toLowerCase() === first);
    const weddingIds = [...new Set(hits.map(g => g.wedding_id))];
    if (weddingIds.length === 1) {
      const w = weddings.find(x => x.id === weddingIds[0]);
      return {
        weddingId: weddingIds[0],
        confidence: 70,
        reason: `Quo knows this number as "${callerName}", and ${callerName} is on the guest list for ${w?.couple_names || 'this wedding'}.`,
      };
    }
    if (weddingIds.length > 1) {
      return { weddingId: null, confidence: 0, reason: `Quo knows this number as "${callerName}", but that name is on ${weddingIds.length} guest lists.` };
    }
  }

  if (last.length >= 3) {
    const matches = weddings.filter(w => new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(w.couple_names || ''));
    if (matches.length === 1) {
      return {
        weddingId: matches[0].id,
        confidence: 55,
        reason: `Quo knows this number as "${callerName}", and "${parts[parts.length - 1]}" appears in ${matches[0].couple_names}. Worth checking before filing.`,
      };
    }
  }

  return { weddingId: null, confidence: 0, reason: `Quo knows this number as "${callerName}", which matches no wedding here.` };
}

/**
 * Ask about everyone who called and is not accounted for.
 *
 * One review row per number, not per call: eleven calls from one mother is one
 * question asked once. The transcripts ride along in the payload, so filing it
 * next week does not depend on OpenPhone still having them.
 */
export async function sweepUnknownCallers({
  supabaseAdmin,
  knownDigits,
  weddings,
  sinceDays = 90,
  maxCallers = 40,
  transcriptState,
  summarise,
  bump,
}) {
  const sinceMs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const out = {
    numbersSeen: 0, unknownNumbers: 0, callersChecked: 0, callersQueued: 0,
    callsQueued: 0, callersWithNoCalls: 0, callersLeft: 0, errors: [], stoppedEarly: false,
  };

  const phoneRes = await quoGet('/phone-numbers');
  if (!phoneRes.ok) throw new Error(`Could not fetch Quo phone numbers (${phoneRes.status})`);
  const lines = phoneRes.json?.data || [];

  // Numbers already answered for. A dismissed number stays dismissed: asking
  // again every week about the same plumber is how a queue stops being read.
  const settled = new Set();
  {
    const { data, error } = await supabaseAdmin
      .from('ingest_review')
      .select('phone_number, status')
      .eq('source', 'quo_call')
      .in('status', ['ignored', 'resolved']);
    if (error && error.code !== '42P01') throw new Error(`Could not read the review queue: ${error.message}`);
    for (const row of data || []) {
      const digits = normalizePhone(row.phone_number);
      if (digits) settled.add(digits);
    }
  }

  const names = await quoContactNames();

  // Newest activity first, so a run that hits its cap has spent it on the
  // people who rang this week rather than someone who rang in April.
  const candidates = new Map();
  for (const line of lines) {
    const { found, error, stoppedEarly } = await conversationParticipants(line.id, sinceMs);
    if (error) out.errors.push(error);
    if (stoppedEarly) out.stoppedEarly = true;
    out.numbersSeen += found.size;
    for (const [digits, activity] of found) {
      if (knownDigits.has(digits)) continue;
      if (settled.has(digits)) continue;
      const prev = candidates.get(digits);
      if (!prev || prev.activity < activity) candidates.set(digits, { activity, lineId: line.id });
    }
  }

  out.unknownNumbers = candidates.size;
  const ordered = [...candidates.entries()].sort((a, b) => b[1].activity - a[1].activity);
  const batch = ordered.slice(0, maxCallers);
  out.callersLeft = Math.max(0, ordered.length - batch.length);

  await bump?.({ total: batch.length });

  let done = 0;
  for (const [digits, { lineId }] of batch) {
    const phoneE164 = toE164(digits);
    out.callersChecked++;

    const { calls, error } = await callsWith(lineId, phoneE164);
    if (error) out.errors.push(error);

    const withTranscripts = [];
    for (const call of calls) {
      const transcript = await fetchCallTranscript(call, transcriptState);
      if (!transcript) continue;
      withTranscripts.push({
        id: call.id,
        occurredAt: callTime(call),
        direction: callDirection(call),
        durationSecs: callDuration(call),
        transcript,
      });
    }

    if (!withTranscripts.length) {
      // Texted but never called, or called and nothing was transcribed. Not a
      // question worth putting in front of anyone.
      out.callersWithNoCalls++;
      done++;
      await bump?.({ processed: done, last_item: phoneE164 });
      continue;
    }

    const callerName = names.get(digits) || null;
    const suggestion = await suggestWedding(supabaseAdmin, callerName, weddings);
    const newest = withTranscripts.reduce((a, b) => (Date.parse(b.occurredAt || 0) > Date.parse(a.occurredAt || 0) ? b : a));
    const summary = await summarise(newest.transcript, callerName || phoneE164, null);

    const { error: upErr } = await supabaseAdmin.from('ingest_review').upsert({
      source: 'quo_call',
      external_id: `quo_caller_${digits}`,
      phone_number: phoneE164,
      title: callerName
        ? `${withTranscripts.length} call${withTranscripts.length === 1 ? '' : 's'} with ${callerName}`
        : `${withTranscripts.length} call${withTranscripts.length === 1 ? '' : 's'} from ${phoneE164}`,
      occurred_at: newest.occurredAt,
      excerpt: summary || newest.transcript.slice(0, 400),
      suggested_wedding_id: suggestion.weddingId,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      status: 'open',
      payload: { digits, phoneE164, callerName, calls: withTranscripts },
    }, { onConflict: 'source,external_id' });

    if (upErr) out.errors.push(`${phoneE164}: ${upErr.message}`);
    else { out.callersQueued++; out.callsQueued += withTranscripts.length; }

    done++;
    await bump?.({ processed: done, matched: out.callersQueued, last_item: phoneE164 });
  }

  return out;
}

/**
 * File a queued caller against a wedding.
 *
 * Works from the stored payload, never from OpenPhone: the transcripts were
 * captured when the sweep ran, and by now the provider may have aged them out
 * or the account may have lost transcription entirely.
 */
export async function fileQueuedCaller({ supabaseAdmin, item, weddingId, contact }) {
  const payload = item.payload || {};
  const calls = Array.isArray(payload.calls) ? payload.calls : [];
  if (!calls.length) throw new Error('There are no transcripts stored against this one to file');

  let contactId = null;
  let contactName = contact?.name || payload.callerName || null;

  // "Remember this number." The point of the queue is that it should shrink:
  // a number filed once should file itself next time.
  if (contact?.name) {
    const { data: saved, error } = await supabaseAdmin
      .from('wedding_contacts')
      .upsert({
        wedding_id: weddingId,
        name: contact.name,
        relationship: contact.relationship || null,
        phone: payload.phoneE164 || item.phone_number || null,
        phone_digits: payload.digits || normalizePhone(item.phone_number),
      }, { onConflict: 'wedding_id,phone_digits' })
      .select('id, name')
      .maybeSingle();
    if (error) throw new Error(`Could not save that contact: ${error.message}`);
    contactId = saved?.id || null;
    contactName = saved?.name || contactName;
  }

  let imported = 0;
  for (const call of calls) {
    const { error } = await supabaseAdmin.from('contact_messages').insert({
      wedding_id: weddingId,
      contact_id: contactId,
      kind: 'call',
      external_id: call.id,
      phone_number: payload.phoneE164 || item.phone_number || null,
      contact_name: contactName,
      direction: call.direction || 'inbound',
      occurred_at: call.occurredAt || null,
      duration_secs: call.durationSecs ?? null,
      body: call.transcript,
    });
    if (error) {
      if (error.code === '23505') continue;   // already filed
      throw new Error(`Could not file that call: ${error.message}`);
    }
    imported++;
  }

  return { imported, contactId };
}
