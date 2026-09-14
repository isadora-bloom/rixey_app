import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config/api'
import { loadJson } from '../utils/api'
import LoadError from './ui/LoadError'
import { getCategoryLabel, getCategoryIcon } from '../pages/admin/adminUtils'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * "Share this with the couple" on a call or email used to write a planning
 * note the couple had no view for at all — item 1 of the ingestion matrix.
 * Reads only the confirmed, added notes Rixey has filed for this wedding;
 * `GET /api/planning-notes/couple/:weddingId` is member-scoped and already
 * excludes pending/unreviewed rows, so there is nothing to gate here beyond
 * grouping and ordering.
 */
export default function CoupleNotes({ weddingId }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    if (!weddingId) return
    setLoading(true)
    setLoadError(null)
    try {
      const data = await loadJson(`${API_URL}/api/planning-notes/couple/${weddingId}`)
      setNotes(Array.isArray(data) ? data : [])
    } catch (err) {
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }, [weddingId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sage-400 text-sm">Loading notes from Rixey…</div>
  }
  if (loadError) {
    return <LoadError what="your notes from Rixey" error={loadError} onRetry={load} />
  }

  // Newest first within each category, categories in the order they were
  // first seen (so the group a couple has the most going on in floats up).
  const groups = []
  const byCategory = new Map()
  for (const note of [...notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
    const category = note.category || 'note'
    if (!byCategory.has(category)) {
      const group = { category, notes: [] }
      byCategory.set(category, group)
      groups.push(group)
    }
    byCategory.get(category).notes.push(note)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-sage-700">Notes from Rixey</h2>
        <p className="text-sm text-sage-500 mt-0.5">
          Anything the team has confirmed and filed from a call, an email or a conversation.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-cream-200 px-6 py-12 text-center text-sm text-sage-400">
          Rixey has not filed anything yet.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.category} className="bg-white rounded-xl border border-cream-200 overflow-hidden">
              <div className="bg-cream-50 border-b border-cream-200 px-4 py-2.5 flex items-center gap-2">
                <span aria-hidden="true">{getCategoryIcon(group.category)}</span>
                <h3 className="text-sm font-medium text-sage-700">{getCategoryLabel(group.category)}</h3>
              </div>
              <ul className="divide-y divide-cream-100">
                {group.notes.map(note => (
                  <li key={note.id} className="px-4 py-3">
                    <p className="text-sm text-sage-700 whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-sage-400 mt-1">{formatDate(note.created_at)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
