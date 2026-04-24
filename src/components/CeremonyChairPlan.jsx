import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'

const DEFAULT_SIDES = 6
const EMPTY_FRONT_ROWS = {
  row1: { left: '', right: '' },
  row2: { left: '', right: '', enabled: false },
}

function countNames(text) {
  return (text || '').split('\n').map(s => s.trim()).filter(Boolean).length
}

export default function CeremonyChairPlan({ weddingId, userId, isAdmin = false }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [aisleLabel, setAisleLabel] = useState('Aisle')
  const [frontRows, setFrontRows] = useState(EMPTY_FRONT_ROWS)
  const saveTimer = useRef()

  useEffect(() => {
    if (weddingId) load()
  }, [weddingId])

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ceremony-plan/${weddingId}`, {
        headers: await authHeaders(),
      })
      const data = await res.json()
      if (data.plan?.rows?.length) {
        setRows(data.plan.rows)
        if (data.plan.aisleLabel) setAisleLabel(data.plan.aisleLabel)
      }
      if (data.plan?.frontRows) {
        setFrontRows({
          row1: { left: data.plan.frontRows.row1?.left || '', right: data.plan.frontRows.row1?.right || '' },
          row2: {
            left: data.plan.frontRows.row2?.left || '',
            right: data.plan.frontRows.row2?.right || '',
            enabled: !!data.plan.frontRows.row2?.enabled,
          },
        })
      }
    } catch (err) {
      console.error('Failed to load ceremony plan:', err)
    }
    setLoading(false)
  }

  const save = async (newRows, newAisleLabel, newFrontRows) => {
    clearTimeout(saveTimer.current)
    setSaved(false)
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/ceremony-plan/${weddingId}`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ plan: {
          rows: newRows ?? rows,
          aisleLabel: newAisleLabel ?? aisleLabel,
          frontRows: newFrontRows ?? frontRows,
        } }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    }
    setSaving(false)
  }

  const autoSave = (newRows, newAisleLabel, newFrontRows) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(newRows, newAisleLabel, newFrontRows), 1200)
  }

  const updateFrontRow = (rowKey, side, value) => {
    const next = {
      ...frontRows,
      [rowKey]: { ...frontRows[rowKey], [side]: value },
    }
    setFrontRows(next)
    autoSave(undefined, undefined, next)
  }

  const toggleRow2 = () => {
    const next = {
      ...frontRows,
      row2: { ...frontRows.row2, enabled: !frontRows.row2.enabled },
    }
    setFrontRows(next)
    autoSave(undefined, undefined, next)
  }

  const updateRow = (idx, field, value) => {
    const next = rows.map((r, i) => i === idx ? { ...r, [field]: Math.max(0, value) } : r)
    setRows(next)
    autoSave(next)
  }

  const addRow = () => {
    const last = rows[rows.length - 1]
    const next = [...rows, { left: last?.left ?? DEFAULT_SIDES, right: last?.right ?? DEFAULT_SIDES, label: '' }]
    setRows(next)
    autoSave(next)
  }

  const addMultipleRows = (count) => {
    const last = rows[rows.length - 1]
    const newRows = Array.from({ length: count }, () => ({
      left: last?.left ?? DEFAULT_SIDES,
      right: last?.right ?? DEFAULT_SIDES,
      label: '',
    }))
    const next = [...rows, ...newRows]
    setRows(next)
    autoSave(next)
  }

  const removeRow = (idx) => {
    const next = rows.filter((_, i) => i !== idx)
    setRows(next)
    autoSave(next)
  }

  const updateRowLabel = (idx, label) => {
    const next = rows.map((r, i) => i === idx ? { ...r, label } : r)
    setRows(next)
    autoSave(next)
  }

  const totalSeats = rows.reduce((sum, r) => sum + (r.left || 0) + (r.right || 0), 0)
  const totalLeft = rows.reduce((sum, r) => sum + (r.left || 0), 0)
  const totalRight = rows.reduce((sum, r) => sum + (r.right || 0), 0)

  // Find the widest side for consistent X grid alignment
  const maxSide = Math.max(...rows.map(r => Math.max(r.left || 0, r.right || 0)), 1)

  if (loading) return <div className="text-sage-500 text-center py-8">Loading ceremony plan...</div>

  const row1LeftCount = countNames(frontRows.row1.left)
  const row1RightCount = countNames(frontRows.row1.right)
  const row2LeftCount = countNames(frontRows.row2.left)
  const row2RightCount = countNames(frontRows.row2.right)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Ceremony Chair Plan</h2>
          <p className="text-sage-600 text-sm">Visual seating layout for the ceremony</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-green-600 text-xs">Saved</span>}
          {saving && <span className="text-sage-400 text-xs">Saving...</span>}
        </div>
      </div>

      {/* Front row seating — who sits where */}
      <div className="bg-white border border-cream-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="font-serif text-lg text-sage-700">Front row seating</h3>
          <p className="text-sage-600 text-sm mt-1">
            Who should sit in the front row? Immediate family usually — parents, siblings, grandparents.
            Max 8 per side. The two sides don&apos;t need to match.
          </p>
        </div>

        {/* Row 1 */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-sage-700 uppercase tracking-wide">Row 1 (front)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sage-500 mb-1">
                Left side · <span className={row1LeftCount > 8 ? 'text-rose-500 font-medium' : 'text-sage-400'}>{row1LeftCount}/8</span>
              </label>
              <textarea
                value={frontRows.row1.left}
                onChange={e => updateFrontRow('row1', 'left', e.target.value)}
                placeholder={'One name per line\ne.g. Mom\nDad\nGrandma Jean'}
                rows={5}
                className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-sage-500 mb-1">
                Right side · <span className={row1RightCount > 8 ? 'text-rose-500 font-medium' : 'text-sage-400'}>{row1RightCount}/8</span>
              </label>
              <textarea
                value={frontRows.row1.right}
                onChange={e => updateFrontRow('row1', 'right', e.target.value)}
                placeholder={'One name per line'}
                rows={5}
                className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Row 2 toggle + inputs */}
        <div className="pt-2 border-t border-cream-100">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={frontRows.row2.enabled}
              onChange={toggleRow2}
              className="w-4 h-4 rounded border-sage-300 text-sage-600"
            />
            <span className="text-sm text-sage-700">Also assign Row 2</span>
          </label>

          {frontRows.row2.enabled && (
            <div className="mt-3 space-y-3">
              <p className="text-xs font-semibold text-sage-700 uppercase tracking-wide">Row 2</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-sage-500 mb-1">
                    Left side · <span className={row2LeftCount > 8 ? 'text-rose-500 font-medium' : 'text-sage-400'}>{row2LeftCount}/8</span>
                  </label>
                  <textarea
                    value={frontRows.row2.left}
                    onChange={e => updateFrontRow('row2', 'left', e.target.value)}
                    placeholder={'One name per line'}
                    rows={5}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-sage-500 mb-1">
                    Right side · <span className={row2RightCount > 8 ? 'text-rose-500 font-medium' : 'text-sage-400'}>{row2RightCount}/8</span>
                  </label>
                  <textarea
                    value={frontRows.row2.right}
                    onChange={e => updateFrontRow('row2', 'right', e.target.value)}
                    placeholder={'One name per line'}
                    rows={5}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Client-only placeholder when coordinator hasn't built the chair plan yet */}
      {!isAdmin && rows.length === 0 && (
        <div className="bg-cream-50 rounded-2xl border border-cream-200 p-12 text-center">
          <p className="text-sage-500 text-sm">Your full ceremony seating plan will appear here once your coordinator has set it up.</p>
        </div>
      )}

      {/* Totals — only once rows exist */}
      {rows.length > 0 && (
        <div className="bg-sage-600 text-white rounded-xl p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{totalLeft}</p>
              <p className="text-sage-200 text-sm">Left side</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{totalSeats}</p>
              <p className="text-sage-200 text-sm">Total chairs</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalRight}</p>
              <p className="text-sage-200 text-sm">Right side</p>
            </div>
          </div>
          <p className="text-sage-200 text-xs text-center mt-2">{rows.length} row{rows.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Visual layout — admin always, couple only after rows exist */}
      {(isAdmin || rows.length > 0) && (
      <div className="bg-cream-50 border border-cream-200 rounded-xl p-4 sm:p-6 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sage-400 text-sm text-center py-8">
            No rows yet. Add rows below to build your ceremony layout.
          </p>
        ) : (
          <div className="space-y-1 min-w-fit">
            {/* Altar / front marker */}
            <div className="text-center mb-4">
              <div className="inline-block px-6 py-2 bg-sage-100 border border-sage-200 rounded-lg">
                <span className="text-sage-700 text-sm font-medium">Altar / Officiant</span>
              </div>
            </div>

            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center justify-center gap-1 group">
                {/* Row number */}
                <span className="text-xs text-sage-400 w-8 text-right flex-shrink-0 tabular-nums">
                  R{idx + 1}
                </span>

                {/* Left side X's — right-aligned */}
                <div className="flex justify-end gap-0.5 flex-shrink-0" style={{ width: `${maxSide * 1.25}rem` }}>
                  {Array.from({ length: row.left || 0 }).map((_, i) => (
                    <span key={i} className="w-4 h-4 flex items-center justify-center text-sage-700 text-xs font-bold select-none">
                      X
                    </span>
                  ))}
                </div>

                {/* Left count */}
                <span className="text-xs font-bold text-sage-800 w-6 text-center flex-shrink-0 tabular-nums">
                  {row.left || 0}
                </span>

                {/* Aisle gap */}
                <div className="w-12 sm:w-16 flex-shrink-0 border-l border-r border-dashed border-sage-300 mx-1" />

                {/* Right count */}
                <span className="text-xs font-bold text-sage-800 w-6 text-center flex-shrink-0 tabular-nums">
                  {row.right || 0}
                </span>

                {/* Right side X's — left-aligned */}
                <div className="flex justify-start gap-0.5 flex-shrink-0" style={{ width: `${maxSide * 1.25}rem` }}>
                  {Array.from({ length: row.right || 0 }).map((_, i) => (
                    <span key={i} className="w-4 h-4 flex items-center justify-center text-sage-700 text-xs font-bold select-none">
                      X
                    </span>
                  ))}
                </div>

                {/* Row label (if set) */}
                {row.label && (
                  <span className="text-xs text-sage-400 ml-2 flex-shrink-0">{row.label}</span>
                )}

                {/* Row total */}
                <span className="text-xs text-sage-500 ml-2 flex-shrink-0 tabular-nums">
                  = {(row.left || 0) + (row.right || 0)}
                </span>
              </div>
            ))}

            {/* Back marker */}
            <div className="text-center mt-4 pt-2 border-t border-dashed border-sage-200">
              <span className="text-sage-400 text-xs uppercase tracking-wide">Back of ceremony</span>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Row editor — admin only */}
      {isAdmin && <div className="border border-cream-200 rounded-xl overflow-hidden">
        <div className="bg-cream-50 px-4 py-3 border-b border-cream-200 flex items-center justify-between">
          <h3 className="font-medium text-sage-700">Edit Rows</h3>
          <div className="flex gap-2">
            <button onClick={addRow}
              className="text-xs px-3 py-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition">
              + Add Row
            </button>
            <button onClick={() => addMultipleRows(5)}
              className="text-xs px-3 py-1.5 rounded-lg border border-sage-300 text-sage-700 hover:bg-sage-50 transition">
              + 5 Rows
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sage-400 text-sm mb-3">Start by adding rows for your ceremony seating.</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button onClick={() => {
                const starter = Array.from({ length: 7 }, (_, i) => ({
                  left: i === 0 ? 4 : 6, right: i === 0 ? 4 : 6, label: i === 0 ? 'Reserved' : '',
                }))
                setRows(starter)
                autoSave(starter)
              }}
                className="px-4 py-2 rounded-lg border border-sage-300 text-sage-700 text-sm hover:bg-sage-50 transition">
                Quick start: 7 rows (48 chairs)
              </button>
              <button onClick={() => {
                const starter = Array.from({ length: 10 }, (_, i) => ({
                  left: i < 2 ? 5 : 8, right: i < 2 ? 5 : 8, label: i === 0 ? 'Reserved' : '',
                }))
                setRows(starter)
                autoSave(starter)
              }}
                className="px-4 py-2 rounded-lg border border-sage-300 text-sage-700 text-sm hover:bg-sage-50 transition">
                Quick start: 10 rows (140 chairs)
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-cream-100 max-h-96 overflow-y-auto">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs font-medium text-sage-500 w-8 flex-shrink-0">R{idx + 1}</span>

                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-sage-500">L</label>
                  <input
                    type="number" min="0" max="30"
                    value={row.left}
                    onChange={e => updateRow(idx, 'left', parseInt(e.target.value) || 0)}
                    className="w-14 px-2 py-1.5 border border-cream-300 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-sage-300"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-sage-500">R</label>
                  <input
                    type="number" min="0" max="30"
                    value={row.right}
                    onChange={e => updateRow(idx, 'right', parseInt(e.target.value) || 0)}
                    className="w-14 px-2 py-1.5 border border-cream-300 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-sage-300"
                  />
                </div>

                <input
                  type="text"
                  value={row.label || ''}
                  onChange={e => updateRowLabel(idx, e.target.value)}
                  placeholder="Label (optional)"
                  className="flex-1 px-2 py-1.5 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sage-300 min-w-0"
                />

                <span className="text-xs text-sage-600 font-medium w-8 text-center tabular-nums">
                  {(row.left || 0) + (row.right || 0)}
                </span>

                <button onClick={() => removeRow(idx)}
                  className="text-sage-300 hover:text-red-500 transition flex-shrink-0" title="Remove row">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* Bulk actions — admin only */}
      {isAdmin && rows.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-sage-500">Set all rows to:</span>
          {[4, 5, 6, 7, 8, 10].map(n => (
            <button key={n} onClick={() => {
              const next = rows.map(r => ({ ...r, left: n, right: n }))
              setRows(next)
              autoSave(next)
            }}
              className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-600 hover:bg-cream-50 transition">
              {n} + {n}
            </button>
          ))}
          <button onClick={() => save()}
            className="ml-auto text-xs px-4 py-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition">
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
