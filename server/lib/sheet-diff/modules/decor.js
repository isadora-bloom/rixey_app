import { makeEntry } from '../types.js';
import { getTab, cellAt } from './_helpers.js';

const SECTION = 'Decor Layout';

/**
 * Sheet layout per row: Table (location) | Item | Where is it coming from? | Who is it going home with? | Are you leaving it?
 *
 * Lea's sheet had all 10 section rows empty — the portal's decor_inventory is the rich
 * source. We only emit entries for rows the couple actually filled in. Portal-rich /
 * sheet-empty is shown as a single summary entry rather than per-item read-only rows.
 */
export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Decor Layout', 'Decor');
    if (!rows) return [];

    const entries = [];
    const portalRows = portal.decor_inventory || [];

    let filledRowCount = 0;
    for (let r = 1; r < rows.length; r++) {
      const tableName = cellAt(rows, r, 0);
      const item = cellAt(rows, r, 1);
      const source = cellAt(rows, r, 2);
      const goesHome = cellAt(rows, r, 3);
      const leaving = cellAt(rows, r, 4);

      if (!tableName) continue;
      // Only treat the row as filled if there's an item, source, or destination
      const filled = [item, source, goesHome, leaving].some(Boolean);
      if (!filled) continue;
      filledRowCount += 1;

      // Try to match an existing decor_inventory row by (space_name + item_name)
      const portalMatch = portalRows.find((p) => {
        const sp = (p.space_name || '').toLowerCase();
        const it = (p.item_name || '').toLowerCase();
        return sp === tableName.toLowerCase()
          && (item ? it.includes(item.toLowerCase()) : true);
      });

      if (portalMatch) {
        entries.push(makeEntry({
          id: `decor:agree:${portalMatch.id}`,
          section: SECTION,
          field: `${tableName} — ${item || '(unspecified)'}`,
          sheetValue: [item, source && `from ${source}`, goesHome && `→ ${goesHome}`].filter(Boolean).join(' · '),
          portalValue: `${portalMatch.item_name} (already in inventory)`,
          status: 'agree'
        }));
        continue;
      }

      entries.push(makeEntry({
        id: `decor:add:${slug(tableName)}-${slug(item || 'unspecified')}`,
        section: SECTION,
        field: `${tableName} — ${item || '(unspecified)'}`,
        sheetValue: [item, source && `from ${source}`, goesHome && `→ ${goesHome}`, leaving && `leaving: ${leaving}`].filter(Boolean).join(' · '),
        portalValue: null,
        status: 'missing',
        applyOp: {
          type: 'insert',
          table: 'decor_inventory',
          row: {
            wedding_id: weddingId,
            space_name: tableName,
            item_name: item || tableName,
            source: source || 'bringing it',
            goes_home_with: goesHome || null,
            leaving_it: !!(leaving && /yes|true|leaving|^y$/i.test(String(leaving).trim())),
            notes: leaving && !/yes|true|leaving|^y$/i.test(String(leaving).trim()) ? `Leaving: ${leaving}` : null
          }
        }
      }));
    }

    // Always emit a count summary so Grace can see the discrepancy at a glance
    entries.unshift(makeEntry({
      id: 'decor:summary',
      section: SECTION,
      field: 'Decor items',
      sheetValue: `${filledRowCount} sheet rows with content`,
      portalValue: `${portalRows.length} portal items`,
      status: portalRows.length === 0 && filledRowCount === 0
        ? 'both-missing'
        : portalRows.length > 0 && filledRowCount === 0
        ? 'sheet-only'
        : 'agree',
      notes: filledRowCount === 0
        ? 'Sheet section is blank. Portal Decor Inventory is the source of truth.'
        : null
    }));

    return entries;
  }
};

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
