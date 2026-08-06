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
