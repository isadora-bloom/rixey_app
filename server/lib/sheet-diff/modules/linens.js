import { makeEntry } from '../types.js';
import { getTab, cellAt } from './_helpers.js';

const SECTION = 'Table Sizes & Linens';

/**
 * The "Final Linens" block (right side of the Table Sizes tab) records per-table
 * linen counts + sizes + exceptions ("NOT WHITE"). The portal's wedding_tables row
 * only stores one venue-wide linen_color/napkin_color — there's no per-table override
 * column. We surface the breakdown as informational entries so Grace can spot the
 * NOT-WHITE exceptions; we don't auto-write anything.
 *
 * If the schema later gains a wedding_tables.linen_overrides JSONB column, this module
 * can switch its applyOps to json-patch writes.
 */
export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Table Sizes & Linens', 'Table Sizes');
    if (!rows) return [];

    const wt = portal.wedding_tables || {};
    const entries = [];

    // Find the "Final Linens" header row
    let finalLinensRow = -1;
    for (let r = 0; r < rows.length; r++) {
      const c5 = cellAt(rows, r, 5);
      if (c5 && /final linens/i.test(c5)) { finalLinensRow = r; break; }
    }

    let exceptions = [];
    let linenBreakdown = [];

    if (finalLinensRow >= 0) {
      // Header row is finalLinensRow + 2 (the "Table Type | Number | Linen Size | Count" header)
      for (let r = finalLinensRow + 2; r < rows.length; r++) {
        const tableType = cellAt(rows, r, 5);
        if (!tableType) {
          // Allow same-name continuations (e.g. "Guest Tables" then a blank row with 132x90)
          const cn = cellAt(rows, r, 6);
          if (!cn) continue;
        }
        if (tableType && /^total$/i.test(tableType)) break;
        const num = cellAt(rows, r, 6);
        const size = cellAt(rows, r, 7);
        const count = cellAt(rows, r, 8);
        const note = cellAt(rows, r, 9);
        if (!num && !size) continue;
        linenBreakdown.push({ type: tableType || '(continuation)', num, size, count, note });
        if (note && /not white/i.test(note)) {
          exceptions.push({ type: tableType || '(continuation)', size, note });
        }
      }
    }

    entries.push(makeEntry({
      id: 'linens:portal-color',
      section: SECTION,
      field: 'Portal linen color (venue-wide)',
      sheetValue: 'Per-table sizes only (no single color on sheet)',
      portalValue: wt.linen_color || null,
      status: wt.linen_color ? 'agree' : 'missing',
      notes: 'Sheet does not record a venue-wide color. wedding_tables.linen_color stays under that single value.'
    }));

    if (exceptions.length > 0) {
      entries.push(makeEntry({
        id: 'linens:not-white-exceptions',
        section: SECTION,
        field: 'NOT WHITE per-table exceptions',
        sheetValue: exceptions.map((e) => `${e.type} (${e.size})`).join(' · '),
        portalValue: null,
        status: 'sheet-only',
        notes: 'Portal has no per-table linen override column. Pass these to the caterer manually for now.'
      }));
    }

    // Breakdown summary
    if (linenBreakdown.length > 0) {
      entries.push(makeEntry({
        id: 'linens:breakdown',
        section: SECTION,
        field: 'Linen counts',
        sheetValue: linenBreakdown
          .filter((b) => b.num)
          .map((b) => `${b.type}: ${b.num} × ${b.size || '?'}`).join(' · '),
        portalValue: null,
        status: 'sheet-only',
        notes: 'Informational — full table breakdown from the sheet.'
      }));
    }

    return entries;
  }
};
