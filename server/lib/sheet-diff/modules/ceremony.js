import { makeEntry, classify, looselyEqual } from '../types.js';
import { getTab, cellAt } from './_helpers.js';

const SECTION = 'Ceremony';

/**
 * Sheet has 4 ceremony blocks side-by-side:
 *   cols 0-1: Processional Name + Role
 *   cols 2-3: Recessional Name + Role
 *   cols 4-5: Front Row positions, one column per partner (Lea, Liam)
 *   cols 7-10: Front-row "From Center Aisle Out" layout
 *
 * For v1 we only diff Processional roles against portal ceremony_order.
 * Front row already lives in table_layouts.ceremony_plan and is read-rich in the
 * Ceremony Chairs admin tool.
 */
function parseProcessional(rows) {
  const out = [];
  // Header row varies (row 1 or 2). Find first row where col0 != row1's "Name" header.
  let dataStart = 3; // dump shows headers at rows 0-2, data starts at 3
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const c0 = (row[0] || '').toString().trim();
    if (!c0) continue;
    // The sheet has a duplicated example block starting with "Example" — stop there
    if (/^example$/i.test(c0)) break;
    const role = (row[1] || '').toString().trim();
    if (role) out.push({ name: c0, role });

    // also pair cols 2-3 if present
    const c2 = (row[2] || '').toString().trim();
    const c3 = (row[3] || '').toString().trim();
    if (c2 && c3) out.push({ name: c2, role: c3 });
  }
  return out;
}

function normalizeName(n) {
  return String(n).trim().toLowerCase().replace(/\s+/g, ' ');
}

export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Ceremony');
    if (!rows) return [];

    const sheetPeople = parseProcessional(rows);
    const portalPeople = portal.ceremony_order || [];
    const portalByName = new Map();
    for (const p of portalPeople) {
      const key = normalizeName(p.participant_name || '');
      if (key) portalByName.set(key, p);
    }

    const entries = [];
    const usedPortalIds = new Set();

    for (const sp of sheetPeople) {
      const key = normalizeName(sp.name);
      // Try exact match, then first-name match
      let portalRow = portalByName.get(key);
      if (!portalRow) {
        const first = key.split(' ')[0];
        for (const [k, v] of portalByName.entries()) {
          if (k.split(' ')[0] === first) { portalRow = v; break; }
        }
      }
      if (portalRow) usedPortalIds.add(portalRow.id);

      if (!portalRow) {
        entries.push(makeEntry({
          id: `ceremony:missing:${slug(sp.name)}`,
          section: SECTION,
          field: `${sp.name} (sheet, not in portal)`,
          sheetValue: sp.role,
          portalValue: null,
          status: 'missing',
          applyOp: {
            type: 'insert',
            table: 'ceremony_order',
            row: {
              wedding_id: weddingId,
              participant_name: sp.name,
              role: sp.role,
              section: 'processional'
            }
          }
        }));
        continue;
      }

      const status = looselyEqual(sp.role, portalRow.role) ? 'agree' : 'conflict';
      entries.push(makeEntry({
        id: `ceremony:role:${portalRow.id}`,
        section: SECTION,
        field: `${sp.name} — role`,
        sheetValue: sp.role,
        portalValue: portalRow.role,
        status,
        applyOp: {
          type: 'patch',
          table: 'ceremony_order',
          match: { id: portalRow.id },
          patch: { role: sp.role }
        }
      }));
    }

    // Portal-only entries
    for (const p of portalPeople) {
      if (usedPortalIds.has(p.id)) continue;
      entries.push(makeEntry({
        id: `ceremony:portal-only:${p.id}`,
        section: SECTION,
        field: `${p.participant_name} (portal only)`,
        sheetValue: null,
        portalValue: p.role,
        status: 'sheet-only'
      }));
    }

    return entries;
  }
};

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
