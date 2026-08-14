/**
 * Reading the guest care blob.
 *
 * `wedding_guest_care` is one row per wedding with a single jsonb `data`
 * column, keyed by the twelve section keys the couple answers. Each value is
 * `{ has: true|false|null, notes: string }`.
 *
 * Two places in the server queried it as if it were one row per note —
 * `select('guest_name, note_type, notes')` — and those columns do not exist.
 * PostgREST returned 42703 every time and the error went unchecked, so **Sage
 * has never seen any guest care information for any wedding**: no allergies,
 * no mobility needs, no family dynamics, none of it. The couple filled the
 * form in and the assistant answering their questions could not see a word of
 * it.
 *
 * This is the shape the data actually has, in one place, so the same mistake
 * cannot be made twice in two files.
 */

/** Labels, phrased for someone reading a briefing rather than filling a form. */
export const GUEST_CARE_LABELS = {
  children: 'Children attending',
  mobility: 'Mobility needs',
  vision_hearing: 'Vision or hearing',
  sensory: 'Sensory sensitivities',
  dietary: 'Dietary and allergies',
  sobriety: 'Sober guests',
  elderly: 'Elderly or frail guests',
  medical: 'Medical conditions',
  service_animals: 'Service animals',
  pet_allergies: 'Pet allergies',
  family_dynamics: 'Family dynamics',
  other: 'Anything else',
};

/**
 * Turn the blob into lines worth putting in front of an assistant.
 *
 * A section is included when the couple wrote something, or when they said yes
 * without elaborating — "there are mobility needs" is worth knowing even
 * without detail. A plain no is dropped: twelve lines of "no" would bury the
 * two that matter.
 */
export function formatGuestCare(data) {
  if (!data || typeof data !== 'object') return [];
  const lines = [];
  for (const [key, label] of Object.entries(GUEST_CARE_LABELS)) {
    const entry = data[key];
    if (!entry || typeof entry !== 'object') continue;
    const notes = String(entry.notes || '').trim();
    if (notes) {
      lines.push(`${label}: ${notes}`);
    } else if (entry.has === true) {
      lines.push(`${label}: yes, no detail given`);
    }
  }
  return lines;
}

/** The whole section, ready to drop into a prompt. Empty string when there is nothing. */
export function guestCareContext(data, heading = 'GUEST CARE NOTES') {
  const lines = formatGuestCare(data);
  if (!lines.length) return '';
  return `${heading}:\nThese are things the couple told us about their guests. Treat them as sensitive.\n${lines.map(l => `- ${l}`).join('\n')}\n`;
}
