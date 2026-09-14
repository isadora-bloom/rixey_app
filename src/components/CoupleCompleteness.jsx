import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config/api'
import { loadJson } from '../utils/api'
import LoadError from './ui/LoadError'

const CheckIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
)

/**
 * The couple's own view of how complete their file is. Same aspects
 * WeddingCompleteness.jsx (src/pages/admin/WeddingCompleteness.jsx) checks
 * for the venue, computed server-side at GET /api/completeness/:weddingId
 * rather than through seventeen fetches, and with nothing venue-internal in
 * it. One row per section rather than the venue's itemised checklist.
 *
 * PLAN-UX-NAV.md item 9. Does not navigate itself: "go to section" calls
 * onOpenSection(key) and leaves the actual switch to whichever nav is
 * hosting this.
 */
export default function CoupleCompleteness({ weddingId, onOpenSection }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    if (!weddingId) return
    setLoading(true)
    setLoadError(null)
    try {
      setData(await loadJson(`${API_URL}/api/completeness/${weddingId}`))
    } catch (err) {
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }, [weddingId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sage-400 text-sm">Checking your file…</div>
  }
  if (loadError) {
    return <LoadError what="your completeness check" error={loadError} onRetry={load} />
  }

  const sections = data?.sections || []
  const pct = data?.percent ?? 0

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-cream-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sage-800">How complete is your file?</h3>
          <span className="text-lg font-bold text-sage-700">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-cream-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct === 100 ? 'bg-green-500' : pct >= 70 ? 'bg-sage-500' : 'bg-amber-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-sage-500 mt-1.5">
          {data?.doneCount ?? 0} of {data?.totalCount ?? 0} sections filled in
        </p>
      </div>

      <div className="bg-white rounded-xl border border-cream-200 divide-y divide-cream-100">
        {sections.map(s => (
          <div key={s.key} className="flex items-center gap-3 px-5 py-3">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                s.done ? 'bg-green-100 text-green-600' : 'bg-cream-200 text-sage-400'
              }`}
            >
              {s.done ? <CheckIcon /> : <span className="w-2 h-2 rounded-full bg-sage-300" />}
            </span>
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${s.done ? 'text-sage-700' : 'text-sage-500'}`}>{s.label}</span>
              {s.detail && <span className="text-xs text-sage-400 ml-2">{s.detail}</span>}
            </div>
            {onOpenSection && (
              <button
                type="button"
                onClick={() => onOpenSection(s.key)}
                className="text-xs text-sage-500 hover:text-sage-700 px-2 py-1 rounded hover:bg-cream-50 transition"
              >
                {s.done ? 'View' : 'Go'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
