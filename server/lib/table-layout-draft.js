/**
 * Who a table-layout save belongs to, and where it is allowed to land.
 *
 * ## The bug this exists to end
 *
 * One row in wedding_tables per wedding, written by two different people. The
 * couple fills it in from their dashboard; Rixey edits the same row from the
 * admin profile. The admin screen showed "In progress, not visible to client"
 * whenever is_draft was set, and that sentence was never true: the couple's
 * planner loads the same row and has never once looked at is_draft.
 *
 * Autosave made it worse rather than causing it. Once every field change
 * scheduled a POST, a venue tidying up a layout it had already sent was
 * publishing each keystroke to the couple a second and a half later.
 *
 * ## The rule
 *
 * Decide by the caller, never by the body. A venue's unfinished work goes in
 * `draft`, which nothing couple-facing reads. Only an explicit Send to Client
 * copies it onto the live columns. A couple writing their own layout is
 * unaffected: their row is their row, and their is_draft is their own
 * in-progress flag, which tells Rixey whether to start building from it.
 *
 * ## Before migration 037
 *
 * There is nowhere to put a draft, so an admin autosave is refused with a 409
 * and a sentence. Refusing a save is a nuisance. Writing it to the couple is
 * the thing we are here to stop, so the nuisance wins.
 */
import { has037 } from './migration-037.js';

export const DRAFT_STORAGE_MISSING = 'Draft storage needs migration 037; nothing was saved';

/** Postgres says 23505 for a unique violation. */
const UNIQUE_VIOLATION = '23505';
/** PostgREST says PGRST116 for "no rows where one was expected". */
const NO_ROWS = 'PGRST116';

/**
 * The planner payload, with only the keys the planner actually sends.
 *
 * This is what goes in the `draft` column, so it is deliberately the client's
 * own shape rather than the column names. Several columns are repurposed
 * (chair_sash holds chargers, head_table_placement holds sided-ness) and a
 * draft that stored those would have to be un-repurposed on the way back out,
 * which is one more place for the two meanings to drift apart.
 *
 * weddingId, userId and isDraft are left out on purpose: the first two are
 * routing, and a draft is a draft.
 */
export function normaliseLayout(body = {}) {
  const layout = {};
  for (const key of [
    'guestCount', 'tableShape', 'guestsPerTable',
    'headTable', 'headTableSize', 'headTableSided', 'sweetheartTable',
    'cocktailTables', 'kidsTable', 'kidsCount',
    'linenColor', 'napkinColor', 'linenVenueChoice', 'runnerStyle', 'chargersOn',
    'checkeredDanceFloor', 'loungeArea',
    'centerpieceNotes', 'layoutNotes', 'linenNotes',
  ]) {
    if (body[key] !== undefined) layout[key] = body[key];
  }
  layout.extraTables = body.extraTables || {};
  return layout;
}

/**
 * The live columns, exactly as the route has always written them.
 *
 * Undefined values are dropped by JSON.stringify on the way to PostgREST, so a
 * payload missing a key leaves that column alone, which is the behaviour the
 * planner has always relied on.
 */
export function layoutColumns(body = {}) {
  return {
    guest_count:          body.guestCount,
    table_shape:          body.tableShape,
    guests_per_table:     body.guestsPerTable,
    head_table:           body.headTable,
    head_table_size:      body.headTableSize,      // # people at head table
    head_table_placement: body.headTableSided,     // 'one' or 'two' (repurposed field)
    sweetheart_table:     body.sweetheartTable,
    cocktail_tables:      body.cocktailTables,
    kids_table:           body.kidsTable,
    kids_count:           body.kidsCount,
    layout_notes:         body.layoutNotes,
    linen_color:          body.linenColor,
    napkin_color:         body.napkinColor,
    centerpiece_notes:    body.centerpieceNotes,
    linen_notes:          body.linenNotes,
    extra_tables:         body.extraTables || {},
    linen_venue_choice:   body.linenVenueChoice,
    runner_style:         body.runnerStyle,
    chair_sash:           body.chargersOn,         // repurposed for chargers
    dance_floor_size:     body.checkeredDanceFloor ? 'checkered' : 'none',
    lounge_area:          body.loungeArea,
  };
}

/**
 * Save a table layout on behalf of whoever sent it.
 *
 * Returns { status, body, notifyCouple }. The route does the activity log and
 * the notifications; this decides where the bytes go, so it can be tested
 * without Express or a database.
 */
export async function saveTableLayout(supabase, { body = {}, admin = false, draftStorage = has037() } = {}) {
  const weddingId = body.weddingId;
  if (!weddingId) {
    return { status: 400, body: { error: 'weddingId is required' }, notifyCouple: false };
  }

  const sending = body.isDraft === false;

  // An admin autosave, or an explicit Save Draft. Never touches the live row.
  if (admin && !sending) {
    if (!draftStorage) {
      return { status: 409, body: { error: DRAFT_STORAGE_MISSING }, notifyCouple: false };
    }
    const draftUpdatedAt = new Date().toISOString();
    const patch = { draft: normaliseLayout(body), draft_updated_at: draftUpdatedAt };

    const { data, error } = await supabase
      .from('wedding_tables')
      .update(patch)
      .eq('wedding_id', weddingId)
      .select('wedding_id');
    if (error) return { status: 500, body: { error: error.message }, notifyCouple: false };

    if (!data || data.length === 0) {
      // No row yet: the venue got to this layout before the couple did.
      const { error: insertError } = await supabase
        .from('wedding_tables')
        .insert({ wedding_id: weddingId, ...patch })
        .select('wedding_id');
      if (insertError && insertError.code === UNIQUE_VIOLATION) {
        // Two saves raced and the other one created the row. Write into it.
        const { error: retryError } = await supabase
          .from('wedding_tables')
          .update(patch)
          .eq('wedding_id', weddingId)
          .select('wedding_id');
        if (retryError) return { status: 500, body: { error: retryError.message }, notifyCouple: false };
      } else if (insertError) {
        return { status: 500, body: { error: insertError.message }, notifyCouple: false };
      }
    }

    return { status: 200, body: { savedTo: 'draft', draftUpdatedAt }, notifyCouple: false };
  }

  const row = {
    wedding_id: weddingId,
    ...layoutColumns(body),
    updated_at: new Date().toISOString(),
  };

  let sentToClientAt = null;
  if (admin) {
    // Send to Client. The draft becomes the live layout and stops existing.
    row.is_draft = false;
    if (draftStorage) {
      sentToClientAt = new Date().toISOString();
      row.sent_to_client_at = sentToClientAt;
      row.draft = null;
      row.draft_updated_at = null;
    }
  } else {
    // The couple's own save. is_draft is their in-progress flag and means what
    // it has always meant: Rixey should not start building from this yet.
    row.is_draft = body.isDraft === true;
  }

  const { data, error } = await supabase
    .from('wedding_tables')
    .upsert(row, { onConflict: 'wedding_id' })
    .select()
    .single();
  if (error) return { status: 500, body: { error: error.message }, notifyCouple: false };

  const tables = stripDraft(data);
  return {
    status: 200,
    body: admin ? { savedTo: 'live', sentToClientAt, tables } : { savedTo: 'live', tables },
    // Only a couple pressing Send to Rixey means "a floor plan is needed".
    notifyCouple: !admin && sending,
  };
}

/** The row without anything that describes the venue's unsent work. */
export function stripDraft(row) {
  if (!row) return row;
  const copy = { ...row };
  delete copy.draft;
  delete copy.draft_updated_at;
  return copy;
}

/**
 * Read a layout for whoever asked.
 *
 * A couple gets the live row and nothing else. An admin gets the live row plus
 * the draft alongside it, so the planner can show the unsent work and still
 * know what the couple is looking at.
 */
export async function readTableLayout(supabase, { weddingId, admin = false } = {}) {
  const { data, error } = await supabase
    .from('wedding_tables')
    .select('*')
    .eq('wedding_id', weddingId)
    .single();
  if (error && error.code !== NO_ROWS) {
    return { status: 500, body: { error: 'Failed to fetch table setup' }, error };
  }

  const row = data || null;
  if (!admin) return { status: 200, body: { tables: stripDraft(row) } };

  return {
    status: 200,
    body: {
      tables: stripDraft(row),
      draft: row?.draft || null,
      draft_updated_at: row?.draft_updated_at || null,
      sent_to_client_at: row?.sent_to_client_at || null,
    },
  };
}

/** Throw the venue's unsent work away. The live layout is untouched. */
export async function discardDraft(supabase, { weddingId, draftStorage = has037() } = {}) {
  if (!draftStorage) {
    return { status: 409, body: { error: DRAFT_STORAGE_MISSING } };
  }
  const { error } = await supabase
    .from('wedding_tables')
    .update({ draft: null, draft_updated_at: null })
    .eq('wedding_id', weddingId)
    .select('wedding_id');
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { discarded: true } };
}
