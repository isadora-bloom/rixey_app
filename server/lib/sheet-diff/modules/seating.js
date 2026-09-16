import { makeEntry } from '../types.js';
import { getTab, cellAt } from './_helpers.js';
import { allPeople } from '../../../../shared/guest-names.js';

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
    // People, not rows. The sheet grid holds one name per seat, so comparing it
    // against a count of rows compared two different things: before 025 a party
    // of two counted as one, after it a plus one counted as a guest with no
    // party. A failed read arrives as an object, not a list.
    const guests = Array.isArray(portal.wedding_guests) ? portal.wedding_guests : [];
    const people = allPeople(guests);

    // Sheet grid is rows 3-14 approximately, cols 2-13
    let sheetNamesFilled = 0;
    for (let r = 3; r < Math.min(rows.length, 30); r++) {
      for (let c = 2; c < 14; c++) {
        const v = cellAt(rows, r, c);
        if (v && v !== '-' && !/^\d+$/.test(v) && v.length > 1) sheetNamesFilled += 1;
      }
    }
    const portalAssigned = people.filter((p) => p.row?.table_assignment).length;

    const entries = [];
    entries.push(makeEntry({
      id: 'seating:summary',
      section: SECTION,
      field: 'Seated guests',
      sheetValue: `${sheetNamesFilled} names in sheet grid`,
      portalValue: `${portalAssigned} of ${people.length} guests assigned to a table`,
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
