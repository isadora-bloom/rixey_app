import { makeEntry, classify, looselyEqual } from '../types.js';
import { getTab } from './_helpers.js';

const SECTION = 'Wedding Day Timeline';

/**
 * Mapping from sheet event labels (loose match) to portal event IDs in
 * wedding_timeline.timeline_data.events. The sheet uses freeform humanish names;
 * portal events are stable IDs.
 *
 * Ambiguous one-to-many mappings (e.g. sheet "Cake Cutting/Speeches" hits BOTH portal
 * "toasts" AND "cake-cutting") emit two diff entries so Grace can review each separately.
 */
const SHEET_TO_PORTAL = [
  [/lunch arrival/i, ['buffer-break']],
  [/hair.*makeup finished/i, ['hair-makeup-done']],
  [/detail photos/i, ['details-photos']],
  [/robes.*getting ready/i, ['robe-photos']],
  [/bridesmaids?.*groomsmen.*dressed/i, ['bridesmaids-dressed']],
  [/bride gets dressed/i, ['bride-dress']],
  [/first look with dad/i, ['first-look-dad']],
  [/first look (with )?groom/i, ['first-look-groom']],
  [/bride.*bridesmaids/i, ['wedding-party-photos']],
  [/bride away/i, ['hide-bride']],
  [/private vows.*first touch/i, ['private-vows']],
  [/^ceremony$/i, ['ceremony']],
  [/group photos/i, ['group-photo']],
  [/family photos/i, ['family-formals', 'extended-family']],
  [/wedding party photos/i, ['wedding-party-photos']],
  [/^sweethearts$/i, ['couple-portraits']],
  [/ballroom.*patio open/i, ['doors-open']],
  [/introductions.*welcome speech.*first dance/i, ['grand-entrance', 'welcome-toast', 'first-dance', 'parent-dances']],
  [/dinner served/i, ['dinner']],
  [/cake cutting.*speeches/i, ['cake-cutting', 'toasts']],
  [/open dance floor/i, ['open-dancing']],
  [/last dance/i, ['last-dance']],
  [/last shuttle/i, ['last-shuttle']]
];

function parseTime(s) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  // Try 12h "h:mm AM/PM" / "h:mm:ss AM/PM"
  const m12 = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i);
  if (m12) {
    let h = Number(m12[1]);
    const m = Number(m12[2]);
    const ampm = m12[3].toLowerCase();
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  // Try 24h "HH:MM" or "H:MM"
  const m24 = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    return `${String(Number(m24[1])).padStart(2, '0')}:${m24[2]}`;
  }
  return null;
}

function findEventLabel(label) {
  for (const [re, portalIds] of SHEET_TO_PORTAL) {
    if (re.test(label)) return portalIds;
  }
  return null;
}

export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Wedding Day');
    if (!rows) return [];
    const wt = portal.wedding_timeline || {};
    const tdata = (wt && wt.timeline_data) || {};
    const events = tdata.events || {};
    const match = { wedding_id: weddingId };
    const entries = [];

    // Walk data rows. Schema: col 0=time block, col 1=time, col 2=event, col 3=involved, col 4=notes
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const time = parseTime(row[1]);
      const label = (row[2] || '').toString().trim();
      if (!time || !label) continue;

      const portalIds = findEventLabel(label);
      if (!portalIds || portalIds.length === 0) {
        // Sheet has this event, portal doesn't recognise it — informational only
        entries.push(makeEntry({
          id: `timeline:unmapped:${slug(label)}`,
          section: SECTION,
          field: `${label} (sheet only — no portal event)`,
          sheetValue: time,
          portalValue: null,
          status: 'sheet-only'
        }));
        continue;
      }

      for (const pid of portalIds) {
        const portalEvent = events[pid];
        const portalTime = portalEvent?.time || null;
        const status = portalTime == null ? 'missing'
                     : looselyEqual(time, portalTime) ? 'agree' : 'conflict';

        entries.push(makeEntry({
          id: `timeline:${pid}`,
          section: SECTION,
          field: `${label} → ${pid}`,
          sheetValue: time,
          portalValue: portalTime,
          status,
          notes: portalIds.length > 1 ? `Sheet row maps to ${portalIds.length} portal events` : null,
          applyOp: {
            type: 'json-patch',
            table: 'wedding_timeline',
            match,
            column: 'timeline_data',
            path: ['events', pid, 'time'],
            value: time
          }
        }));
      }
    }

    return entries;
  }
};

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
