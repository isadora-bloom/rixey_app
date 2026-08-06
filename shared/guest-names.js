/**
 * Party naming rules, shared by the API (Railway) and the wedding website (Vercel).
 *
 * A wedding_guests row is a party, not a person. The plus one lives in
 * plus_one_name and has no row of their own, so every surface that needs to
 * call them something has to make the same two decisions: is this a real name,
 * and what is their surname. Both decisions live here so they cannot drift.
 */

// What people type into plus_one_name when they don't know who it is yet.
// None of these is a person and none should be searchable or printed as one.
// Relationship words count as placeholders too: "Hubby" is not a name, and
// inheriting a surname would turn it into "Hubby Early" on a place card.
const PLACEHOLDER = /^(the\s+)?(\+?\s*1|x+|tbd|tba|n\.?\/?a\.?|none|guest|unknown|plus\s*one|and\s*guest|some\s*(chick|dude|guy|girl|one)|girlfriend|boyfriend|partner|date|friend|husband|hubby|hubs|wife|wifey|spouse|fianc\w*|mr|mrs|ms|maybe)$/i;

/** Strip the decoration people leave around a name: "Justin **", "Girlfriend..". */
function tidy(name) {
  return (name || '').replace(/^[*.\s]+/, '').replace(/[*.\s]+$/, '').trim();
}

/** Do we have an actual name for this person, or just a placeholder? */
export function isNamedPerson(name) {
  const s = tidy(name);
  if (s.length < 2) return false;
  if (!/[a-z]{2}/i.test(s)) return false; // rules out "..", "+1", "X"
  return !PLACEHOLDER.test(s);
}

export function guestFullName(guest) {
  return [guest?.first_name, guest?.last_name].filter(Boolean).join(' ').trim();
}

/**
 * Full name for a plus one.
 *
 * House rule: when only a first name is given, the plus one shares the primary
 * guest's surname. Where a surname was actually typed we take it as written,
 * even when it differs from the host, because that is them saying otherwise.
 *
 * Worth knowing the strength of this: of the 237 plus ones on the books in
 * August 2026, 141 state a surname and 43 of those differ from their host. So
 * for the 96 that state nothing, the inherited surname is a good working
 * assumption rather than a certainty. It is derived on read and never written
 * to the column, so fixing a host's surname fixes theirs, and nothing
 * downstream inherits a guess it can no longer question.
 */
export function plusOneFullName(plusOneName, hostLastName) {
  const s = tidy(plusOneName);
  if (!s) return '';
  if (!isNamedPerson(s)) return s;
  if (/\s/.test(s)) return s; // already more than one word, take it as written
  return hostLastName ? `${s} ${hostLastName.trim()}` : s;
}

/**
 * Does this guest have a plus one?
 *
 * Only the couple decides this, and they say so by putting something in
 * plus_one_name. A blank means no plus one and must never be read as an
 * unfilled one. Placeholders are a deliberate third state: Cat & Josh mark 15
 * guests "X" and name 11 others while leaving 96 blank, and 6 of Isabella and
 * Angelina's 8 "+1" entries have already RSVP'd yes. Those are real people
 * whose names nobody has collected yet. They count. They are not named.
 */
export function hasPlusOne(guest) {
  return !!(guest?.plus_one_name && String(guest.plus_one_name).trim());
}

/** What we write when a couple says a guest gets a plus one but not who. */
export const UNNAMED_PLUS_ONE = '+1';

/**
 * Read a spreadsheet cell that is meant to say whether a guest gets a plus one.
 *
 * Three outcomes, because there are three real states, and collapsing them is
 * how a phantom guest called "No" ends up on a seating chart. A blank or an
 * explicit no means no plus one and nothing is stored. A yes means one was
 * granted without a name. Anything else is taken as written, including a
 * couple's own marker like "X", so importing a list you exported gives you
 * back what you had.
 */
export function parsePlusOneCell(raw) {
  // Emptiness is judged before tidying. A cell of ".." is someone the couple
  // did grant a plus one and then gave up describing, and tidying it to
  // nothing first would quietly delete that person.
  const original = String(raw == null ? '' : raw).trim();
  if (!original) return { granted: false, name: null };
  if (/^(no|n|none|nope|false|0|n\.?\/?a\.?|-+|—)$/i.test(original)) return { granted: false, name: null };
  if (/^(yes|y|true|1)$/i.test(original)) return { granted: true, name: UNNAMED_PLUS_ONE };
  const s = tidy(original);
  return { granted: true, name: s || UNNAMED_PLUS_ONE };
}

/** What to call a plus one on screen or in print. Never a placeholder. */
export function plusOneDisplayName(guest) {
  if (!hasPlusOne(guest)) return '';
  return isNamedPerson(guest.plus_one_name)
    ? plusOneFullName(guest.plus_one_name, guest.last_name)
    : 'Guest';
}

/**
 * Expand a wedding_guests row into the people it represents.
 *
 * A row is a party, not a person, and the app kept forgetting: some counts
 * were of parties and some of people, sitting next to each other in the same
 * summary bar. Anything that needs a headcount should flatten through here.
 */
export function partyMembers(guest) {
  const people = [{
    id: `${guest?.id}`,
    name: guestFullName(guest),
    rsvp: guest?.rsvp || 'pending',
    mealChoice: guest?.meal_choice || null,
    dietary: guest?.dietary_restrictions || null,
    isPlusOne: false,
    host: null,
  }];
  if (hasPlusOne(guest)) {
    people.push({
      id: `${guest.id}:+1`,
      name: plusOneDisplayName(guest),
      rsvp: guest.plus_one_rsvp || 'pending',
      mealChoice: guest.plus_one_meal_choice || null,
      dietary: guest.plus_one_dietary || null,
      isPlusOne: true,
      host: guestFullName(guest),
    });
  }
  return people;
}

/** Every person on a guest list, hosts and plus ones alike. */
export function allPeople(guests) {
  return (guests || []).flatMap(partyMembers);
}

/**
 * Every dietary note recorded on the guest list, one per person.
 *
 * Dietary information lives in three unconnected places: this, the plus one's
 * own column, and the hand-keyed allergy registry, which is the only one the
 * printed pack reads. So an allergy a guest typed into their RSVP never
 * reached the kitchen. These two helpers let the registry show what it is
 * missing without copying anything, which would only create a second copy to
 * drift.
 */
export function dietaryNotes(guests) {
  const out = [];
  for (const g of guests || []) {
    const own = String(g?.dietary_restrictions || '').trim();
    if (own) out.push({ name: guestFullName(g), note: own, isPlusOne: false, host: null, guestId: g.id });
    if (hasPlusOne(g)) {
      const theirs = String(g.plus_one_dietary || '').trim();
      if (theirs) out.push({ name: plusOneDisplayName(g), note: theirs, isPlusOne: true, host: guestFullName(g), guestId: g.id });
    }
  }
  return out;
}

/** Guest-list dietary notes with nobody of that name in the allergy registry. */
export function dietaryNotInRegistry(guests, registryRows) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  const known = new Set((registryRows || []).map(r => norm(r.guest_name)).filter(Boolean));
  return dietaryNotes(guests).filter(d => !known.has(norm(d.name)));
}

/** Headcounts that all mean the same thing wherever they are shown. */
export function headcount(guests) {
  const people = allPeople(guests);
  const by = status => people.filter(p => p.rsvp === status).length;
  return {
    total: people.length,
    attending: by('yes'),
    declined: by('no'),
    maybe: by('maybe'),
    pending: people.length - by('yes') - by('no') - by('maybe'),
  };
}
