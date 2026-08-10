/**
 * What to call each half of a couple.
 *
 * The timeline was written around "Bride" and "Groom" as fixed labels, which
 * breaks the moment a wedding has two brides, two grooms, or anyone who uses
 * neither word. Isabella and Angelina are married on 22 August and their
 * timeline currently reads "Groom Getting Ready Photos".
 *
 * Rather than adding a second set of hardcoded labels (bride 1, bride 2, groom
 * 1, groom 2), which only moves the problem one step, this uses the couple's
 * own names. "Isabella Gets Dressed" is better than any generic label for
 * every couple, not just this one, and it needs no decision from anyone about
 * which of them is which kind of partner.
 *
 * Order of preference:
 *   1. partner1_name / partner2_name, if the venue has filled them in
 *   2. the two halves of couple_names, split on and / & / +
 *   3. "Partner 1" and "Partner 2"
 *
 * Nothing here is stored. Correct a name in one place and every label follows.
 */

const SPLITTERS = /\s+(?:&|\+|and|And|AND)\s+/;

/** Trim, drop a trailing surname only if both halves share it. */
function tidy(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

export function partnerLabels(wedding) {
  const p1 = tidy(wedding?.partner1_name);
  const p2 = tidy(wedding?.partner2_name);
  if (p1 && p2) return { p1, p2, source: 'partner_names' };

  const couple = tidy(wedding?.couple_names);
  if (couple) {
    const parts = couple.split(SPLITTERS).map(tidy).filter(Boolean);
    if (parts.length === 2) {
      // Taken exactly as written. An earlier version took the first word to
      // shorten "Dana Richardson" to "Dana", which also turned "Ai Vy" into
      // "Ai" and would mangle "Mary Kate" or "van Besien". A slightly long
      // label is a cosmetic problem; a wrong name is not.
      return { p1: p1 || parts[0], p2: p2 || parts[1], source: 'couple_names' };
    }
  }

  // One name, or none. "Jeff Warrington" tells us nothing about the second
  // person, so neither of them gets a name rather than one being guessed.
  return { p1: p1 || 'Partner 1', p2: p2 || 'Partner 2', source: 'fallback' };
}

/**
 * Fill {p1} / {p2} in a label.
 *
 * Labels are templates rather than fixed strings so the same definition serves
 * every couple, and so a stored label can never drift from the couple it
 * belongs to.
 */
export function fillLabel(template, labels) {
  return String(template ?? '')
    .replace(/\{p1\}/g, labels?.p1 || 'Partner 1')
    .replace(/\{p2\}/g, labels?.p2 || 'Partner 2');
}
