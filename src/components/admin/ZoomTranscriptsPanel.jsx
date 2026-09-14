import { useEffect, useState } from 'react'
import { API_URL } from '../../config/api'
import { loadJson } from '../../utils/api'
import LoadError from '../ui/LoadError'

/**
 * The transcripts nothing calls.
 *
 * `GET /api/zoom/transcripts` has existed for a while with no screen reading
 * it, so a Zoom call's own words — and the confidence behind however it got
 * matched to this wedding — were unreachable except by querying the table
 * directly. This is a plain reader: rows in, expandable text out.
 *
 * The response shape is expected to change under this (a weddingId filter and
 * a handful of match fields are new), so every field is read defensively
 * rather than assumed, and an unrecognised shape renders as "nothing here"
 * rather than throwing.
 */

function whenLabel(iso) {
  if (!iso) return 'no date'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function normalise(row) {
  return {
    id: row.id || row.zoom_meeting_id || row.meeting_id,
    topic: row.topic || row.meeting_topic || '(no topic)',
    date: row.processed_at || row.created_at || row.occurred_at,
    participants: row.participant_names || row.participants || [],
    matchReason: row.match_reason ?? row.reason ?? null,
    matchConfidence: row.match_confidence ?? row.confidence ?? null,
    matchedBy: row.matched_by ?? null,
    transcript: row.transcript || row.transcript_text || row.transcript_preview || row.parsed_preview || '',
  }
}

// The route can hand back a bare array, or one of the shapes it has used
// before ({ processed_meetings: { data } }); read whichever arrives.
function extractRows(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.transcripts)) return data.transcripts
  if (Array.isArray(data?.processed_meetings?.data)) return data.processed_meetings.data
  return []
}

const fetchTranscripts = (weddingId) =>
  loadJson(`${API_URL}/api/zoom/transcripts?weddingId=${weddingId}`).then(data => extractRows(data).map(normalise))

export default function ZoomTranscriptsPanel({ weddingId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)

  const load = () => {
    setError(null)
    fetchTranscripts(weddingId).then(setRows).catch(err => setError(err))
  }

  useEffect(() => {
    if (!weddingId) return
    let alive = true
    fetchTranscripts(weddingId)
      .then(rows => { if (alive) setRows(rows) })
      .catch(err => { if (alive) setError(err) })
    return () => { alive = false }
  }, [weddingId])

  return (
    <div className="border border-cream-200 rounded-xl p-4 mt-6">
      <h3 className="font-serif text-lg text-sage-700 mb-1">Zoom transcripts</h3>
      <p className="text-sage-500 text-sm mb-3">
        Calls Zoom recorded and matched to this wedding.
      </p>

      {error ? (
        <LoadError what="Zoom transcripts" error={error} onRetry={load} />
      ) : !rows ? (
        <p className="text-sage-400 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sage-400 text-sm">Nothing recorded for this wedding yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="border border-cream-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenId(openId === r.id ? null : r.id)}
                className="w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-cream-50 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-sage-800 truncate">{r.topic}</p>
                  <p className="text-xs text-sage-500 mt-0.5">
                    {whenLabel(r.date)}
                    {r.participants?.length > 0 && ` · ${[].concat(r.participants).join(', ')}`}
                  </p>
                  {(r.matchReason || r.matchedBy) && (
                    <p className="text-xs text-sage-400 mt-0.5">
                      {r.matchedBy && `matched by ${r.matchedBy}`}
                      {r.matchReason && (r.matchedBy ? ` — ${r.matchReason}` : r.matchReason)}
                      {typeof r.matchConfidence === 'number' && ` (${Math.max(0, Math.min(100, Math.round(r.matchConfidence)))}% sure)`}
                    </p>
                  )}
                </div>
                <svg className={`w-4 h-4 text-sage-400 flex-shrink-0 transition ${openId === r.id ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openId === r.id && (
                <div className="px-3 pb-3 border-t border-cream-100">
                  <pre className="whitespace-pre-wrap text-xs text-sage-700 bg-cream-50 rounded p-3 mt-2 max-h-80 overflow-y-auto font-sans leading-relaxed">
                    {r.transcript || 'No transcript text.'}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
