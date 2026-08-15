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

/** A tour is the commercially important one, and reads differently in a list. */
export function isTour(meetingKind) {
  return /tour|site visit|venue visit/i.test(String(meetingKind || ''));
}
