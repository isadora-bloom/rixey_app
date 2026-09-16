/**
 * Turning an imported spreadsheet row into a guest, and keeping a host's
 * plus-one columns in step with the plus one's own row.
 *
 * Pure, so the rules can be asserted without a database. Two of them have cost
 * real data:
 *
 * A bulk import answered every fault with one 400 saying "weddingId and guests
 * array required", which was wrong about at least two of the three things it
 * covered. A sheet whose name column was never mapped came back with that
 * message and the couple went looking for a missing wedding id.
 *
 * And an update wrote all four plus_one_* columns whether or not the sheet had
 * anything to say about them. Re-importing an RSVP export with no plus-one
 * column deleted every plus one at the wedding, silently, because a blank cell
 * and an absent column looked the same by the time the row got here.
 */
import { parsePlusOneCell } from '../../shared/guest-names.js';

/** Past this, an import is a mistake rather than a big wedding. */
export const BULK_ROW_LIMIT = 2000;

/** Which incoming keys can carry each plus-one field. */
const PLUS_ONE_SOURCE_KEYS = {
  plus_one_name: ['plus_one_name', 'plus_one', 'plusone', 'plus_1'],
  plus_one_rsvp: ['plus_one_rsvp'],
  plus_one_meal_choice: ['plus_one_meal_choice', 'plus_one_meal'],
  plus_one_dietary: ['plus_one_dietary', 'plus_one_dietary_restrictions'],
};

export const PLUS_ONE_FIELDS = Object.keys(PLUS_ONE_SOURCE_KEYS);

function typeName(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * What is wrong with this import, in a sentence that names it.
 *
 * `parsed` is how many rows survived the mapping, and is left out on the first
 * call because the rows have not been built yet.
 */
export function bulkImportFault({ weddingId, guests, parsed } = {}) {
  if (!weddingId) return 'No weddingId';
  if (!Array.isArray(guests)) return `guests must be an array, got ${typeName(guests)}`;
  if (guests.length > BULK_ROW_LIMIT) return `Too many rows: ${guests.length}, the limit is ${BULK_ROW_LIMIT}`;
  if (parsed !== undefined && parsed === 0) {
    return `guests was empty after parsing ${guests.length} rows (no name column?)`;
  }
  return null;
}

/** The first of these keys the row actually carries, or '' when it has none. */
function firstPresent(g, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(g, k)) return g[k];
  }
  return '';
}

/** Which plus-one fields this row has a column for, blank cell or not. */
export function plusOneKeysPresent(g) {
  const out = {};
  for (const [field, keys] of Object.entries(PLUS_ONE_SOURCE_KEYS)) {
    out[field] = keys.some(k => Object.prototype.hasOwnProperty.call(g || {}, k));
  }
  return out;
}

export function parseRsvpValue(raw) {
  if (!raw) return 'pending';
  const lower = String(raw).toLowerCase();
  if (/going|attend|yes|confirm/.test(lower)) return 'yes';
  if (/declin|not coming|no\b|cant|can't/.test(lower)) return 'no';
  if (/maybe|unsure|likely/.test(lower)) return 'maybe';
  return 'pending';
}

/**
 * One spreadsheet row as a guest.
 *
 * A plus one is only ever created because the sheet says so. "No", "n/a" and
 * blank all mean no plus one; a bare "yes" means one was granted without a
 * name; anything else is kept as written. Without this, a column of Yes/No
 * produced guests called "No".
 */
export function buildImportRow(g, weddingId) {
  const plusOne = parsePlusOneCell(firstPresent(g, PLUS_ONE_SOURCE_KEYS.plus_one_name));
  return {
    wedding_id: weddingId,
    first_name: g.first_name || g.firstName || '',
    last_name: g.last_name || g.lastName || null,
    email: g.email || null,
    phone: g.phone || null,
    address: g.address || null,
    rsvp: g.rsvp || 'pending',
    dietary_restrictions: g.dietary_restrictions || g.dietary || null,
    meal_choice: g.meal_choice || g.meal || null,
    table_assignment: g.table_assignment || g.table || null,
    tags: Array.isArray(g.tags) ? g.tags : [],
    notes: g.notes || null,
    plus_one_name: plusOne.name,
    plus_one_rsvp: plusOne.granted ? parseRsvpValue(firstPresent(g, PLUS_ONE_SOURCE_KEYS.plus_one_rsvp)) : 'pending',
    plus_one_meal_choice: plusOne.granted ? (firstPresent(g, PLUS_ONE_SOURCE_KEYS.plus_one_meal_choice) || null) : null,
    plus_one_dietary: plusOne.granted ? (firstPresent(g, PLUS_ONE_SOURCE_KEYS.plus_one_dietary) || null) : null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * What an update is allowed to write onto a guest already on the list.
 *
 * wedding_id and the name are what matched, so they are not rewritten. A
 * plus-one field is only written when the sheet had a column for it: the
 * client sends the columns it mapped and nothing else, so an absent key means
 * the sheet was silent, and silence must not delete anybody.
 */
export function updatePatch(row, source) {
  const { wedding_id: _w, first_name: _f, last_name: _l, ...patch } = row;
  const present = plusOneKeysPresent(source);
  for (const field of PLUS_ONE_FIELDS) {
    if (!present[field]) delete patch[field];
  }
  return patch;
}

/**
 * What to write onto a plus one's own row when their host's row changes.
 *
 * On creation the host's columns are all there is, so they are copied down. On
 * a later edit the plus one may have answered for themselves — through the
 * RSVP form, or because somebody typed it on their row — and a host's save
 * must not undo that. So an answer already on their row stands, and only what
 * is still blank is filled in. 'pending' counts as blank, because it is what a
 * row starts as rather than something anybody said.
 */
export function plusOneRowPatch(host, existing) {
  const patch = {
    wedding_id: host.wedding_id,
    party_id: host.party_id || host.id,
    is_plus_one: true,
    plus_one_of: host.id,
    updated_at: new Date().toISOString(),
  };

  const keep = (column, value) => {
    const current = existing ? existing[column] : null;
    const answered = column === 'rsvp'
      ? !!current && current !== 'pending'
      : current !== null && current !== undefined && String(current).trim() !== '';
    if (!answered) patch[column] = value ?? null;
  };

  keep('rsvp', host.plus_one_rsvp || 'pending');
  keep('meal_choice', host.plus_one_meal_choice || null);
  keep('dietary_restrictions', host.plus_one_dietary || null);
  return patch;
}

/** Split a plus one's name the way the host's column holds it. */
export function splitPlusOneName(raw, isNamed) {
  const wanted = String(raw || '').trim();
  const tidied = wanted.replace(/^[*.\s]+/, '').replace(/[*.\s]+$/, '').trim();
  // A placeholder is kept as written and shown as "Guest"; a single name
  // leaves last_name null so the host's surname stays inherited on read.
  if (!tidied || !isNamed) return { first_name: wanted, last_name: null };
  const parts = tidied.split(/\s+/);
  return {
    first_name: parts.length === 1 ? parts[0] : parts.slice(0, -1).join(' '),
    last_name: parts.length === 1 ? null : parts[parts.length - 1],
  };
}

/**
 * What to write back onto the host when the plus one's own row is edited.
 *
 * The two shapes are both live, deliberately, and this is the direction that
 * was missing: editing a plus one wrote their row, then the next save of their
 * host copied the stale columns straight back over it.
 */
export function hostMirrorPatch(plusOneRow) {
  const patch = {
    plus_one_rsvp: plusOneRow.rsvp || 'pending',
    plus_one_meal_choice: plusOneRow.meal_choice || null,
    plus_one_dietary: plusOneRow.dietary_restrictions || null,
    updated_at: new Date().toISOString(),
  };
  // A row that has been granted but never named leaves the host's column as it
  // is: "+1" there says more than an empty string would.
  const name = [plusOneRow.first_name, plusOneRow.last_name].filter(Boolean).join(' ').trim();
  if (name) patch.plus_one_name = name;
  return patch;
}

/** Run an async job over a list, `size` at a time. */
export async function inChunks(items, size, run) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(run)));
  }
  return out;
}
