import { useState, useEffect } from 'react'
import { API_URL } from '../config/api'
import { apiFetch } from '../utils/api'
import { useToast } from './ui/Toast'

/**
 * Crashes that happened in somebody's browser.
 *
 * The guest list threw on every render for twenty hours in August, for every
 * couple and for the venue, and the way Rixey found out was a client ringing
 * up. ErrorBoundary had caught it the whole time and written to a console
 * nobody at Rixey was looking at.
 *
 * So this screen exists to be dull. An empty one is the normal state and is
 * worth saying out loud, because a monitoring page that is blank when it is
 * broken looks exactly like one that is blank because nothing is wrong.
 */

function timeAgo(iso) {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** The screen somebody was on, without the domain in the way. */
function whereabouts(url) {
  if (!url) return 'unknown page'
  try {
    const u = new URL(url)
    return u.pathname + (u.hash || '')
  } catch {
    return url
  }
}

export default function CrashReports() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [busy, setBusy] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRows = () => apiFetch(`${API_URL}/api/admin/client-errors`)

  // A monitoring page that fails to load must say so. An empty list would
  // report "nothing is wrong" on no evidence at all, which is the exact
  // failure this page was built to end.
  const applyRows = data => { setRows(data || []); setLoadError('') }

  /** The Refresh button. */
  const load = async () => {
    try {
      applyRows(await fetchRows())
    } catch (err) {
      setLoadError(err.message)
    }
    setLoading(false)
  }

  // The mount load is written out rather than calling load(), so that no state
  // is set in the straight-line body of the effect: that is a cascading render
  // and React warns about it. The other loaders in this app only escape the
  // same warning because they happen to be declared below their effect, which
  // is evasion rather than a fix. `alive` also stops a slow response setting
  // state on a screen somebody has already navigated away from.
  useEffect(() => {
    let alive = true
    fetchRows()
      .then(data => { if (alive) applyRows(data) })
      .catch(err => { if (alive) setLoadError(err.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resolve = async (row) => {
    setBusy(row.id)
    try {
      await apiFetch(`${API_URL}/api/admin/client-errors/${row.id}/resolve`, { method: 'POST' })
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'done' } : r))
      toastSuccess('Marked as dealt with. It will come back if it happens again.')
    } catch (err) {
      toastError(`Could not update that: ${err.message}`)
    }
    setBusy(null)
  }

  const open = rows.filter(r => r.status !== 'done')
  const done = rows.filter(r => r.status === 'done')
  const shown = showDone ? done : open

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Errors</h2>
          <p className="text-sage-500 text-sm mt-0.5">
            When something breaks in a couple&apos;s browser, or in yours, it is written down here.
            You should not have to hear about it from a client.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {done.length > 0 && (
            <button onClick={() => setShowDone(v => !v)} className="text-xs text-sage-500 underline">
              {showDone ? `Back to ${open.length} open` : `Show ${done.length} dealt with`}
            </button>
          )}
          <button
            onClick={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
            disabled={refreshing}
            className="text-sm px-3 py-1.5 rounded-lg border border-cream-300 text-sage-600 hover:bg-cream-50 transition disabled:opacity-50"
          >
            {refreshing ? 'Checking…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-red-800">This page could not load its own list.</p>
          <p className="text-xs text-red-700 mt-1">{loadError}</p>
          <p className="text-xs text-red-700 mt-2">
            If that says the table is missing, run <code>migrations/026_client_errors.sql</code> in
            Supabase. Errors are still written to the server log in the meantime, so nothing is lost.
          </p>
        </div>
      )}

      {loading && <p className="text-sage-400 text-sm">Loading…</p>}

      {!loading && !loadError && shown.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sage-600 text-sm">
            {showDone ? 'Nothing here.' : 'Nothing has broken.'}
          </p>
          <p className="text-sage-400 text-xs mt-1">
            This page checked and found nothing, which is different from not having looked.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {shown.map(row => (
          <div
            key={row.id}
            className={`border rounded-xl p-4 ${row.status === 'done' ? 'border-cream-200 bg-cream-50/50 opacity-70' : 'border-red-200 bg-red-50/40'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-sage-800 break-words">{row.message}</p>
                <p className="text-xs text-sage-500 mt-1">
                  {whereabouts(row.url)}
                  {' · '}
                  {timeAgo(row.last_seen_at)}
                  {row.seen_count > 1 && (
                    <span className="ml-1 text-red-600 font-medium">
                      · {row.seen_count} times
                    </span>
                  )}
                  {row.user_email && <span> · {row.user_email}</span>}
                </p>
              </div>
              {row.status !== 'done' && (
                <button
                  onClick={() => resolve(row)}
                  disabled={busy === row.id}
                  className="text-xs px-3 py-1.5 rounded-lg border border-sage-300 text-sage-600 hover:bg-sage-50 transition disabled:opacity-50 shrink-0"
                >
                  {busy === row.id ? 'Saving…' : 'Dealt with'}
                </button>
              )}
            </div>

            <button
              onClick={() => setExpanded(expanded === row.id ? null : row.id)}
              className="text-xs text-sage-500 underline mt-2"
            >
              {expanded === row.id ? 'Hide the detail' : 'What exactly broke'}
            </button>

            {expanded === row.id && (
              <div className="mt-2 space-y-2">
                {/* Kept as monospace and scrollable rather than tidied: this is
                    for pasting to whoever is fixing it, not for reading. */}
                {row.stack && (
                  <pre className="text-[11px] bg-white border border-cream-200 rounded-lg p-3 overflow-x-auto whitespace-pre text-sage-700 max-h-56">
{row.stack}
                  </pre>
                )}
                {row.component && (
                  <pre className="text-[11px] bg-white border border-cream-200 rounded-lg p-3 overflow-x-auto whitespace-pre text-sage-600 max-h-40">
{row.component}
                  </pre>
                )}
                <p className="text-xs text-sage-400">
                  First seen {timeAgo(row.first_seen_at)}
                  {row.release && ` · version ${row.release}`}
                  {row.user_agent && ` · ${row.user_agent.slice(0, 90)}`}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
