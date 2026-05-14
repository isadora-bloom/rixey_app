import { makeEntry } from '../types.js';
import { getTab, cellAt } from './_helpers.js';

const SECTION = 'Email Notes';

/**
 * The "Copy of Email Notes" tab is a 3-column log (Date, Category, Note). It's
 * historically empty — the portal's planning_notes table is the source of truth
 * (populated via Gmail sync). We surface a count comparison only.
 */
export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Copy of Email Notes', 'Email Notes');
    if (!rows) return [];

    let sheetNoteCount = 0;
    for (let r = 1; r < rows.length; r++) {
      const date = cellAt(rows, r, 0);
      const note = cellAt(rows, r, 2);
      if (date || note) sheetNoteCount += 1;
    }

    return [
      makeEntry({
        id: 'email-notes:count',
        section: SECTION,
        field: 'Email notes',
        sheetValue: `${sheetNoteCount} entries in sheet`,
        portalValue: 'planning_notes (Gmail-synced) is canonical',
        status: 'sheet-only',
        notes: 'No diff is computed for this section. The Planning Notes admin tab is the canonical log.'
      })
    ];
  }
};
