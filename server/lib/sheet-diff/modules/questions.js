import { makeEntry, classify } from '../types.js';
import { getTab, findRowValue, toYesNo } from './_helpers.js';

const SECTION = 'Questions';

/**
 * Questions tab pattern: question in col 0, answer in col 4, optional notes in col 5.
 * findRowValue(rows, /matcher/, 1) returns the first non-empty cell after col 0 — which is
 * the answer for every Q&A row.
 */
function parseQuestions(rows) {
  const row = (m) => findRowValue(rows, m, 1);
  return {
    ceremony_location: row(/^location\??$/i),
    unity_table: row(/need a unity table/i),
    arbor_choice: row(/which arbor will you be using/i),
    ceremony_notes: row(/additional details regarding the ceremony/i),
    high_chairs: row(/high chairs.*booster seats/i),
    seating_method: row(/how are you telling people where to sit/i),
    providing_table_numbers: row(/will you be providing table numbers/i),
    providing_charger_plates: row(/will you be providing charger plates/i),
    providing_champagne_glasses: row(/will you be providing special champagne glasses/i),
    providing_cake_cutter: row(/will you be providing special cake cutters/i),
    providing_cake_topper: row(/will you be providing special cake topper/i),
    reception_notes: row(/additional details regarding the reception/i),
    favors_description: row(/please list any favors/i),
    send_off_type: row(/are you having a formal send off/i)
  };
}

/**
 * "No - borrowing" → false, "Yes - through caterer" → true, "Yes (for the priest)" → true,
 * "none" → null (not a boolean answer, more like a free-text "none provided").
 */
function looseYesNo(s) {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  if (t === 'none' || t === 'n/a') return false;
  return toYesNo(s);
}

export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Questions');
    if (!rows) return [];

    const s = parseQuestions(rows);
    const wd = portal.wedding_details || {};
    const match = { wedding_id: weddingId };
    const entries = [];

    const push = (id, field, sv, pv, op) => {
      entries.push(makeEntry({
        id: `questions:${id}`,
        section: SECTION,
        field,
        sheetValue: sv,
        portalValue: pv,
        status: classify(sv, pv),
        applyOp: op || { type: 'noop' }
      }));
    };

    push('ceremony_location', 'Ceremony location', s.ceremony_location, wd.ceremony_location, {
      type: 'patch', table: 'wedding_details', match, patch: { ceremony_location: s.ceremony_location }
    });

    const unity = looseYesNo(s.unity_table);
    push('unity_table', 'Unity table needed', unity, wd.unity_table, {
      type: 'patch', table: 'wedding_details', match, patch: { unity_table: unity }
    });

    push('arbor_choice', 'Arbor choice', s.arbor_choice, wd.arbor_choice, {
      type: 'patch', table: 'wedding_details', match, patch: { arbor_choice: s.arbor_choice }
    });

    push('ceremony_notes', 'Ceremony additional details', s.ceremony_notes, wd.ceremony_notes, {
      type: 'patch', table: 'wedding_details', match, patch: { ceremony_notes: s.ceremony_notes }
    });

    const hc = looseYesNo(s.high_chairs);
    push('high_chairs_needed', 'High chairs needed', hc, wd.high_chairs_needed, {
      type: 'patch', table: 'wedding_details', match, patch: { high_chairs_needed: hc }
    });

    push('seating_method', 'Seating chart method', s.seating_method, wd.seating_method, {
      type: 'patch', table: 'wedding_details', match, patch: { seating_method: s.seating_method }
    });

    const tableNum = looseYesNo(s.providing_table_numbers);
    push('providing_table_numbers', 'Providing table numbers', tableNum, wd.providing_table_numbers, {
      type: 'patch', table: 'wedding_details', match, patch: { providing_table_numbers: tableNum }
    });

    const chargers = looseYesNo(s.providing_charger_plates);
    push('providing_charger_plates', 'Providing charger plates', chargers, wd.providing_charger_plates, {
      type: 'patch', table: 'wedding_details', match, patch: { providing_charger_plates: chargers }
    });

    const champagne = looseYesNo(s.providing_champagne_glasses);
    push('providing_champagne_glasses', 'Providing champagne glasses', champagne, wd.providing_champagne_glasses, {
      type: 'patch', table: 'wedding_details', match, patch: { providing_champagne_glasses: champagne }
    });

    const cakeCutter = looseYesNo(s.providing_cake_cutter);
    push('providing_cake_cutter', 'Providing cake cutter', cakeCutter, wd.providing_cake_cutter, {
      type: 'patch', table: 'wedding_details', match, patch: { providing_cake_cutter: cakeCutter }
    });

    const cakeTopper = looseYesNo(s.providing_cake_topper);
    push('providing_cake_topper', 'Providing cake topper', cakeTopper, wd.providing_cake_topper, {
      type: 'patch', table: 'wedding_details', match, patch: { providing_cake_topper: cakeTopper }
    });

    push('reception_notes', 'Reception special requests', s.reception_notes, wd.reception_notes, {
      type: 'patch', table: 'wedding_details', match, patch: { reception_notes: s.reception_notes }
    });

    push('favors_description', 'Favors / guest gifts', s.favors_description, wd.favors_description, {
      type: 'patch', table: 'wedding_details', match, patch: { favors_description: s.favors_description }
    });

    push('send_off_type', 'Send-off type', s.send_off_type, wd.send_off_type, {
      type: 'patch', table: 'wedding_details', match, patch: { send_off_type: s.send_off_type }
    });

    return entries;
  }
};
