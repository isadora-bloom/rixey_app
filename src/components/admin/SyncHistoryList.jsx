import { useEffect, useState } from 'react'
import { API_URL } from '../../config/api'
import { loadJson } from '../../utils/api'
import LoadError from '../ui/LoadError'

/**
 * What actually happened, not just when it last ran.
 *
 * Both sync panels used to show one timestamp — "Last applied" — which a
 * document import silently overwrote for the sheet, and vice versa. This
 * reads sheet_sync_log itself, filtered to the one source this panel cares
 * about, so a document import stops erasing the sheet's own history and
 * either panel can say what was actually written, row by row.
 *
 * The route is new (`GET /api/admin/sync-log/:weddingId?source=...`) and may
 * not exist yet at the far end, so a 404 degrades to LoadError rather than an
 * empty "nothing happened yet" that would be a lie about a table that has
 * simply not been built.
 */

// The row shape varies by however sheet_sync_log ends up columned; read a
// handful of plausible names rather than assume one, so a rename on the
// server does not turn every row blank.
function pick(row, keys) {
  for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
  return null
}

function normalise(row) {
  const date = pick(row, ['date', 'applied_at', 'created_at', 'occurred_at'])
  return {
    id: row.id ?? `${date}-${row.table ?? row.table_name ?? ''}-${row.op ?? row.op_type ?? ''}`,
    date,
    table: pick(row, ['table', 'table_name', 'target_table']),
    op: pick(row, ['op', 'op_type', 'operation']),
    choice: pick(row, ['choice', 'decision']),
    error: pick(row, ['error', 'error_message']),
  }
}

function whenLabel(iso) {
  if (!iso) return 'no date'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString()
}

const fetchHistory = (weddingId, source) =>
  loadJson(`${API_URL}/api/admin/sync-log/${weddingId}?source=${encodeURIComponent(source)}`)
    .then(data => (Array.isArray(data) ? data : (data?.rows || data?.entries || data?.items || [])).map(normalise))

export default function SyncHistoryList({ weddingId, source, emptyLabel = 'Nothing applied yet.' }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  // The Retry button re-runs this. The mount effect below does the same fetch
  // inline rather than calling this, so that setting state on load is not a
  // named function call inside the effect body — see CrashReports.jsx for the
  // same shape and why.
  const load = () => {
    setError(null)
    fetchHistory(weddingId, source).then(setRows).catch(err => setError(err))
  }

  useEffect(() => {
    if (!weddingId || !source) return
    let alive = true
    fetchHistory(weddingId, source)
      .then(rows => { if (alive) setRows(rows) })
      .catch(err => { if (alive) setError(err) })
    return () => { alive = false }
  }, [weddingId, source])

  if (error) {
    return <LoadError what="the history" error={error} onRetry={load} className="mt-3" />
  }

  if (!rows) {
    return <p className="text-xs text-sage-400 mt-2">Loading history…</p>
  }

  if (!rows.length) {
    return <p className="text-xs text-sage-400 mt-2">{emptyLabel}</p>
  }

  return (
    <div className="mt-3 border border-cream-200 rounded-xl divide-y divide-cream-100">
      {rows.map(r => (
        <div key={r.id} className="px-3 py-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-sage-500 shrink-0">{whenLabel(r.date)}</span>
          {r.table && <span className="text-sage-700">{r.table}</span>}
          {r.op && <span className="text-sage-400">{r.op}</span>}
          {r.choice && <span className="text-sage-400">· {r.choice}</span>}
          {r.error && <span className="text-red-600">· failed: {r.error}</span>}
        </div>
      ))}
    </div>
  )
}
