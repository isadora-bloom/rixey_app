import { makeEntry, classify, looselyEqual } from '../types.js';
import { getTab } from './_helpers.js';

const SECTION = 'Vendors';

/**
 * Map a sheet vendor-type label to a canonical portal vendor_type. Multiple sheet labels
 * can map to one canonical (e.g. "Caterering for Wedding" → "Caterer"). Returns null
 * for "Other" / blank slots.
 */
const TYPE_MAP = [
  [/cater(ering|ing) for wedding/i, 'Caterer'],
  [/cater(ing|ering) for rehearsal/i, 'Catering for Rehearsal'],
  [/cater(ing|ering) for saturday/i, 'Catering for Saturday Lunch'],
  [/cater(ing|ering) for sunday/i, 'Catering for Sunday Brunch'],
  [/^linens/i, 'Linens'],
  [/^tent/i, 'Tent'],
  [/^rentals?$/i, 'Rentals'],
  [/^dj$/i, 'DJ'],
  [/florist/i, 'Florist'],
  [/photographer/i, 'Photographer'],
  [/videographer/i, 'Videographer'],
  [/officiant/i, 'Officiant'],
  [/shuttle/i, 'Shuttle'],
  [/^hair.*makeup$/i, 'HAIR_AND_MAKEUP'], // expands to two entries
  [/^hair$/i, 'Hair'],
  [/^makeup$/i, 'Makeup'],
  [/photo ?booth/i, 'Photo Booth'],
  [/^cake$/i, 'Cake'],
  [/^dessert$/i, 'Dessert']
];

function mapType(label) {
  if (!label) return null;
  for (const [re, canonical] of TYPE_MAP) {
    if (re.test(label.trim())) return canonical;
  }
  // Skip "Other" placeholder rows
  if (/^other$/i.test(label.trim())) return null;
  return label.trim();
}

function findPortalVendor(checklist, canonicalType) {
  if (!canonicalType) return null;
  return (checklist || []).find((v) => {
    const t = (v.vendor_type || '').toLowerCase();
    return t === canonicalType.toLowerCase() || t.includes(canonicalType.toLowerCase()) || canonicalType.toLowerCase().includes(t);
  });
}

export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Vendors');
    if (!rows) return [];

    const entries = [];
    const checklist = portal.vendor_checklist || [];
    const usedPortalIds = new Set();

    // Row 0 = headers. Walk data rows.
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const rawType = (row[0] || '').toString().trim();
      const name = (row[1] || '').toString().trim();
      const phone = (row[2] || '').toString().trim();
      const arrival = (row[3] || '').toString().trim();
      const departure = (row[4] || '').toString().trim();
      const instagram = (row[7] || '').toString().trim();
      const notes = (row[8] || '').toString().trim();

      if (!rawType && !name) continue;
      const canonical = mapType(rawType);
      if (!canonical) continue;
      // "n/a" / "none" name → skip
      if (name && /^(n\/a|none|tbd|-)$/i.test(name)) continue;

      const canonicalsToProcess =
        canonical === 'HAIR_AND_MAKEUP' ? ['Hair', 'Makeup'] : [canonical];

      for (const cType of canonicalsToProcess) {
        const portalRow = findPortalVendor(checklist, cType);
        if (portalRow) usedPortalIds.add(portalRow.id);

        const id = `vendors:${slug(cType)}`;

        if (!portalRow && name) {
          entries.push(
            makeEntry({
              id: `${id}:name`,
              section: SECTION,
              field: `${cType} — vendor`,
              sheetValue: name,
              portalValue: null,
              status: 'missing',
              applyOp: {
                type: 'insert',
                table: 'vendor_checklist',
                row: {
                  wedding_id: weddingId,
                  vendor_type: cType,
                  vendor_name: name,
                  contact_phone: phone || null,
                  arrival_time: arrival || null,
                  departure_time: departure || null,
                  instagram_handle: instagram || null,
                  notes: notes || null,
                  is_booked: true
                }
              }
            })
          );
          continue;
        }

        if (!portalRow && !name) continue; // both empty, skip

        // Existing portal row — diff fields
        const fields = [
          ['name', 'name', name || null, portalRow?.vendor_name || null],
          ['phone', 'phone', phone || null, portalRow?.contact_phone || null],
          ['arrival', 'arrival time', arrival || null, portalRow?.arrival_time || null],
          ['departure', 'departure time', departure || null, portalRow?.departure_time || null],
          ['instagram', 'Instagram', instagram || null, portalRow?.instagram_handle || null],
          ['notes', 'notes', notes || null, portalRow?.notes || null]
        ];

        for (const [fk, fLabel, sv, pv] of fields) {
          const status = classify(sv, pv);
          if (status === 'both-missing') continue;
          const fieldName =
            fk === 'name'
              ? `${cType} — vendor`
              : `${cType} — ${fLabel}`;
          const patchCol =
            fk === 'name' ? 'vendor_name' :
            fk === 'phone' ? 'contact_phone' :
            fk === 'arrival' ? 'arrival_time' :
            fk === 'departure' ? 'departure_time' :
            fk === 'instagram' ? 'instagram_handle' :
            'notes';
          entries.push(
            makeEntry({
              id: `${id}:${fk}`,
              section: SECTION,
              field: fieldName,
              sheetValue: sv,
              portalValue: pv,
              status,
              applyOp: {
                type: 'patch',
                table: 'vendor_checklist',
                match: { id: portalRow.id },
                patch: { [patchCol]: sv }
              }
            })
          );
        }
      }
    }

    // Surface portal vendors that aren't represented in the sheet (read-only entries)
    for (const v of checklist) {
      if (usedPortalIds.has(v.id)) continue;
      entries.push(
        makeEntry({
          id: `vendors:portal-only:${v.id}`,
          section: SECTION,
          field: `${v.vendor_type} (portal only)`,
          sheetValue: null,
          portalValue: v.vendor_name,
          status: 'sheet-only'
        })
      );
    }

    return entries;
  }
};

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
