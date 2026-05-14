import { makeEntry, classify, looselyEqual } from '../types.js';
import { getTab, cellAt } from './_helpers.js';

const SECTION = 'Bedroom Assignments';

/**
 * Sheet layout (cols 0-indexed):
 *   col 0 = Bedroom
 *   col 1 = Details
 *   col 3 = Friday occupant 1
 *   col 4 = Friday occupant 2
 *   col 5 = Saturday occupant 1
 *   col 6 = Saturday occupant 2
 *
 * Portal `bedroom_assignments` stores guest_friday / guest_saturday as comma-separated
 * text. We compare normalized "A, B" strings.
 */
function parseBedrooms(rows) {
  const out = [];
  for (let r = 0; r < rows.length; r++) {
    const room = cellAt(rows, r, 0);
    if (!room) continue;
    // Skip the warning row and header row
    if (/we have found in the past|^bedroom$/i.test(room)) continue;
    // Skip sub-rows like " | Queen Room"
    if (/^queen room|twin room|in maple/i.test(room)) continue;

    const friday = [cellAt(rows, r, 3), cellAt(rows, r, 4)].filter(Boolean).join(', ') || null;
    const saturday = [cellAt(rows, r, 5), cellAt(rows, r, 6)].filter(Boolean).join(', ') || null;
    if (!friday && !saturday) continue;

    out.push({ room: room.trim(), friday, saturday });
  }
  return out;
}

function findPortalRoom(portalRows, name) {
  const target = name.toLowerCase();
  return (portalRows || []).find((r) => {
    const rn = (r.room_name || '').toLowerCase();
    return rn === target || rn.includes(target) || target.includes(rn);
  });
}

export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Bedroom Assignments');
    if (!rows) return [];

    const sheetRooms = parseBedrooms(rows);
    const portalRows = portal.bedroom_assignments || [];
    const usedPortalIds = new Set();
    const entries = [];

    for (const sr of sheetRooms) {
      const portalRow = findPortalRoom(portalRows, sr.room);
      if (portalRow) usedPortalIds.add(portalRow.id);

      const id = `bedrooms:${slug(sr.room)}`;

      if (!portalRow) {
        entries.push(makeEntry({
          id: `${id}:create`,
          section: SECTION,
          field: `${sr.room} — create entry`,
          sheetValue: `Fri: ${sr.friday || '(empty)'} · Sat: ${sr.saturday || '(empty)'}`,
          portalValue: null,
          status: 'missing',
          applyOp: {
            type: 'insert',
            table: 'bedroom_assignments',
            row: {
              wedding_id: weddingId,
              room_name: sr.room,
              guest_friday: sr.friday,
              guest_saturday: sr.saturday
            }
          }
        }));
        continue;
      }

      if (sr.friday) {
        entries.push(makeEntry({
          id: `${id}:friday`,
          section: SECTION,
          field: `${sr.room} — Friday`,
          sheetValue: sr.friday,
          portalValue: portalRow.guest_friday || null,
          status: classify(sr.friday, portalRow.guest_friday),
          applyOp: {
            type: 'patch',
            table: 'bedroom_assignments',
            match: { id: portalRow.id },
            patch: { guest_friday: sr.friday }
          }
        }));
      }
      if (sr.saturday) {
        entries.push(makeEntry({
          id: `${id}:saturday`,
          section: SECTION,
          field: `${sr.room} — Saturday`,
          sheetValue: sr.saturday,
          portalValue: portalRow.guest_saturday || null,
          status: classify(sr.saturday, portalRow.guest_saturday),
          applyOp: {
            type: 'patch',
            table: 'bedroom_assignments',
            match: { id: portalRow.id },
            patch: { guest_saturday: sr.saturday }
          }
        }));
      }
    }

    // Portal-only rooms (cottage subdivisions in Lea's case — portal richer than sheet)
    for (const p of portalRows) {
      if (usedPortalIds.has(p.id)) continue;
      entries.push(makeEntry({
        id: `bedrooms:portal-only:${p.id}`,
        section: SECTION,
        field: `${p.room_name} (portal only)`,
        sheetValue: null,
        portalValue: `Fri: ${p.guest_friday || '(empty)'} · Sat: ${p.guest_saturday || '(empty)'}`,
        status: 'sheet-only'
      }));
    }

    return entries;
  }
};

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
