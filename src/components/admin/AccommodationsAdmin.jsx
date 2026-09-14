import { useEffect, useState } from 'react'
import { API_URL } from '../../config/api'
import { loadJson, apiFetch } from '../../utils/api'
import { useToast } from '../ui/Toast'
import { ConfirmDialog } from '../ui'
import LoadError from '../ui/LoadError'

/**
 * A table nobody could write to.
 *
 * `accommodations` fed the couple's Accommodations page and the wedding
 * website's "Where to Stay" section, but rows only ever went in by hand in
 * the Supabase console — read from the browser with the anon key, no admin
 * writer anywhere. This is that writer: the same columns those two screens
 * already read (`name`, `booking_platform`, `sleeps`, `distance`, `rating`,
 * `availability`, `price_per_night`, `price_per_person`).
 */

const FIELDS = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'booking_platform', label: 'Type', type: 'text', placeholder: 'Airbnb, VRBO, Hotel…' },
  { key: 'sleeps', label: 'Sleeps', type: 'number' },
  { key: 'distance', label: 'Distance', type: 'text', placeholder: '10 minutes' },
  { key: 'rating', label: 'Rating', type: 'text', placeholder: '4.8' },
  { key: 'availability', label: 'Availability note', type: 'text' },
  { key: 'price_per_night', label: 'Price / night', type: 'number' },
  { key: 'price_per_person', label: 'Price / person', type: 'number' },
]

const BLANK = FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})

export default function AccommodationsAdmin() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const fetchRows = () =>
    loadJson(`${API_URL}/api/admin/accommodations`).then(data => (Array.isArray(data) ? data : (data?.accommodations || [])))

  const load = () => {
    setError(null)
    fetchRows().then(setRows).catch(err => setError(err))
  }

  useEffect(() => {
    let alive = true
    fetchRows()
      .then(rows => { if (alive) setRows(rows) })
      .catch(err => { if (alive) setError(err) })
    return () => { alive = false }
  }, [])

  const startAdd = () => { setForm(BLANK); setEditingId(null); setAdding(true) }
  const startEdit = (row) => {
    setForm(FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: row[f.key] ?? '' }), {}))
    setEditingId(row.id)
    setAdding(true)
  }
  const cancel = () => { setAdding(false); setEditingId(null); setForm(BLANK) }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const body = { ...form }
    for (const f of FIELDS) {
      if (f.type === 'number') body[f.key] = body[f.key] === '' ? null : Number(body[f.key])
    }
    try {
      if (editingId) {
        const updated = await apiFetch(`${API_URL}/api/admin/accommodations/${editingId}`, {
          method: 'PUT', body: JSON.stringify(body),
        })
        setRows(prev => prev.map(r => r.id === editingId ? (updated?.id ? updated : { ...r, ...body }) : r))
        toastSuccess('Saved.')
      } else {
        const created = await apiFetch(`${API_URL}/api/admin/accommodations`, {
          method: 'POST', body: JSON.stringify(body),
        })
        setRows(prev => [...(prev || []), created?.id ? created : { ...body, id: Date.now() }])
        toastSuccess('Added.')
      }
      cancel()
    } catch (err) {
      toastError(`Could not save: ${err.message}`)
    }
    setSaving(false)
  }

  const remove = async (id) => {
    const snapshot = rows
    setRows(prev => prev.filter(r => r.id !== id))
    try {
      await apiFetch(`${API_URL}/api/admin/accommodations/${id}`, { method: 'DELETE' })
    } catch (err) {
      setRows(snapshot)
      toastError(`Could not delete: ${err.message}`)
    }
  }

  if (error) return <LoadError what="accommodations" error={error} onRetry={load} />

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Accommodations</h2>
          <p className="text-sage-500 text-sm">
            Places to stay near the venue. Shown on the couple's Accommodations page and their wedding website.
          </p>
        </div>
        <button onClick={adding ? cancel : startAdd} className="text-sm px-4 py-2 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition">
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {adding && (
        <div className="bg-cream-50 border border-cream-200 rounded-xl p-4 mb-4 grid sm:grid-cols-2 gap-3">
          {FIELDS.map(f => (
            <label key={f.key} className="block">
              <span className="text-xs text-sage-500">{f.label}</span>
              <input
                type={f.type}
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full mt-0.5 px-3 py-2 border border-cream-300 rounded-lg text-sm"
              />
            </label>
          ))}
          <div className="sm:col-span-2 flex gap-2">
            <button
              onClick={save}
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded-lg text-sm bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add'}
            </button>
            <button onClick={cancel} className="px-4 py-2 rounded-lg text-sm border border-cream-300 text-sage-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {!rows ? (
        <p className="text-sage-400 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sage-400 text-sm text-center py-8">Nothing added yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="bg-white border border-cream-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-sage-800">
                  {r.name}
                  {r.booking_platform && <span className="text-xs text-sage-400 ml-2">{r.booking_platform}</span>}
                </p>
                <p className="text-xs text-sage-500 mt-0.5">
                  {[r.sleeps && `sleeps ${r.sleeps}`, r.distance, r.price_per_night && `$${r.price_per_night}/night`, r.price_per_person && `$${r.price_per_person}/person`]
                    .filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <button onClick={() => startEdit(r)} className="text-xs text-sage-600 underline">Edit</button>
                <button onClick={() => setConfirmDeleteId(r.id)} className="text-xs text-red-500 underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => remove(confirmDeleteId)}
        title="Remove this place?"
        message="Couples will no longer see it on their Accommodations page or wedding website."
        confirmLabel="Remove"
        danger
      />
    </div>
  )
}
