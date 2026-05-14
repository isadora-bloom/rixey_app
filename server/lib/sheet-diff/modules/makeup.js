import { makeEntry, classify } from '../types.js';
import { getTab, findRowValue } from './_helpers.js';

const SECTION = 'Makeup Timeline';

/**
 * The Makeup tab is rarely filled. We only diff the two boolean questions at the bottom
 * (shot list confirmed / team timing confirmed) and surface a count of per-person rows.
 * Per-person hair/makeup times are not commonly used; portal-only data is fine.
 */
export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Makeup Timeline');
    if (!rows) return [];

    const shotList = findRowValue(rows, /photographer have a list of photos/i, 2);
    const teamReady = findRowValue(rows, /team know what time they need to be ready/i, 2);
    const brideStart = findRowValue(rows, /time bride starts hair and makeup/i, 2);

    const portalRows = portal.makeup_schedule || [];
    const entries = [];

    // Count per-person rows on each side
    let personRowsOnSheet = 0;
    for (let r = 1; r < rows.length; r++) {
      const name = rows[r]?.[1];
      const time = rows[r]?.[2] || rows[r]?.[3];
      if (!name) continue;
      // Skip the Y/N questions and "Time Bride Starts" row
      const s = String(name).toLowerCase();
      if (s.includes('?') || s.includes('time bride starts')) continue;
      if (!time) continue;
      personRowsOnSheet += 1;
    }

    entries.push(makeEntry({
      id: 'makeup:per-person-rows',
      section: SECTION,
      field: 'Per-person hair/makeup rows',
      sheetValue: `${personRowsOnSheet} rows in sheet`,
      portalValue: `${portalRows.length} rows in portal`,
      status: personRowsOnSheet === portalRows.length ? 'agree' : (portalRows.length === 0 ? 'missing' : 'conflict'),
      notes: 'Use the Hair & Makeup admin tab to manage per-person rows.'
    }));

    if (brideStart) {
      entries.push(makeEntry({
        id: 'makeup:bride-start',
        section: SECTION,
        field: 'Time bride starts hair and makeup',
        sheetValue: brideStart,
        portalValue: null,
        status: 'sheet-only',
        notes: 'No portal column captures this — see Wedding Day Timeline instead (hair-makeup-done event).'
      }));
    }

    entries.push(makeEntry({
      id: 'makeup:shot-list',
      section: SECTION,
      field: 'Photographer has shot list',
      sheetValue: shotList,
      portalValue: null,
      status: shotList ? 'sheet-only' : 'both-missing'
    }));
    entries.push(makeEntry({
      id: 'makeup:team-ready',
      section: SECTION,
      field: 'Team knows when to be ready',
      sheetValue: teamReady,
      portalValue: null,
      status: teamReady ? 'sheet-only' : 'both-missing'
    }));

    return entries;
  }
};
