/**
 * Turning what was said in a room into rows in the portal.
 *
 * The whole design rests on one rule: **every writer here inserts, none of
 * them update.** A walkthrough note is a fast, informal capture and the parser
 * reading it is guessing. An extra row someone deletes in two clicks is a
 * nuisance; an overwritten ceremony time or a rewritten vendor contact is data
 * nobody knows they have lost. So when in doubt this adds, and a human merges.
 *
 * Anything without a writer falls through to planning_notes, which is where
 * every other unstructured signal in this system already lands. Nothing is
 * ever dropped for want of a destination.
 */

/**
 * Where a walkthrough item can be filed.
 *
 * `fields` is what the parser is asked to fill in for that section, and it is
 * fed verbatim into the prompt, so the wording here is the spec the model
 * works from. Keep it plain.
 */
/** A date only counts as a deadline if it is one. Today or earlier is a mis-read. */
function isFutureDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
  return v > new Date().toISOString().slice(0, 10);
}

export const WALKTHROUGH_TARGETS = {
  checklist: {
    label: 'To-do list',
    table: 'planning_checklist',
    fields: 'task_text (what needs doing, as an instruction), category (one of: Vendors, Timeline, Attire & Beauty, Guests, Venue, Decor, Other), due_date (YYYY-MM-DD, only if a date was actually said)',
    build: (p, weddingId) => ({
      wedding_id: weddingId,
      task_text: String(p.task_text || '').trim().slice(0, 300),
      category: ['Vendors', 'Timeline', 'Attire & Beauty', 'Guests', 'Venue', 'Decor', 'Other'].includes(p.category) ? p.category : 'Other',
      // A due date in the past is always a mis-read, not a deadline. Asked to
      // file "decide on the day", the model helpfully stamped the walkthrough's
      // own date on it, which would have landed as an already-overdue task.
      due_date: isFutureDate(p.due_date) ? p.due_date : null,
      is_completed: false,
      is_custom: true,
    }),
    valid: p => !!String(p.task_text || '').trim(),
  },

  allergies: {
    label: 'Allergy registry',
    table: 'allergy_registry',
    fields: 'guest_name, allergy (what they cannot have), severity (only if they actually said how bad it is: Mild, Moderate, or Severe / Anaphylactic — leave it out otherwise), notes',
    build: (p, weddingId) => {
      // Severity is left blank unless it was actually said. Guessing "Mild"
      // for "Heidi has a shellfish thing" is a guess in the dangerous
      // direction: it reads as checked, and a kitchen could plan around it.
      const stated = ['Mild', 'Moderate', 'Severe / Anaphylactic'].includes(p.severity) ? p.severity : null;
      const notes = [
        p.notes ? String(p.notes).slice(0, 400) : 'Noted at the walkthrough.',
        stated ? null : 'Severity not confirmed — check before passing to the caterer.',
      ].filter(Boolean).join(' ');
      return {
        wedding_id: weddingId,
        guest_name: String(p.guest_name || '').trim().slice(0, 120),
        allergy: String(p.allergy || '').trim().slice(0, 200),
        severity: stated,
        notes,
        caterer_alerted: false,
        staying_overnight: false,
      };
    },
    valid: p => !!String(p.guest_name || '').trim() && !!String(p.allergy || '').trim(),
  },

  decor: {
    label: 'Decor inventory',
    table: 'decor_inventory',
    fields: 'item_name, space_name (which room or area it goes in), source (who is bringing it), notes',
    build: (p, weddingId) => ({
      wedding_id: weddingId,
      item_name: String(p.item_name || '').trim().slice(0, 200),
      space_name: String(p.space_name || 'Unassigned').trim().slice(0, 120),
      source: p.source ? String(p.source).slice(0, 120) : null,
      notes: p.notes ? String(p.notes).slice(0, 500) : null,
      leaving_it: false,
    }),
    valid: p => !!String(p.item_name || '').trim(),
  },

  bar: {
    label: 'Bar shopping list',
    table: 'bar_shopping_list',
    fields: 'item_name, quantity (a number if one was said), unit (bottles, cases, kegs…), category, notes',
    build: (p, weddingId) => ({
      wedding_id: weddingId,
      item_name: String(p.item_name || '').trim().slice(0, 200),
      quantity: p.quantity ? String(p.quantity).slice(0, 40) : null,
      unit: p.unit ? String(p.unit).slice(0, 40) : null,
      category: p.category ? String(p.category).slice(0, 60) : 'other',
      notes: p.notes ? String(p.notes).slice(0, 500) : null,
      checked: false,
      from_calculator: false,
    }),
    valid: p => !!String(p.item_name || '').trim(),
  },

  shuttle: {
    label: 'Shuttle schedule',
    table: 'shuttle_schedule',
    fields: 'run_label, pickup_location, pickup_time (like "4:00 PM"), dropoff_location, dropoff_time, seat_count, notes',
    build: (p, weddingId) => ({
      wedding_id: weddingId,
      run_label: String(p.run_label || 'Walkthrough note').trim().slice(0, 120),
      pickup_location: p.pickup_location ? String(p.pickup_location).slice(0, 160) : null,
      pickup_time: p.pickup_time ? String(p.pickup_time).slice(0, 40) : null,
      dropoff_location: p.dropoff_location ? String(p.dropoff_location).slice(0, 160) : null,
      dropoff_time: p.dropoff_time ? String(p.dropoff_time).slice(0, 40) : null,
      seat_count: p.seat_count ? String(p.seat_count).slice(0, 20) : null,
      notes: p.notes ? String(p.notes).slice(0, 500) : null,
    }),
    valid: p => !!(p.run_label || p.pickup_time || p.pickup_location),
  },

  vendor: {
    label: 'Vendor checklist',
    table: 'vendor_checklist',
    // Inserted, never merged into an existing vendor row. If they already have
    // a florist, this adds a second line for a human to reconcile rather than
    // silently overwriting a contact that took someone a phone call to get.
    fields: 'vendor_type (Caterer, Florist, Photographer, DJ, Officiant, Cake, Rentals, Hair + Makeup, Transportation…), vendor_name, vendor_contact, notes',
    build: (p, weddingId) => ({
      wedding_id: weddingId,
      vendor_type: String(p.vendor_type || 'Other').trim().slice(0, 80),
      vendor_name: p.vendor_name ? String(p.vendor_name).slice(0, 160) : null,
      vendor_contact: p.vendor_contact ? String(p.vendor_contact).slice(0, 200) : null,
      notes: p.notes ? String(p.notes).slice(0, 500) : 'Added from the walkthrough.',
      is_booked: false,
    }),
    valid: p => !!(String(p.vendor_name || '').trim() || String(p.vendor_type || '').trim()),
  },
};

/** Sections the parser may choose, plus the catch-all. */
export const TARGET_KEYS = Object.keys(WALKTHROUGH_TARGETS);

/**
 * Fallback destination. Free text, always accepts, always available. Used for
 * anything the parser could not route and anything a writer rejects as
 * incomplete, so a half-understood sentence still ends up somewhere a person
 * will read it.
 */
export function buildNote(item, weddingId, walkthroughLabel) {
  return {
    wedding_id: weddingId,
    user_id: null,
    category: 'note',
    content: item.summary || item.source_text,
    source_message: `From ${walkthroughLabel}: "${String(item.source_text || '').slice(0, 300)}"`,
    status: 'pending',
  };
}

/** The instruction the model gets. Kept here so the spec and the writers sit together. */
export function organisePrompt({ rawNotes, context, kindLabel, occurredOn }) {
  const targetDocs = Object.entries(WALKTHROUGH_TARGETS)
    .map(([key, t]) => `- "${key}" — ${t.label}. proposed fields: ${t.fields}`)
    .join('\n');

  return `These are a wedding coordinator's own notes, typed quickly during a ${kindLabel} at Rixey Manor on ${occurredOn}. They are messy on purpose: fragments, shorthand, half sentences, things said in passing.

Your job is to break them into separate items and say where each one belongs in the planning portal. You are not summarising and you are not improving their writing. You are sorting.

${context}

Destinations available:
${targetDocs}
- null — anything that does not clearly fit one of the above. This is not a failure; a note filed as a note is still filed.

Return a JSON array. One object per item:
{
  "source_text": "the exact words from the notes this came from, quoted, not paraphrased",
  "kind": "task" | "note" | "detail" | "decision",
  "section": one of the keys above, or null,
  "summary": "one plain sentence a person can act on",
  "proposed": { the fields listed for that section, filled in from what was actually said },
  "confidence": 0-100
}

Rules that matter:
- Split on meaning, not punctuation. One sentence can hold two items; three lines can be one.
- Never invent a detail. If they did not say a time, a name or a number, leave that field out. A half-filled item is fine and a human will finish it.
- "Chase the florist" is a task. "Florist is Blue Ridge Blooms, 555-0100" is a vendor detail. Both can come from one line.
- Anything about an allergy or a dietary need goes to "allergies" and is never dropped, even if you only have a first name.
- Set confidence low when you are guessing at the destination. Low confidence still gets returned; it just gets looked at harder.
- If a line is a personal observation about the couple, their family or their mood, keep it as a note with section null. Those matter and must not be discarded for being unstructured.

Return ONLY the JSON array.

Notes:
${rawNotes}`;
}

/** Pull the array out of a model response and make each item safe to store. */
export function parseItems(raw) {
  const match = String(raw || '').match(/\[[\s\S]*\]/);
  if (!match) return [];
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch { return []; }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(i => i && (i.summary || i.source_text))
    .map(i => {
      const section = TARGET_KEYS.includes(i.section) ? i.section : null;
      return {
        source_text: String(i.source_text || i.summary || '').slice(0, 2000),
        kind: ['task', 'note', 'detail', 'decision'].includes(i.kind) ? i.kind : 'note',
        section,
        summary: String(i.summary || i.source_text || '').slice(0, 400),
        proposed: (i.proposed && typeof i.proposed === 'object' && !Array.isArray(i.proposed)) ? i.proposed : {},
        confidence: Number.isFinite(+i.confidence) ? Math.max(0, Math.min(100, Math.round(+i.confidence))) : null,
      };
    });
}
