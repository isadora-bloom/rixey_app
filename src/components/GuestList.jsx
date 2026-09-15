import { useState, useEffect, useRef, Fragment } from 'react'
import { API_URL } from '../config/api'
import { apiFetch, loadJson } from '../utils/api'
import { describeExtras } from '../../shared/rsvp-fields'
import { plusOneFullName, plusOneDisplayName, isNamedPerson, hasPlusOne, allPeople, headcount, usesPersonModel } from '../../shared/guest-names'
import { parseGuestCsv, inferColumns, applyColumnMapping, FIELD_GROUPS, FIELD_LABELS, tagLabelOf, isMappableKey } from '../../shared/guest-csv'
import { useToast } from './ui/Toast'
import LoadError from './ui/LoadError'


const RSVP_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  { value: 'yes', label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  { value: 'no', label: 'Declined', color: 'bg-red-100 text-red-700' },
  { value: 'maybe', label: 'Maybe', color: 'bg-blue-100 text-blue-700' },
]

const TAG_PALETTE = [
  '#C9748A', '#C4553A', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899',
]

// ─── CSV Helpers ────────────────────────────────────────────────────────────────

// parseCSVLine and the header mapping live in shared/guest-csv.js so they
// can be unit tested; the component keeps the RSVP normalising and tags.

// A spreadsheet that has been through the check step once is remembered by
// its exact set of headers, so the same export next month arrives already
// answered. Only the columns are remembered, never anybody's details.
const MAPPING_STORE = 'rixey.guestImport.mappings'

function mappingStoreKey(headers) {
  return headers.map(h => String(h == null ? '' : h).trim()).sort().join('|')
}

function readMappingStore() {
  try {
    const raw = localStorage.getItem(MAPPING_STORE)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * The keys this exact header set was confirmed with last time, in the current
 * column order. Headers can repeat (a wedding website asks the same question
 * of the guest and of their plus one), so they are matched by name and by
 * which occurrence of that name it is.
 */
function rememberedMapping(headers) {
  const entry = readMappingStore()[mappingStoreKey(headers)]
  if (!entry || !Array.isArray(entry.headers) || !Array.isArray(entry.keys)) return null
  const seen = new Map()
  const keys = headers.map(h => {
    const name = String(h == null ? '' : h).trim()
    const nth = seen.get(name) || 0
    seen.set(name, nth + 1)
    let count = 0
    for (let i = 0; i < entry.headers.length; i++) {
      if (String(entry.headers[i] == null ? '' : entry.headers[i]).trim() !== name) continue
      if (count === nth) return entry.keys[i]
      count++
    }
    return null
  })
  return keys.every(isMappableKey) ? keys : null
}

function rememberMapping(headers, keys) {
  try {
    const store = readMappingStore()
    store[mappingStoreKey(headers)] = { headers, keys, at: new Date().toISOString() }
    // Keep the twenty most recent, so this cannot grow without end.
    const entries = Object.entries(store).sort((a, b) => String(b[1]?.at || '').localeCompare(String(a[1]?.at || '')))
    localStorage.setItem(MAPPING_STORE, JSON.stringify(Object.fromEntries(entries.slice(0, 20))))
  } catch {
    // A private window with storage turned off just means no memory of it.
  }
}

/** Quote a CSV field if it contains commas, quotes, or newlines */
function csvEscape(value) {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

// The print views build HTML by hand. Guest-supplied text goes through here
// first, otherwise an ampersand or a stray angle bracket in someone's note or
// message eats the rest of the table.
function h(value) {
  return (value == null ? '' : String(value))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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
  const [showPlusOneHelp, setShowPlusOneHelp] = useState(false)

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
      const data = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      })
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
            {/*
              The three states are a real distinction and the app relies on it,
              so it is worth saying plainly at the point of the decision rather
              than in a help page. Left blank, ticked-and-unnamed, and named are
              three different answers, and couples have used all three
              deliberately: one wedding marks 15 guests "X", names 11 and leaves
              96 blank.
            */}
            <button
              type="button"
              onClick={() => setShowPlusOneHelp(v => !v)}
              className="text-xs text-sage-500 underline mt-1.5"
            >
              {showPlusOneHelp ? 'Hide' : 'What is a plus one, and when should I use one?'}
            </button>
            {showPlusOneHelp && (
              <div className="mt-2 bg-sage-50 border border-sage-200 rounded-xl p-3 text-xs text-sage-700 space-y-2">
                <p>
                  A plus one is a seat you are giving this guest to bring somebody, when you are not
                  inviting that person by name. Use it when you are happy for them to bring a partner
                  or a friend and you do not know, or do not mind, who it turns out to be.
                </p>
                <p>
                  <span className="font-medium">If you already know who is coming, add them as their own guest instead.</span>{' '}
                  They get their own place card, their own meal and their own dietary note, and they
                  can be seated apart from whoever invited them.
                </p>
                <p className="font-medium text-sage-800">There are three answers here, and they mean different things:</p>
                <ul className="space-y-1 pl-1">
                  <li>
                    <span className="font-medium">Leave this unticked</span> — no plus one. Nobody is added
                    and nothing is held for them.
                  </li>
                  <li>
                    <span className="font-medium">Tick it and leave the name blank</span> — a seat you have
                    promised, for somebody not yet named. They count in your numbers and in the catering,
                    and they show up as “Guest” until you or your guest fills the name in.
                  </li>
                  <li>
                    <span className="font-medium">Tick it and write a name</span> — that person, by name,
                    everywhere.
                  </li>
                </ul>
                <p>
                  A first name on its own is fine. They will show with{' '}
                  {form.last_name?.trim() ? `the surname ${form.last_name.trim()}` : 'this guest’s surname'},
                  which you can change any time by writing their full name here.
                </p>
              </div>
            )}
          </div>

          {/* Plus one fields */}
          {form.has_plus_one && (
            <div className="bg-cream-50 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide">Plus One</p>
              <input
                className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.plus_one_name}
                onChange={e => setForm({ ...form, plus_one_name: e.target.value })}
                placeholder="Name, or leave blank if you don’t know yet"
              />
              <p className="text-xs text-sage-500">
                {form.plus_one_name.trim()
                  ? (isNamedPerson(form.plus_one_name)
                      ? `Will show as ${plusOneFullName(form.plus_one_name, form.last_name)}.`
                      : 'That reads as a placeholder rather than a name, so they will show as “Guest”. They still count.')
                  : 'A seat is held and counted. They will show as “Guest” until somebody names them.'}
              </p>
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
  const { error: toastError } = useToast()
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
    const snapshot = plated
    setPlated(val)
    try {
      await apiFetch(`${API_URL}/api/guest-settings/${weddingId}`, {
        method: 'PUT',
        body: JSON.stringify({ platedMeal: val }),
      })
      emit({ platedMeal: val })
    } catch (err) {
      setPlated(snapshot)
      toastError(`Could not update plated meal setting: ${err.message}`)
    }
  }

  const addTag = async () => {
    if (!newTag.trim()) return
    try {
      const data = await apiFetch(`${API_URL}/api/guest-tags`, {
        method: 'POST',
        body: JSON.stringify({ weddingId, label: newTag.trim(), color: newTagColor }),
      })
      const updated = [...tags, data.tag]
      setTags(updated)
      setNewTag('')
      emit({ tagOptions: updated })
    } catch (err) {
      toastError(`Could not add tag: ${err.message}`)
    }
  }

  const deleteTag = async (id) => {
    const snapshot = tags
    const updated = tags.filter(t => t.id !== id)
    setTags(updated)
    try {
      await apiFetch(`${API_URL}/api/guest-tags/${id}`, { method: 'DELETE' })
      emit({ tagOptions: updated })
    } catch (err) {
      setTags(snapshot)
      toastError(`Could not delete tag: ${err.message}`)
    }
  }

  const addMeal = async () => {
    if (!newMeal.trim()) return
    try {
      const data = await apiFetch(`${API_URL}/api/meal-options`, {
        method: 'POST',
        body: JSON.stringify({ weddingId, label: newMeal.trim() }),
      })
      const updated = [...meals, data.option]
      setMeals(updated)
      setNewMeal('')
      emit({ mealOptions: updated })
    } catch (err) {
      toastError(`Could not add meal option: ${err.message}`)
    }
  }

  const deleteMeal = async (id) => {
    const snapshot = meals
    const updated = meals.filter(m => m.id !== id)
    setMeals(updated)
    try {
      await apiFetch(`${API_URL}/api/meal-options/${id}`, { method: 'DELETE' })
      emit({ mealOptions: updated })
    } catch (err) {
      setMeals(snapshot)
      toastError(`Could not delete meal option: ${err.message}`)
    }
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
  const { error: toastError } = useToast()
  const [guests, setGuests] = useState([])
  const [tagOptions, setTagOptions] = useState([])
  const [mealOptions, setMealOptions] = useState([])
  const [tableOptions, setTableOptions] = useState([]) // [{label, capacity}] from table layout
  const [platedMeal, setPlatedMeal] = useState(false)
  const [rsvpConfig, setRsvpConfig] = useState(null) // labels for rsvp_extras answers
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
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
  // Empty the whole list: opens a dialog that asks for the word DELETE.
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deleteAllWord, setDeleteAllWord] = useState('')
  const [deletingAll, setDeletingAll] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState(null)
  const [csvPendingImport, setCsvPendingImport] = useState(null) // parsed rows waiting on a mode choice
  const [csvCheck, setCsvCheck] = useState(null) // the column mapping waiting to be confirmed
  const csvInputRef = useRef(null)

  useEffect(() => {
    if (weddingId) loadData()
  }, [weddingId])

  const loadData = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [gData, sData, tData] = await Promise.all([
        loadJson(`${API_URL}/api/guests/${weddingId}`),
        loadJson(`${API_URL}/api/guest-settings/${weddingId}`),
        loadJson(`${API_URL}/api/table-layout/${weddingId}`),
      ])
      // Only for the custom-question labels, so RSVP answers read as words
      // rather than custom_0. Failing this must not break the guest list.
      try {
        const wData = await loadJson(`${API_URL}/api/wedding-website/${weddingId}`)
        setRsvpConfig(wData?.rsvp_config || null)
      } catch {
        setRsvpConfig(null)
      }
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
      setLoadError(err)
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

  const handleDeleteAll = async () => {
    if (deleteAllWord.trim() !== 'DELETE') return
    setDeletingAll(true)
    try {
      const data = await apiFetch(`${API_URL}/api/guests/all`, {
        method: 'DELETE',
        body: JSON.stringify({ weddingId, confirm: 'DELETE' }),
      })
      setGuests([])
      setDeleteAllOpen(false)
      setDeleteAllWord('')
      setCsvResult({ success: true, message: `Removed ${data?.deleted ?? 'all'} guests. The list is empty.` })
    } catch (err) {
      toastError(`Could not empty the guest list: ${err.message}`)
    }
    setDeletingAll(false)
  }

  const handleDelete = async (id) => {
    const snapshot = guests
    setGuests(prev => prev.filter(g => g.id !== id))
    setDeleteConfirm(null)
    try {
      await apiFetch(`${API_URL}/api/guests/${id}`, { method: 'DELETE' })
    } catch (err) {
      setGuests(snapshot)
      toastError(`Could not delete guest: ${err.message}`)
    }
  }

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCsvResult(null)
    let text = await file.text()
    // Strip UTF-8 BOM if present
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
    const { rawHeaders, rawRows } = parseGuestCsv(text)
    e.target.value = ''
    if (rawHeaders.length === 0 || rawRows.length === 0) {
      setCsvResult({ success: false, error: 'CSV has no data rows' })
      return
    }

    // Guess locally first. A sheet the portal already knows, or one it is sure
    // about, never leaves the browser.
    const cols = inferColumns(rawHeaders, rawRows)
    const remembered = rememberedMapping(rawHeaders)
    if (remembered) {
      setCsvCheck({
        rawHeaders,
        rawRows,
        remembered: true,
        cols: cols.map((c, i) => ({
          ...c,
          key: remembered[i],
          confidence: 'high',
          reason: 'You checked this spreadsheet before, so these are the answers you gave.',
        })),
        keys: remembered,
      })
      return
    }

    setCsvCheck({ rawHeaders, rawRows, cols, keys: cols.map(c => c.key), asking: cols.some(c => c.confidence !== 'high') })
    if (cols.every(c => c.confidence === 'high')) return

    // Only the columns it could not place are worth asking about, and only
    // those answers are taken. A failure here changes nothing.
    try {
      const data = await apiFetch(`${API_URL}/api/guests/map-columns`, {
        method: 'POST',
        body: JSON.stringify({ weddingId, headers: rawHeaders, samples: rawRows.slice(0, 5) }),
      })
      const mapping = data?.mapping || {}
      setCsvCheck(prev => {
        if (!prev || prev.rawHeaders !== rawHeaders) return prev
        const keys = prev.keys.slice()
        const merged = prev.cols.map((c, i) => {
          if (c.confidence !== 'low') return c
          const suggested = mapping[c.raw]
          if (!isMappableKey(suggested) || suggested === c.key) return c
          const clash = suggested !== 'ignore' && !tagLabelOf(suggested) && keys.some((k, j) => j !== i && k === suggested)
          if (clash) return c
          keys[i] = suggested
          return { ...c, key: suggested, confidence: 'medium', reason: 'Read from the header and the values by Claude.' }
        })
        return { ...prev, cols: merged, keys, asking: false }
      })
    } catch (err) {
      console.error('Column mapping request failed, keeping the local guesses:', err)
      setCsvCheck(prev => (prev && prev.rawHeaders === rawHeaders ? { ...prev, asking: false } : prev))
    }
  }

  /** A column the person changed by hand is settled, so it stops asking. */
  const setCsvColumnKey = (index, key) => {
    setCsvCheck(prev => {
      if (!prev) return prev
      return {
        ...prev,
        keys: prev.keys.map((k, j) => (j === index ? key : k)),
        cols: prev.cols.map((c, j) => (j === index ? { ...c, key, confidence: 'high', reason: 'You chose this one.' } : c)),
      }
    })
  }

  /** The check step is done: build the rows and move on to add-or-update. */
  const confirmCsvMapping = () => {
    if (!csvCheck) return
    const { rawHeaders, rawRows, keys } = csvCheck
    const built = applyColumnMapping(rawHeaders, rawRows, keys)
    if (built.length === 0) {
      setCsvCheck(null)
      setCsvResult({ success: false, error: `No rows with a name. Columns found: ${rawHeaders.join(', ')}. One column needs to be the first name, or the full name.` })
      return
    }
    // Normalise columns into the guest schema
    const normalised = built.map(({ guest: g, raw }) => {
      // Name handling
      if (!g.first_name && g.name) {
        const parts = g.name.split(' ')
        g.first_name = parts[0]
        g.last_name = parts.slice(1).join(' ')
      }
      if (!g.first_name && raw.firstname) g.first_name = raw.firstname
      if (!g.last_name && raw.lastname) g.last_name = raw.lastname

      // Phone: handle "phone_number" alias
      if (!g.phone && raw.phone_number) g.phone = raw.phone_number

      // RSVP: normalise "Accepted"/"Declined" to yes/no/pending
      if (g.rsvp) {
        const r = g.rsvp.trim().toLowerCase()
        if (r === 'accepted' || r === 'attending' || r === 'yes') g.rsvp = 'yes'
        else if (r === 'declined' || r === 'not attending' || r === 'no') g.rsvp = 'no'
        else if (r === 'maybe' || r === 'tentative') g.rsvp = 'maybe'
        else g.rsvp = 'pending'
      }

      // Tags mapped column by column, plus the two the old import always knew
      // about, for a sheet whose columns were not mapped as tags.
      const tags = Array.isArray(g.tags) ? g.tags.slice() : []
      const add = label => { if (!tags.includes(label)) tags.push(label) }
      // Rehearsal dinner
      const rehearsalRsvp = raw.rehersal_rsvp || raw.rehearsal_rsvp || ''
      const invitedRehearsal = raw.invited_to_rehersal || raw.invited_to_rehearsal || ''
      if (rehearsalRsvp.trim().toLowerCase() === 'accepted' || invitedRehearsal.trim().toLowerCase() === 'yes') {
        add('Rehearsal Dinner')
      }
      // Shuttle
      const shuttle = raw.shuttle || ''
      if (shuttle.trim().toLowerCase() === 'yes') add('Shuttle')
      g.tags = tags

      return g
    })
    rememberMapping(rawHeaders, keys)
    setCsvCheck(null)
    // Ask before importing rather than after: whether a re-import doubles the
    // list or updates it in place is a one-way choice about existing data.
    setCsvPendingImport(normalised)
  }

  const submitCsvImport = async (mode) => {
    const guestsToImport = csvPendingImport
    if (!guestsToImport) return
    setCsvPendingImport(null)
    setCsvImporting(true)
    setCsvResult(null)
    try {
      const data = await apiFetch(`${API_URL}/api/guests/bulk`, {
        method: 'POST',
        body: JSON.stringify({ weddingId, guests: guestsToImport, mode }),
      })
      if (data && (data.added !== undefined || data.updated !== undefined || data.skipped !== undefined)) {
        setCsvResult({ success: true, added: data.added || 0, updated: data.updated || 0, skipped: data.skipped || 0 })
      } else {
        // Old server: no mode support yet, same shape as before.
        setGuests(prev => [...prev, ...(data?.guests || [])])
        setCsvResult({ success: true, count: data?.imported, warning: data?.duplicateWarning })
        setCsvImporting(false)
        return
      }
      // New server: added/updated rows both need to show, so re-fetch rather
      // than guess which rows changed.
      try {
        const gData = await loadJson(`${API_URL}/api/guests/${weddingId}`)
        setGuests(gData.guests || [])
      } catch (err) {
        console.error('Failed to refresh guests after import:', err)
      }
    } catch (err) {
      setCsvResult({ success: false, error: err.message })
      toastError(`Could not import guests: ${err.message}`)
    }
    setCsvImporting(false)
  }

  const handleSettingsUpdate = ({ platedMeal: pm, tagOptions: to, mealOptions: mo }) => {
    setPlatedMeal(pm)
    setTagOptions(to)
    setMealOptions(mo)
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  // Every column is a choice. The fixed set is below; RSVP question answers
  // and tags are added per wedding from the data. Address was missing
  // entirely until 15 Sep 2026, which is what couples mail invitations from.
  const EXPORT_COLUMNS = [
    { key: 'first_name', label: 'First name', value: g => g.first_name },
    { key: 'last_name', label: 'Last name', value: g => g.last_name },
    { key: 'email', label: 'Email', value: g => g.email },
    { key: 'phone', label: 'Phone', value: g => g.phone },
    { key: 'address', label: 'Address', value: g => g.address },
    { key: 'rsvp', label: 'RSVP', value: g => g.rsvp },
    { key: 'meal_choice', label: 'Meal choice', value: g => g.meal_choice },
    { key: 'dietary_restrictions', label: 'Dietary', value: g => g.dietary_restrictions },
    { key: 'table_assignment', label: 'Table', value: g => g.table_assignment },
    { key: 'plus_one_name', label: 'Plus one', value: g => g.plus_one_name },
    { key: 'plus_one_rsvp', label: 'Plus one RSVP', value: g => (g.plus_one_name ? plusOneRsvpOf(g) : '') },
    { key: 'plus_one_meal_choice', label: 'Plus one meal', value: g => (g.plus_one_name ? plusOneMealOf(g) : '') },
    { key: 'plus_one_dietary', label: 'Plus one dietary', value: g => (g.plus_one_name ? plusOneDietaryOf(g) : '') },
    { key: 'notes', label: 'Notes', value: g => g.notes },
  ]
  const EXPORT_STORE = 'rixey.guestExport.columns'
  const [exportOpen, setExportOpen] = useState(false)
  const [exportCols, setExportCols] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(EXPORT_STORE) || 'null')
      if (Array.isArray(saved) && saved.length) return new Set(saved)
    } catch { /* fall through to the default */ }
    return null // null = everything, decided when the picker opens
  })

  // Columns that exist for THIS wedding: the fixed set, one per tag, one per
  // RSVP question anyone answered. Built from the data rather than the
  // current toggles, so answers to a question since switched off still come
  // out.
  const exportColumnsFor = () => {
    const answersByGuest = new Map(guests.map(g => [g.id, describeExtras(g.rsvp_extras, rsvpConfig, { plusOneName: plusOneDisplayName(g) })]))
    const answerCols = []
    for (const list of answersByGuest.values()) {
      for (const a of list) if (!answerCols.some(c => c.key === a.key)) answerCols.push({ key: a.key, label: a.label })
    }
    const cols = [
      ...EXPORT_COLUMNS,
      ...tagOptions.map(t => ({ key: `tag:${t.label}`, label: `Tag: ${t.label}`, value: g => ((g.tags || []).includes(t.label) ? 'yes' : '') })),
      ...answerCols.map(c => ({ key: `answer:${c.key}`, label: c.label, value: g => (answersByGuest.get(g.id) || []).find(a => a.key === c.key)?.value || '' })),
    ]
    return cols
  }

  const openExport = () => {
    if (!exportCols) setExportCols(new Set(exportColumnsFor().map(c => c.key)))
    setExportOpen(true)
  }

  const toggleExportCol = (key) => {
    setExportCols(prev => {
      const next = new Set(prev || [])
      if (next.has(key)) next.delete(key); else next.add(key)
      try { localStorage.setItem(EXPORT_STORE, JSON.stringify([...next])) } catch { /* private mode */ }
      return next
    })
  }
  const setAllExportCols = (on) => {
    const next = on ? new Set(exportColumnsFor().map(c => c.key)) : new Set()
    try { localStorage.setItem(EXPORT_STORE, JSON.stringify([...next])) } catch { /* private mode */ }
    setExportCols(next)
  }

  const handleCsvExport = () => {
    const cols = exportColumnsFor().filter(c => !exportCols || exportCols.has(c.key))
    if (!cols.length) { toastError('Pick at least one column to export.'); return }
    const rows = [cols.map(c => csvEscape(c.label)).join(',')]
    // One line per party. Under the person model a plus one is also its own
    // row (is_plus_one), and walking every row put each plus one out twice:
    // once in the host's plus_one columns and once as a line of its own.
    // Dana's export had 66 of them. The host row already carries the plus
    // one's RSVP, meal and dietary through plusOneRsvpOf and friends.
    const exportRows = usesPersonModel(guests) ? guests.filter(g => !g.is_plus_one) : guests
    exportRows.forEach(g => {
      rows.push(cols.map(c => csvEscape(c.value(g))).join(','))
    })
    // CRLF line endings and a UTF-8 byte-order mark: without the mark, Excel
    // on Windows reads accented names as rubbish, and without CRLF some
    // versions run the whole file into one row.
    const csv = '﻿' + rows.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `guest-list-${new Date().toISOString().slice(0, 10)}.csv`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoking straight away cancels the download on Safari and iPhone. Give
    // the browser a moment to take the blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    setExportOpen(false)
  }

  // Assign a guest to a table inline (sends full guest object to preserve all fields)
  const assignTable = async (guest, tableLabel) => {
    const updated = { ...guest, table_assignment: tableLabel || null }
    setGuests(prev => prev.map(g => g.id === guest.id ? updated : g))
    try {
      await apiFetch(`${API_URL}/api/guests/${guest.id}`, {
        method: 'PUT',
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
      setGuests(prev => prev.map(g => g.id === guest.id ? guest : g)) // revert
      toastError(`Could not assign table: ${err.message}`)
    }
  }

  const printFullList = () => {
    const rsvpWord = g => g.rsvp === 'yes' ? 'Accepted' : g.rsvp === 'no' ? 'Declined' : g.rsvp === 'maybe' ? 'Maybe' : 'Pending'
    const guestRows = sorted.map(g => {
      const answers = describeExtras(g.rsvp_extras, rsvpConfig, { plusOneName: plusOneDisplayName(g) })
      return `
      <tr>
        <td style="padding:4px 8px;white-space:nowrap">${h(g.first_name)} ${h(g.last_name)}</td>
        <td style="padding:4px 8px">${rsvpWord(g)}</td>
        <td style="padding:4px 8px;font-size:11px">${h(g.phone)}</td>
        <td style="padding:4px 8px;font-size:11px">${h(g.email)}</td>
        <td style="padding:4px 8px;font-size:11px;max-width:200px">${h(g.address)}</td>
        <td style="padding:4px 8px">${h(g.dietary_restrictions)}</td>
        <td style="padding:4px 8px">${h((g.tags || []).join(', '))}</td>
        <td style="padding:4px 8px">${h(g.table_assignment)}</td>
        <td style="padding:4px 8px">${h(g.plus_one_name)}</td>
        <td style="padding:4px 8px;font-size:11px">${h(g.notes)}</td>
        <td style="padding:4px 8px;font-size:11px">${answers.map(a => `${h(a.short)}: ${h(a.value)}`).join('<br>')}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><title>Guest List</title>
      <style>body{font-family:sans-serif;padding:20px;font-size:12px}
      h1{font-size:18px;margin-bottom:4px}
      .stats{color:#666;font-size:13px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      th{text-align:left;padding:4px 8px;font-size:10px;color:#666;border-bottom:2px solid #333;text-transform:uppercase}
      td{border-bottom:1px solid #eee}
      @media print{button{display:none}@page{size:landscape;margin:1cm}}</style></head>
      <body>
      <h1>Guest List</h1>
      <p class="stats">${totalPeople} total people | ${confirmed} confirmed | ${declined} declined | ${pending + maybe} pending</p>
      <table>
        <thead><tr>
          <th>Name</th><th>RSVP</th><th>Phone</th><th>Email</th><th>Address</th><th>Dietary</th><th>Tags</th><th>Table</th><th>Plus One</th><th>Notes</th><th>RSVP answers</th>
        </tr></thead>
        <tbody>${guestRows}</tbody>
      </table>
      </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.print()
  }

  const printByTable = () => {
    // Seated one person at a time.
    //
    // This walked the rows and, for each one, also emitted a plus one from
    // plus_one_name. Since 025 the plus one has a row of their own, so every
    // one of them was seated twice: printed twice on the chart and counted
    // twice against the table's capacity. Isabella and Angelina's Table 6
    // showed ten people for nine, with Emma listed on it twice.
    const people = allPeople(guests)
    const groups = {}
    tableOptions.forEach(t => { groups[t.label] = [] })
    people.forEach(person => {
      const table = person.row?.table_assignment
      if (!table) return
      if (!groups[table]) groups[table] = []
      groups[table].push(person)
    })
    const unassigned = people.filter(person => !person.row?.table_assignment)

    // A plus one is a row of its own, a sibling of its host's, never nested
    // inside it: that was not valid table markup and left the browser to guess
    // where the row ended.
    const tableRows = (peopleAtTable) => peopleAtTable.map(person => `
      <tr>
        <td style="padding:4px 8px${person.isPlusOne ? ' 4px 24px;color:#666' : ''}">${h(person.name)}${person.isPlusOne ? ' (+1)' : ''}</td>
        <td style="padding:4px 8px${person.isPlusOne ? ';color:#666' : ''}">${h(person.dietary)}</td>
        ${platedMeal ? `<td style="padding:4px 8px${person.isPlusOne ? ';color:#666' : ''}">${h(person.mealChoice)}</td>` : ''}
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
        // One seat per person, which is the same maths tableCounts now does,
        // so the printed chart and the screen cannot disagree.
        const used = guestList.length
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

  // Since migration 025 a plus one has a row of their own. This screen shows a
  // party per line, with the plus one inside their host's line, so the plus-one
  // rows must not also appear on their own or every one of them is on screen
  // twice. Headcounts still run over the full set: headcount() knows which
  // model it is looking at, and it is people it is counting, not lines.
  const parties = usesPersonModel(guests) ? guests.filter(g => !g.is_plus_one) : guests

  // The plus one's own row, by the host it belongs to.
  //
  // Their answers live there now. The host's plus_one_* columns are kept as a
  // mirror so the CSV export and the print pack keep working, but a mirror can
  // be a deploy behind the truth, and this screen should show what the plus one
  // actually said rather than what was last copied.
  const plusOneRowFor = new Map()
  for (const g of guests) if (g.is_plus_one && g.plus_one_of) plusOneRowFor.set(g.plus_one_of, g)
  const plusOneRsvpOf = g => plusOneRowFor.get(g.id)?.rsvp ?? g.plus_one_rsvp
  const plusOneDietaryOf = g => plusOneRowFor.get(g.id)?.dietary_restrictions ?? g.plus_one_dietary
  const plusOneMealOf = g => plusOneRowFor.get(g.id)?.meal_choice ?? g.plus_one_meal_choice

  // Filtering
  const filtered = parties.filter(g => {
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

  // Seat usage per table: a party takes a seat per person, not per row.

  // Counted one person at a time, from the row that person sits on.
  //
  // This used to walk the party heads and add partyMembers(host).length, which
  // seats a plus one wherever their host is. Since 025 they have a row and a
  // table of their own and can be moved apart, so the only honest count is per
  // person. Before 025 a plus one shares their host's row, so the same code
  // gives the same answer.
  const tableCounts = allPeople(guests).reduce((acc, person) => {
    const table = person.row?.table_assignment
    if (table) acc[table] = (acc[table] || 0) + 1
    return acc
  }, {})

  // Summary stats. Every figure here is a headcount of people. They used to be
  // a mix: total and confirmed counted people while declined, pending and
  // maybe counted parties, so the buckets never added up to the total.
  const plusOneCount = usesPersonModel(guests)
    ? guests.filter(g => g.is_plus_one).length
    : guests.filter(hasPlusOne).length
  const { total: totalPeople, attending: confirmed, declined, pending, maybe } = headcount(guests)

  // Meal counts (if plated). Anyone who has declined is left out: their choice
  // is stale and the kitchen should not be cooking it. Pending people are kept,
  // since couples often fill meals in from a sheet before replies come back.
  const mealCounts = platedMeal
    ? (() => {
        const eating = allPeople(guests).filter(p => p.rsvp !== 'no')
        return mealOptions.reduce((acc, opt) => {
          acc[opt.label] = eating.filter(p => p.mealChoice === opt.label).length
          return acc
        }, {})
      })()
    : {}

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-10 text-center">
        <p className="text-sage-400 text-sm">Loading guest list...</p>
      </div>
    )
  }

  if (loadError) {
    return <LoadError what="the guest list" error={loadError} onRetry={loadData} />
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
            <button
              onClick={printFullList}
              disabled={guests.length === 0}
              className="flex items-center gap-1.5 border border-sage-300 text-sage-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-sage-50 disabled:opacity-50 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Guest List
            </button>
            {tableOptions.length > 0 && (
              <button
                onClick={printByTable}
                className="flex items-center gap-1.5 border border-sage-300 text-sage-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-sage-50 transition"
              >
                Print by Table
              </button>
            )}
            <button
              onClick={() => { setDeleteAllWord(''); setDeleteAllOpen(true) }}
              disabled={guests.length === 0}
              className="flex items-center gap-1.5 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition"
              title="Remove every guest on this list"
            >
              Delete all
            </button>
            <button
              onClick={openExport}
              disabled={guests.length === 0}
              className="flex items-center gap-1.5 border border-sage-300 text-sage-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-sage-50 disabled:opacity-50 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            {exportOpen && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => setExportOpen(false)}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="px-5 pt-5 pb-3 border-b border-cream-200">
                    <h3 className="font-serif text-lg text-sage-800">Export guest list</h3>
                    <p className="text-sm text-sage-500 mt-1">Tick the columns you want. Your choice is remembered on this device.</p>
                    <div className="flex gap-3 mt-3 text-sm">
                      <button type="button" className="text-sage-600 underline" onClick={() => setAllExportCols(true)}>All</button>
                      <button type="button" className="text-sage-600 underline" onClick={() => setAllExportCols(false)}>None</button>
                    </div>
                  </div>
                  <div className="px-5 py-3 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    {exportColumnsFor().map(c => (
                      <label key={c.key} className="flex items-center gap-2 py-1.5 text-sm text-sage-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-sage-600"
                          checked={!exportCols || exportCols.has(c.key)}
                          onChange={() => toggleExportCol(c.key)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                  <div className="px-5 py-4 border-t border-cream-200 flex justify-end gap-3">
                    <button type="button" className="px-4 py-2 rounded-xl text-sm text-sage-600 hover:bg-sage-50" onClick={() => setExportOpen(false)}>Cancel</button>
                    <button type="button" className="px-4 py-2 rounded-xl text-sm font-medium bg-sage-600 text-white hover:bg-sage-700" onClick={handleCsvExport}>
                      Download {exportCols ? exportCols.size : exportColumnsFor().length} column{(exportCols ? exportCols.size : 1) === 1 ? '' : 's'}
                    </button>
                  </div>
                </div>
              </div>
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
            // All four are headcounts of people, so the last three add up to
            // the first. The sub-line spells out the difference between a
            // person and an invitation, which is what used to be muddled.
            {
              label: 'Total People', value: totalPeople, color: 'text-sage-700',
              sub: plusOneCount > 0 ? `${parties.length} invitations, ${plusOneCount} with a plus one` : `${parties.length} invitations`,
            },
            { label: 'Confirmed', value: confirmed, color: 'text-green-600' },
            { label: 'Declined', value: declined, color: 'text-red-500' },
            { label: 'Pending / Maybe', value: pending + maybe, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="bg-cream-50 rounded-xl px-4 py-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-sage-400 mt-0.5">{s.label}</p>
              {s.sub && <p className="text-[10px] text-sage-300 mt-0.5 leading-tight">{s.sub}</p>}
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
                    { label: 'Address', field: null },
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
                {sorted.map(guest => {
                  const answers = describeExtras(guest.rsvp_extras, rsvpConfig, { plusOneName: plusOneDisplayName(guest) })
                  return (
                  <Fragment key={guest.id}>
                  <tr className={`hover:bg-cream-50/60 transition ${answers.length ? '' : 'border-b border-cream-100'}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sage-800">{guest.first_name} {guest.last_name}</p>
                      {guest.phone && (
                        <p className="text-xs text-sage-500 mt-0.5">{guest.phone}</p>
                      )}
                      {guest.email && (
                        <p className="text-xs text-sage-400 truncate max-w-[200px]">{guest.email}</p>
                      )}
                      {guest.notes && (
                        <p className="text-xs text-sage-400 truncate max-w-[200px] mt-0.5 italic">{guest.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RsvpBadge rsvp={guest.rsvp} />
                    </td>
                    <td className="px-4 py-3 text-xs text-sage-600 max-w-[180px]">
                      {guest.address ? (
                        <span className="line-clamp-2">{guest.address}</span>
                      ) : (
                        <span className="text-sage-300">--</span>
                      )}
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
                      {hasPlusOne(guest) ? (
                        <div className="space-y-0.5">
                          {/* "Guest" where the couple recorded a plus one but
                              no name, so a placeholder never reads as one. */}
                          <p className={`text-xs ${isNamedPerson(guest.plus_one_name) ? 'text-sage-700' : 'text-sage-400 italic'}`}>
                            {plusOneDisplayName(guest)}
                          </p>
                          <RsvpBadge rsvp={plusOneRsvpOf(guest)} />
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
                  {/* What this party told you when they RSVP'd. Sits in its own
                      row so a long message or address doesn't squeeze the
                      columns above it. */}
                  {answers.length > 0 && (
                    <tr className="border-b border-cream-100 bg-cream-50/40">
                      <td colSpan={7 + (tableOptions.length > 0 ? 1 : 0) + (platedMeal ? 1 : 0)} className="px-4 pb-3 pt-0">
                        <div className="flex flex-wrap gap-x-5 gap-y-1">
                          {answers.map(a => (
                            <span key={a.key} className="text-xs text-sage-600">
                              <span className="text-sage-400">{a.short}:</span> {a.value}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
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

      {csvCheck && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="p-6 pb-3">
              <h3 className="font-semibold text-sage-800 mb-1">Check the columns</h3>
              <p className="text-sm text-sage-500">
                This is what each column in your spreadsheet looks like. Change anything that is wrong,
                then import. {csvCheck.remembered ? 'You imported this spreadsheet before, so these are the answers you gave last time.' : ''}
              </p>
              {csvCheck.asking && (
                <p className="text-xs text-sage-400 mt-2">Still reading the columns it is unsure of...</p>
              )}
            </div>
            <div className="overflow-y-auto px-6 pb-2">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-sage-400 text-left">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Column</th>
                    <th className="py-2 pr-3 font-medium">Import as</th>
                    <th className="py-2 pr-3 font-medium">Sure?</th>
                    <th className="py-2 font-medium">First few values</th>
                  </tr>
                </thead>
                <tbody>
                  {csvCheck.cols.map((col, i) => {
                    const taken = new Set(csvCheck.keys.filter((k, j) => j !== i && k !== 'ignore' && !tagLabelOf(k)))
                    const currentTag = tagLabelOf(csvCheck.keys[i])
                    const newTag = String(col.raw || '').replace(/\s+/g, ' ').trim().slice(0, 48)
                    const tagChoices = tagOptions.map(t => t.label)
                    if (newTag && !tagChoices.includes(newTag)) tagChoices.push(newTag)
                    if (currentTag && !tagChoices.includes(currentTag)) tagChoices.push(currentTag)
                    return (
                      <tr key={`${col.raw}-${i}`} className="border-t border-cream-200 align-top">
                        <td className="py-2.5 pr-3 max-w-[14rem]">
                          <span className="text-sage-800 break-words">{col.raw || <em className="text-sage-400">no header</em>}</span>
                          {col.reason && <span className="block text-xs text-sage-400 mt-0.5">{col.reason}</span>}
                        </td>
                        <td className="py-2.5 pr-3">
                          <select
                            value={csvCheck.keys[i]}
                            onChange={e => setCsvColumnKey(i, e.target.value)}
                            className="border border-cream-300 rounded-lg px-2 py-1.5 text-sm bg-white max-w-[12rem]"
                          >
                            {FIELD_GROUPS.map(group => (
                              <optgroup key={group.label} label={group.label}>
                                {group.keys.map(k => (
                                  <option key={k} value={k} disabled={taken.has(k)}>
                                    {FIELD_LABELS[k]}{taken.has(k) ? ' (taken)' : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                            <optgroup label="Tags">
                              {tagChoices.map(label => (
                                <option key={label} value={`tag:${label}`}>
                                  {tagOptions.some(t => t.label === label) ? label : `New tag: ${label}`}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Leave out">
                              <option value="ignore">Do not import</option>
                            </optgroup>
                          </select>
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          {col.confidence === 'high'
                            ? <span className="text-sage-400" title={col.reason}>✓</span>
                            : <span className="text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 text-xs" title={col.reason}>check</span>}
                        </td>
                        <td className="py-2.5 text-xs text-sage-500 break-words max-w-[16rem]">
                          {col.samples.length ? col.samples.join(' · ') : <em className="text-sage-300">empty</em>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-6 pt-4 border-t border-cream-200 flex gap-3">
              <button
                onClick={confirmCsvMapping}
                className="flex-1 bg-sage-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-sage-700 transition"
              >
                Looks right
              </button>
              <button
                onClick={() => setCsvCheck(null)}
                className="px-5 border border-cream-300 rounded-xl py-2.5 text-sm text-sage-600 hover:bg-cream-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {csvPendingImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-sage-800 mb-2">
              Import {csvPendingImport.length} guest{csvPendingImport.length !== 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-sage-500 mb-5">
              Re-importing the same list can double it up. Choose how these should land.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => submitCsvImport('add')}
                className="border border-sage-300 text-sage-700 rounded-xl py-2.5 text-sm font-medium hover:bg-sage-50 transition"
              >
                Add all as new
              </button>
              <button
                onClick={() => submitCsvImport('update')}
                className="bg-sage-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-sage-700 transition"
              >
                Update guests that match by name, add the rest
              </button>
              <button
                onClick={() => setCsvPendingImport(null)}
                className="text-sage-500 text-sm py-2 hover:text-sage-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {csvResult && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
          csvResult.success ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
        }`}>
          {csvResult.success
            ? (csvResult.added !== undefined
                ? `✓ Added ${csvResult.added}, updated ${csvResult.updated || 0}, skipped ${csvResult.skipped || 0}`
                : `✓ Imported ${csvResult.count} guest${csvResult.count !== 1 ? 's' : ''}`)
            : `Import failed: ${csvResult.error}`}
          {csvResult.warning && (
            <span className="block mt-1 text-xs opacity-90">{csvResult.warning}</span>
          )}
          <button onClick={() => setCsvResult(null)} className="ml-4 opacity-75 hover:opacity-100">×</button>
        </div>
      )}

      {deleteAllOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !deletingAll && setDeleteAllOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sage-800 mb-2">Remove every guest?</h3>
            <p className="text-sm text-sage-500 mb-4">
              This removes all {guests.length} guests on this list, including plus ones, RSVPs and table assignments. Export a CSV first if you want a copy. Type <span className="font-mono font-semibold text-sage-700">DELETE</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteAllWord}
              onChange={e => setDeleteAllWord(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleDeleteAll() }}
              placeholder="DELETE"
              autoFocus
              className="w-full border border-cream-300 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAll}
                disabled={deleteAllWord.trim() !== 'DELETE' || deletingAll}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition"
              >
                {deletingAll ? 'Removing…' : 'Remove all'}
              </button>
              <button
                onClick={() => setDeleteAllOpen(false)}
                disabled={deletingAll}
                className="flex-1 border border-cream-300 rounded-xl py-2.5 text-sm text-sage-600 hover:bg-cream-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
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
