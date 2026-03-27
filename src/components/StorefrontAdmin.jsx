import { useState, useEffect } from 'react'
import { API_URL } from '../config/api'


const CATEGORIES = ['Partyware & Serving', 'Guest Experience', 'Décor & Lighting']
const PICK_TYPES = [
  'Best Save',
  'Best Splurge',
  'Best Practical',
  'Best Seasonal (Spring/Summer)',
  'Best Seasonal (Fall/Winter)',
  'Best Custom',
]

const EMPTY_FORM = {
  product_type: '',
  category: CATEGORIES[0],
  pick_name: '',
  pick_type: PICK_TYPES[0],
  description: '',
  affiliate_link: '',
  image_url: '',
  color_options: '',
  is_active: true,
}

function pickTypeColor(type) {
  if (!type) return 'bg-cream-100 text-sage-600'
  if (type.includes('Save')) return 'bg-green-100 text-green-700'
  if (type.includes('Splurge')) return 'bg-purple-100 text-purple-700'
  if (type.includes('Practical')) return 'bg-blue-100 text-blue-700'
  if (type.includes('Spring') || type.includes('Summer')) return 'bg-rose-100 text-rose-700'
  if (type.includes('Fall') || type.includes('Winter')) return 'bg-amber-100 text-amber-700'
  if (type.includes('Custom')) return 'bg-teal-100 text-teal-700'
  return 'bg-cream-100 text-sage-600'
}

export default function StorefrontAdmin() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterType, setFilterType] = useState('All')
  const [filterActive, setFilterActive] = useState('active')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadItems() }, [])

  const loadItems = async () => {
    try {
      const res = await fetch(`${API_URL}/api/storefront/all`)
      const data = await res.json()
      setItems(data.items || [])
    } catch (err) {
      console.error('Load storefront error:', err)
    }
    setLoading(false)
  }

  const filtered = items.filter(item => {
    if (filterCategory !== 'All' && item.category !== filterCategory) return false
    if (filterType !== 'All' && item.pick_type !== filterType) return false
    if (filterActive === 'active' && !item.is_active) return false
    if (filterActive === 'inactive' && item.is_active) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        item.pick_name?.toLowerCase().includes(q) ||
        item.product_type?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const saveItem = async () => {
    if (!form.pick_name.trim() || !form.product_type.trim()) return
    setSaving(true)
    setSaveMsg('')
    try {
      const url = editingId
        ? `${API_URL}/api/storefront/${editingId}`
        : `${API_URL}/api/storefront`
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setSaveMsg('Saved!')
        setShowForm(false)
        setEditingId(null)
        setForm(EMPTY_FORM)
        loadItems()
      } else {
        setSaveMsg('Error saving item.')
      }
    } catch (err) {
      setSaveMsg('Error saving item.')
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const toggleActive = async (item) => {
    try {
      await fetch(`${API_URL}/api/storefront/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, is_active: !item.is_active }),
      })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
    } catch (err) {
      console.error('Toggle active error:', err)
    }
  }

  const deleteItem = async (id) => {
    try {
      await fetch(`${API_URL}/api/storefront/${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.id !== id))
      setConfirmDelete(null)
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const startEdit = (item) => {
    setForm({
      product_type: item.product_type,
      category: item.category,
      pick_name: item.pick_name,
      pick_type: item.pick_type || PICK_TYPES[0],
      description: item.description || '',
      affiliate_link: item.affiliate_link || '',
      image_url: item.image_url || '',
      color_options: item.color_options || '',
      is_active: item.is_active,
    })
    setEditingId(item.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeCount = items.filter(i => i.is_active).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Rixey Picks</h2>
          <p className="text-sage-400 text-sm mt-0.5">
            {activeCount} of {items.length} items active · Clients see this as a curated shopping guide
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setEditingId(null); setForm(EMPTY_FORM) }}
          className="px-4 py-2 bg-sage-600 text-white rounded-xl text-sm font-medium hover:bg-sage-700 transition"
        >
          {showForm && !editingId ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-cream-50 rounded-2xl border border-cream-200 p-5 mb-6">
          <h3 className="font-serif text-lg text-sage-700 mb-4">
            {editingId ? 'Edit Item' : 'Add New Item'}
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Product Type *</label>
              <input
                type="text"
                value={form.product_type}
                onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))}
                placeholder="e.g. Disposable Champagne Flutes"
                className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm text-sage-700 focus:outline-none focus:border-sage-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Pick Name *</label>
              <input
                type="text"
                value={form.pick_name}
                onChange={e => setForm(f => ({ ...f, pick_name: e.target.value }))}
                placeholder="e.g. Crystal-Cut Gold-Rim Flutes"
                className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm text-sage-700 focus:outline-none focus:border-sage-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm text-sage-700 focus:outline-none focus:border-sage-400"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Pick Type</label>
              <select
                value={form.pick_type}
                onChange={e => setForm(f => ({ ...f, pick_type: e.target.value }))}
                className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm text-sage-700 focus:outline-none focus:border-sage-400"
              >
                {PICK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-sage-600 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Short, punchy description of what makes this pick special…"
                className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm text-sage-700 focus:outline-none focus:border-sage-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Affiliate Link</label>
              <input
                type="url"
                value={form.affiliate_link}
                onChange={e => setForm(f => ({ ...f, affiliate_link: e.target.value }))}
                placeholder="https://amzn.to/…"
                className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm text-sage-700 focus:outline-none focus:border-sage-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Image URL</label>
              <input
                type="url"
                value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="https://…"
                className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm text-sage-700 focus:outline-none focus:border-sage-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Color Options</label>
              <input
                type="text"
                value={form.color_options}
                onChange={e => setForm(f => ({ ...f, color_options: e.target.value }))}
                placeholder="Gold/Silver/Pink…"
                className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm text-sage-700 focus:outline-none focus:border-sage-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="accent-sage-600"
              />
              <label htmlFor="is_active" className="text-sm text-sage-700">Active (visible to clients)</label>
            </div>
          </div>

          {/* Image preview */}
          {form.image_url && (
            <div className="mt-4">
              <p className="text-xs text-sage-400 mb-1">Image preview:</p>
              <img
                src={form.image_url}
                alt="preview"
                className="w-24 h-24 object-contain border border-cream-200 rounded-lg"
                onError={e => { e.target.style.display = 'none' }}
              />
            </div>
          )}

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={saveItem}
              disabled={saving || !form.pick_name.trim() || !form.product_type.trim()}
              className="px-5 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : editingId ? 'Update Item' : 'Add Item'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }}
              className="px-4 py-2 text-sage-500 hover:text-sage-700 text-sm transition"
            >
              Cancel
            </button>
            {saveMsg && <span className="text-sm text-sage-500">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="px-3 py-1.5 border border-cream-200 rounded-lg text-sm text-sage-700 focus:outline-none focus:border-sage-400 w-36"
        />
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 border border-cream-200 rounded-lg text-sm text-sage-600 focus:outline-none focus:border-sage-400"
        >
          <option value="All">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-1.5 border border-cream-200 rounded-lg text-sm text-sage-600 focus:outline-none focus:border-sage-400"
        >
          <option value="All">All types</option>
          {PICK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterActive}
          onChange={e => setFilterActive(e.target.value)}
          className="px-3 py-1.5 border border-cream-200 rounded-lg text-sm text-sage-600 focus:outline-none focus:border-sage-400"
        >
          <option value="active">Active only</option>
          <option value="all">All items</option>
          <option value="inactive">Inactive only</option>
        </select>
        <span className="text-sage-400 text-sm self-center">{filtered.length} items</span>
      </div>

      {/* Item table */}
      {loading ? (
        <p className="text-sage-400 text-sm">Loading…</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div
              key={item.id}
              className={`bg-white rounded-xl border p-3 flex items-start gap-3 ${
                item.is_active ? 'border-cream-200' : 'border-cream-100 opacity-60'
              }`}
            >
              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-cream-50 border border-cream-100 flex-shrink-0">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.pick_name}
                    className="w-full h-full object-contain p-1"
                    onError={e => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">🛍</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className="font-medium text-sage-800 text-sm">{item.pick_name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pickTypeColor(item.pick_type)}`}>
                    {item.pick_type}
                  </span>
                  {!item.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cream-100 text-sage-400">Hidden</span>
                  )}
                </div>
                <p className="text-sage-500 text-xs mt-0.5">{item.product_type} · {item.category}</p>
                {item.description && (
                  <p className="text-sage-400 text-xs mt-1 line-clamp-1">{item.description}</p>
                )}
                {item.affiliate_link && (
                  <a
                    href={item.affiliate_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sage-400 hover:text-sage-600 text-xs underline mt-0.5 inline-block"
                  >
                    {item.affiliate_link.length > 50 ? item.affiliate_link.slice(0, 50) + '…' : item.affiliate_link}
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Toggle active */}
                <button
                  onClick={() => toggleActive(item)}
                  title={item.is_active ? 'Hide from clients' : 'Show to clients'}
                  className={`p-1.5 rounded-lg text-xs transition ${
                    item.is_active
                      ? 'bg-green-50 text-green-600 hover:bg-green-100'
                      : 'bg-cream-100 text-sage-400 hover:bg-cream-200'
                  }`}
                >
                  {item.is_active ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>

                {/* Edit */}
                <button
                  onClick={() => startEdit(item)}
                  className="p-1.5 rounded-lg bg-cream-50 hover:bg-cream-100 text-sage-500 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Delete */}
                {confirmDelete === item.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="px-2 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-2 py-1 text-sage-400 text-xs hover:text-sage-600 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(item.id)}
                    className="p-1.5 rounded-lg bg-cream-50 hover:bg-red-50 text-sage-400 hover:text-red-400 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="text-center text-sage-400 py-8">No items match your filters.</p>
          )}
        </div>
      )}
    </div>
  )
}
