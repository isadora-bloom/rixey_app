import { useEffect, useState } from 'react'
import { API_URL } from '../../config/api'
import { loadJson } from '../../utils/api'
import LoadError from '../ui/LoadError'

/**
 * A complete scoring feature with no screen anywhere — `GET
 * /api/communication-pulse/:weddingId` has run since it was built and nothing
 * ever read the answer. This renders whatever numeric fields come back,
 * labelled, rather than hard-coding today's shape: the breakdown is exactly
 * the kind of object a second inbound channel gets added to later.
 */

const LABELS = {
  emails: 'Emails',
  texts: 'Texts',
  zooms: 'Zoom calls',
  sageChat: 'Sage chat',
  directMessages: 'Direct messages',
  portalActivity: 'Portal activity',
}

function label(key) {
  return LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
}

const LEVEL_STYLE = {
  less: 'bg-amber-50 border-amber-200 text-amber-700',
  more: 'bg-sage-50 border-sage-200 text-sage-700',
  typical: 'bg-cream-50 border-cream-200 text-sage-600',
}

const fetchPulse = (weddingId) => loadJson(`${API_URL}/api/communication-pulse/${weddingId}`)

export default function CommunicationPulseCard({ weddingId }) {
  const [pulse, setPulse] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    setError(null)
    fetchPulse(weddingId).then(setPulse).catch(err => setError(err))
  }

  useEffect(() => {
    if (!weddingId) return
    let alive = true
    fetchPulse(weddingId)
      .then(data => { if (alive) setPulse(data) })
      .catch(err => { if (alive) setError(err) })
    return () => { alive = false }
  }, [weddingId])

  if (error) return <LoadError what="the communication pulse" error={error} onRetry={load} />
  if (!pulse) return null

  const breakdown = pulse.breakdown && typeof pulse.breakdown === 'object' ? pulse.breakdown : {}

  return (
    <div className={`rounded-xl border p-4 ${LEVEL_STYLE[pulse.level] || 'bg-white border-cream-200'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {typeof pulse.score === 'number' ? `${pulse.score} touches` : 'Communication pulse'} in the last 30 days
        </p>
        {pulse.level && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 border border-current/20 capitalize">
            {pulse.level === 'less' ? 'less than usual' : pulse.level === 'more' ? 'more than usual' : 'typical'}
          </span>
        )}
      </div>
      {pulse.stage && (
        <p className="text-xs opacity-80 mt-0.5">
          {pulse.stage}
          {pulse.expected && typeof pulse.expected.min === 'number' && typeof pulse.expected.max === 'number'
            ? ` · usually ${pulse.expected.min}–${pulse.expected.max}`
            : ''}
        </p>
      )}
      {Object.keys(breakdown).length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
          {Object.entries(breakdown)
            .filter(([, v]) => typeof v === 'number')
            .map(([key, v]) => (
              <span key={key}>
                <strong>{v}</strong> {label(key)}
              </span>
            ))}
        </div>
      )}
    </div>
  )
}
