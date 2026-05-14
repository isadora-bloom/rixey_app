import { makeEntry, classify } from '../types.js';
import { getTab, findRowValue, toYesNo } from './_helpers.js';

const SECTION = 'Rehearsal Dinner';

/**
 * The "PrePost Wedding Days" tab is a freeform layout — questions in col A, answers
 * scattered across cols B-H depending on whether the human typed in the middle or
 * the right column. findRowValue() picks the first non-empty cell after col 0.
 */
function parsePrePost(rows) {
  const row = (matcher) => findRowValue(rows, matcher, 1);
  return {
    bar_type: row(/beer and wine only.*or beer.*liquor/i) || row(/serving beer and wine/i),
    location: row(/where would you like.*rehearsal dinner.*take place/i),
    food_type: row(/full catering company or restaurant delivery/i),
    seating_type: row(/open seating or assigned seating/i),
    linens_source: row(/who will be providing table linens/i),
    decor_source: row(/who will be.*providing decor/i),
    using_disposables: row(/are we using disposables/i),
    renting_china: row(/renting.*providing china/i),
    renting_flatware: row(/renting.*providing flatware/i),
    special_requests: row(/special request.*additional details regarding the reception/i),
    table_layout: row(/table layout for dinner/i)
  };
}

function normSeating(s) {
  if (!s) return null;
  const t = String(s).toLowerCase();
  if (t.includes('assign')) return 'assigned';
  if (t.includes('open')) return 'open';
  return s;
}

function normFoodType(s) {
  if (!s) return null;
  const t = String(s).toLowerCase();
  if (t.includes('pick')) return 'Pickup';
  if (t.includes('deliver')) return 'Delivery';
  if (t.includes('full')) return 'Full catering';
  return s;
}

function normBarType(s) {
  if (!s) return null;
  const t = String(s).toLowerCase();
  if (t.includes('not liquor') || t.includes('no liquor') || (t.includes('beer') && t.includes('wine') && !t.includes('liquor'))) {
    return 'Beer & Wine (no liquor)';
  }
  if (t.includes('liquor')) return 'Beer, Wine & Liquor';
  return s;
}

function disposablesNotes(usingDisposables, china, flatware) {
  // Combine the three "what are you bringing/renting" answers into a notes blob
  const parts = [];
  if (china) parts.push(`China: ${china}`);
  if (flatware) parts.push(`Flatware: ${flatware}`);
  if (usingDisposables) parts.push(`Disposables: ${usingDisposables}`);
  return parts.length ? parts.join(' · ') : null;
}

export default {
  section: SECTION,
  build({ sheet, portal, weddingId }) {
    const rows = getTab(sheet, 'PrePost Wedding Days', 'PrePost');
    if (!rows) return [];

    const s = parsePrePost(rows);
    const rd = portal.rehearsal_dinner || {};
    const match = { wedding_id: weddingId };
    const entries = [];

    // If no rehearsal_dinner row exists yet, the apply op for every "missing" field
    // must INSERT a row first. We model this by emitting a single composite "create
    // rehearsal_dinner row" entry on top, plus per-field PATCH entries that depend on it.
    const noRow = !rd || !rd.id;

    const push = (id, field, sv, pv, op) => {
      const status = classify(sv, pv);
      entries.push(makeEntry({ id: `rehearsal-dinner:${id}`, section: SECTION, field, sheetValue: sv, portalValue: pv, status, applyOp: op || { type: 'noop' } }));
    };

    // If the entire row is missing, surface a single "Create rehearsal dinner record"
    // entry that inserts a row with every sheet-derived value at once. Per-field entries
    // then become "agree" after the insert.
    if (noRow) {
      const row = {
        wedding_id: weddingId,
        bar_type: normBarType(s.bar_type),
        location: s.location,
        food_type: normFoodType(s.food_type),
        seating_type: normSeating(s.seating_type),
        linens_source: s.linens_source,
        decor_source: s.decor_source,
        using_disposables: toYesNo(s.using_disposables) ?? (s.using_disposables ? true : null),
        renting_china: toYesNo(s.renting_china) ?? false,
        renting_flatware: toYesNo(s.renting_flatware) ?? false,
        table_layout: s.table_layout,
        notes: disposablesNotes(s.using_disposables, s.renting_china, s.renting_flatware) || s.special_requests || null
      };
      // Strip nulls so Supabase doesn't complain about missing columns
      Object.keys(row).forEach((k) => row[k] === null && delete row[k]);

      push(
        'create-row',
        'Create Rehearsal Dinner record',
        Object.keys(row).filter((k) => k !== 'wedding_id').length + ' fields',
        null,
        { type: 'insert', table: 'rehearsal_dinner', row }
      );
      return entries;
    }

    // Row exists — diff field-by-field
    push('bar_type', 'Bar type', normBarType(s.bar_type), rd.bar_type, {
      type: 'patch', table: 'rehearsal_dinner', match, patch: { bar_type: normBarType(s.bar_type) }
    });
    push('location', 'Location', s.location, rd.location, {
      type: 'patch', table: 'rehearsal_dinner', match, patch: { location: s.location }
    });
    push('food_type', 'Food type', normFoodType(s.food_type), rd.food_type, {
      type: 'patch', table: 'rehearsal_dinner', match, patch: { food_type: normFoodType(s.food_type) }
    });
    push('seating_type', 'Seating type', normSeating(s.seating_type), rd.seating_type, {
      type: 'patch', table: 'rehearsal_dinner', match, patch: { seating_type: normSeating(s.seating_type) }
    });
    push('linens_source', 'Linens source', s.linens_source, rd.linens_source, {
      type: 'patch', table: 'rehearsal_dinner', match, patch: { linens_source: s.linens_source }
    });
    push('decor_source', 'Decor source', s.decor_source, rd.decor_source, {
      type: 'patch', table: 'rehearsal_dinner', match, patch: { decor_source: s.decor_source }
    });
    push('table_layout', 'Table layout', s.table_layout, rd.table_layout, {
      type: 'patch', table: 'rehearsal_dinner', match, patch: { table_layout: s.table_layout }
    });

    const usingDispBool = toYesNo(s.using_disposables);
    push('using_disposables', 'Using disposables', usingDispBool, rd.using_disposables, {
      type: 'patch', table: 'rehearsal_dinner', match, patch: { using_disposables: usingDispBool }
    });
    const chinaBool = toYesNo(s.renting_china);
    push('renting_china', 'Renting china', chinaBool, rd.renting_china, {
      type: 'patch', table: 'rehearsal_dinner', match, patch: { renting_china: chinaBool }
    });
    const flatBool = toYesNo(s.renting_flatware);
    push('renting_flatware', 'Renting flatware', flatBool, rd.renting_flatware, {
      type: 'patch', table: 'rehearsal_dinner', match, patch: { renting_flatware: flatBool }
    });

    const notes = disposablesNotes(s.using_disposables, s.renting_china, s.renting_flatware);
    if (notes) {
      push('notes', 'Notes (china/flatware details)', notes, rd.notes, {
        type: 'patch', table: 'rehearsal_dinner', match, patch: { notes }
      });
    }

    return entries;
  }
};
