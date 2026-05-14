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
// Each entry can match multiple portal IDs. We now run every regex against the
// sheet label and union the hits — so a compound row like
// "Introductions/First Dance/Parent Dances/Welcome Speech" maps to all 4 portal
// events at the same start time. Regexes are intentionally permissive (no
// anchors, optional plurals) because human-typed sheets drift in wording.
const SHEET_TO_PORTAL = [
  // Prep
  [/lunch arrival|lunch.*break/i, ['buffer-break']],
  [/hair.*makeup (finished|complete|done)/i, ['hair-makeup-done']],
  [/details? photos?/i, ['details-photos']],
  [/robes?.*getting ready|robe photos?/i, ['robe-photos']],
  [/bridesmaids?.*groomsmen.*dressed|wedding party.*dressed|bridesmaids?.*dressed/i, ['bridesmaids-dressed']],
  [/bride gets dressed|bride.*dress.*on|bride dressing/i, ['bride-dress']],
  [/(pj|pyjama|getting ready).*pictures?|bride getting ready/i, ['bride-getting-ready-photos']],
  [/groomsmen pics|groomsmen photos|groom getting ready/i, ['groom-getting-ready']],
  [/bridesmaids?.*bride photos?|bride.*bridesmaids?/i, ['wedding-party-photos']],
  // First-look
  [/first look (with )?dad/i, ['first-look-dad']],
  [/first look (with )?groom/i, ['first-look-groom']],
  [/private vows|first touch/i, ['private-vows']],
  // Pre-ceremony
  [/bride away|hide bride|put bride away/i, ['hide-bride']],
  [/last shuttle/i, ['last-shuttle']],
  // Ceremony
  [/^ceremony$|^ceremony begins/i, ['ceremony']],
  // Post-ceremony
  [/group photos?|big group photo|^group photo/i, ['group-photo']],
  [/family (photos?|formals)/i, ['family-formals', 'extended-family']],
  [/wedding party photos?/i, ['wedding-party-photos']],
  [/sweethearts? photos?|^sweethearts?$|couple portraits?|sweetheart photos?/i, ['couple-portraits']],
  // Cocktail
  [/cocktail hour/i, ['cocktail-hour']],
  [/couple join.*cocktail|couple.*join.*reception|return to (cocktail|reception)/i, ['couple-break']],
  // Reception
  [/ballroom.*patio open|doors open|ballroom opens/i, ['doors-open']],
  [/introductions|grand entrance/i, ['grand-entrance']],
  [/welcome speech|welcome toast|welcome.*blessing|blessing/i, ['welcome-toast']],
  [/first dance/i, ['first-dance']],
  [/parent dances?|father.daughter dance|mother.son dance/i, ['parent-dances']],
  [/dinner (served|service)|dinner begins/i, ['dinner']],
  [/toasts?(\s|$)|speeches/i, ['toasts']],
  [/cake cutting/i, ['cake-cutting']],
  [/open dance floor|open dancing|dance floor opens/i, ['open-dancing']],
  // End of night
  [/last dance/i, ['last-dance']],
  [/grand exit|sparkler|send.?off/i, ['grand-exit']]
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
  const all = [];
  for (const [re, portalIds] of SHEET_TO_PORTAL) {
    if (re.test(label)) {
      for (const pid of portalIds) {
        if (!all.includes(pid)) all.push(pid);
      }
    }
  }
  return all.length ? all : null;
}

/**
 * Heuristic for which Timeline section a custom event belongs to. The portal
 * supports five buckets: prep / ceremony / cocktail / reception / end. We use
 * ceremony start as the anchor and fall back to absolute time bands when the
 * ceremony time isn't known.
 */
function inferSection(time, ceremonyTime) {
  const [h, m] = String(time).split(':').map(Number);
  const mins = h * 60 + m;
  const cer = ceremonyTime ? (() => {
    const [ch, cm] = String(ceremonyTime).split(':').map(Number);
    return ch * 60 + cm;
  })() : null;
  if (cer != null) {
    if (mins < cer) return 'prep';
    if (mins < cer + 25) return 'ceremony';
    if (mins < cer + 90) return 'cocktail';
    if (mins < cer + 5 * 60) return 'reception';
    return 'end';
  }
  if (mins < 16 * 60) return 'prep';
  if (mins < 17 * 60) return 'ceremony';
  if (mins < 18 * 60) return 'cocktail';
  if (mins < 22 * 60) return 'reception';
  return 'end';
}

export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Wedding Day');
    if (!rows) return [];
    const wt = portal.wedding_timeline || {};
    const tdata = (wt && wt.timeline_data) || {};
    const events = tdata.events || {};
    const customEvents = tdata.customEvents || [];
    const ceremonyStart = wt.ceremony_start || null;
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
        // Sheet has an event the portal template doesn't know. Emit a json-array-upsert
        // op that adds (or updates) it inside timeline_data.customEvents, keyed by a
        // deterministic slug-id so re-imports don't duplicate.
        const customId = `custom-${slug(label)}`;
        const existing = customEvents.find((c) => c && c.id === customId);
        const section = inferSection(time, ceremonyStart);
        const status = !existing ? 'missing'
                     : looselyEqual(existing.time, time) ? 'agree' : 'conflict';
        entries.push(makeEntry({
          id: `timeline:custom:${slug(label)}`,
          section: SECTION,
          field: `${label} (custom event)`,
          sheetValue: time,
          portalValue: existing?.time || null,
          status,
          notes: `Will appear in the ${section} block. Add or edit times directly in the Timeline tab afterwards if needed.`,
          applyOp: {
            type: 'json-array-upsert',
            table: 'wedding_timeline',
            match,
            column: 'timeline_data',
            path: ['customEvents'],
            key: 'id',
            item: {
              id: customId,
              name: label,
              time,
              duration: 15,
              section,
              notes: ''
            }
          }
        }));
        continue;
      }

      for (const pid of portalIds) {
        const portalEvent = events[pid];
        const portalTime = portalEvent?.time || null;
        const isIncluded = portalEvent?.included === true;
        const isManual = portalEvent?.manualTime === true;
        // We only count portal as "having this time" when the operator has actually
        // locked it (manualTime). Auto-calculated times will be overwritten on the
        // portal's next render, so they aren't real overrides — treat them as missing
        // unless they happen to match the sheet.
        let status;
        if (!portalTime || !isIncluded) {
          status = 'missing';
        } else if (looselyEqual(time, portalTime)) {
          status = isManual ? 'agree' : 'conflict';
        } else {
          status = 'conflict';
        }

        const noteParts = [];
        if (portalIds.length > 1) noteParts.push(`Sheet row maps to ${portalIds.length} portal events`);
        if (portalTime && !isManual) noteParts.push('Portal time is auto-calculated, not locked');

        entries.push(makeEntry({
          id: `timeline:${pid}`,
          section: SECTION,
          field: `${label} → ${pid}`,
          sheetValue: time,
          portalValue: portalTime,
          status,
          notes: noteParts.join(' · ') || null,
          applyOp: {
            type: 'json-patch',
            table: 'wedding_timeline',
            match,
            column: 'timeline_data',
            path: ['events', pid],
            patch: { included: true, time, manualTime: true }
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
