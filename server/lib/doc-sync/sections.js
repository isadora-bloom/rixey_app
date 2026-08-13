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
    key: 'questions',
    label: 'Open questions for the venue',
    table: null,
    fields: 'question (what they are asking or waiting on), topic (a short label like Catering, Timeline, Rooms)',
    hint: 'Many plans end with a list of unresolved points aimed at the venue. These are the single most useful thing in the document and are never anywhere else. Capture them even when phrased as a fragment.',
  },
];

export const SECTION_KEYS = DOC_SECTIONS.map(s => s.key);

/**
 * Chunk long documents on their own page or tab boundaries.
 *
 * Splitting mid-table would hand the model half a vendor list and invite it to
 * guess the rest. The markers extract.js writes are the natural seams.
 */
export function chunkDocument(text, maxChars = 45_000) {
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

Pull out only the things listed below, in exactly these shapes. This is not a summary and not a transcription — anything that does not fit one of these belongs nowhere and should be left out.

${spec}

Return a JSON object. Every key optional; omit a key entirely rather than returning an empty array.

{
  "dietary":   [ { "guest_name": "...", "allergy": "...", "severity": "...", "notes": "..." } ],
  "vendors":   [ { "vendor_type": "...", "vendor_name": "...", "vendor_contact": "...", "notes": "..." } ],
  "bedrooms":  [ { "room_name": "...", "occupants": "...", "night": "..." } ],
  "decor":     [ { "item_name": "...", "space_name": "...", "source": "...", "notes": "..." } ],
  "bar":       [ { "item_name": "...", "quantity": "...", "unit": "...", "notes": "..." } ],
  "questions": [ { "question": "...", "topic": "..." } ]
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
