import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle, X, Check } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe / Anaphylactic']

const emptyForm = {
  guest_name: '',
  allergy: '',
  severity: 'Mild',
  caterer_alerted: false,
  staying_overnight: false,
  notes: '',
}

function SeverityBadge({ severity }) {
  const base = 'inline-block px-2 py-0.5 rounded-full text-xs font-medium'
  if (severity === 'Severe / Anaphylactic')
    return <span className={`${base} bg-red-100 text-red-700`}>{severity}</span>
  if (severity === 'Moderate')
    return <span className={`${base} bg-amber-100 text-amber-700`}>{severity}</span>
  return <span className={`${base} bg-sage-100 text-sage-700`}>{severity}</span>
}

function CheckToggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-8 h-5 rounded-full transition-colors relative ${
        value ? 'bg-sage-600' : 'bg-cream-300'
      }`}
      aria-label="toggle"
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-3' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export default function AllergyRegistry({ weddingId, userId }) {
  const [allergies, setAllergies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!weddingId) return
    fetchAllergies()
  }, [weddingId])

  const fetchAllergies = () => {
    setLoading(true)
    fetch(`${API_URL}/api/allergies/${weddingId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllergies(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const setField = (field) => (val) =>
    setFormData((prev) => ({ ...prev, [field]: val }))

  const setInputField = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))

  const handleAddClick = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setShowForm(true)
  }

  const handleEditClick = (row) => {
    setEditingId(row.id)
    setFormData({
      guest_name: row.guest_name || '',
      allergy: row.allergy || '',
      severity: row.severity || 'Mild',
      caterer_alerted: row.caterer_alerted || false,
      staying_overnight: row.staying_overnight || false,
      notes: row.notes || '',
    })
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(emptyForm)
  }

  const handleSave = async () => {
    if (!formData.guest_name.trim() || !formData.allergy.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`${API_URL}/api/allergies/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, wedding_id: weddingId }),
        })
        const updated = await res.json()
        setAllergies((prev) =>
          prev.map((a) => (a.id === editingId ? { ...a, ...updated } : a))
        )
      } else {
        const res = await fetch(`${API_URL}/api/allergies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wedding_id: weddingId,
            ...formData,
            sort_order: allergies.length,
          }),
        })
        const created = await res.json()
        setAllergies((prev) => [...prev, created])
      }
      handleCancel()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this allergy entry? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await fetch(`${API_URL}/api/allergies/${id}`, { method: 'DELETE' })
      setAllergies((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sage-400 text-sm">
        Loading allergy registry…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Amber banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">
          Share this list with your caterer before the wedding.
        </p>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-sage-700">Allergy Registry</h2>
        {!showForm && (
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 transition-colors"
          >
            <Plus size={15} />
            Add Guest
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
        {allergies.length === 0 && !showForm ? (
          <div className="px-6 py-12 text-center text-sm text-sage-400">
            No allergies recorded yet. Add any guests with dietary restrictions or allergies.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-50 border-b border-cream-200 text-left">
                  <th className="px-4 py-3 font-medium text-sage-600 whitespace-nowrap">Guest name</th>
                  <th className="px-4 py-3 font-medium text-sage-600 whitespace-nowrap">Allergy</th>
                  <th className="px-4 py-3 font-medium text-sage-600 whitespace-nowrap">Severity</th>
                  <th className="px-4 py-3 font-medium text-sage-600 whitespace-nowrap">Caterer alerted</th>
                  <th className="px-4 py-3 font-medium text-sage-600 whitespace-nowrap">Overnight guest</th>
                  <th className="px-4 py-3 font-medium text-sage-600 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {allergies.map((row) => {
                  const isSevere = row.severity === 'Severe / Anaphylactic'
                  return (
                    <tr
                      key={row.id}
                      className={isSevere ? 'bg-red-50' : 'hover:bg-cream-50'}
                    >
                      <td className="px-4 py-3 text-sage-700 font-medium">{row.guest_name}</td>
                      <td className="px-4 py-3 text-sage-600">{row.allergy}</td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={row.severity} />
                      </td>
                      <td className="px-4 py-3">
                        {row.caterer_alerted ? (
                          <Check size={15} className="text-sage-600" />
                        ) : (
                          <span className="text-cream-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.staying_overnight ? (
                          <Check size={15} className="text-sage-600" />
                        ) : (
                          <span className="text-cream-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(row)}
                            className="p-1 text-sage-400 hover:text-sage-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(row.id)}
                            disabled={deletingId === row.id}
                            className="p-1 text-sage-400 hover:text-rose-400 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Inline form */}
        {showForm && (
          <div className="border-t border-cream-200 bg-cream-50 px-6 py-5 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-sage-700">
                {editingId ? 'Edit entry' : 'Add guest'}
              </h3>
              <button
                onClick={handleCancel}
                className="p-1 text-sage-400 hover:text-sage-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-sage-600">
                  Guest name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.guest_name}
                  onChange={setInputField('guest_name')}
                  placeholder="Full name"
                  className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-sage-600">
                  Allergy / restriction <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.allergy}
                  onChange={setInputField('allergy')}
                  placeholder="e.g. peanuts, gluten, shellfish"
                  className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-sage-600">Severity</label>
              <div className="flex flex-wrap gap-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField('severity')(opt)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      formData.severity === opt
                        ? 'bg-sage-600 text-white border-sage-600'
                        : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between bg-white rounded-lg border border-cream-200 px-4 py-2.5">
                <span className="text-sm text-sage-700">Caterer alerted</span>
                <CheckToggle
                  value={formData.caterer_alerted}
                  onChange={setField('caterer_alerted')}
                />
              </div>
              <div className="flex items-center justify-between bg-white rounded-lg border border-cream-200 px-4 py-2.5">
                <span className="text-sm text-sage-700">Overnight guest</span>
                <CheckToggle
                  value={formData.staying_overnight}
                  onChange={setField('staying_overnight')}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-sage-600">Notes</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={setInputField('notes')}
                placeholder="Any additional details…"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-sage-600 hover:text-sage-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !formData.guest_name.trim() || !formData.allergy.trim()}
                className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : editingId ? 'Update' : 'Add to registry'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add at bottom when table has entries */}
      {allergies.length > 0 && !showForm && (
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 text-sm text-sage-500 hover:text-sage-700 transition-colors"
        >
          <Plus size={15} />
          Add another guest
        </button>
      )}
    </div>
  )
}
