import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config/api'
import { loadJson } from '../utils/api'
import LoadError from './ui/LoadError'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The couple's own read-only list of what they have sent Rixey. Mirrors
 * GET /api/admin/documents/:weddingId (the venue's list, at ~14540), minus
 * parse_error and sectionCounts — those are about what the venue found
 * wrong with a read, not something the couple needs — plus a download link
 * back to their own file.
 *
 * PLAN-UX-NAV.md item 9. Read-only: no upload here, that stays an admin
 * action.
 */
export default function CoupleDocuments({ weddingId }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    if (!weddingId) return
    setLoading(true)
    setLoadError(null)
    try {
      const data = await loadJson(`${API_URL}/api/documents/${weddingId}`)
      setDocs(Array.isArray(data) ? data : [])
    } catch (err) {
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }, [weddingId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sage-400 text-sm">Loading documents…</div>
  }
  if (loadError) {
    return <LoadError what="your documents" error={loadError} onRetry={load} />
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-sage-700">Documents</h2>
        <p className="text-sm text-sage-500 mt-0.5">
          Anything you&apos;ve sent Rixey to read: contracts, layouts, lists.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
        {docs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-sage-400">
            Nothing uploaded yet. Send documents to Rixey and they appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-50 border-b border-cream-200 text-left">
                  <th className="px-4 py-3 font-medium text-sage-600 whitespace-nowrap">File</th>
                  <th className="px-4 py-3 font-medium text-sage-600 whitespace-nowrap">Kind</th>
                  <th className="px-4 py-3 font-medium text-sage-600 whitespace-nowrap">Sent</th>
                  <th className="px-4 py-3 font-medium text-sage-600 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 font-medium text-sage-600 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {docs.map(d => (
                  <tr key={d.id} className="hover:bg-cream-50">
                    <td className="px-4 py-3 text-sage-700 font-medium">
                      {d.filename}
                      {d.page_count ? (
                        <span className="block text-xs text-sage-400 font-normal">
                          {d.page_count} page{d.page_count === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sage-600 capitalize">{d.kind || '—'}</td>
                    <td className="px-4 py-3 text-sage-500">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3 text-sage-500">
                      {d.parsed_at ? `Read by Rixey on ${formatDate(d.parsed_at)}` : 'Not yet read'}
                    </td>
                    <td className="px-4 py-3">
                      {d.download_url ? (
                        <a
                          href={d.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded-lg border border-sage-200 text-sage-600 hover:bg-sage-50 transition"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-cream-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
