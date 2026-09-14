/**
 * Marker first, extraction second, and the outcome written down either way.
 *
 * Every ingestion in this file follows the same three steps: write the
 * processed-marker row so the item is never imported twice, read the item with
 * Claude, save what came back. Step two failing used to be invisible. The
 * extractor swallowed the error and returned [], the marker was already in
 * place, and the item was marked done with nothing to show for it. A 429 on a
 * Tuesday afternoon is a permanently lost meeting.
 *
 * The order matters and it is not the obvious one. Extracting first and marking
 * afterwards would lose nothing on an error, but it duplicates every note when
 * the marker write is the thing that fails, and duplicate notes are the ones a
 * couple reads. So: marker first, then record whether the extraction worked.
 *
 * Migration 035 adds extracted_at and extract_error to the three marker tables.
 * Until it is applied, everything here still runs — the outcome is counted into
 * the sync job's detail and logged instead of written to a column.
 */

/**
 * Which new column each gated behaviour needs, so the boot probe can say
 * precisely what is switched off rather than "035 is missing".
 */
export const MIGRATION_035_FEATURES = {
  markers:    { table: 'processed_emails',  column: 'extracted_at',      disables: 'per-item extraction outcomes (extracted_at / extract_error)' },
  noteSource: { table: 'planning_notes',    column: 'source_id',         disables: 'source-keyed note dedup, per-note confidence' },
  transcript: { table: 'walkthrough_media', column: 'transcript_error',  disables: 'recording a Deepgram failure on the media row' },
  docModel:   { table: 'wedding_documents', column: 'parsed_with_model', disables: 'recording which model read a document' },
};

const present = new Map();

/** Postgres says 42703 for "column does not exist". */
const UNDEFINED_COLUMN = '42703';

/**
 * Ask the database once, at boot, which of 035's columns exist.
 *
 * A select of the column with no rows wanted is the cheapest question that
 * still gets a straight answer. Anything other than 42703 is treated as "the
 * column is probably there and the database is having a moment" — refusing to
 * run the whole pipeline because a probe timed out would be the worse mistake.
 */
export async function detectMigration035(supabase, log = console.log) {
  for (const [feature, { table, column, disables }] of Object.entries(MIGRATION_035_FEATURES)) {
    let ok = true;
    try {
      const { error } = await supabase.from(table).select(column).limit(1);
      if (error && error.code === UNDEFINED_COLUMN) ok = false;
      else if (error) {
        log(`[035] could not probe ${table}.${column} (${error.message}); assuming it is there`);
      }
    } catch (err) {
      log(`[035] could not probe ${table}.${column} (${err.message}); assuming it is there`);
    }
    present.set(feature, ok);
    if (!ok) log(`migration 035 not applied, ${disables} disabled (${table}.${column} is missing)`);
  }
  return Object.fromEntries(present);
}

/** True when the column behind this behaviour exists. Defaults to false until the probe has run. */
export function has035(feature) {
  return present.get(feature) === true;
}

/** Test seam. Production code never calls this. */
export function setMigration035(feature, value) {
  present.set(feature, value);
}

/**
 * The patch to write onto a marker row once the extraction has been tried.
 *
 * Returns null when 035 is not applied, which callers read as "count it into
 * the job detail and log it instead".
 */
export function markerExtractionPatch(outcome, { applied = has035('markers') } = {}) {
  if (!applied) return null;
  if (outcome && outcome.error) {
    return { extract_error: String(outcome.error).slice(0, 500), extracted_at: null };
  }
  return { extracted_at: new Date().toISOString(), extract_error: null };
}

/**
 * Stamp a batch of notes with the item they were read out of.
 *
 * No-op without 035: the columns are not there and PostgREST would refuse the
 * whole insert rather than ignore the extra keys.
 */
export function withSource(notes, sourceKind, sourceId, { applied = has035('noteSource') } = {}) {
  if (!applied || !sourceId) return notes;
  return notes.map(n => ({ ...n, source_kind: sourceKind, source_id: String(sourceId) }));
}

/**
 * Marker, then extraction, then the outcome — in that order, every time.
 *
 * All the input and output is injected, so the ordering this guarantees can be
 * proved in a unit test against a fake client rather than asserted in a comment.
 *
 * @param {object}   o
 * @param {function} [o.writeMarker]   async () => ({ ok: boolean, error?: string }). Runs first. A false stops everything.
 * @param {boolean}  [o.alreadyExtracted] this source has notes already, so a reprocess refreshes the raw record only
 * @param {function} o.extract         async () => ({ notes: [], error?: Error|string })
 * @param {function} [o.save]          async (notes) => void
 * @param {function} [o.recordOutcome] async ({ error }) => void, called whether it worked or not
 * @returns {Promise<{ status: string, notes: number, error?: string }>} never throws
 */
export async function importWithMarker({
  writeMarker, alreadyExtracted = false, extract, save, recordOutcome,
}) {
  if (writeMarker) {
    const marker = await writeMarker();
    if (marker && marker.ok === false) {
      return { status: 'marker-failed', notes: 0, error: marker.error || 'marker write failed' };
    }
  }

  if (alreadyExtracted) return { status: 'extraction-skipped', notes: 0 };

  let result;
  try {
    result = await extract();
  } catch (err) {
    // A throw and a returned error are the same event as far as this is
    // concerned. Callers should not have to care which shape the extractor is in.
    result = { notes: [], error: err };
  }

  const failure = result?.error;
  if (failure) {
    const message = String(failure?.message || failure);
    if (recordOutcome) await recordOutcome({ error: message });
    return { status: 'extract-failed', notes: 0, error: message };
  }

  const notes = result?.notes || [];
  if (notes.length && save) await save(notes);
  if (recordOutcome) await recordOutcome({ error: null });
  return { status: 'ok', notes: notes.length };
}

/**
 * A confidence the model actually gave, or nothing.
 *
 * A missing confidence stays missing. Defaulting it to 1 would make every note
 * from a model that ignored the instruction look certain, which is the opposite
 * of what the column is for.
 */
export function normaliseConfidence(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return n <= 100 ? n / 100 : 1;   // a model that answered in percent
  return n;
}
