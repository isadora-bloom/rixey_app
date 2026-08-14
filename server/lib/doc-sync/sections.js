/**
 * Reading a planning document into the portal's own vocabulary.
 *
 * Sheet Sync solves the same problem with fourteen hand-written modules, one
 * per tab of a spreadsheet the venue itself hands out. That works because the
 * source is known. Here the source is whatever the couple or their planner
 * happened to make, so the structure has to be recovered rather than assumed.
 *
 * The extraction is deliberately narrow. It asks only for the things the
 * portal has somewhere to put, in exactly the shape those tables expect, and
 * it is told to leave out anything it is unsure of. A document like this will
 * mention a hundred facts; the useful output is the dozen that are missing
 * from the portal, not a transcription.
 */

/**
 * One entry per portal destination this can read.
 *
 * `fields` is fed verbatim into the prompt, so the wording is the spec. `key`
 * is what comes back in the JSON and what diff.js expects.
 */
export const DOC_SECTIONS = [
  {
    key: 'dietary',
    label: 'Dietary restrictions and allergies',
    table: 'allergy_registry',
    fields: 'guest_name (the person, exactly as written), allergy (what they cannot eat), severity (only if the document says how serious it is: Mild, Moderate, or Severe / Anaphylactic — leave out otherwise), notes',
    hint: 'Often under a heading like "Dietary Restrictions and Allergies", sometimes a column in a seating chart. One entry per person. Do not invent a severity; "celiac" is not automatically severe.',
  },
  {
    key: 'vendors',
    label: 'Vendors',
    table: 'vendor_checklist',
    fields: 'vendor_type (Caterer, Florist, Photographer, DJ, Officiant, Cake, Rentals, Hair + Makeup, Transportation, Venue, Other), vendor_name (the company), vendor_contact (person, email, phone — all of it in one string), notes',
    hint: 'Usually a table headed "Vendors and Contractors". The venue itself (Rixey Manor) counts as a vendor row too. If a vendor is named with no contact details, still return it.',
  },
  {
    key: 'bedrooms',
    label: 'Bedroom assignments',
    table: 'bedroom_assignments',
    fields: 'room_name (the room as the document names it), occupants (who is staying there, as written), night (friday, saturday, or both, only if stated)',
    hint: 'Look for room names paired with people. Rixey rooms include Newlywed Suite, Maple, Mountain, Garden, Rose, Blue.',
  },
  {
    key: 'decor',
    label: 'Decor',
    table: 'decor_inventory',
    fields: 'item_name, space_name (which room or area), source (who is providing it — the couple, the venue, a rental company), notes',
    hint: 'Often split into what the couple supplies and what comes from the venue. Keep that distinction in source.',
  },
  {
    key: 'bar',
    label: 'Bar',
    table: 'bar_shopping_list',
    fields: 'item_name, quantity (only if a number is given), unit (bottles, cases, kegs, gallons), notes',
    hint: 'Drinks to be bought or provided. Free-text instructions like "trade port city for yuengling" belong in notes on the item they concern, or as their own item if they name a drink.',
  },
  {
    key: 'guests',
    label: 'Guest list',
    table: 'wedding_guests',
    fields: 'name (the whole entry exactly as written, even when it names two people), party_size (the number in a "#" or count column, if there is one), address, rsvp (yes, no, or leave out if not stated), category (their grouping, e.g. "Sarah\'s Friends", "Bridal Party")',
    hint: 'Usually the largest table in the document. Entries are often written surname-first and may cover a couple: "Ashby, Brooke and McClanahan, Cole" is one entry for two people. Copy the whole string into name and put the count in party_size — do NOT split it yourself. A row like "Yes" or "No" on its own is a section heading marking the RSVP status of everything under it, not a guest.',
  },
  {
    key: 'seating',
    label: 'Seating chart',
    table: 'wedding_guests',
    fields: 'guest_name, table_name (the table label as written, e.g. "Table 1" or "TABLE 3 - 5 ft round"), dietary (anything noted beside their name)',
    hint: 'Sometimes a list per table, sometimes blocks of columns laid out side by side across the page with a table name heading each block. Each person sits at exactly one table.',
  },
  {
    key: 'hair_makeup',
    label: 'Hair and makeup schedule',
    table: 'makeup_schedule',
    fields: 'person (whose hair or makeup it is), service (hair, makeup, or both), time (24h "HH:MM"), stylist (who is doing it, if the document says)',
    hint: 'Often a grid with a time column beside each stylist, so one row can hold several people at the same time under different stylists. A heading row of bare names is usually the stylists themselves, not clients. Ignore anyone listed only as a column heading.',
  },
  {
    key: 'questions',
    label: 'Open questions for the venue',
    table: null,
    fields: 'question (what they are asking or waiting on), topic (a short label like Catering, Timeline, Rooms)',
    hint: 'Many plans end with a list of unresolved points aimed at the venue. These are the single most useful thing in the document and are never anywhere else. Capture them even when phrased as a fragment.',
  },
  {
    key: 'other',
    label: 'Everything else',
    table: null,
    fields: 'heading (what part of the document this came from, e.g. "Payments", "Music Selections", "Gifts"), detail (the fact itself, in one line)',
    hint: 'The catch-all, and it matters. These documents are the couple telling us everything they know, and anything the portal has no column for still has to be readable somewhere rather than dropped. Payments and who owes what, music selections, favours, send-off, gifts, parking, cake details, shower plans, contract terms, anything at all. One entry per fact. Do not repeat something already captured in a section above.',
  },
];

export const SECTION_KEYS = DOC_SECTIONS.map(s => s.key);

/**
 * Chunk long documents on their own page or tab boundaries.
 *
 * Splitting mid-table would hand the model half a vendor list and invite it to
 * guess the rest. The markers extract.js writes are the natural seams.
 *
 * Chunks are small on purpose. Asked to extract everything from a spreadsheet
 * with 88 guests in one call, the model spent over eight minutes generating a
 * single enormous reply — long enough to time out in production and long
 * enough that a failure costs the whole document. Several bounded calls are
 * slower in total and far more likely to finish.
 */
export function chunkDocument(text, maxChars = 12_000) {
  const blocks = String(text || '').split(/(?======\s+(?:PAGE|TAB))/);
  const chunks = [];
  let current = '';
  for (const b of blocks) {
    if (current && current.length + b.length > maxChars) { chunks.push(current); current = ''; }
    // A single block over the limit goes on its own; better an oversized chunk
    // than one cut through the middle of a table.
    current += b;
  }
  if (current.trim()) chunks.push(current);
  return chunks.length ? chunks : [String(text || '')];
}

export function sectionsPrompt({ chunk, coupleNames, weddingDate, part, total }) {
  const spec = DOC_SECTIONS
    .map(s => `"${s.key}" — ${s.label}\n     fields: ${s.fields}\n     where to look: ${s.hint}`)
    .join('\n\n');

  return `This is part of a wedding planning document for ${coupleNames || 'a couple'}${weddingDate ? `, married ${weddingDate}` : ''}, at Rixey Manor. It was written by the couple or their planner, so it follows no particular format.

Pull out the things listed below, in exactly these shapes. Be thorough: this document is the couple telling the venue everything they know, and anything missed here is lost. The last category, "other", is a catch-all for facts the earlier ones have no place for — use it rather than dropping something.

${spec}

Return a JSON object. Every key optional; omit a key entirely rather than returning an empty array.

{
  "dietary":     [ { "guest_name": "...", "allergy": "...", "severity": "...", "notes": "..." } ],
  "vendors":     [ { "vendor_type": "...", "vendor_name": "...", "vendor_contact": "...", "notes": "..." } ],
  "bedrooms":    [ { "room_name": "...", "occupants": "...", "night": "..." } ],
  "decor":       [ { "item_name": "...", "space_name": "...", "source": "...", "notes": "..." } ],
  "bar":         [ { "item_name": "...", "quantity": "...", "unit": "...", "notes": "..." } ],
  "guests":      [ { "name": "...", "party_size": 2, "address": "...", "rsvp": "...", "category": "..." } ],
  "seating":     [ { "guest_name": "...", "table_name": "...", "dietary": "..." } ],
  "hair_makeup": [ { "person": "...", "service": "...", "time": "...", "stylist": "..." } ],
  "questions":   [ { "question": "...", "topic": "..." } ],
  "other":       [ { "heading": "...", "detail": "..." } ]
}

Rules that matter more than completeness:
- Never invent a field. If the document does not give a phone number, a severity or a quantity, leave that field out. A half-filled entry is fine and a person will finish it.
- Copy names exactly as written, including how they are punctuated. Do not reorder "Ashby, Brooke" into "Brooke Ashby" and do not split a name you are unsure about.
- A person listed with two allergies is one entry with both, not two entries.
- Skip anything that is only a heading, a page number, or a running header.
- If this part of the document contains nothing of the kinds listed, return {}.
${total > 1 ? `\nThis is part ${part} of ${total}. Other parts are handled separately — extract only what is in front of you, and ignore fragments cut off at either end.` : ''}

Document:
${chunk}`;
}

/** Merge per-chunk results and drop near-duplicates a split can produce. */
export function mergeSections(results) {
  const merged = {};
  for (const key of SECTION_KEYS) {
    const rows = results.flatMap(r => Array.isArray(r?.[key]) ? r[key] : []);
    if (!rows.length) continue;
    const seen = new Set();
    merged[key] = rows.filter(row => {
      if (!row || typeof row !== 'object') return false;
      const fingerprint = JSON.stringify(row).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 160);
      if (!fingerprint || seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });
  }
  return merged;
}

export function parseSectionsResponse(raw) {
  const match = String(raw || '').match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[0]);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}
