import { useState, useRef, useEffect, useCallback } from 'react'
import { apiFetch } from '../../utils/api'
import { API_URL } from '../../config/api'
import { useToast } from '../ui/Toast'
import { formatDateOnly } from '../../utils/dates'
import { weddingName } from '../../../shared/wedding-name.js'

/**
 * Ask Sage about any wedding, from the admin home, without opening one first.
 *
 * The old shape of this was three moves: remember which couple, find them in
 * the list, open the profile, then ask. This is one: "tell me the caterer for
 * alyssa's wedding" and the answer comes back with the couple named above it.
 *
 * Three things can come back. An answer, which says which wedding it is about
 * and offers the profile. A short list, when more than one couple fits the
 * name, because two Alyssas is a question not an answer. Or nothing placed at
 * all, which offers the wedding list she already has on screen rather than a
 * shrug.
 *
 * The last five exchanges stay, one line each, because the second question is
 * usually about the first answer.
 */
export default function AskSageBar({ weddings = [], onOpenProfile }) {
  const { error: toastError } = useToast()
  const inputRef = useRef(null)

  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  // The wedding could not be settled from the sentence. Holds what she typed
  // so a chip or the picker can re-send it against a wedding she has named.
  const [asking, setAsking] = useState(null)
  // What failed, and enough to try it again unchanged.
  const [failed, setFailed] = useState(null)
  const [history, setHistory] = useState([])
  const [openId, setOpenId] = useState(null)

  // "/" is the search key everywhere else, so it is the search key here.
  // Not while she is typing in something: an admin home full of name fields
  // would otherwise swallow every slash in a URL she is pasting.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      const tag = el?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const ask = useCallback(async (question, weddingId = null) => {
    const asked = String(question || '').trim()
    if (!asked || loading) return

    setLoading(true)
    setFailed(null)
    setAsking(null)
    try {
      const body = weddingId ? { text: asked, weddingId } : { text: asked }
      const data = await apiFetch(`${API_URL}/api/admin/ask`, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (!data?.resolved) {
        setAsking({ text: asked, candidates: data?.candidates || [] })
        return
      }

      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        asked,
        question: data.question || asked,
        wedding: data.wedding,
        answer: data.answer || '',
        confidence: data.confidence,
      }
      // Newest first, five deep. Six answers back is scrollback, not memory.
      setHistory(h => [entry, ...h].slice(0, 5))
      setOpenId(entry.id)
      setText('')
    } catch (err) {
      toastError(err.message || 'Sage could not answer that.')
      setFailed({ text: asked, weddingId, message: err.message || 'Sage could not answer that.' })
    } finally {
      setLoading(false)
    }
  }, [loading, toastError])

  const onSubmit = (e) => {
    e.preventDefault()
    ask(text)
  }

  // The wedding list the page already loaded, most recent first, so the picker
  // is not another request and cannot disagree with the list below it.
  const pickable = [...weddings]
    .filter(w => !w.archived)
    .sort((a, b) => String(a.wedding_date || '').localeCompare(String(b.wedding_date || '')))

  const openProfile = (weddingId) => {
    const full = weddings.find(w => w.id === weddingId)
    if (full && onOpenProfile) onOpenProfile(full)
  }

  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-3 sm:p-4">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <span className="text-base pl-1" aria-hidden="true">✨</span>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask Sage about any wedding, e.g. tell me the caterer for Alyssa's wedding"
          aria-label="Ask Sage about any wedding"
          className="flex-1 min-w-0 py-2 text-sm bg-transparent focus:outline-none placeholder:text-sage-300"
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="px-3 py-1.5 text-sm rounded-lg bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Asking…' : 'Ask'}
        </button>
      </form>

      {loading && (
        <p className="mt-3 text-sm text-sage-400">Reading the wedding…</p>
      )}

      {failed && !loading && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-red-600">
          <span>{failed.message}</span>
          <button
            onClick={() => ask(failed.text, failed.weddingId)}
            className="px-2 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50 transition"
          >
            Try again
          </button>
        </div>
      )}

      {asking && !loading && (
        <div className="mt-3">
          {asking.candidates.length > 0 ? (
            <>
              <p className="text-sm text-sage-600">Which wedding?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {asking.candidates.map(c => (
                  <button
                    key={c.id}
                    onClick={() => ask(asking.text, c.id)}
                    className="px-3 py-1.5 text-sm rounded-full border border-cream-300 text-sage-700 hover:bg-cream-50 transition"
                  >
                    {c.couple_names || 'Unnamed'}
                    {c.wedding_date && <span className="text-sage-400"> · {formatDateOnly(c.wedding_date)}</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-sage-600">I could not tell which wedding you mean.</p>
              <select
                defaultValue=""
                onChange={(e) => { if (e.target.value) ask(asking.text, e.target.value) }}
                className="mt-2 w-full sm:w-80 px-3 py-2 rounded-lg border border-cream-300 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              >
                <option value="">Pick the wedding…</option>
                {pickable.map(w => (
                  <option key={w.id} value={w.id}>
                    {weddingName(w)}{w.wedding_date ? ` · ${formatDateOnly(w.wedding_date)}` : ''}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-3 divide-y divide-cream-100 border-t border-cream-100">
          {history.map(entry => {
            const open = openId === entry.id
            return (
              <div key={entry.id} className="py-2">
                <button
                  onClick={() => setOpenId(open ? null : entry.id)}
                  className="w-full flex items-baseline gap-2 text-left"
                >
                  <span className="text-sage-300 text-xs flex-shrink-0">{open ? '▾' : '▸'}</span>
                  <span className="text-sm text-sage-700 truncate">{entry.asked}</span>
                  <span className="text-xs text-sage-400 flex-shrink-0 ml-auto truncate max-w-[45%]">
                    {entry.wedding?.couple_names || ''}
                  </span>
                </button>

                {open && (
                  <div className="mt-2 pl-5">
                    <p className="text-xs text-sage-500">
                      Answering for {entry.wedding?.couple_names || 'this wedding'}
                      {entry.wedding?.wedding_date ? `, ${formatDateOnly(entry.wedding.wedding_date)}` : ''}
                      {entry.wedding?.id && (
                        <>
                          {' '}
                          <button
                            onClick={() => openProfile(entry.wedding.id)}
                            className="text-sage-600 underline hover:text-sage-800"
                          >
                            Open profile
                          </button>
                        </>
                      )}
                    </p>
                    <div className="mt-2 space-y-2">
                      {String(entry.answer).split(/\n{2,}/).filter(Boolean).map((para, i) => (
                        <p key={i} className="text-sm text-sage-700 whitespace-pre-wrap">{para}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
