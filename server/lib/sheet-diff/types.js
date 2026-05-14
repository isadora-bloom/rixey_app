/**
 * Shape definitions used across the sheet-diff framework.
 *
 * DiffEntry = {
 *   id: string,                  // Stable identifier, e.g. 'top-sheet:partner1_parents'
 *   section: string,             // Section label shown in UI ('Top Sheet', 'Vendors', ...)
 *   field: string,               // Human-readable field name ("Bride's parents")
 *   sheetValue: any,             // Value as it appears in the Google Sheet (null if blank)
 *   portalValue: any,            // Value as it appears in Supabase (null if missing)
 *   status: 'missing' | 'conflict' | 'agree' | 'sheet-only' | 'both-missing',
 *   defaultAction: 'import-sheet' | 'use-portal' | 'skip' | null,
 *   notes?: string,              // Optional context for Grace ('Stale staffing input', etc.)
 *   applyOp: ApplyOp             // Server-side recipe describing what to write
 * }
 *
 * ApplyOp variants:
 *   { type: 'patch',      table, match, patch }
 *   { type: 'insert',     table, row }
 *   { type: 'delete',     table, match }
 *   { type: 'json-patch', table, match, column, path: string[], value }
 *   { type: 'noop' }
 *
 * Modules implement:
 *   build({ sheet, portal, weddingId }): DiffEntry[]
 */
export const STATUSES = ['missing', 'conflict', 'agree', 'sheet-only', 'both-missing'];

export function makeEntry({ id, section, field, sheetValue, portalValue, status, applyOp, notes }) {
  let defaultAction = null;
  if (status === 'missing') defaultAction = 'import-sheet';
  else if (status === 'conflict') defaultAction = 'skip';
  else if (status === 'agree' || status === 'sheet-only' || status === 'both-missing') defaultAction = 'skip';
  return {
    id,
    section,
    field,
    sheetValue: normalize(sheetValue),
    portalValue: normalize(portalValue),
    status,
    defaultAction,
    notes: notes || null,
    applyOp: applyOp || { type: 'noop' }
  };
}

function normalize(v) {
  if (v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return v;
}

/**
 * Compare two values for "agree" detection. Loose: strings are trimmed + case-insensitive,
 * numbers compared numerically, booleans coerced, null/empty treated equivalently.
 */
export function looselyEqual(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na == null || nb == null) return na == null && nb == null;
  if (typeof na === 'number' && typeof nb === 'number') return na === nb;
  const sa = String(na).trim().toLowerCase();
  const sb = String(nb).trim().toLowerCase();
  if (sa === sb) return true;
  const numA = Number(sa);
  const numB = Number(sb);
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA === numB) return true;
  return false;
}

/**
 * Classify two values into a DiffEntry status. Most modules can use this directly.
 */
export function classify(sheetValue, portalValue) {
  const sv = normalize(sheetValue);
  const pv = normalize(portalValue);
  if (sv == null && pv == null) return 'both-missing';
  if (sv == null && pv != null) return 'sheet-only';
  if (sv != null && pv == null) return 'missing';
  return looselyEqual(sv, pv) ? 'agree' : 'conflict';
}
