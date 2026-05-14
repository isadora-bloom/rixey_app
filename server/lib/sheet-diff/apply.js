/**
 * Apply user-chosen actions to Supabase.
 *
 * Input: list of { entryId, choice, op }
 *   choice ∈ 'import-sheet' | 'use-portal' | 'skip'
 *   op is the applyOp from the original DiffEntry (re-sent by FE to avoid trusting a registry lookup)
 *
 * Output: { results: [{ entryId, ok, error? }], appliedCount }
 *
 * Strategy:
 *   - 'skip' / 'use-portal' (when the portal already has the value) → noop write
 *   - 'import-sheet' → execute the op
 *   - 'use-portal' for a conflict where the user prefers portal → we could write portal back
 *     to sheet, but we don't have write scope. So 'use-portal' = noop and is logged as "resolved
 *     in favor of portal" (decision audit only)
 */
export async function applyChoices({ supabase, weddingId, decisions }) {
  const results = [];
  let appliedCount = 0;
  const auditRows = [];

  for (const d of decisions || []) {
    const { entryId, choice, op } = d;
    if (!entryId || !op) {
      results.push({ entryId: entryId || null, ok: false, error: 'missing entryId or op' });
      continue;
    }

    if (choice === 'skip' || choice === 'use-portal') {
      results.push({ entryId, ok: true, skipped: true });
      auditRows.push({
        wedding_id: weddingId,
        entry_id: entryId,
        choice,
        op_type: op.type,
        table_name: op.table || null,
        executed: false,
        applied_at: new Date().toISOString()
      });
      continue;
    }

    if (choice !== 'import-sheet') {
      results.push({ entryId, ok: false, error: `unknown choice: ${choice}` });
      continue;
    }

    try {
      const r = await executeOp(supabase, op, weddingId);
      results.push({ entryId, ok: true, ...r });
      appliedCount += 1;
      auditRows.push({
        wedding_id: weddingId,
        entry_id: entryId,
        choice,
        op_type: op.type,
        table_name: op.table || null,
        executed: true,
        applied_at: new Date().toISOString()
      });
    } catch (err) {
      const msg = err?.message || String(err);
      results.push({ entryId, ok: false, error: msg });
      auditRows.push({
        wedding_id: weddingId,
        entry_id: entryId,
        choice,
        op_type: op.type,
        table_name: op.table || null,
        executed: false,
        error: msg,
        applied_at: new Date().toISOString()
      });
    }
  }

  if (auditRows.length > 0) {
    const { error: auditErr } = await supabase.from('sheet_sync_log').insert(auditRows);
    if (auditErr) {
      // Log table may not exist yet — surface but don't fail the apply
      console.warn('[sheet-sync] audit insert failed (table missing?):', auditErr.message);
    }
  }

  return { results, appliedCount };
}

async function executeOp(supabase, op, weddingId) {
  switch (op.type) {
    case 'noop':
      return { skipped: true };

    case 'patch': {
      let q = supabase.from(op.table).update(op.patch || {});
      for (const [k, v] of Object.entries(op.match || { wedding_id: weddingId })) {
        q = q.eq(k, v);
      }
      const { error } = await q;
      if (error) throw new Error(error.message);
      return {};
    }

    case 'insert': {
      const row = { ...op.row };
      if (!row.wedding_id) row.wedding_id = weddingId;
      const { error } = await supabase.from(op.table).insert(row);
      if (error) throw new Error(error.message);
      return {};
    }

    case 'delete': {
      let q = supabase.from(op.table).delete();
      for (const [k, v] of Object.entries(op.match || {})) q = q.eq(k, v);
      const { error } = await q;
      if (error) throw new Error(error.message);
      return {};
    }

    case 'json-patch': {
      // Patch a single key path inside a JSONB column. We fetch the current row, deep-set
      // the new value, then write the whole column back.
      const match = op.match || { wedding_id: weddingId };
      let q = supabase.from(op.table).select(op.column);
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
      const { data, error } = await q.limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      const current = (data && data[op.column]) || {};
      const next = deepSet(structuredClone(current), op.path || [], op.value);
      let u = supabase.from(op.table).update({ [op.column]: next });
      for (const [k, v] of Object.entries(match)) u = u.eq(k, v);
      const { error: uErr } = await u;
      if (uErr) throw new Error(uErr.message);
      return {};
    }

    default:
      throw new Error(`unsupported op type: ${op.type}`);
  }
}

function deepSet(target, path, value) {
  if (!path || path.length === 0) return value;
  let cur = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (cur[key] == null || typeof cur[key] !== 'object') {
      cur[key] = {};
    }
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
  return target;
}
