// Reads a guest-list CSV, however the columns are named.
//
// The portal's own export writes labels ("Plus one", "Table"), Zola and The
// Knot write their own, Excel writes CRLF and sometimes a byte-order mark, and
// a hand-made sheet writes anything at all. Everything here is pure so it can
// be tested without a browser; the component does the RSVP normalising and
// tag building on top.

/** Parse one CSV line, handling quoted fields (commas inside quotes, doubled quotes). */
export function parseCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      current += ch; i++
    } else {
      if (ch === '"') { inQuotes = true; i++; continue }
      if (ch === ',') { fields.push(current.trim()); current = ''; i++; continue }
      current += ch; i++
    }
  }
  fields.push(current.trim())
  return fields
}

/** Header names people actually use, mapped onto the guest columns. */
export const HEADER_ALIASES = {
  first_name: ['first_name', 'firstname', 'first', 'given_name'],
  last_name: ['last_name', 'lastname', 'last', 'surname', 'family_name'],
  name: ['name', 'full_name', 'guest_name', 'guest', 'fullname'],
  email: ['email', 'e_mail', 'email_address', 'emailaddress'],
  phone: ['phone', 'phone_number', 'mobile', 'cell', 'telephone', 'tel'],
  address: ['address', 'mailing_address', 'street_address', 'postal_address'],
  rsvp: ['rsvp', 'rsvp_status', 'attending', 'response'],
  meal_choice: ['meal_choice', 'meal', 'entree', 'main', 'dinner'],
  dietary_restrictions: ['dietary_restrictions', 'dietary', 'diet', 'allergies', 'allergy', 'dietary_needs', 'dietary_requirements'],
  table_assignment: ['table_assignment', 'table', 'table_number', 'table_no'],
  plus_one_name: ['plus_one_name', 'plus_one', 'plusone', 'guest_of', 'partner', 'companion'],
  plus_one_rsvp: ['plus_one_rsvp'],
  plus_one_meal_choice: ['plus_one_meal_choice', 'plus_one_meal'],
  plus_one_dietary: ['plus_one_dietary', 'plus_one_dietary_restrictions'],
  notes: ['notes', 'note', 'comments', 'comment'],
}

const CANONICAL = new Map()
for (const [key, aliases] of Object.entries(HEADER_ALIASES)) for (const a of aliases) CANONICAL.set(a, key)

// An address split across several columns is joined back into one line in
// the order the columns appear.
const ADDRESS_PARTS = ['address_', 'address_line', 'street', 'city', 'town', 'state', 'county', 'province', 'zip', 'postal_code', 'postcode', 'country']

export function canonicalHeader(raw) {
  const k = String(raw || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return CANONICAL.get(k) || k
}

/**
 * Turn CSV text into `{ rawHeaders, headers, guests }`, where each guest is
 * a plain object keyed by canonical column and every row without a first
 * name or a full name is dropped. Nothing is normalised beyond the names of
 * the columns and the address join; the caller decides what "yes" means.
 */
export function parseGuestCsv(text) {
  // Strip a leading byte-order mark (U+FEFF) by code point rather than with a
  // regex literal, so no invisible character has to survive in this file.
  const raw = String(text || '')
  const body = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
  const lines = body.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return { rawHeaders: lines.length ? parseCSVLine(lines[0]) : [], headers: [], guests: [] }
  const rawHeaders = parseCSVLine(lines[0])
  const headers = rawHeaders.map(canonicalHeader)
  const addressPartIdx = headers
    .map((h, i) => (h !== 'address' && ADDRESS_PARTS.some(p => h === p || h.startsWith(p)) ? i : -1))
    .filter(i => i > -1)
  const guests = lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const obj = {}
    headers.forEach((h, i) => { if (!(h in obj) || values[i]) obj[h] = (values[i] || '').trim() })
    if (!obj.address && addressPartIdx.length) {
      obj.address = addressPartIdx.map(i => (values[i] || '').trim()).filter(Boolean).join(', ')
    }
    return obj
  }).filter(g => g.first_name || g.name)
  return { rawHeaders, headers, guests }
}
