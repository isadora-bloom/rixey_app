import { makeEntry, classify } from '../types.js';
import { getTab, findLabeledValue, findRowValue, toNumber } from './_helpers.js';

const SECTION = 'Top Sheet';

/**
 * Parse the Top Sheet tab into a flat field bag. Every field is a string or null.
 * Labels are matched permissively because human-typed sheets drift in wording.
 */
function parseTopSheet(rows) {
  const find = (...matchers) => findLabeledValue(rows, ...matchers);
  const row = (matcher) => findRowValue(rows, matcher, 1);

  return {
    bride_name: find(/^bride'?s? name$/i, /brides? name/i),
    groom_name: find(/^groom'?s? name$/i, /grooms? name/i),
    bride_parents: find(/parents of the bride/i, /bride'?s? parents/i),
    groom_parents: find(/parents of the groom/i, /groom'?s? parents/i),
    bride_social: find(/^social handle$/i),
    contract_checkin_out: find(/check ?in.*out time/i, /^check in/i),
    contract_max_rehearsal: find(/max rehearsal guest count/i),
    contract_max_wedding: find(/max wedding guest count/i),
    contract_overnights: find(/overnights? booked/i),
    contract_rehearsal_hours: find(/rehearsal dinner hours/i, /rehers?al dinner hours/i),
    contract_wedding_hours: find(/wedding day hours/i),
    rehearsal_time: find(/^rehearsal time/i),
    rehearsal_location: find(/rehearsal dinner onsite/i),
    rehearsal_guest_count: find(/rehers?al guest count/i, /rehearsal guest count/i),
    wedding_colors: find(/wedding colors/i),
    wedding_date: find(/^wedding date/i),
    guest_count: find(/^guest count/i),
    wedding_party_count: find(/wedding party count/i),
    ceremony_start: find(/ceremony start time/i),
    sunset: find(/^sunset/i),
    dogs: find(/dogs coming/i),
    venmo: find(/venmo handle/i),
    bartenders_friday: row(/bartenders on night before/i),
    extra_hands_friday: row(/extra hands on night before/i),
    bartenders_saturday: row(/bartenders on wedding day/i),
    extra_hands_saturday: row(/extra hands on wedding day/i),
    bartenders_sunday: row(/bartenders on day after/i),
    extra_hands_sunday: row(/extra hands on day after/i)
  };
}

function splitPartyCount(s) {
  // "7 for bride, 6 for groom" → { p1: 7, p2: 6 }
  if (!s) return { p1: null, p2: null };
  const m1 = String(s).match(/(\d+)\s*(?:for)?\s*bride/i);
  const m2 = String(s).match(/(\d+)\s*(?:for)?\s*groom/i);
  return { p1: m1 ? Number(m1[1]) : null, p2: m2 ? Number(m2[1]) : null };
}

function splitGuestCount(s) {
  // "73 Adults: 73  Minors: 0   Children: 0" → 73 (first number)
  if (!s) return null;
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function splitCheckinOut(s) {
  // "3pm out 10am" or "Time in: 3pm out 10am" → { in: '3pm', out: '10am' }
  if (!s) return { in: null, out: null };
  const norm = String(s).toLowerCase().replace(/time\s+in:?/, '');
  const m = norm.match(/(\S+(?:\s?[ap]m)?)\s+out\s+(\S+(?:\s?[ap]m)?)/i);
  if (m) return { in: m[1].trim(), out: m[2].trim() };
  return { in: norm.trim(), out: null };
}

export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'Top Sheet');
    if (!rows) return [];

    const s = parseTopSheet(rows);
    const wd = portal.wedding_details || {};
    const w = portal.weddings || {};
    const ws = portal.wedding_staffing || {};
    const wsa = ws.answers || {};

    const entries = [];
    const match = { wedding_id: weddingId };

    const push = (id, field, sheetValue, portalValue, op) => {
      const status = classify(sheetValue, portalValue);
      entries.push(
        makeEntry({
          id: `top-sheet:${id}`,
          section: SECTION,
          field,
          sheetValue,
          portalValue,
          status,
          applyOp: op || { type: 'noop' }
        })
      );
    };

    // Couple names — informational only. weddings.couple_names is the combined cell.
    push(
      'couple_names',
      'Couple names (combined)',
      [s.bride_name, s.groom_name].filter(Boolean).join(' and ') || null,
      w.couple_names || null,
      {
        type: 'patch',
        table: 'weddings',
        match: { id: weddingId },
        patch: { couple_names: [s.bride_name, s.groom_name].filter(Boolean).join(' and ') }
      }
    );

    // Parents
    push('partner1_parents', "Bride's parents", s.bride_parents, wd.partner1_parents, {
      type: 'patch', table: 'wedding_details', match, patch: { partner1_parents: s.bride_parents }
    });
    push('partner2_parents', "Groom's parents", s.groom_parents, wd.partner2_parents, {
      type: 'patch', table: 'wedding_details', match, patch: { partner2_parents: s.groom_parents }
    });
    push('partner1_social', "Bride's social", s.bride_social, wd.partner1_social, {
      type: 'patch', table: 'wedding_details', match, patch: { partner1_social: s.bride_social }
    });

    // Contract terms
    const ci = splitCheckinOut(s.contract_checkin_out);
    push('contract_checkin', 'Contract check-in', ci.in, wd.contract_checkin, {
      type: 'patch', table: 'wedding_details', match, patch: { contract_checkin: ci.in }
    });
    push('contract_checkout', 'Contract check-out', ci.out, wd.contract_checkout, {
      type: 'patch', table: 'wedding_details', match, patch: { contract_checkout: ci.out }
    });

    const maxR = toNumber(s.contract_max_rehearsal);
    push('contract_max_rehearsal', 'Max rehearsal count', maxR, wd.contract_max_rehearsal, {
      type: 'patch', table: 'wedding_details', match, patch: { contract_max_rehearsal: maxR }
    });
    const maxW = toNumber(s.contract_max_wedding);
    push('contract_max_wedding', 'Max wedding count', maxW, wd.contract_max_wedding, {
      type: 'patch', table: 'wedding_details', match, patch: { contract_max_wedding: maxW }
    });
    push('contract_overnights', 'Overnights booked', s.contract_overnights, wd.contract_overnights, {
      type: 'patch', table: 'wedding_details', match, patch: { contract_overnights: s.contract_overnights }
    });
    push('contract_rehearsal_hours', 'Rehearsal dinner hours', s.contract_rehearsal_hours, wd.contract_rehearsal_hours, {
      type: 'patch', table: 'wedding_details', match, patch: { contract_rehearsal_hours: s.contract_rehearsal_hours }
    });
    push('contract_wedding_hours', 'Wedding day hours', s.contract_wedding_hours, wd.contract_wedding_hours, {
      type: 'patch', table: 'wedding_details', match, patch: { contract_wedding_hours: s.contract_wedding_hours }
    });

    push('wedding_colors', 'Wedding colors', s.wedding_colors, wd.wedding_colors, {
      type: 'patch', table: 'wedding_details', match, patch: { wedding_colors: s.wedding_colors }
    });

    const party = splitPartyCount(s.wedding_party_count);
    push('wedding_party_count_1', 'Wedding party (bride side)', party.p1, wd.wedding_party_count_1, {
      type: 'patch', table: 'wedding_details', match, patch: { wedding_party_count_1: party.p1 }
    });
    push('wedding_party_count_2', 'Wedding party (groom side)', party.p2, wd.wedding_party_count_2, {
      type: 'patch', table: 'wedding_details', match, patch: { wedding_party_count_2: party.p2 }
    });

    // Staffing — the sheet is canonical for the actual guest counts that drive staffing math
    const sheetGuestCount = splitGuestCount(s.guest_count);
    push('staffing_guest_count', 'Guest count (staffing input)', sheetGuestCount, wsa.guestCount ?? null, {
      type: 'json-patch',
      table: 'wedding_staffing',
      match,
      column: 'answers',
      path: ['guestCount'],
      value: sheetGuestCount
    });

    const fridayGuests = toNumber(s.rehearsal_guest_count);
    push('staffing_friday_guest_count', 'Friday guest count (staffing input)', fridayGuests, wsa.fridayGuestCount ?? null, {
      type: 'json-patch',
      table: 'wedding_staffing',
      match,
      column: 'answers',
      path: ['fridayGuestCount'],
      value: fridayGuests
    });

    const bf = toNumber(s.bartenders_friday);
    push('friday_bartenders', 'Friday bartenders', bf, ws.friday_bartenders ?? null, {
      type: 'patch', table: 'wedding_staffing', match, patch: { friday_bartenders: bf }
    });
    const ef = toNumber(s.extra_hands_friday);
    push('friday_extra_hands', 'Friday extra hands', ef, ws.friday_extra_hands ?? null, {
      type: 'patch', table: 'wedding_staffing', match, patch: { friday_extra_hands: ef }
    });
    const bs = toNumber(s.bartenders_saturday);
    push('saturday_bartenders', 'Saturday bartenders', bs, ws.saturday_bartenders ?? null, {
      type: 'patch', table: 'wedding_staffing', match, patch: { saturday_bartenders: bs }
    });
    const es = toNumber(s.extra_hands_saturday);
    push('saturday_extra_hands', 'Saturday extra hands', es, ws.saturday_extra_hands ?? null, {
      type: 'patch', table: 'wedding_staffing', match, patch: { saturday_extra_hands: es }
    });

    return entries;
  }
};
