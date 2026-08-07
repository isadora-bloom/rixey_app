import { useState, useEffect } from 'react'
import { API_URL } from '../config/api'
import { apiFetch } from '../utils/api'

const KIND_LABELS = {
  final_walkthrough: 'Final walkthrough',
  site_visit: 'Site visit',
  rehearsal: 'Rehearsal',
  call: 'Call',
}

/**
 * What the couple sees from a walkthrough.
 *
 * Only the summary the venue chose to share, never the raw notes. The endpoint
 * enforces that too — it selects the shared columns and filters on shared_at —
 * so a change here cannot accidentally expose someone's private scratchpad.
 */
export default function WalkthroughSummaries({ weddingId }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!weddingId) return
    apiFetch(`${API_URL}/api/walkthroughs/${weddingId}/shared`)
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [weddingId])

  if (loading) return <div className="text-sage-400 text-sm text-center py-10">Loading…</div>

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="font-serif text-xl text-sage-700">Walkthrough Notes</h2>
        <p className="text-sage-500 text-sm mt-0.5">
          What we agreed when we walked the venue together.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="border border-dashed border-cream-300 rounded-xl py-12 text-center">
          <p className="text-sage-400 text-sm">
            Nothing here yet. After your walkthrough we&apos;ll write up what we agreed and it will appear here.
          </p>
        </div>
      ) : (
        list.map(w => (
          <div key={w.id} className="border border-cream-200 rounded-xl p-5 bg-white">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <p className="font-medium text-sage-700">{KIND_LABELS[w.kind] || 'Walkthrough'}</p>
              <p className="text-xs text-sage-400">
                {new Date(w.occurred_on + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            {w.attendees && <p className="text-xs text-sage-400 mb-3">With {w.attendees}</p>}
            <p className="text-sm text-sage-700 whitespace-pre-wrap leading-relaxed">{w.shared_summary}</p>
          </div>
        ))
      )}
    </div>
  )
}
