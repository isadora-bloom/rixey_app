/**
 * Committing a seating chart onto the guest list.
 *
 * A chart lists people. The guest list holds rows, and since migration 025 a
 * row is a person too, so the two finally line up. Before 025 a plus one had
 * no row of their own and the only thing of theirs on their host's row was a
 * seat, so both shapes are handled here rather than assumed.
 *
 * Lifted out of server/index.js so the matching can be tested without a
 * database. The old version read the guest list without `is_plus_one`, which
 * sent shared/guest-names.js down the pre-025 path on post-025 data: a chart
 * line saying "Cole" found nobody called that, fell through to the bare-name
 * pass, and wrote Cole's first name onto Brooke's row. Her name, her notes and
 * her RSVP went with it.
 */
import crypto from 'node:crypto';
import { allPeople, hasPlusOne, isNamedPerson } from '../../shared/guest-names.js';

// is_plus_one, party_id and plus_one_of are not optional here: allPeople()
// decides which model it is looking at from the rows themselves, and without
// them it reads post-025 data as pre-025 and matches the wrong people.
export const SEATING_SELECT =
  'id, first_name, last_name, plus_one_name, is_plus_one, party_id, plus_one_of, table_assignment';

const PAGE = 1000;

export function nameKey(full) {
  return String(full || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** The whole guest list, not the first thousand of it. */
export async function readGuestsForSeating(supabase, weddingId) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('wedding_guests')
      .select(SEATING_SELECT)
      .eq('wedding_id', weddingId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not read the guest list: ${error.message}`);
    const page = data || [];
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

/**
 * One index of people, by the name each of them shows under.
 *
 * `sharesRow` is the whole point of it: a plus one who has no row of their own
 * can only be given a seat, because everything else on that row belongs to
 * their host. A plus one who does have a row is a person like any other and
 * takes their own notes, allergies and RSVP.
 */
export function buildSeatingIndex(existingGuests) {
  const rows = existingGuests || [];
  const index = new Map();
  // First match wins, so a real guest of that name always beats a derived one.
  const put = (key, entry) => { if (key && !index.has(key)) index.set(key, entry); };

  for (const person of allPeople(rows)) {
    const row = person.row;
    if (!row?.id || !person.name) continue;
    put(nameKey(person.name), {
      rowId: row.id,
      isPlusOne: !!person.isPlusOne,
      sharesRow: !!person.isPlusOne && !row.is_plus_one,
    });
  }

  // A chart may also use the bare name the couple typed, without the surname
  // inherited from their host. Added second for the same reason.
  for (const g of rows) {
    if (!hasPlusOne(g) || !isNamedPerson(g.plus_one_name)) continue;
    const own = rows.find(r => r.is_plus_one && r.plus_one_of === g.id);
    put(nameKey(g.plus_one_name), own
      ? { rowId: own.id, isPlusOne: true, sharesRow: false }
      : { rowId: g.id, isPlusOne: true, sharesRow: true });
  }

  return index;
}

/**
 * What a charted line is allowed to write onto a row it matched.
 *
 * Names are left alone on an update: the row was found by its name, so it
 * already has it, and writing the split-out surname back would turn a plus
 * one's inherited surname into a stored one. Empty cells are left alone too,
 * because a chart with no RSVP column used to set every guest on it back to
 * pending, and a chart with no notes column wiped the notes.
 */
export function seatingPayload(guest, { includeName = false } = {}) {
  const payload = {
    table_assignment: guest.table_assignment ?? null,
    updated_at: new Date().toISOString(),
  };
  if (includeName) {
    payload.first_name = guest.first_name;
    payload.last_name = guest.last_name ?? null;
  }
  if (guest.notes) payload.notes = guest.notes;
  if (guest.dietary_restrictions) payload.dietary_restrictions = guest.dietary_restrictions;
  if (guest.rsvp) payload.rsvp = guest.rsvp;
  return payload;
}

/**
 * Work out every write the chart implies, before making any of them.
 *
 * Pure, so the matching can be asserted without a database, and so the writes
 * can then go out in batches rather than one round trip per guest. A 300-seat
 * chart was 300 sequential updates, which is most of Railway's 50 seconds.
 */
export function planSeating(tables, index) {
  const writes = new Map();       // row id -> { name, payload }
  const inserts = [];             // { key, name, row }
  const warnings = [];
  const assignedTable = new Map();  // row id -> the table already set on it
  const plannedNew = new Map();     // name key -> index into inserts
  const seatedIds = new Set();
  const updatedIds = new Set();

  for (const table of tables || []) {
    for (const guest of table.guests || []) {
      const full = [guest.first_name, guest.last_name].filter(Boolean).join(' ');
      const key = nameKey(full);
      const hit = index.get(key);

      if (hit) {
        const already = assignedTable.get(hit.rowId);
        if (already !== undefined && already !== guest.table_assignment) {
          warnings.push(hit.sharesRow
            ? `${full} is charted at ${guest.table_assignment} but shares a row with someone already seated at ${already}. Left as ${already}.`
            : `${full} is charted at both ${already} and ${guest.table_assignment}. Left as ${already}.`);
          continue;
        }
        const payload = hit.sharesRow
          ? { table_assignment: guest.table_assignment ?? null, updated_at: new Date().toISOString() }
          : seatingPayload(guest);
        const existing = writes.get(hit.rowId);
        writes.set(hit.rowId, { name: existing?.name || full, payload: { ...(existing?.payload || {}), ...payload } });
        assignedTable.set(hit.rowId, guest.table_assignment ?? null);
        if (hit.sharesRow) seatedIds.add(hit.rowId); else updatedIds.add(hit.rowId);
        continue;
      }

      const plannedAt = plannedNew.get(key);
      if (plannedAt !== undefined) {
        const planned = inserts[plannedAt];
        if (planned.row.table_assignment !== (guest.table_assignment ?? null)) {
          warnings.push(`${full} appears twice on the chart, at ${planned.row.table_assignment} and at ${guest.table_assignment}. Seated at ${planned.row.table_assignment}.`);
        }
        continue;
      }

      // A name on the chart that matches nobody. Added as a guest in their own
      // right, with no plus one, because nothing here says they have one. Head
      // of their own party: migration 027's trigger would fill party_id in as
      // well, but a path that only works because of a trigger breaks on any
      // database where the trigger has not been run.
      const id = crypto.randomUUID();
      plannedNew.set(key, inserts.length);
      inserts.push({ key, name: full, row: { id, party_id: id, ...seatingPayload(guest, { includeName: true }) } });
    }
  }

  return {
    writes: [...writes].map(([rowId, w]) => ({ rowId, ...w })),
    inserts,
    warnings,
    seatedIds,
    updatedIds,
  };
}

/** Run an async job over a list, `size` at a time. */
async function inChunks(items, size, run) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(run)));
  }
  return out;
}

/** Write a parsed chart onto the guest list. */
export async function commitSeatingToGuests(supabase, weddingId, tables, replaceExisting) {
  if (replaceExisting) {
    const { error } = await supabase
      .from('wedding_guests')
      .update({ table_assignment: null })
      .eq('wedding_id', weddingId);
    // Half-cleared seating read back as a finished import is worse than a
    // refusal, so this stops rather than carries on.
    if (error) throw new Error(`Could not clear the existing seating: ${error.message}`);
  }

  const existingGuests = await readGuestsForSeating(supabase, weddingId);
  const plan = planSeating(tables, buildSeatingIndex(existingGuests));
  const warnings = [...plan.warnings];

  const failedIds = new Set();
  await inChunks(plan.writes, 50, async ({ rowId, name, payload }) => {
    const { error } = await supabase.from('wedding_guests').update(payload).eq('id', rowId);
    if (error) {
      failedIds.add(rowId);
      warnings.push(`${name || 'A guest'} could not be seated: ${error.message}`);
    }
  });

  // Inserted in batches rather than one at a time, and the batch reports the
  // names it was carrying when it fails.
  let created = 0;
  for (let i = 0; i < plan.inserts.length; i += 50) {
    const chunk = plan.inserts.slice(i, i + 50);
    const { data, error } = await supabase
      .from('wedding_guests')
      .insert(chunk.map(c => ({ wedding_id: weddingId, ...c.row })))
      .select('id');
    if (error) {
      // Counted as created even when it never landed, before this. Warn rather
      // than inflate the summary the admin reads back.
      warnings.push(`${chunk.length} guest${chunk.length === 1 ? '' : 's'} on the chart could not be added (${chunk.map(c => c.name || 'unnamed').slice(0, 5).join(', ')}${chunk.length > 5 ? ', …' : ''}): ${error.message}`);
      continue;
    }
    created += (data || chunk).length;
  }

  const countOf = ids => [...ids].filter(id => !failedIds.has(id)).length;
  return {
    created,
    updated: countOf([...plan.updatedIds].filter(id => !plan.seatedIds.has(id))),
    seatedAsPlusOne: countOf(plan.seatedIds),
    warnings,
  };
}
