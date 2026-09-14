/**
 * Ask the database once, at boot, whether migration 037's draft columns exist.
 *
 * Same shape and same reason as migration-036.js: Isadora applies migrations by
 * hand, so this code runs against a database without them for however long that
 * takes.
 *
 * What 037 gates is unusual, and worth being plain about. Without the columns
 * there is nowhere to put a venue's unfinished layout, and the old behaviour
 * was to write it straight onto the row the couple reads. So the answer here is
 * not "fall back to the old behaviour", it is "refuse the save and say so". A
 * save the venue can see was refused is recoverable. A save that quietly went
 * to the couple is not.
 */

export const MIGRATION_037_FEATURE = {
  table: 'wedding_tables',
  column: 'draft',
  disables: 'the venue drafting a table layout without the couple seeing it',
};

/** Postgres says 42703 for "column does not exist". */
const UNDEFINED_COLUMN = '42703';

let present = null;

export async function detectMigration037(supabase, log = console.log) {
  const { table, column, disables } = MIGRATION_037_FEATURE;
  let ok = true;
  try {
    const { error } = await supabase.from(table).select(column).limit(1);
    if (error && error.code === UNDEFINED_COLUMN) ok = false;
    else if (error) {
      log(`[037] could not probe ${table}.${column} (${error.message}); assuming it is there`);
    }
  } catch (err) {
    log(`[037] could not probe ${table}.${column} (${err.message}); assuming it is there`);
  }
  present = ok;
  if (!ok) log(`migration 037 not applied, ${disables} disabled (${table}.${column} is missing)`);
  return ok;
}

/** True when the draft column exists. False until the probe has run. */
export function has037() {
  return present === true;
}

/** Test seam. Production code never calls this. */
export function setMigration037(value) {
  present = value;
}
