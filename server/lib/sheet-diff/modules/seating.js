import { makeEntry } from '../types.js';
import { getTab, cellAt } from './_helpers.js';

const SECTION = 'Seating Chart';

/**
 * The Seating Chart tab is a wide grid: cols 2-13 are tables, rows 3+ are seat slots
 * (1 through 12) where the couple fills in names. Most weddings leave this entirely
 * empty and use the dedicated Table Map / Guest List admin tools instead.
 *
 * v1: summary-only. Count filled name cells vs portal wedding_guests.table_assignment.
 */
export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Seating Chart', 'Seating');
    if (!rows) return [];

    const wt = portal.wedding_tables || {};
    const guests = portal.wedding_guests || [];

    // Sheet grid is rows 3-14 approximately, cols 2-13
    let sheetNamesFilled = 0;
    for (let r = 3; r < Math.min(rows.length, 30); r++) {
      for (let c = 2; c < 14; c++) {
        const v = cellAt(rows, r, c);
        if (v && v !== '-' && !/^\d+$/.test(v) && v.length > 1) sheetNamesFilled += 1;
      }
    }
    const portalAssigned = guests.filter((g) => g.table_assignment).length;

    const entries = [];
    entries.push(makeEntry({
      id: 'seating:summary',
      section: SECTION,
      field: 'Seated guests',
      sheetValue: `${sheetNamesFilled} names in sheet grid`,
      portalValue: `${portalAssigned} of ${guests.length} guests assigned to a table`,
      status: sheetNamesFilled === 0 && portalAssigned === 0 ? 'both-missing'
        : sheetNamesFilled > 0 && portalAssigned === 0 ? 'missing'
        : 'agree',
      notes: 'Use the Guest List / Table Map admin tabs to manage seat assignments.'
    }));

    entries.push(makeEntry({
      id: 'seating:total-guest-count',
      section: SECTION,
      field: 'Wedding tables: total guest count',
      sheetValue: null,
      portalValue: wt.guest_count != null ? `${wt.guest_count} (${wt.guests_per_table || '?'} per table)` : null,
      status: wt.guest_count != null ? 'sheet-only' : 'both-missing',
      notes: 'wedding_tables.guest_count is the portal canonical for table sizing.'
    }));

    return entries;
  }
};
