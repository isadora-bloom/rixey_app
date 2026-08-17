import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../config/api'
import { apiFetch } from '../utils/api'
import { useToast } from './ui/Toast'

/**
 * Upload a planning document, see what it says the portal does not, decide.
 *
 * The order on screen mirrors the order of trust: read the file, look at the
 * differences, then choose. Nothing is written until Import is pressed, and
 * only rows explicitly ticked are written.
 *
 * Agreeing rows are hidden by default. A 53-page plan produces ninety-odd
 * entries and the portal already agrees with most of them; showing all of it
 * buries the handful that matter, which for Alyssa & Brett was two missing
 * allergies.
 */

const STATUS_STYLE = {
  missing: { label: 'Not in portal', cls: 'bg-amber-100 text-amber-800' },
  conflict: { label: 'Differs', cls: 'bg-red-100 text-red-700' },
  agree: { label: 'Matches', cls: 'bg-sage-100 text-sage-600' },
  'sheet-only': { label: 'Document only', cls: 'bg-cream-200 text-sage-600' },
  'both-missing': { label: 'Neither', cls: 'bg-cream-200 text-sage-400' },
}

export default function DocumentSyncPanel({ weddingId }) {
  const { error: toastError, success: toastSuccess } = useToast()
  const [docs, setDocs] = useState([])
  const [active, setActive] = useState(null)
  const [diff, setDiff] = useState(null)
  const [busy, setBusy] = useState('')
  const [showAgreeing, setShowAgreeing] = useState(false)
  const [choices, setChoices] = useState({})   // entryId -> true when ticked
  // The outcome of the last import, kept so the panel can say what happened.
  // Without it, a successful import left the screen identical to before.
  const [lastImport, setLastImport] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { if (weddingId) load() }, [weddingId])

  const load = async () => {
    try { setDocs(await apiFetch(`${API_URL}/api/admin/documents/${weddingId}`) || []) }
    catch (err) { toastError(`Could not load documents: ${err.message}`) }
  }

  const upload = async (file) => {
    setBusy('upload')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch(`${API_URL}/api/admin/documents/${weddingId}/upload`, { method: 'POST', body: form })
      if (res.duplicateOf) {
        toastSuccess(res.message)
      } else {
        toastSuccess(`Read ${res.filename} — ${res.page_count || '?'} pages, version ${res.version}.`)
        await load()
        await parse(res.id)
      }
    } catch (err) { toastError(`Upload failed: ${err.message}`) }
    setBusy('')
  }

  // Reading runs in the background — a big document takes minutes and several
  // model calls — so this starts it and then waits for parsed_at to appear.
  const parse = async (id) => {
    setBusy('parse')
    try {
      const res = await apiFetch(`${API_URL}/api/admin/documents/${id}/parse`, { method: 'POST' })
      toastSuccess(`Reading it — ${res.chunks} section${res.chunks === 1 ? '' : 's'} to work through. This can take a couple of minutes.`)

      const startedAt = Date.now()
      while (Date.now() - startedAt < 10 * 60 * 1000) {
        await new Promise(r => setTimeout(r, 5000))
        const list = await apiFetch(`${API_URL}/api/admin/documents/${weddingId}`) || []
        setDocs(list)
        const doc = list.find(d => d.id === id)
        if (doc?.parse_error && !doc?.parsed_at) { toastError(`Could not read it: ${doc.parse_error}`); break }
        if (doc?.parsed_at) {
          const found = Object.entries(doc.sectionCounts || {}).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', ')
          toastSuccess(found ? `Found ${found}.` : 'Nothing recognisable in that document.')
          if (doc.parse_error) toastError(`Partly read only: ${doc.parse_error}`)
          await openDiff(id)
          break
        }
      }
    } catch (err) { toastError(`Could not read it: ${err.message}`) }
    setBusy('')
  }

  const openDiff = async (id) => {
    setBusy('diff')
    try {
      const d = await apiFetch(`${API_URL}/api/admin/documents/${id}/diff`)
      setDiff(d)
      setActive(id)
      // Pre-tick what is missing. A conflict means a human wrote something
      // different and that judgement should not be overridden by default.
      const pre = {}
      for (const e of d.entries) if (e.status === 'missing' && e.applyOp?.type !== 'noop') pre[e.id] = true
      setChoices(pre)
    } catch (err) {
      if (err.message?.includes('parse')) toastError('Read the document first.')
      else toastError(`Could not compare: ${err.message}`)
    }
    setBusy('')
  }

  const apply = async () => {
    const decisions = (diff?.entries || [])
      .filter(e => choices[e.id] && e.applyOp?.type !== 'noop')
      .map(e => ({ entryId: e.id, choice: 'import-sheet', op: e.applyOp }))
    if (!decisions.length) return
    setBusy('apply')
    try {
      const res = await apiFetch(`${API_URL}/api/admin/documents/${active}/apply`, {
        method: 'POST', body: JSON.stringify({ decisions }),
      })
      const failed = (res.results || []).filter(r => !r.ok)
      const skipped = (res.results || []).filter(r => r.ok && r.skipped).length
      if (failed.length) {
        toastError(`Imported ${res.appliedCount}, but ${failed.length} failed: ${failed[0].error || 'no reason given'}`)
      } else {
        toastSuccess(
          `Imported ${res.appliedCount}${skipped ? `, ${skipped} already there` : ''}. ` +
          'They are in the planning notes and checklist now.'
        )
      }
      // What was just imported, so the panel can say so rather than going back
      // to looking exactly as it did before the button was pressed.
      setLastImport({ count: res.appliedCount, skipped, failed: failed.length, at: Date.now() })
      await openDiff(active)
    } catch (err) { toastError(`Import failed: ${err.message}`) }
    setBusy('')
  }

  const remove = async (id) => {
    if (!window.confirm('Remove this document? What was already imported stays.')) return
    try {
      await apiFetch(`${API_URL}/api/admin/documents/${id}`, { method: 'DELETE' })
      if (active === id) { setActive(null); setDiff(null) }
      await load()
    } catch (err) { toastError(`Could not remove: ${err.message}`) }
  }

  const entries = diff?.entries || []
  const shown = entries.filter(e => showAgreeing || e.status === 'missing' || e.status === 'conflict')
  const bySection = {}
  for (const e of shown) (bySection[e.section] ||= []).push(e)
  const tickedCount = entries.filter(e => choices[e.id] && e.applyOp?.type !== 'noop').length

  const toggleSection = (list, on) =>
    setChoices(prev => {
      const next = { ...prev }
      for (const e of list) if (e.applyOp?.type !== 'noop') next[e.id] = on
      return next
    })

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Planning Documents</h2>
          <p className="text-sage-500 text-sm mt-0.5">
            Upload their plan, spreadsheet or contract. Sage reads it and shows what the portal is missing.
            Nothing is saved until you say so.
          </p>
        </div>
        <input
          ref={fileRef} type="file" hidden
          accept=".pdf,.xlsx,.xls,.csv,.docx,.doc"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="shrink-0 text-sm px-4 py-2 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition disabled:opacity-50"
        >
          {busy === 'upload' ? 'Reading…' : busy === 'parse' ? 'Making sense of it…' : '+ Upload'}
        </button>
      </div>

      {docs.length > 0 && (
        <div className="border border-cream-200 rounded-xl divide-y divide-cream-100">
          {docs.map(d => (
            <div key={d.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${active === d.id ? 'bg-sage-50/60' : ''}`}>
              <div className="min-w-0">
                <p className="text-sm text-sage-800 truncate">
                  {d.filename}
                  <span className="text-sage-400 text-xs ml-2">v{d.version}</span>
                </p>
                <p className="text-xs text-sage-400 mt-0.5">
                  {d.kind}{d.page_count ? ` · ${d.page_count} ${d.kind === 'xlsx' ? 'tabs' : 'pages'}` : ''}
                  {' · '}{String(d.created_at).slice(0, 10)}
                  {d.parsed_at
                    ? ` · read (${Object.entries(d.sectionCounts || {}).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing found'})`
                    : ' · not read yet'}
                  {d.parse_error ? ` · failed: ${d.parse_error}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => (d.parsed_at ? openDiff(d.id) : parse(d.id))}
                  disabled={!!busy}
                  className="text-xs px-3 py-1.5 rounded-lg border border-sage-300 text-sage-600 hover:bg-sage-50 transition disabled:opacity-50"
                >
                  {d.parsed_at ? 'Compare' : 'Read it'}
                </button>
                <button onClick={() => remove(d.id)} className="text-xs px-2 py-1.5 text-sage-400 hover:text-red-500">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {docs.length === 0 && (
        <div className="border border-dashed border-cream-300 rounded-xl py-12 text-center">
          <p className="text-sage-400 text-sm">Nothing uploaded yet. PDF, Excel or Word.</p>
        </div>
      )}

      {diff && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-200 pt-4">
            <div>
              <p className="text-sm font-medium text-sage-700">
                {diff.counts.actionable} of {diff.counts.total} need a look
              </p>
              <p className="text-xs text-sage-400 mt-0.5">
                {diff.counts.missing || 0} not in the portal · {diff.counts.conflict || 0} differ · {diff.counts.agree || 0} already match
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAgreeing(v => !v)} className="text-xs text-sage-500 underline">
                {showAgreeing ? 'Hide matching' : `Show ${diff.counts.agree || 0} matching`}
              </button>
              <button
                onClick={apply}
                disabled={!tickedCount || busy === 'apply'}
                className="text-sm px-4 py-2 rounded-lg bg-sage-700 text-white hover:bg-sage-800 transition disabled:opacity-40"
              >
                {busy === 'apply'
                  ? 'Importing…'
                  : tickedCount
                    ? `Import ${tickedCount} ticked`
                    : 'Nothing left to import'}
              </button>
            </div>
          </div>

          {/*
            Say what the import did.

            The old panel toasted a count and then re-rendered identically,
            because everything it had just written still read as missing and got
            re-ticked. So it looked like the button had done nothing and inviting
            another press, which inserted the lot again.
          */}
          {lastImport && (
            <div className={`rounded-xl px-4 py-3 border ${
              lastImport.failed ? 'bg-red-50 border-red-200' : 'bg-sage-50 border-sage-200'
            }`}>
              <p className="text-sm font-medium text-sage-800">
                {lastImport.count > 0
                  ? `${lastImport.count} item${lastImport.count === 1 ? '' : 's'} imported.`
                  : 'Nothing new to import.'}
                {lastImport.skipped > 0 && ` ${lastImport.skipped} were already there.`}
                {lastImport.failed > 0 && ` ${lastImport.failed} failed.`}
              </p>
              <p className="text-xs text-sage-500 mt-0.5">
                They are in Planning Notes and the Checklist now, waiting for review.
                Anything shown as already imported below will not be sent twice.
              </p>
            </div>
          )}

          {/* What the planner changed since their last version. A different
              question from what differs from the portal, so kept separate. */}
          {diff.sinceLast?.changes?.length > 0 && (
            <div className="bg-cream-50 border border-cream-200 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-sage-700">
                {diff.sinceLast.changes.length} change{diff.sinceLast.changes.length === 1 ? '' : 's'} since {diff.sinceLast.filename} (v{diff.sinceLast.version})
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {diff.sinceLast.changes.slice(0, 12).map((c, i) => (
                  <li key={i} className="text-xs text-sage-600">
                    <span className={c.type === 'added' ? 'text-sage-700' : 'text-red-600'}>
                      {c.type === 'added' ? '+' : '−'}
                    </span>{' '}
                    <span className="text-sage-400">{c.key}</span>{' '}
                    {Object.values(c.row).filter(Boolean).join(' — ').slice(0, 90)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.entries(bySection).map(([section, list]) => (
            <div key={section} className="border border-cream-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-cream-50 border-b border-cream-200">
                <p className="text-sm font-medium text-sage-700">{section} <span className="text-sage-400">({list.length})</span></p>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => toggleSection(list, true)} className="text-sage-600 underline">Tick all</button>
                  <button onClick={() => toggleSection(list, false)} className="text-sage-400 underline">None</button>
                </div>
              </div>
              <div className="divide-y divide-cream-100">
                {list.map(e => {
                  const style = STATUS_STYLE[e.status] || STATUS_STYLE.missing
                  const writable = e.applyOp?.type !== 'noop'
                  return (
                    <label key={e.id} className={`flex items-start gap-3 px-4 py-3 ${writable ? 'cursor-pointer hover:bg-cream-50/60' : 'opacity-70'}`}>
                      <input
                        type="checkbox"
                        className="mt-1 accent-sage-600"
                        disabled={!writable}
                        checked={!!choices[e.id]}
                        onChange={ev => setChoices(prev => ({ ...prev, [e.id]: ev.target.checked }))}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-sage-800">{e.field}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${style.cls}`}>{style.label}</span>
                          {!writable && <span className="text-[10px] text-sage-400">needs doing by hand</span>}
                        </div>
                        <p className="text-xs text-sage-600 mt-1">
                          <span className="text-sage-400">document:</span> {String(e.sheetValue)}
                        </p>
                        {e.portalValue && (
                          <p className="text-xs text-sage-500">
                            <span className="text-sage-400">portal:</span> {String(e.portalValue)}
                          </p>
                        )}
                        {e.notes && <p className="text-[11px] text-amber-700 mt-1">{e.notes}</p>}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          {shown.length === 0 && (
            <div className="border border-dashed border-cream-300 rounded-xl py-10 text-center">
              <p className="text-sage-500 text-sm">Everything in this document already matches the portal.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
