/**
 * The extra questions a couple can add to their RSVP form.
 *
 * One definition, used by RSVP Settings (which toggles them), the wedding
 * website (which asks them) and the Guest List, CSV export and print pack
 * (which read the answers back). They drifted once already: the settings page
 * offered a dietary toggle the form never consulted.
 *
 * `extra` is the key the answer is stored under inside wedding_guests.rsvp_extras.
 * A null `extra` means the answer goes to a real column instead.
 */
export const RSVP_FIELDS = [
  { key: 'ask_dietary',       extra: null,            label: 'Dietary restrictions / allergies', short: 'Dietary',       default: true },
  { key: 'ask_phone',         extra: 'phone',         label: 'Phone number',                     short: 'Phone',         default: false },
  { key: 'ask_email',         extra: 'email',         label: 'Email address',                    short: 'Email',         default: false },
  { key: 'ask_address',       extra: 'address',       label: 'Mailing address',                  short: 'Address',       default: false },
  { key: 'ask_hotel',         extra: 'hotel',         label: 'Hotel preference',                 short: 'Hotel',         default: false },
  { key: 'ask_shuttle',       extra: 'shuttle',       label: 'Shuttle preference',               short: 'Shuttle',       default: false },
  { key: 'ask_accessibility', extra: 'accessibility', label: 'Accessibility needs',              short: 'Accessibility', default: false },
  { key: 'ask_song',          extra: 'song',          label: 'Song request',                     short: 'Song',          default: false },
  { key: 'ask_message',       extra: 'message',       label: 'Message to the couple',            short: 'Message',       default: false },
];

/** Is this question switched on for this wedding? */
export function isFieldOn(rsvpConfig, key) {
  const fields = rsvpConfig?.fields || {};
  if (fields[key] !== undefined) return !!fields[key];
  return !!RSVP_FIELDS.find(f => f.key === key)?.default;
}

/**
 * Should guests get an email confirming what they submitted?
 *
 * Not one of the questions above, so it is kept out of RSVP_FIELDS, but it
 * lives in the same config blob. On by default: a guest with no receipt comes
 * back to check, and until recently the site told them the wrong thing when
 * they did. Only ever sends where an address is available.
 */
export function sendsConfirmation(rsvpConfig) {
  const v = rsvpConfig?.fields?.send_confirmation;
  return v === undefined ? true : !!v;
}

/**
 * Turn a stored rsvp_extras blob into labelled answers, ready to display.
 *
 * Answers outlive their question on purpose. If a couple switches a toggle off
 * or deletes a custom question after guests have replied, what those guests
 * said still shows, under a plain label rather than disappearing.
 */
export function describeExtras(extras, rsvpConfig) {
  if (!extras || typeof extras !== 'object' || Array.isArray(extras)) return [];
  const custom = rsvpConfig?.custom_questions || [];
  const out = [];
  const seen = new Set();

  const present = v => v !== undefined && v !== null && String(v).trim() !== '';

  for (const f of RSVP_FIELDS) {
    if (!f.extra) continue;
    seen.add(f.extra);
    if (!present(extras[f.extra])) continue;
    out.push({ key: f.extra, label: f.label, short: f.short, value: String(extras[f.extra]).trim() });
  }

  for (const [k, v] of Object.entries(extras)) {
    if (seen.has(k) || !present(v)) continue;
    const m = /^custom_(\d+)$/.exec(k);
    const idx = m ? Number(m[1]) : null;
    // A deleted custom question leaves the answer with no label of its own.
    const label = idx !== null
      ? (custom[idx]?.label?.trim() || `Custom question ${idx + 1}`)
      : k;
    out.push({ key: k, label, short: label, value: String(v).trim() });
  }

  return out;
}
