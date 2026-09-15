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
  if (lines.length < 2) return { rawHeaders: lines.length ? parseCSVLine(lines[0]) : [], headers: [], guests: [], rawRows: [] }
  const rawHeaders = parseCSVLine(lines[0])
  const rawRows = lines.slice(1).map(parseCSVLine)
  const headers = rawHeaders.map(canonicalHeader)
  const addressPartIdx = headers
    .map((h, i) => (h !== 'address' && ADDRESS_PARTS.some(p => h === p || h.startsWith(p)) ? i : -1))
    .filter(i => i > -1)
  const guests = rawRows.map(values => {
    const obj = {}
    headers.forEach((h, i) => { if (!(h in obj) || values[i]) obj[h] = (values[i] || '').trim() })
    if (!obj.address && addressPartIdx.length) {
      obj.address = addressPartIdx.map(i => (values[i] || '').trim()).filter(Boolean).join(', ')
    }
    return obj
  }).filter(g => g.first_name || g.name)
  return { rawHeaders, headers, guests, rawRows }
}

// ─── Guessing what each column is ────────────────────────────────────────────
//
// An alias list only ever recognises the headers somebody thought of. Real
// sheets say "Emial", or "Friday Night Welcome Party", or ask a whole question
// where a header should be. So every column gets two votes: one from its
// header (exact alias, word overlap, a little spelling slack) and one from its
// values (an @ sign, a run of digits, Accepted/Declined, a house number and a
// street word). The two votes together decide the field and how sure we are.
//
// The one thing content may never do is overrule a header that matched an
// alias exactly. A column headed "Email" is the email column even if every
// value in it is blank or rubbish.

/** Every field a column can be mapped onto, besides tags and ignore. */
export const GUEST_FIELD_KEYS = [
  'first_name', 'last_name', 'name', 'email', 'phone', 'address', 'rsvp',
  'meal_choice', 'dietary_restrictions', 'table_assignment', 'notes',
  'plus_one_name', 'plus_one_rsvp', 'plus_one_meal_choice', 'plus_one_dietary',
]

/** The pieces of an address that parseGuestCsv joins back into one line. */
export const ADDRESS_PART_KEYS = ['address_line', 'city', 'state', 'zip', 'country']

export const FIELD_LABELS = {
  first_name: 'First name',
  last_name: 'Last name',
  name: 'Full name',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  rsvp: 'RSVP',
  meal_choice: 'Meal choice',
  dietary_restrictions: 'Dietary',
  table_assignment: 'Table',
  notes: 'Notes',
  plus_one_name: 'Plus one name',
  plus_one_rsvp: 'Plus one RSVP',
  plus_one_meal_choice: 'Plus one meal',
  plus_one_dietary: 'Plus one dietary',
  address_line: 'Street address',
  city: 'City',
  state: 'State',
  zip: 'Postcode or ZIP',
  country: 'Country',
  ignore: 'Do not import',
}

/** How the chooser groups the fields. Tags are per wedding, so not listed here. */
export const FIELD_GROUPS = [
  { label: 'Guest', keys: ['first_name', 'last_name', 'name', 'email', 'phone', 'address', 'rsvp', 'meal_choice', 'dietary_restrictions', 'table_assignment', 'notes'] },
  { label: 'Plus one', keys: ['plus_one_name', 'plus_one_rsvp', 'plus_one_meal_choice', 'plus_one_dietary'] },
  { label: 'Address parts', keys: ADDRESS_PART_KEYS },
]

/** 'tag:Shuttle' becomes 'Shuttle'; anything else becomes null. */
export function tagLabelOf(key) {
  return typeof key === 'string' && key.startsWith('tag:') && key.length > 4 ? key.slice(4) : null
}

export function isMappableKey(key) {
  if (typeof key !== 'string') return false
  if (key === 'ignore') return true
  if (tagLabelOf(key)) return true
  return GUEST_FIELD_KEYS.includes(key) || ADDRESS_PART_KEYS.includes(key)
}

// Address columns get their own aliases; the whole-address alias list above
// still wins where a sheet has one "Address" column and nothing else.
const ADDRESS_PART_ALIASES = {
  address_line: ['address_line', 'address_line_1', 'address_line_2', 'address_1', 'address_2', 'street_1', 'street_line'],
  city: ['city', 'town'],
  state: ['state', 'province', 'region'],
  zip: ['zip', 'zip_code', 'postal_code', 'postcode', 'post_code'],
  country: ['country'],
}

// Columns that are about how to address an envelope, not about the guest.
const IGNORE_HEADERS = new Set([
  'title', 'suffix', 'prefix', 'salutation', 'honorific', 'id', 'guest_id',
  'party_id', 'household_id', 'row', 'row_number', 'party', 'party_name',
  'household', 'group',
])

// On a tie, the more specific field wins. Lower is better.
const KEY_PRECEDENCE = [
  'plus_one_meal_choice', 'plus_one_dietary', 'plus_one_rsvp', 'plus_one_name',
  'first_name', 'last_name', 'email', 'phone', 'dietary_restrictions',
  'meal_choice', 'table_assignment', 'rsvp', 'address_line', 'city', 'state',
  'zip', 'country', 'address', 'notes', 'name', 'ignore',
]

const ALL_ALIASES = []
for (const [key, aliases] of Object.entries(HEADER_ALIASES)) ALL_ALIASES.push([key, aliases])
for (const [key, aliases] of Object.entries(ADDRESS_PART_ALIASES)) ALL_ALIASES.push([key, aliases])

const EXACT = new Map()
for (const [key, aliases] of ALL_ALIASES) for (const a of aliases) if (!EXACT.has(a)) EXACT.set(a, key)

/** Lowercase, digits kept, everything else an underscore. "Address Line 1" gives "address_line_1". */
function normaliseHeader(raw) {
  return String(raw == null ? '' : raw).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/** The same thing with spaces, for looking for a phrase inside a question. */
function phraseOf(raw) {
  return String(raw == null ? '' : raw).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function singular(token) {
  return token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token
}

/**
 * Damerau-Levenshtein, so a swapped pair of letters costs one rather than two
 * and "Emial" still reaches "email".
 */
function editDistance(a, b) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 3) return 99
  const rows = []
  for (let i = 0; i <= a.length; i++) rows.push(new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) rows[i][0] = i
  for (let j = 0; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2][j - 2] + 1)
      }
      rows[i][j] = best
    }
  }
  return rows[a.length][b.length]
}

/** A near miss counts, at a discount. */
function tokenWeight(aliasToken, headerTokens) {
  if (headerTokens.has(aliasToken)) return { weight: 1, fuzzy: false }
  if (aliasToken.length >= 4) {
    for (const t of headerTokens) {
      if (Math.abs(t.length - aliasToken.length) > 1) continue
      if (editDistance(t, aliasToken) <= 1) return { weight: 0.8, fuzzy: true }
    }
  }
  return { weight: 0, fuzzy: false }
}

// A wedding website exports the question, not a header: "Please let us know if
// you have any dietary restrictions or food allergies...". Length is not the
// signal, the words are. These are checked before word overlap, because a
// question about a guest's full name overlaps with half the alias list.
const PHRASE_RULES = [
  { needles: ['dietary', 'allerg', 'food restriction'], key: 'dietary_restrictions' },
  { needles: ['guest s full name', 'guests full name', 'guest full name', 'plus one', 'plus 1', 'companion'], key: 'plus_one_name' },
  { needles: ['guest name'], key: 'plus_one_name', sentenceOnly: true },
  { needles: ['shuttle', 'transport'], key: 'tag:Shuttle', needsYesNo: true },
  { needles: ['song', 'request'], key: 'notes' },
]

function phraseVote(phrase, wordCount) {
  for (const rule of PHRASE_RULES) {
    if (rule.sentenceOnly && wordCount < 4) continue
    if (rule.needles.some(n => phrase.includes(n))) return rule
  }
  return null
}

/**
 * The header's own opinion, best first. `kind` is 'exact' for an alias hit or
 * a phrase hit (both are taken as settled), otherwise 'token' or 'fuzzy'.
 */
function headerVotes(raw) {
  const n = normaliseHeader(raw)
  if (!n) return []
  const toks = n.split('_').filter(Boolean)
  const singularTokens = toks.map(singular)
  const singularN = singularTokens.join('_')
  if (IGNORE_HEADERS.has(n) || IGNORE_HEADERS.has(singularN)) {
    return [{ key: 'ignore', score: 1, kind: 'exact', via: 'ignore' }]
  }
  const exact = EXACT.get(n) || EXACT.get(singularN)
  if (exact) return [{ key: exact, score: 1, kind: 'exact', via: 'alias' }]
  const phrase = phraseVote(phraseOf(raw), toks.length)
  if (phrase) return [{ key: phrase.key, score: 0.95, kind: 'exact', via: 'phrase', needsYesNo: !!phrase.needsYesNo }]

  const headerTokens = new Set(singularTokens)
  const votes = []
  for (const [key, aliases] of ALL_ALIASES) {
    let best = 0
    let fuzzy = false
    for (const alias of aliases) {
      const aliasTokens = alias.split('_').filter(Boolean).map(singular)
      let matched = 0
      let usedFuzzy = false
      for (const at of aliasTokens) {
        const hit = tokenWeight(at, headerTokens)
        matched += hit.weight
        if (hit.fuzzy) usedFuzzy = true
      }
      if (!matched) continue
      const score = ((matched / aliasTokens.length) * 0.6 + (matched / toks.length) * 0.4) * 0.9
      if (score > best) { best = score; fuzzy = usedFuzzy }
    }
    if (best > 0) votes.push({ key, score: best, kind: fuzzy ? 'fuzzy' : 'token' })
  }
  return sortCandidates(votes)
}

function sortCandidates(votes) {
  return votes.slice().sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.02) return b.score - a.score
    return KEY_PRECEDENCE.indexOf(a.key) - KEY_PRECEDENCE.indexOf(b.key)
  })
}

// ── What the values look like ────────────────────────────────────────────────

// Every wedding-website export writes its own word for the same three answers.
const RSVP_WORDS = new Set([
  'yes', 'no', 'y', 'n', 'accepted', 'accept', 'declined', 'decline', 'attending',
  'not attending', 'notattending', 'going', 'not going', 'maybe', 'pending',
  'tentative', 'regrets', 'no response', 'noresponse', 'awaiting response',
  'awaiting', 'invited', 'true', 'false', 'coming', 'not coming',
])

const STREET_WORDS = new Set([
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'lane', 'ln', 'drive', 'dr',
  'way', 'blvd', 'boulevard', 'court', 'ct', 'place', 'pl', 'terrace', 'ter',
  'circle', 'cir', 'highway', 'hwy', 'route', 'rte', 'trail', 'parkway', 'pkwy',
])

const US_STATES = new Set(['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR'])

/** True when the first letter is a letter with case and it is the capital of it. */
function isCapitalised(word) {
  if (!word) return false
  const first = word[0]
  if (first.toLowerCase() === first.toUpperCase()) return false
  if (first !== first.toUpperCase()) return false
  return !(word.length > 3 && word === word.toUpperCase())
}

function looksLikePhone(value) {
  const digits = value.replace(/[^0-9]/g, '')
  if (digits.length < 7 || digits.length > 15) return false
  return value.replace(/[0-9\s()+.\-x/]/gi, '').length === 0
}

function looksLikeAddress(value) {
  const words = value.split(/[\s,]+/).filter(Boolean)
  if (words.length < 3) return false
  if (!/^[0-9]+[a-zA-Z]?$/.test(words[0])) return false
  return words.some(w => STREET_WORDS.has(w.toLowerCase().replace(/[.,]/g, '')))
}

function looksLikeTable(value) {
  const words = value.split(/\s+/)
  if (words[0].toLowerCase() === 'table') return true
  if (!/^[0-9]{1,3}$/.test(value)) return false
  const n = Number(value)
  return n >= 1 && n <= 999
}

/** Which of the content classes a single value could belong to. */
function valueClasses(value) {
  const out = []
  const lower = value.toLowerCase()
  if (value.includes('@') && !value.includes(' ')) out.push('email')
  if (/^[0-9]{5}(-[0-9]{4})?$/.test(value)) out.push('zip')
  if (value.length === 2 && US_STATES.has(value.toUpperCase())) out.push('state')
  if (looksLikePhone(value)) out.push('phone')
  if (RSVP_WORDS.has(lower)) out.push('rsvp')
  if (looksLikeTable(value)) out.push('table_assignment')
  if (looksLikeAddress(value)) out.push('address')
  const words = value.split(/\s+/).filter(Boolean)
  if (words.length >= 2 && words.length <= 4 && words.every(isCapitalised)) out.push('name')
  if (words.length === 1 && isCapitalised(value) && value.length <= 30) out.push('word')
  return out
}

// Checked in this order, so "Yes" is an RSVP answer rather than a single
// capitalised word and "VA" is a state rather than a name.
const CONTENT_ORDER = ['email', 'zip', 'state', 'phone', 'rsvp', 'table_assignment', 'address', 'name', 'word']

/** Ratio of the non-empty values falling into each class. */
function contentRatios(values) {
  const counts = {}
  for (const v of values) for (const c of valueClasses(v)) counts[c] = (counts[c] || 0) + 1
  const ratios = {}
  for (const c of CONTENT_ORDER) ratios[c] = values.length ? (counts[c] || 0) / values.length : 0
  return ratios
}

/** The values' own opinion, or null when they do not agree on anything. */
function contentVote(values) {
  if (values.length < 2) return null
  const ratios = contentRatios(values)
  // A column of first names is single words; a column of full names is pairs.
  // Together they are still a name column, so they vote as one.
  const nameish = ratios.name + ratios.word
  for (const cls of CONTENT_ORDER) {
    if (cls === 'name' || cls === 'word') break
    if (ratios[cls] >= 0.6) return { key: cls, score: ratios[cls], ratios }
  }
  if (nameish >= 0.7) {
    return { key: ratios.name >= ratios.word ? 'name' : 'word', score: nameish, ratios }
  }
  return { key: null, score: 0, ratios }
}

// Which header field a content class is happy to sit in.
const CONTENT_AGREES = {
  email: ['email'],
  zip: ['zip'],
  state: ['state'],
  phone: ['phone'],
  rsvp: ['rsvp', 'plus_one_rsvp'],
  table_assignment: ['table_assignment'],
  address: ['address', 'address_line'],
  name: ['name', 'plus_one_name'],
  word: ['first_name', 'last_name', 'name', 'plus_one_name', 'city', 'country'],
}

/** The field a content class stands for on its own, with no header to help. */
const CONTENT_FIELD = {
  email: 'email', zip: 'zip', state: 'state', phone: 'phone', rsvp: 'rsvp',
  table_assignment: 'table_assignment', address: 'address', name: 'name', word: null,
}

const PLUS_ONE_TWIN = {
  dietary_restrictions: 'plus_one_dietary',
  meal_choice: 'plus_one_meal_choice',
  name: 'plus_one_name',
  rsvp: 'plus_one_rsvp',
  first_name: 'plus_one_name',
}

/** A tag label people will recognise in the filter list. */
function tagLabelFor(raw) {
  const tidy = String(raw || '').replace(/\s+/g, ' ').trim()
  return tidy.length > 48 ? `${tidy.slice(0, 45).trim()}...` : tidy
}

function isFreeText(values) {
  if (values.length < 2) return false
  const long = values.filter(v => v.length >= 12 && v.includes(' ')).length
  return long / values.length >= 0.5
}

/**
 * Guess what every column in a sheet is.
 *
 * `rows` may be arrays of values in column order or objects keyed by the raw
 * header. Returns one entry per column, in column order:
 * `{ raw, key, confidence, reason, samples }`.
 */
export function inferColumns(rawHeaders, rows) {
  const headers = (rawHeaders || []).map(h => String(h == null ? '' : h))
  const source = Array.isArray(rows) ? rows.slice(0, 500) : []
  const cols = headers.map((raw, i) => {
    const values = []
    for (const row of source) {
      if (values.length >= 50) break
      const v = Array.isArray(row) ? row[i] : (row && typeof row === 'object' ? row[raw] : undefined)
      const s = String(v == null ? '' : v).trim()
      if (s) values.push(s)
    }
    const hv = headerVotes(raw)
    const cv = contentVote(values)
    return {
      raw, index: i, values, samples: values.slice(0, 3), hv, cv,
      key: null, confidence: 'low', reason: '', locked: false, score: 0,
    }
  })

  // 1. The first pass: what each column says about itself.
  for (const col of cols) {
    const head = col.hv[0] || null
    const cont = col.cv && col.cv.key ? col.cv : null
    if (head && head.kind === 'exact') {
      // A shuttle question with no yes-or-no answers in it is somebody's notes.
      if (head.needsYesNo && cont && cont.key !== 'rsvp' && isFreeText(col.values)) {
        col.key = 'notes'
        col.confidence = 'medium'
        col.reason = 'The header asks about the shuttle, but the answers are written out, so they are kept as notes.'
        col.score = 0.6
        continue
      }
      col.key = head.key
      col.locked = true
      col.score = 1
      col.confidence = 'high'
      const tag = tagLabelOf(head.key)
      if (head.via === 'ignore') col.reason = 'Not a guest field, so it is left out.'
      else if (tag) col.reason = `The header asks about the ${tag.toLowerCase()}, so it becomes a tag.`
      else if (head.via === 'phrase') col.reason = `The wording of the header points at ${(FIELD_LABELS[head.key] || head.key).toLowerCase()}.`
      else col.reason = `The header matches ${FIELD_LABELS[head.key] || head.key} exactly.`
      continue
    }
    if (head && cont && (CONTENT_AGREES[cont.key] || []).includes(head.key)) {
      col.key = head.key
      col.score = Math.max(head.score, 0.8)
      col.confidence = 'high'
      col.reason = `The header looks like ${FIELD_LABELS[head.key] || head.key} and the values agree.`
      continue
    }
    if (head && head.score >= 0.55) {
      col.key = head.key
      col.score = head.score
      col.confidence = 'medium'
      col.reason = `The header reads like ${FIELD_LABELS[head.key] || head.key}.`
      continue
    }
    if (cont && CONTENT_FIELD[cont.key]) {
      col.key = CONTENT_FIELD[cont.key]
      col.score = cont.score * 0.8
      col.confidence = 'medium'
      col.reason = describeContent(cont.key)
      continue
    }
  }

  // 2. Event columns. A wedding-website export has one column per event, all
  // holding Accepted / Declined / No Response. Only one of them can be the
  // RSVP; the rest are what the guest is coming to, which is a tag.
  const eventCols = cols.filter(c => c.cv && c.cv.ratios.rsvp >= 0.7 && !(c.locked && c.key !== 'rsvp'))
  if (eventCols.length) {
    const named = needle => eventCols.find(c => phraseOf(c.raw).split(' ').includes(needle))
    const exactRsvp = eventCols.find(c => c.locked && c.key === 'rsvp')
    const byName = named('reception') || named('ceremony') || named('wedding')
    const chosen = exactRsvp || byName || eventCols[0]
    for (const col of eventCols) {
      if (col === chosen) {
        col.key = 'rsvp'
        col.locked = true
        col.score = 1
        if (exactRsvp === col || byName === col) {
          col.confidence = 'high'
          col.reason = eventCols.length > 1
            ? 'Several columns hold event answers; this is the one for the wedding itself.'
            : 'The header and the Accepted or Declined answers both say RSVP.'
        } else {
          col.confidence = 'medium'
          col.reason = 'The only column holding Accepted or Declined answers, so it is taken as the RSVP.'
        }
        continue
      }
      col.key = `tag:${tagLabelFor(col.raw)}`
      col.locked = true
      col.score = 1
      col.confidence = 'high'
      col.reason = 'Accepted or Declined answers for another event, so guests who accepted get this tag.'
    }
  }

  // 3. A single capitalised word next to another one is a first and a last
  // name, in that order, when nothing else claimed them.
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]
    if (col.key || !col.cv || col.cv.key !== 'word') continue
    const before = cols[i - 1]
    const after = cols[i + 1]
    if (after && !after.key && after.cv && after.cv.key === 'word') {
      col.key = 'first_name'
      col.confidence = 'low'
      col.reason = 'Single names, with another column of single names beside it, so this is the first name.'
      after.key = 'last_name'
      after.confidence = 'low'
      after.reason = 'The column after the first names, so this is taken as the surname.'
      after.score = 0.4
      col.score = 0.4
      i++
      continue
    }
    if (before && before.key === 'first_name') {
      col.key = 'last_name'
      col.confidence = 'low'
      col.score = 0.4
      col.reason = 'Single names following the first names, so this is taken as the surname.'
    }
  }

  // 4. Whatever is left. Free text is worth keeping as a note; the rest is not
  // worth guessing at.
  for (const col of cols) {
    if (col.key) continue
    if (isFreeText(col.values)) {
      col.key = 'notes'
      col.score = 0.3
      col.confidence = 'low'
      col.reason = 'Sentences rather than a field, so they are kept as notes.'
    } else {
      col.key = 'ignore'
      col.score = 0.1
      col.confidence = 'low'
      col.reason = col.values.length ? 'Nothing here looks like a guest field.' : 'The column is empty.'
    }
  }

  // 5. The same header twice is the guest's answer and then their plus one's.
  const seenHeader = new Map()
  for (const col of cols) {
    const n = normaliseHeader(col.raw)
    if (!n) continue
    const first = seenHeader.get(n)
    if (first === undefined) { seenHeader.set(n, col); continue }
    const twin = PLUS_ONE_TWIN[col.key]
    if (twin && first.key === col.key) {
      col.key = twin
      col.confidence = first.confidence
      col.reason = 'The same question a second time, so this answer is the plus one\'s.'
    }
  }

  // 6. Two columns cannot land in the same field. The surer one keeps it.
  const taken = new Map()
  const order = cols.slice().sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0) || b.score - a.score || a.index - b.index)
  for (const col of order) {
    if (col.key === 'ignore' || tagLabelOf(col.key)) continue
    const holder = taken.get(col.key)
    if (holder === undefined) { taken.set(col.key, col); continue }
    const alt = col.hv.map(v => v.key).find(k => k !== col.key && !taken.has(k) && isMappableKey(k))
    if (alt) {
      col.key = alt
      taken.set(alt, col)
    } else {
      col.key = 'ignore'
      col.reason = `Another column is already the ${FIELD_LABELS[holder.key] || holder.key}.`
    }
    col.confidence = 'low'
  }

  return cols.map(c => ({
    raw: c.raw,
    key: c.key,
    confidence: c.confidence,
    reason: c.reason,
    samples: c.samples,
  }))
}

function describeContent(cls) {
  switch (cls) {
    case 'email': return 'Most of the values hold an @ sign.'
    case 'phone': return 'Most of the values are phone numbers.'
    case 'zip': return 'Most of the values are postcodes.'
    case 'state': return 'Most of the values are two-letter state codes.'
    case 'rsvp': return 'The values are yes, no and maybe answers.'
    case 'table_assignment': return 'The values are small numbers or say "Table".'
    case 'address': return 'The values have a house number and a street.'
    case 'name': return 'The values are two capitalised words.'
    default: return 'Guessed from the values.'
  }
}

// What counts as a yes in a column kept as a tag.
const TRUTHY = new Set(['yes', 'y', 'true', 'x', '1', 'accepted', 'attending', 'going', 'coming'])

/**
 * Build the guest rows from a confirmed mapping.
 *
 * `keys` is one target field per column, in column order. Returns
 * `[{ guest, raw }]`, where `raw` is the old canonical-header object so the
 * caller's existing RSVP and tag handling keeps working unchanged.
 */
export function applyColumnMapping(rawHeaders, rawRows, keys) {
  const headers = (rawHeaders || []).map(h => String(h == null ? '' : h))
  const canonical = headers.map(canonicalHeader)
  const mapped = headers.map((h, i) => (isMappableKey(keys && keys[i]) ? keys[i] : 'ignore'))
  const out = []
  for (const row of rawRows || []) {
    const guest = {}
    const rawObj = {}
    const addressBits = []
    const tags = []
    headers.forEach((h, i) => {
      const value = String((Array.isArray(row) ? row[i] : row && row[h]) || '').trim()
      const c = canonical[i]
      if (!(c in rawObj) || value) rawObj[c] = value
      const key = mapped[i]
      if (key === 'ignore') return
      const tag = tagLabelOf(key)
      if (tag) {
        if (TRUTHY.has(value.toLowerCase()) && !tags.includes(tag)) tags.push(tag)
        return
      }
      if (key === 'address' || ADDRESS_PART_KEYS.includes(key)) {
        if (value) addressBits.push(value)
        return
      }
      if (!(key in guest) || value) guest[key] = value
    })
    if (addressBits.length) guest.address = addressBits.join(', ')
    guest.tags = tags
    if (guest.first_name || guest.name) out.push({ guest, raw: rawObj })
  }
  return out
}
