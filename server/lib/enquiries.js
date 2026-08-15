/**
 * Turning a Calendly booking into something the portal can hold.
 *
 * Calendly already collects more than anyone reads. A venue tour booking
 * carries both partners' names and emails, a phone number, the date they are
 * hoping for, a guest estimate and where they heard about Rixey. All of it sits
 * in the booking confirmation and none of it reaches the portal, so the tour
 * happens with none of it to hand.
 *
 * The questions are matched loosely on purpose. Real ones today include
 * "Partners First and Last Name " with a trailing space, and "Our website lists
 * all of our available weekends - do you have a date in mind?" which is a
 * paragraph. The wording will change again. Anything unmatched is still kept
 * whole in `answers`, so a new question is never silently dropped — it just
 * lands somewhere general instead of somewhere specific.
 */

/** question text → the column it belongs in. First match wins, so order matters. */
const QUESTION_MAP = [
  [/partner.*(first|last|name)|fianc|spouse.*name/i, 'partner_name'],
  [/partner.*e-?mail/i, 'partner_email'],
  [/phone|mobile|cell|number to reach/i, 'phone'],
  [/date in mind|available weekends|preferred date|wedding date|looking at/i, 'preferred_date'],
  [/guests? in mind|number of (invited )?guests|guest count|how many people/i, 'guest_estimate'],
  [/hear about|find us|how did you (find|hear)/i, 'heard_about'],
  // Order matters against the one below: "Have you built a package on our
  // pricing calculator?" contains the word package and is not the question
  // about which package they want.
  [/pricing calculator|built a package/i, 'used_calculator'],
  [/which package|packages? (are|you).*interested|interested in/i, 'package_interest'],
];

const clean = (v) => String(v == null ? '' : v).trim();

/**
 * Pull the fields we have columns for out of a Calendly invitee's answers.
 * Everything is returned, matched or not: `answers` is the whole set.
 */
export function readAnswers(questionsAndAnswers) {
  const list = Array.isArray(questionsAndAnswers) ? questionsAndAnswers : [];
  const out = { answers: [] };

  for (const qa of list) {
    const question = clean(qa?.question);
    const answer = clean(qa?.answer);
    if (!question) continue;
    out.answers.push({ question, answer });
    if (!answer) continue;

    for (const [pattern, field] of QUESTION_MAP) {
      if (pattern.test(question) && !out[field]) {
        out[field] = answer;
        break;
      }
    }
  }
  return out;
}

/** Digits only, last 10, so a phone from a form matches one from Quo. */
export function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

const lower = (v) => clean(v).toLowerCase();

/**
 * Is this booking an existing couple, or somebody new?
 *
 * Matched on email, which is exact, rather than on a name. The lesson from
 * filing Anne Throckmorton's Zoom call under the wrong couple is that a name is
 * not an identifier, and here there is a real one to hand.
 *
 * Checks the partner's email too: Emily Farnsworth books, but the wedding might
 * be registered under Chris.
 *
 * @returns {{weddingId: string|null, why: string}}
 */
export function matchToWedding({ email, partnerEmail, phone }, profiles) {
  const wanted = [lower(email), lower(partnerEmail)].filter(Boolean);
  for (const p of profiles || []) {
    const pe = lower(p.email);
    if (pe && wanted.includes(pe)) {
      return { weddingId: p.wedding_id, why: `${p.email} is already on a wedding` };
    }
  }

  // Phone is a decent second: a couple who books a tour from the same number
  // they have been texting from is the same people.
  const want = normalisePhone(phone);
  if (want) {
    for (const p of profiles || []) {
      if (p.phone && normalisePhone(p.phone) === want) {
        return { weddingId: p.wedding_id, why: `phone number already on a wedding` };
      }
    }
  }

  return { weddingId: null, why: 'nobody with this email or number has a wedding yet' };
}

/** Edit distance, capped: we only care whether it is 0, 1 or 2. */
function editDistance(a, b) {
  a = String(a); b = String(b);
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

const NAME_NOISE = new Set(['and', '&', 'the', 'wedding', 'plus', 'de', 'van', 'jr', 'ii']);

function nameTokens(s) {
  return String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter(t => t.length > 2 && !NAME_NOISE.has(t));
}

/**
 * Who this enquiry *might* be, when nothing matched exactly.
 *
 * Three real cases from the first sync, none of which an exact email match
 * could catch:
 *
 *   Samantha Sheads booked as sheadsaamantha@gmail.com. The portal has
 *   sheadssamantha@gmail.com. One letter. A final walkthrough for a wedding in
 *   four weeks looked like a stranger.
 *
 *   "Griffin and Daniel" booked their onboarding from jperry32@gmu.edu, a
 *   university address belonging to neither of them. No email overlap at all,
 *   and the name is an exact match for the couple.
 *
 *   Swati Sinha has booked Rixey and has no wedding in the portal, which is not
 *   a matching problem at all — it is a missing record, and the tour list
 *   showing her is correct.
 *
 * This suggests and never files. Guessing wrong here puts a stranger's tour on
 * a real couple's record, so the answer to "probably" is to ask. Same rule as
 * the Zoom review queue.
 *
 * @returns {{weddingId: string, reason: string, confidence: number}|null}
 */
export function suggestWedding({ name, email, partnerName, partnerEmail }, weddings) {
  const enquiryEmails = [lower(email), lower(partnerEmail)].filter(Boolean);
  const enquiryTokens = new Set([...nameTokens(name), ...nameTokens(partnerName)]);
  let best = null;

  for (const w of weddings || []) {
    const profiles = w.profiles || [];
    let score = 0;
    const why = [];

    // An email one or two characters out is a typo, not a different person.
    for (const p of profiles) {
      const pe = lower(p.email);
      if (!pe) continue;
      for (const ee of enquiryEmails) {
        if (ee === pe) { score += 100; why.push(`same email as ${p.name}`); continue; }
        const [eLocal, eDomain] = ee.split('@');
        const [pLocal, pDomain] = pe.split('@');
        if (eDomain === pDomain && eLocal && pLocal) {
          const d = editDistance(eLocal, pLocal);
          if (d === 1) { score += 70; why.push(`email is one character off ${p.email}`); }
          else if (d === 2) { score += 45; why.push(`email is two characters off ${p.email}`); }
        }
      }
    }

    // Names, from every place the wedding keeps one.
    const weddingTokens = new Set([
      ...nameTokens(w.couple_names),
      ...nameTokens(w.partner1_name),
      ...nameTokens(w.partner2_name),
      ...profiles.flatMap(p => nameTokens(p.name)),
    ]);
    const shared = [...enquiryTokens].filter(t => weddingTokens.has(t));
    if (shared.length >= 2) { score += 60; why.push(`names match: ${shared.join(', ')}`); }
    else if (shared.length === 1 && shared[0].length > 4) { score += 20; why.push(`name "${shared[0]}" in common`); }

    if (score > 0 && (!best || score > best.confidence)) {
      best = { weddingId: w.id, coupleNames: w.couple_names, confidence: score, reason: why.join('; ') };
    }
  }

  // One weak name in common is most of the venue's client list, so it has to
  // clear a bar before it is worth putting in front of anyone.
  return best && best.confidence >= 45 ? best : null;
}

/**
 * A Calendly scheduled event plus its invitees, as a row for `enquiries`.
 * Returns null for an event with no invitee, which is a cancelled or held slot.
 */
export function enquiryFromEvent(event, { profiles = [] } = {}) {
  const invitee = (event?.invitees || [])[0];
  if (!invitee?.email) return null;

  const parsed = readAnswers(invitee.questions_and_answers);
  const match = matchToWedding(
    { email: invitee.email, partnerEmail: parsed.partner_email, phone: parsed.phone },
    profiles,
  );

  return {
    row: {
      name: clean(invitee.name) || clean(invitee.email),
      email: lower(invitee.email) || null,
      phone: parsed.phone || null,
      partner_name: parsed.partner_name || null,
      partner_email: lower(parsed.partner_email) || null,
      source: 'calendly',
      calendly_event_uri: clean(event.uri) || null,
      meeting_kind: clean(event.name) || null,
      meeting_at: event.start_time || null,
      meeting_location: clean(event.location?.location || event.location?.type) || null,
      preferred_date: parsed.preferred_date || null,
      guest_estimate: parsed.guest_estimate || null,
      heard_about: parsed.heard_about || null,
      package_interest: parsed.package_interest || null,
      used_calculator: parsed.used_calculator || null,
      answers: parsed.answers,
      wedding_id: match.weddingId,
    },
    matchReason: match.why,
    isExistingCouple: !!match.weddingId,
  };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

/**
 * The date they typed, as a real date, when it is one.
 *
 * People write it every possible way: "9/25/2027", "10-16-2027", "May 8 2027",
 * "Sept 11,", "August 2027", "I would say 2028! But it could come way sooner!".
 * Only the unambiguous ones come back; a month with no day is not a date.
 *
 * Worth the trouble because the answer changes the conversation. A date that is
 * already sold is the single most useful thing to know walking into a tour, and
 * it was sitting in the booking form unread.
 */
export function parseStatedDate(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;

  // 9/25/2027, 10-16-2027, 6/5/27 — US order, which is what the form gets.
  const numeric = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (numeric) {
    const [, m, d, rawY] = numeric;
    const y = rawY.length === 2 ? `20${rawY}` : rawY;
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // May 8 2027 · September 19, 2026 · 8 May 2027
  const named = t.match(new RegExp(`\\b(${MONTHS.join('|')})\\w*\\s+(\\d{1,2})(?:st|nd|rd|th)?[,\\s]+(\\d{4})\\b`))
    || t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS.join('|')})\\w*[,\\s]+(\\d{4})\\b`));
  if (named) {
    const monthFirst = MONTHS.includes(named[1]);
    const month = monthFirst ? named[1] : named[2];
    const day = monthFirst ? named[2] : named[1];
    const year = named[3];
    const mi = MONTHS.indexOf(month);
    if (mi >= 0) return `${year}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Short month: "Sept 11, 2027". Only with a year; "Sept 11," alone is not a date.
  const short = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})\b/);
  if (short) {
    const idx = MONTHS.findIndex(m => m.startsWith(short[1] === 'sept' ? 'sep' : short[1]));
    if (idx >= 0) return `${short[3]}-${String(idx + 1).padStart(2, '0')}-${String(short[2]).padStart(2, '0')}`;
  }

  return null;
}

/** A tour is the commercially important one, and reads differently in a list. */
export function isTour(meetingKind) {
  return /tour|site visit|venue visit/i.test(String(meetingKind || ''));
}
