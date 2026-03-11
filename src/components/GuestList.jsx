import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const RSVP_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  { value: 'yes', label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  { value: 'no', label: 'Declined', color: 'bg-red-100 text-red-700' },
  { value: 'maybe', label: 'Maybe', color: 'bg-blue-100 text-blue-700' },
]

const TAG_PALETTE = [
  '#C9748A', '#C4553A', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899',
]

function RsvpBadge({ rsvp }) {
  const opt = RSVP_OPTIONS.find(o => o.value === rsvp) || RSVP_OPTIONS[0]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${opt.color}`}>
      {opt.label}
    </span>
  )
}

// ─── Guest Add/Edit Modal ──────────────────────────────────────────────────────

function GuestModal({ guest, weddingId, tagOptions, mealOptions, platedMeal, tableOptions, onSave, onClose }) {
  const [form, setForm] = useState({
    first_name: guest?.first_name || '',
    last_name: guest?.last_name || '',
    email: guest?.email || '',
    phone: guest?.phone || '',
    address: guest?.address || '',
    rsvp: guest?.rsvp || 'pending',
    dietary_restrictions: guest?.dietary_restrictions || '',
    meal_choice: guest?.meal_choice || '',
    tags: guest?.tags || [],
    notes: guest?.notes || '',
    has_plus_one: !!guest?.plus_one_name,
    plus_one_name: guest?.plus_one_name || '',
    plus_one_rsvp: guest?.plus_one_rsvp || 'pending',
    plus_one_meal_choice: guest?.plus_one_meal_choice || '',
    plus_one_dietary: guest?.plus_one_dietary || '',
    table_assignment: guest?.table_assignment || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleTag = (label) => {
    setForm(prev => {
      const has = prev.tags.includes(label)
      if (!has && prev.tags.length >= 4) return prev
      return { ...prev, tags: has ? prev.tags.filter(t => t !== label) : [...prev.tags, label] }
    })
  }

  const handleSave = async () => {
    if (!form.first_name.trim()) { setError('First name is required'); return }
    setSaving(true)
    setError('')

    const payload = {
      weddingId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      rsvp: form.rsvp,
      dietary_restrictions: form.dietary_restrictions.trim() || null,
      meal_choice: platedMeal ? (form.meal_choice || null) : null,
      tags: form.tags,
      notes: form.notes.trim() || null,
      plus_one_name: form.has_plus_one && form.plus_one_name.trim() ? form.plus_one_name.trim() : null,
      plus_one_rsvp: form.has_plus_one ? form.plus_one_rsvp : 'pending',
      plus_one_meal_choice: form.has_plus_one && platedMeal ? (form.plus_one_meal_choice || null) : null,
      plus_one_dietary: form.has_plus_one ? (form.plus_one_dietary.trim() || null) : null,
      table_assignment: form.table_assignment || null,
    }

    try {
      const url = guest?.id ? `${API_URL}/api/guests/${guest.id}` : `${API_URL}/api/guests`
      const method = guest?.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      onSave(data.guest)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-sage-800">
              {guest ? 'Edit Guest' : 'Add Guest'}
            </h2>
            <button onClick={onClose} className="text-sage-400 hover:text-sage-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">First Name *</label>
              <input
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.first_name}
                onChange={e => setForm({ ...form, first_name: e.target.value })}
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Last Name</label>
              <input
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.last_name}
                onChange={e => setForm({ ...form, last_name: e.target.value })}
                placeholder="Last name"
              />
            </div>
          </div>

          {/* Contact info */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-sage-600 mb-1">Email</label>
            <input
              className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              type="email"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Phone</label>
              <input
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone number"
                type="tel"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Address</label>
              <input
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Street, City, State"
              />
            </div>
          </div>

          {/* RSVP */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-sage-600 mb-1">RSVP Status</label>
            <select
              className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
              value={form.rsvp}
              onChange={e => setForm({ ...form, rsvp: e.target.value })}
            >
              {RSVP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Tags */}
          {tagOptions.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-sage-600 mb-1">Tags (up to 4)</label>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map(tag => {
                  const active = form.tags.includes(tag.label)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.label)}
                      className={`text-xs px-3 py-1 rounded-full border transition ${
                        active ? 'border-transparent text-white' : 'border-cream-300 text-sage-500 hover:border-sage-300'
                      }`}
                      style={active ? { backgroundColor: tag.color } : {}}
                    >
                      {tag.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Dietary */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-sage-600 mb-1">Dietary Restrictions / Allergies</label>
            <input
              className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              value={form.dietary_restrictions}
              onChange={e => setForm({ ...form, dietary_restrictions: e.target.value })}
              placeholder="e.g. gluten-free, nut allergy"
            />
          </div>

          {/* Meal choice (plated only) */}
          {platedMeal && mealOptions.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-sage-600 mb-1">Meal Choice</label>
              <select
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
                value={form.meal_choice}
                onChange={e => setForm({ ...form, meal_choice: e.target.value })}
              >
                <option value="">— Select —</option>
                {mealOptions.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-sage-600 mb-1">Notes</label>
            <textarea
              className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Any notes..."
            />
          </div>

          {/* Table assignment */}
          {tableOptions.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-sage-600 mb-1">Table Assignment</label>
              <select
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
                value={form.table_assignment}
                onChange={e => setForm({ ...form, table_assignment: e.target.value })}
              >
                <option value="">— Unassigned —</option>
                {tableOptions.map(t => (
                  <option key={t.label} value={t.label}>{t.label} (max {t.capacity})</option>
                ))}
              </select>
            </div>
          )}

          {/* Plus one toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_plus_one}
                onChange={e => setForm({ ...form, has_plus_one: e.target.checked })}
                className="rounded border-cream-300 text-sage-600 focus:ring-sage-300"
              />
              <span className="text-sm text-sage-700">Has a plus one</span>
            </label>
          </div>

          {/* Plus one fields */}
          {form.has_plus_one && (
            <div className="bg-cream-50 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide">Plus One</p>
              <input
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.plus_one_name}
                onChange={e => setForm({ ...form, plus_one_name: e.target.value })}
                placeholder="Name (optional — can fill in later)"
              />
              <select
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
                value={form.plus_one_rsvp}
                onChange={e => setForm({ ...form, plus_one_rsvp: e.target.value })}
              >
                {RSVP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {platedMeal && mealOptions.length > 0 && (
                <select
                  className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
                  value={form.plus_one_meal_choice}
                  onChange={e => setForm({ ...form, plus_one_meal_choice: e.target.value })}
                >
                  <option value="">— Meal choice —</option>
                  {mealOptions.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
                </select>
              )}
              <input
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.plus_one_dietary}
                onChange={e => setForm({ ...form, plus_one_dietary: e.target.value })}
                placeholder="Dietary restrictions"
              />
            </div>
          )}

          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.first_name.trim()}
              className="flex-1 bg-sage-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-sage-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save Guest'}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-cream-300 rounded-xl text-sm text-sage-600 hover:bg-cream-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Settings Modal ────────────────────────────────────────────────────────────

function SettingsModal({ weddingId, tagOptions, mealOptions, platedMeal, onUpdate, onClose }) {
  const [plated, setPlated] = useState(platedMeal)
  const [tags, setTags] = useState(tagOptions)
  const [meals, setMeals] = useState(mealOptions)
  const [newTag, setNewTag] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0])
  const [newMeal, setNewMeal] = useState('')

  const emit = (updates) => {
    onUpdate({ platedMeal: plated, tagOptions: tags, mealOptions: meals, ...updates })
  }

  const togglePlated = async () => {
    const val = !plated
    setPlated(val)
    await fetch(`${API_URL}/api/guest-settings/${weddingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platedMeal: val }),
    })
    emit({ platedMeal: val })
  }

  const addTag = async () => {
    if (!newTag.trim()) return
    const res = await fetch(`${API_URL}/api/guest-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weddingId, label: newTag.trim(), color: newTagColor }),
    })
    const data = await res.json()
    const updated = [...tags, data.tag]
    setTags(updated)
    setNewTag('')
    emit({ tagOptions: updated })
  }

  const deleteTag = async (id) => {
    await fetch(`${API_URL}/api/guest-tags/${id}`, { method: 'DELETE' })
    const updated = tags.filter(t => t.id !== id)
    setTags(updated)
    emit({ tagOptions: updated })
  }

  const addMeal = async () => {
    if (!newMeal.trim()) return
    const res = await fetch(`${API_URL}/api/meal-options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weddingId, label: newMeal.trim() }),
    })
    const data = await res.json()
    const updated = [...meals, data.option]
    setMeals(updated)
    setNewMeal('')
    emit({ mealOptions: updated })
  }

  const deleteMeal = async (id) => {
    await fetch(`${API_URL}/api/meal-options/${id}`, { method: 'DELETE' })
    const updated = meals.filter(m => m.id !== id)
    setMeals(updated)
    emit({ mealOptions: updated })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-sage-800">Guest List Settings</h2>
            <button onClick={onClose} className="text-sage-400 hover:text-sage-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Plated meal toggle */}
          <div className="mb-6 pb-6 border-b border-cream-200">
            <h3 className="text-sm font-semibold text-sage-700 mb-3">Meal Tracking</h3>
            <button
              onClick={togglePlated}
              className="flex items-center gap-3 w-full text-left"
            >
              <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${plated ? 'bg-sage-500' : 'bg-cream-300'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${plated ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-sage-700">
                {plated ? 'Plated meal — tracking menu choices per guest' : 'Not plated — tracking allergies only'}
              </span>
            </button>
          </div>

          {/* Tags */}
          <div className="mb-6 pb-6 border-b border-cream-200">
            <h3 className="text-sm font-semibold text-sage-700 mb-3">Guest Tags</h3>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.label}
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="hover:opacity-75 leading-none ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <input
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="New tag (e.g. Wedding Party)"
                onKeyDown={e => e.key === 'Enter' && addTag()}
              />
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 flex-1">
                  {TAG_PALETTE.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition ${newTagColor === c ? 'border-sage-700 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  onClick={addTag}
                  disabled={!newTag.trim()}
                  className="px-3 py-1.5 bg-sage-500 text-white rounded-lg text-sm hover:bg-sage-600 disabled:opacity-40 transition"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Meal options (only when plated) */}
          {plated && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-sage-700 mb-3">Meal Options</h3>
              {meals.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {meals.map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-cream-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-sage-700">{m.label}</span>
                      <button onClick={() => deleteMeal(m.id)} className="text-xs text-red-400 hover:text-red-600 transition">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  value={newMeal}
                  onChange={e => setNewMeal(e.target.value)}
                  placeholder="e.g. Chicken, Fish, Vegan"
                  onKeyDown={e => e.key === 'Enter' && addMeal()}
                />
                <button
                  onClick={addMeal}
                  disabled={!newMeal.trim()}
                  className="px-3 py-2 bg-sage-500 text-white rounded-lg text-sm hover:bg-sage-600 disabled:opacity-40 transition"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function GuestList({ weddingId, userId }) {
  const [guests, setGuests] = useState([])
  const [tagOptions, setTagOptions] = useState([])
  const [mealOptions, setMealOptions] = useState([])
  const [tableOptions, setTableOptions] = useState([]) // [{label, capacity}] from table layout
  const [platedMeal, setPlatedMeal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRsvp, setFilterRsvp] = useState('all')
  const [filterTag, setFilterTag] = useState('all')
  const [filterTable, setFilterTable] = useState('all')
  const [filterDietary, setFilterDietary] = useState('all') // 'all' | 'yes' | 'no'
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingGuest, setEditingGuest] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState(null)
  const csvInputRef = useRef(null)

  useEffect(() => {
    if (weddingId) loadData()
  }, [weddingId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [gRes, sRes, tRes] = await Promise.all([
        fetch(`${API_URL}/api/guests/${weddingId}`),
        fetch(`${API_URL}/api/guest-settings/${weddingId}`),
        fetch(`${API_URL}/api/table-layout/${weddingId}`),
      ])
      const gData = await gRes.json()
      const sData = await sRes.json()
      const tData = await tRes.json()
      setGuests(gData.guests || [])
      setTagOptions(sData.tagOptions || [])
      setMealOptions(sData.mealOptions || [])
      setPlatedMeal(sData.platedMeal || false)
      // Extract table elements (not blocks) sorted by label
      const tableEls = (tData.layout?.elements || [])
        .filter(el => el.type === 'round' || el.type === 'rect')
        .map(el => ({ label: el.label, capacity: el.capacity || 0 }))
        .sort((a, b) => {
          const numA = parseInt(a.label) || 0
          const numB = parseInt(b.label) || 0
          return numA !== numB ? numA - numB : a.label.localeCompare(b.label)
        })
      setTableOptions(tableEls)
    } catch (err) {
      console.error('Failed to load guests:', err)
    }
    setLoading(false)
  }

  const handleSaveGuest = (savedGuest) => {
    setGuests(prev => {
      const idx = prev.findIndex(g => g.id === savedGuest.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = savedGuest
        return updated
      }
      return [...prev, savedGuest]
    })
    setShowAddModal(false)
    setEditingGuest(null)
  }

  const handleDelete = async (id) => {
    await fetch(`${API_URL}/api/guests/${id}`, { method: 'DELETE' })
    setGuests(prev => prev.filter(g => g.id !== id))
    setDeleteConfirm(null)
  }

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCsvImporting(true)
    setCsvResult(null)
    const text = await file.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''))
    const guests = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const obj = {}
      headers.forEach((h, i) => { obj[h] = values[i] || '' })
      return obj
    }).filter(g => g.first_name || g.firstname || g.name)
    // Normalise "name" column into first/last
    const normalised = guests.map(g => {
      if (!g.first_name && g.name) {
        const parts = g.name.split(' ')
        g.first_name = parts[0]
        g.last_name = parts.slice(1).join(' ')
      }
      if (!g.first_name && g.firstname) g.first_name = g.firstname
      if (!g.last_name && g.lastname) g.last_name = g.lastname
      return g
    })
    try {
      const res = await fetch(`${API_URL}/api/guests/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId, guests: normalised }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGuests(prev => [...prev, ...data.guests])
      setCsvResult({ success: true, count: data.imported })
    } catch (err) {
      setCsvResult({ success: false, error: err.message })
    }
    setCsvImporting(false)
    e.target.value = ''
  }

  const handleSettingsUpdate = ({ platedMeal: pm, tagOptions: to, mealOptions: mo }) => {
    setPlatedMeal(pm)
    setTagOptions(to)
    setMealOptions(mo)
  }

  // Assign a guest to a table inline (sends full guest object to preserve all fields)
  const assignTable = async (guest, tableLabel) => {
    const updated = { ...guest, table_assignment: tableLabel || null }
    setGuests(prev => prev.map(g => g.id === guest.id ? updated : g))
    try {
      await fetch(`${API_URL}/api/guests/${guest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: guest.first_name, last_name: guest.last_name,
          rsvp: guest.rsvp, dietary_restrictions: guest.dietary_restrictions,
          meal_choice: guest.meal_choice, tags: guest.tags || [], notes: guest.notes,
          email: guest.email, phone: guest.phone, address: guest.address,
          plus_one_name: guest.plus_one_name, plus_one_rsvp: guest.plus_one_rsvp,
          plus_one_meal_choice: guest.plus_one_meal_choice, plus_one_dietary: guest.plus_one_dietary,
          table_assignment: tableLabel || null,
        }),
      })
    } catch (err) {
      console.error('Failed to assign table:', err)
      setGuests(prev => prev.map(g => g.id === guest.id ? guest : g)) // revert
    }
  }

  const printByTable = () => {
    // Group assigned guests by table, sorted by table label
    const groups = {}
    tableOptions.forEach(t => { groups[t.label] = [] })
    guests.forEach(g => {
      if (g.table_assignment && groups[g.table_assignment] !== undefined) {
        groups[g.table_assignment].push(g)
      } else if (g.table_assignment) {
        if (!groups[g.table_assignment]) groups[g.table_assignment] = []
        groups[g.table_assignment].push(g)
      }
    })
    const unassigned = guests.filter(g => !g.table_assignment)

    const tableRows = (guestList) => guestList.map(g => `
      <tr>
        <td style="padding:4px 8px">${g.first_name} ${g.last_name || ''}</td>
        <td style="padding:4px 8px">${g.dietary_restrictions || ''}</td>
        ${platedMeal ? `<td style="padding:4px 8px">${g.meal_choice || ''}</td>` : ''}
        ${g.plus_one_name ? `<tr><td style="padding:4px 8px 4px 24px;color:#666">${g.plus_one_name} (+1)</td><td style="padding:4px 8px;color:#666">${g.plus_one_dietary || ''}</td>${platedMeal ? `<td style="padding:4px 8px;color:#666">${g.plus_one_meal_choice || ''}</td>` : ''}</tr>` : ''}
      </tr>`).join('')

    const html = `<!DOCTYPE html><html><head><title>Seating by Table</title>
      <style>body{font-family:sans-serif;padding:20px;font-size:13px}
      h1{font-size:18px;margin-bottom:16px}
      h2{font-size:14px;margin:20px 0 6px;background:#f5f0e8;padding:6px 10px;border-radius:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      th{text-align:left;padding:4px 8px;font-size:11px;color:#666;border-bottom:1px solid #ddd}
      tr{border-bottom:1px solid #eee}
      .capacity{color:#888;font-weight:normal;font-size:11px;margin-left:8px}
      @media print{button{display:none}}</style></head>
      <body>
      <h1>Seating Chart</h1>
      ${Object.entries(groups).map(([label, guestList]) => {
        const cap = tableOptions.find(t => t.label === label)?.capacity || 0
        const used = guestList.reduce((n, g) => n + 1 + (g.plus_one_name ? 1 : 0), 0)
        return `<h2>${label}<span class="capacity">${used}/${cap} seats</span></h2>
        <table><thead><tr><th>Guest</th><th>Dietary</th>${platedMeal ? '<th>Meal</th>' : ''}</tr></thead>
        <tbody>${tableRows(guestList)}</tbody></table>`
      }).join('')}
      ${unassigned.length > 0 ? `<h2>Unassigned<span class="capacity">${unassigned.length} guests</span></h2>
      <table><thead><tr><th>Guest</th><th>Dietary</th>${platedMeal ? '<th>Meal</th>' : ''}</tr></thead>
      <tbody>${tableRows(unassigned)}</tbody></table>` : ''}
      </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.print()
  }

  // Filtering
  const filtered = guests.filter(g => {
    if (searchTerm) {
      const haystack = `${g.first_name} ${g.last_name || ''} ${g.plus_one_name || ''} ${g.email || ''} ${g.dietary_restrictions || ''}`.toLowerCase()
      if (!haystack.includes(searchTerm.toLowerCase())) return false
    }
    if (filterRsvp !== 'all' && g.rsvp !== filterRsvp) return false
    if (filterTag !== 'all' && !(g.tags || []).includes(filterTag)) return false
    if (filterTable === 'unassigned' && g.table_assignment) return false
    if (filterTable !== 'all' && filterTable !== 'unassigned' && g.table_assignment !== filterTable) return false
    if (filterDietary === 'yes' && !g.dietary_restrictions) return false
    if (filterDietary === 'no' && g.dietary_restrictions) return false
    return true
  })

  // Sorting
  const RSVP_ORDER = { yes: 0, maybe: 1, pending: 2, no: 3 }
  const sorted = [...filtered].sort((a, b) => {
    let av, bv
    switch (sortField) {
      case 'name':
        av = `${a.last_name || ''} ${a.first_name}`.toLowerCase()
        bv = `${b.last_name || ''} ${b.first_name}`.toLowerCase()
        break
      case 'rsvp':
        av = RSVP_ORDER[a.rsvp] ?? 9
        bv = RSVP_ORDER[b.rsvp] ?? 9
        break
      case 'table':
        av = a.table_assignment || 'zzz'
        bv = b.table_assignment || 'zzz'
        break
      case 'dietary':
        av = a.dietary_restrictions ? 0 : 1
        bv = b.dietary_restrictions ? 0 : 1
        break
      case 'plus_one':
        av = a.plus_one_name ? 0 : 1
        bv = b.plus_one_name ? 0 : 1
        break
      case 'meal':
        av = (a.meal_choice || '').toLowerCase()
        bv = (b.meal_choice || '').toLowerCase()
        break
      default:
        return 0
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="ml-1 opacity-30">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Seat usage per table: count guest + plus_one per assignment
  const tableCounts = guests.reduce((acc, g) => {
    if (g.table_assignment) {
      acc[g.table_assignment] = (acc[g.table_assignment] || 0) + 1 + (g.plus_one_name ? 1 : 0)
    }
    return acc
  }, {})

  // Summary stats
  const plusOneCount = guests.filter(g => g.plus_one_name).length
  const totalPeople = guests.length + plusOneCount
  const confirmed = guests.filter(g => g.rsvp === 'yes').length +
    guests.filter(g => g.plus_one_name && g.plus_one_rsvp === 'yes').length
  const declined = guests.filter(g => g.rsvp === 'no').length
  const pending = guests.filter(g => g.rsvp === 'pending').length
  const maybe = guests.filter(g => g.rsvp === 'maybe').length

  // Meal counts (if plated)
  const mealCounts = platedMeal
    ? mealOptions.reduce((acc, opt) => {
        acc[opt.label] =
          guests.filter(g => g.meal_choice === opt.label).length +
          guests.filter(g => g.plus_one_meal_choice === opt.label).length
        return acc
      }, {})
    : {}

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-10 text-center">
        <p className="text-sage-400 text-sm">Loading guest list...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-sage-800">Guest List</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              title="Settings"
              className="p-2 text-sage-400 hover:text-sage-700 hover:bg-cream-50 rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
            {tableOptions.length > 0 && (
              <button
                onClick={printByTable}
                className="flex items-center gap-1.5 border border-sage-300 text-sage-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-sage-50 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print by Table
              </button>
            )}
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={csvImporting}
              className="flex items-center gap-1.5 border border-sage-300 text-sage-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-sage-50 disabled:opacity-50 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {csvImporting ? 'Importing...' : 'Import CSV'}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-sage-700 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Guest
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total People', value: totalPeople, color: 'text-sage-700' },
            { label: 'Confirmed', value: confirmed, color: 'text-green-600' },
            { label: 'Declined', value: declined, color: 'text-red-500' },
            { label: 'Pending / Maybe', value: pending + maybe, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="bg-cream-50 rounded-xl px-4 py-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-sage-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Meal counts */}
        {platedMeal && Object.keys(mealCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(mealCounts).map(([label, count]) => (
              <span key={label} className="text-xs bg-sage-50 text-sage-700 border border-sage-200 px-3 py-1 rounded-full">
                {label}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <input
            className="flex-1 min-w-[160px] border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search guests..."
          />
          <select
            className="border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
            value={filterRsvp}
            onChange={e => setFilterRsvp(e.target.value)}
          >
            <option value="all">All RSVPs</option>
            {RSVP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {tagOptions.length > 0 && (
            <select
              className="border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
            >
              <option value="all">All Tags</option>
              {tagOptions.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
            </select>
          )}
          {tableOptions.length > 0 && (
            <select
              className="border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
              value={filterTable}
              onChange={e => setFilterTable(e.target.value)}
            >
              <option value="all">All Tables</option>
              <option value="unassigned">Unassigned</option>
              {tableOptions.map(t => {
                const used = tableCounts[t.label] || 0
                return <option key={t.label} value={t.label}>{t.label} ({used}/{t.capacity})</option>
              })}
            </select>
          )}
          <select
            className="border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
            value={filterDietary}
            onChange={e => setFilterDietary(e.target.value)}
          >
            <option value="all">All Dietary</option>
            <option value="yes">Has restrictions</option>
            <option value="no">No restrictions</option>
          </select>
        </div>
      </div>

      {/* Guest table */}
      <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-14 text-center">
            <p className="text-sage-400 text-sm">
              {guests.length === 0
                ? 'No guests yet. Hit "Add Guest" to get started.'
                : 'No guests match your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 bg-cream-50">
                  {[
                    { label: 'Name', field: 'name' },
                    { label: 'RSVP', field: 'rsvp' },
                    ...(tableOptions.length > 0 ? [{ label: 'Table', field: 'table' }] : []),
                    { label: 'Tags', field: null },
                    ...(platedMeal ? [{ label: 'Meal', field: 'meal' }] : []),
                    { label: 'Dietary', field: 'dietary' },
                    { label: 'Plus One', field: 'plus_one' },
                  ].map(col => (
                    <th
                      key={col.label}
                      className={`text-left px-4 py-3 text-xs font-semibold text-sage-500 uppercase tracking-wide ${col.field ? 'cursor-pointer select-none hover:text-sage-700' : ''}`}
                      onClick={() => col.field && toggleSort(col.field)}
                    >
                      {col.label}{col.field && <SortIcon field={col.field} />}
                    </th>
                  ))}
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(guest => (
                  <tr key={guest.id} className="border-b border-cream-100 hover:bg-cream-50/60 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sage-800">{guest.first_name} {guest.last_name}</p>
                      {guest.notes && (
                        <p className="text-xs text-sage-400 truncate max-w-[200px] mt-0.5">{guest.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RsvpBadge rsvp={guest.rsvp} />
                    </td>
                    {tableOptions.length > 0 && (
                      <td className="px-4 py-3">
                        <select
                          className="border border-cream-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sage-300 max-w-[130px]"
                          value={guest.table_assignment || ''}
                          onChange={e => assignTable(guest, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {tableOptions.map(t => {
                            const used = tableCounts[t.label] || 0
                            const isAtCap = used >= t.capacity && guest.table_assignment !== t.label
                            return (
                              <option key={t.label} value={t.label} disabled={isAtCap}>
                                {t.label} {isAtCap ? '(full)' : `(${used}/${t.capacity})`}
                              </option>
                            )
                          })}
                        </select>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(guest.tags || []).map(tag => {
                          const opt = tagOptions.find(t => t.label === tag)
                          return (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: opt?.color || '#9CA3AF' }}
                            >
                              {tag}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    {platedMeal && (
                      <td className="px-4 py-3 text-sage-600">
                        {guest.meal_choice || <span className="text-sage-300">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sage-600 text-xs">
                      {guest.dietary_restrictions || <span className="text-sage-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {guest.plus_one_name ? (
                        <div className="space-y-0.5">
                          <p className="text-xs text-sage-700">{guest.plus_one_name}</p>
                          <RsvpBadge rsvp={guest.plus_one_rsvp} />
                        </div>
                      ) : (
                        <span className="text-sage-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setEditingGuest(guest)}
                          className="p-1.5 text-sage-400 hover:text-sage-700 hover:bg-cream-100 rounded-lg transition"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(guest.id)}
                          className="p-1.5 text-sage-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {(showAddModal || editingGuest) && (
        <GuestModal
          guest={editingGuest}
          weddingId={weddingId}
          tagOptions={tagOptions}
          mealOptions={mealOptions}
          platedMeal={platedMeal}
          tableOptions={tableOptions}
          onSave={handleSaveGuest}
          onClose={() => { setShowAddModal(false); setEditingGuest(null) }}
        />
      )}

      {showSettings && (
        <SettingsModal
          weddingId={weddingId}
          tagOptions={tagOptions}
          mealOptions={mealOptions}
          platedMeal={platedMeal}
          onUpdate={handleSettingsUpdate}
          onClose={() => setShowSettings(false)}
        />
      )}

      {csvResult && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
          csvResult.success ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
        }`}>
          {csvResult.success
            ? `✓ Imported ${csvResult.count} guest${csvResult.count !== 1 ? 's' : ''}`
            : `Import failed: ${csvResult.error}`}
          <button onClick={() => setCsvResult(null)} className="ml-4 opacity-75 hover:opacity-100">×</button>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-sage-800 mb-2">Remove guest?</h3>
            <p className="text-sm text-sage-500 mb-5">
              This will permanently remove the guest and their plus one (if any).
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-600 transition"
              >
                Remove
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-cream-300 rounded-xl py-2.5 text-sm text-sage-600 hover:bg-cream-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
