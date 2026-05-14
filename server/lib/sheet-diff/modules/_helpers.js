/**
 * Shared parsing helpers for sheet-diff modules.
 */

export function getTab(sheet, ...nameVariants) {
  const tabs = sheet?.tabs || {};
  const keys = Object.keys(tabs);
  for (const variant of nameVariants) {
    const exact = keys.find((k) => k === variant);
    if (exact) return tabs[exact];
    const loose = keys.find((k) => k.toLowerCase().trim() === variant.toLowerCase().trim());
    if (loose) return tabs[loose];
  }
  for (const variant of nameVariants) {
    const partial = keys.find((k) => k.toLowerCase().includes(variant.toLowerCase()));
    if (partial) return tabs[partial];
  }
  return null;
}

export function cellAt(rows, r, c) {
  const row = rows?.[r];
  if (!row) return null;
  const v = row[c];
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * Walk every cell. For each cell containing "label: value" (in one string), or for
 * adjacent label-then-value cells when a separator is missing, yield { label, value, row, col }.
 *
 * This is intentionally permissive because the sheets are filled in by humans and the
 * label/value boundary varies tab to tab.
 */
export function* iterateLabeledCells(rows) {
  if (!rows) return;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v == null) continue;
      const s = String(v).trim();
      if (!s) continue;
      // Split on first colon
      const m = s.match(/^([^:]{1,80}):\s*(.+)$/);
      if (m) {
        yield { label: m[1].trim(), value: m[2].trim(), row: r, col: c };
        continue;
      }
      // Label-only cell whose value is in a neighboring cell (next col or same-row right)
      if (s.endsWith(':') || s.endsWith('?')) {
        const next = row[c + 1];
        if (next != null && String(next).trim() !== '') {
          yield { label: s.replace(/[:?]\s*$/, '').trim(), value: String(next).trim(), row: r, col: c };
        }
      }
    }
  }
}

/**
 * Find the value associated with a label by fuzzy matching. Returns first match.
 * `labelMatchers` is an array of strings or RegExps; if any matches the cell's label, returns the value.
 */
export function findLabeledValue(rows, ...labelMatchers) {
  for (const item of iterateLabeledCells(rows)) {
    for (const m of labelMatchers) {
      if (m instanceof RegExp) {
        if (m.test(item.label)) return item.value;
      } else {
        if (item.label.toLowerCase().includes(String(m).toLowerCase())) return item.value;
      }
    }
  }
  return null;
}

/**
 * Find a row whose first non-empty cell matches `labelMatcher`, return its second-or-later non-empty cell.
 * Useful for "Bartenders on night before wedding | | | | 0.0" patterns.
 */
export function findRowValue(rows, labelMatcher, fromCol = 1) {
  if (!rows) return null;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const first = (row[0] || '').toString().trim();
    if (!first) continue;
    const ok = labelMatcher instanceof RegExp
      ? labelMatcher.test(first)
      : first.toLowerCase().includes(String(labelMatcher).toLowerCase());
    if (!ok) continue;
    for (let c = fromCol; c < row.length; c++) {
      const v = row[c];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
  }
  return null;
}

/**
 * Parse a numeric value from a string. Returns null if not parseable.
 */
export function toNumber(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a yes/no value into boolean. Returns null if not yes/no.
 */
export function toYesNo(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(s)) return true;
  if (['no', 'n', 'false', '0', 'n/a', 'na', 'none'].includes(s)) return false;
  if (s.startsWith('yes')) return true;
  if (s.startsWith('no')) return false;
  return null;
}
