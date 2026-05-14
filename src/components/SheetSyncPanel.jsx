import { useEffect, useMemo, useState } from 'react'
import { apiFetch, ApiError } from '../utils/api'

const API_URL = import.meta.env.VITE_API_URL || ''

const STATUS_LABEL = {
  'missing': 'Portal missing',
  'conflict': 'Conflict',
  'agree': 'Match',
  'sheet-only': 'Portal has, sheet missing',
  'both-missing': 'Both empty'
}

const STATUS_CLASSES = {
  'missing': 'bg-amber-100 text-amber-800 border-amber-200',
  'conflict': 'bg-red-100 text-red-800 border-red-200',
  'agree': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'sheet-only': 'bg-sky-50 text-sky-700 border-sky-200',
  'both-missing': 'bg-cream-50 text-sage-500 border-cream-200'
}

function formatValue(v) {
  if (v === null || v === undefined) return <span className="italic text-sage-300">(empty)</span>
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'object') return <code className="text-xs">{JSON.stringify(v)}</code>
  return String(v)
}

export default function SheetSyncPanel({ wedding }) {
  const weddingId = wedding?.id
  const [phase, setPhase] = useState('idle')           // idle | loading | loaded | applying | done
  const [diff, setDiff] = useState(null)
  const [decisions, setDecisions] = useState({})       // { entryId: 'import-sheet'|'use-portal'|'skip' }
  const [showAgreed, setShowAgreed] = useState(false)
  const [error, setError] = useState(null)
  const [applyResult, setApplyResult] = useState(null)

  const hasSheetLink = !!wedding?.google_sheets_link

  async function runDiff() {
    setError(null)
    setApplyResult(null)
    setPhase('loading')
    try {
      const data = await apiFetch(`${API_URL}/api/admin/sheet-sync/${weddingId}/diff`, {
        method: 'POST'
      })
      setDiff(data)
      const seed = {}
      for (const e of data.entries || []) seed[e.id] = e.defaultAction || 'skip'
      setDecisions(seed)
      setPhase('loaded')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
      setPhase('idle')
    }
  }

  const [confirming, setConfirming] = useState(false)

  async function applyChanges() {
    if (!diff) return
    const toApply = (diff.entries || []).filter((e) => decisions[e.id] === 'import-sheet')
    if (toApply.length === 0) {
      setError('Nothing selected to import. Toggle at least one row.')
      return
    }
    setPhase('applying')
    setConfirming(false)
    setError(null)
    setApplyResult(null)
    try {
      const data = await apiFetch(`${API_URL}/api/admin/sheet-sync/${weddingId}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          decisions: (diff.entries || []).map((e) => ({
            entryId: e.id,
            choice: decisions[e.id] || 'skip',
            op: e.applyOp
          }))
        })
      })
      setApplyResult(data)
      setPhase('done')
      // Don't auto-rerun diff — leave state visible so the user can read it
    } catch (err) {
      setError(err instanceof ApiError ? `Apply failed: ${err.message}` : String(err))
      setPhase('loaded')
    }
  }

  const grouped = useMemo(() => {
    if (!diff) return []
    const bySection = new Map()
    for (const e of diff.entries || []) {
      if (!showAgreed && (e.status === 'agree' || e.status === 'both-missing')) continue
      if (!bySection.has(e.section)) bySection.set(e.section, [])
      bySection.get(e.section).push(e)
    }
    return [...bySection.entries()].map(([section, rows]) => ({ section, rows }))
  }, [diff, showAgreed])

  const decisionCount = useMemo(() => {
    let importing = 0
    for (const e of diff?.entries || []) {
      if (decisions[e.id] === 'import-sheet') importing += 1
    }
    return importing
  }, [diff, decisions])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-sage-700">Sync from Google Sheet</h2>
          <p className="text-sm text-sage-500 mt-1">
            Pull every difference between the couple's Google Sheet and what's stored in the portal. Import what's missing,
            pick a winner for conflicts, ignore the rest.
          </p>
          {!hasSheetLink && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No Google Sheets link is set on this wedding. Add one via the Links editor on the wedding card before running sync.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {diff && (
            <button
              onClick={() => setShowAgreed((v) => !v)}
              className="px-3 py-2 rounded-lg border border-cream-300 text-sm text-sage-600 hover:bg-cream-50"
            >
              {showAgreed ? 'Hide matching fields' : 'Show matching fields'}
            </button>
          )}
          <button
            onClick={runDiff}
            disabled={!hasSheetLink || phase === 'loading' || phase === 'applying'}
            className="px-4 py-2 rounded-lg bg-sage-600 text-white text-sm hover:bg-sage-700 disabled:opacity-50"
          >
            {phase === 'loading' ? 'Loading…' : diff ? 'Re-run diff' : 'Run diff'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {applyResult && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Applied {applyResult.appliedCount} {applyResult.appliedCount === 1 ? 'change' : 'changes'}.
          {(applyResult.results || []).filter((r) => !r.ok).length > 0 && (
            <span className="text-red-700">
              {' '}Some rows failed —{' '}
              {(applyResult.results || []).filter((r) => !r.ok).map((r) => `${r.entryId} (${r.error})`).join(', ')}
            </span>
          )}
        </div>
      )}

      {diff && (
        <div className="bg-cream-50 border border-cream-200 rounded-lg p-3 text-sm flex flex-wrap gap-x-6 gap-y-1 text-sage-700">
          <span><strong>{diff.counts.missing}</strong> missing in portal</span>
          <span><strong>{diff.counts.conflict}</strong> conflicts</span>
          <span><strong>{diff.counts.agree}</strong> already match</span>
          <span><strong>{diff.counts.sheetOnly}</strong> portal-only</span>
          <span><strong>{diff.counts.bothMissing}</strong> both empty</span>
          <span className="text-sage-400">
            Sheet: <em>{diff.sheetTitle || '(untitled)'}</em>
          </span>
          {diff.lastApply && (
            <span className="text-sage-400">
              Last applied: <em>{new Date(diff.lastApply.applied_at).toLocaleString()}</em>
            </span>
          )}
        </div>
      )}

      {grouped.length === 0 && diff && (
        <div className="text-sm text-sage-500 italic">No rows to review with current filters.</div>
      )}

      {grouped.map(({ section, rows }) => (
        <div key={section} className="border border-cream-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-cream-50 border-b border-cream-200 flex items-center justify-between">
            <h3 className="font-semibold text-sage-700">{section}</h3>
            <span className="text-xs text-sage-500">
              {rows.filter((r) => r.status === 'missing').length} missing ·
              {' '}{rows.filter((r) => r.status === 'conflict').length} conflicts
            </span>
          </div>
          <div className="divide-y divide-cream-100">
            {rows.map((e) => (
              <DiffRow
                key={e.id}
                entry={e}
                choice={decisions[e.id]}
                onChange={(c) => setDecisions((d) => ({ ...d, [e.id]: c }))}
              />
            ))}
          </div>
        </div>
      ))}

      {diff && (
        <div className="sticky bottom-0 bg-white border-t border-cream-200 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-sage-600">
            {decisionCount} change{decisionCount === 1 ? '' : 's'} ready to apply
          </span>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={decisionCount === 0 || phase === 'applying'}
              className="px-5 py-2 rounded-lg bg-sage-700 text-white text-sm font-medium hover:bg-sage-800 disabled:opacity-50"
            >
              {phase === 'applying' ? 'Applying…' : `Apply ${decisionCount} change${decisionCount === 1 ? '' : 's'}`}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-sage-700">Sure? This writes to Supabase.</span>
              <button
                onClick={() => setConfirming(false)}
                className="px-3 py-2 rounded-lg border border-cream-300 text-sm text-sage-600 hover:bg-cream-50"
              >
                Cancel
              </button>
              <button
                onClick={applyChanges}
                disabled={phase === 'applying'}
                className="px-5 py-2 rounded-lg bg-sage-700 text-white text-sm font-medium hover:bg-sage-800 disabled:opacity-50"
              >
                {phase === 'applying' ? 'Applying…' : `Confirm — apply ${decisionCount}`}
              </button>
            </div>
          )}
        </div>
      )}

      {(diff?.moduleErrors || []).length > 0 && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
          <strong>Some modules failed to parse:</strong>
          <ul className="mt-1">
            {diff.moduleErrors.map((m, i) => (
              <li key={i}>· {m.section}: {m.error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function DiffRow({ entry, choice, onChange }) {
  const isMissing = entry.status === 'missing'
  const isConflict = entry.status === 'conflict'
  const isAgree = entry.status === 'agree'
  const isReadOnly = entry.status === 'sheet-only' || entry.status === 'both-missing' || entry.status === 'agree'
  return (
    <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-[200px_1fr_1fr_150px] gap-3 items-start">
      <div>
        <div className="text-sm font-medium text-sage-700">{entry.field}</div>
        <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded border ${STATUS_CLASSES[entry.status]}`}>
          {STATUS_LABEL[entry.status]}
        </span>
        {entry.notes && <div className="text-xs text-sage-400 mt-1 italic">{entry.notes}</div>}
      </div>
      <div className="text-sm text-sage-700">
        <div className="text-[10px] uppercase text-sage-400">Sheet</div>
        <div className="break-words">{formatValue(entry.sheetValue)}</div>
      </div>
      <div className="text-sm text-sage-700">
        <div className="text-[10px] uppercase text-sage-400">Portal</div>
        <div className="break-words">{formatValue(entry.portalValue)}</div>
      </div>
      <div>
        {isMissing && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={choice === 'import-sheet'}
              onChange={(e) => onChange(e.target.checked ? 'import-sheet' : 'skip')}
            />
            <span>Import from sheet</span>
          </label>
        )}
        {isConflict && (
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`choice-${entry.id}`}
                checked={choice === 'import-sheet'}
                onChange={() => onChange('import-sheet')}
              />
              <span>Use sheet</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`choice-${entry.id}`}
                checked={choice === 'use-portal'}
                onChange={() => onChange('use-portal')}
              />
              <span>Keep portal</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`choice-${entry.id}`}
                checked={choice === 'skip' || !choice}
                onChange={() => onChange('skip')}
              />
              <span>Decide later</span>
            </label>
          </div>
        )}
        {isReadOnly && (
          <span className="text-xs text-sage-400 italic">
            {isAgree ? 'No action needed' : 'Read only'}
          </span>
        )}
      </div>
    </div>
  )
}
