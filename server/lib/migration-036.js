/**
 * Ask the database once, at boot, which of migration 036's columns exist.
 *
 * Same shape as extraction-markers.js does for 035, and for the same reason:
 * Isadora applies migrations by hand, so a deploy of this code will land some
 * hours or days before the SQL does. Everything gated here has to run either
 * way, and say plainly what is switched off rather than answering 42703 into a
 * screen that then shows an empty list.
 *
 * 036 adds two columns. vendors.logo_url is already on production, so in
 * practice only sheet_sync_log.source is in question, but both are probed
 * because "already there" is a report and not a guarantee.
 */

export const MIGRATION_036_FEATURES = {
  syncSource: {
    table: 'sheet_sync_log',
    column: 'source',
    disables: 'telling a sheet import apart from a document import in the sync log',
  },
  vendorLogo: {
    table: 'vendors',
    column: 'logo_url',
    disables: 'a vendor uploading their logo',
  },
};

const present = new Map();

/** Postgres says 42703 for "column does not exist". */
const UNDEFINED_COLUMN = '42703';

export async function detectMigration036(supabase, log = console.log) {
  for (const [feature, { table, column, disables }] of Object.entries(MIGRATION_036_FEATURES)) {
    let ok = true;
    try {
      const { error } = await supabase.from(table).select(column).limit(1);
      if (error && error.code === UNDEFINED_COLUMN) ok = false;
      else if (error) {
        log(`[036] could not probe ${table}.${column} (${error.message}); assuming it is there`);
      }
    } catch (err) {
      log(`[036] could not probe ${table}.${column} (${err.message}); assuming it is there`);
    }
    present.set(feature, ok);
    if (!ok) log(`migration 036 not applied, ${disables} disabled (${table}.${column} is missing)`);
  }
  return Object.fromEntries(present);
}

/** True when the column behind this behaviour exists. False until the probe has run. */
export function has036(feature) {
  return present.get(feature) === true;
}

/** Test seam. Production code never calls this. */
export function setMigration036(feature, value) {
  present.set(feature, value);
}

/**
 * The source field to write on a sheet_sync_log row, or nothing.
 *
 * Returns null when the column is not there, which callers read as "leave it
 * out of the insert". PostgREST refuses the whole batch rather than ignoring
 * an unknown key, so this cannot be a value the caller merges in regardless.
 *
 * The two importers produce identical op types — the document differ reuses
 * the sheet executor wholesale — so there is nothing in an existing row to
 * work it out from after the fact. Without the column the log simply cannot
 * say, and the route says so rather than guessing.
 */
export function syncSourcePatch(source, { applied = has036('syncSource') } = {}) {
  if (!applied || !source) return null;
  return { source };
}
