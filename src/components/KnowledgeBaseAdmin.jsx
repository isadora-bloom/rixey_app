import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function KnowledgeBaseAdmin() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: 'general',
    subcategory: '',
    content: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    try {
      const response = await fetch(`${API_URL}/api/knowledge-base`)
      const data = await response.json()
      setEntries(data.entries || [])
    } catch (err) {
      console.error('Failed to load KB:', err)
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingId
        ? `${API_URL}/api/knowledge-base/${editingId}`
        : `${API_URL}/api/knowledge-base`

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await loadEntries()
        resetForm()
      }
    } catch (err) {
      console.error('Save error:', err)
    }
    setSaving(false)
  }

  const handleEdit = (entry) => {
    setFormData({
      title: entry.title,
      category: entry.category || 'general',
      subcategory: entry.subcategory || '',
      content: entry.content
    })
    setEditingId(entry.id)
    setShowAdd(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this knowledge base entry?')) return

    try {
      await fetch(`${API_URL}/api/knowledge-base/${id}`, {
        method: 'DELETE'
      })
      setEntries(entries.filter(e => e.id !== id))
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const toggleActive = async (entry) => {
    try {
      await fetch(`${API_URL}/api/knowledge-base/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !entry.active })
      })
      setEntries(entries.map(e =>
        e.id === entry.id ? { ...e, active: !e.active } : e
      ))
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  const resetForm = () => {
    setFormData({ title: '', category: 'general', subcategory: '', content: '' })
    setEditingId(null)
    setShowAdd(false)
  }

  // Get unique categories
  const categories = [...new Set(entries.map(e => e.category).filter(Boolean))]

  // Filter entries
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchQuery ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = filterCategory === 'all' || entry.category === filterCategory
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return <p className="text-sage-400 text-center py-8">Loading knowledge base...</p>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Knowledge Base</h2>
          <p className="text-sage-500 text-sm">{entries.length} entries - This is what Sage knows</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700"
        >
          + Add Entry
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAdd && (
        <form onSubmit={handleSubmit} className="bg-cream-50 rounded-xl p-4 mb-6 border border-cream-200">
          <h3 className="font-medium text-sage-700 mb-4">
            {editingId ? 'Edit Entry' : 'Add New Entry'}
          </h3>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-sage-600 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm"
                placeholder="e.g., Catering Options"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sage-600 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm"
              >
                <option value="general">General</option>
                <option value="venue">Venue</option>
                <option value="catering">Catering</option>
                <option value="policies">Policies</option>
                <option value="timeline">Timeline</option>
                <option value="vendors">Vendors</option>
                <option value="accommodations">Accommodations</option>
                <option value="pricing">Pricing</option>
                <option value="faq">FAQ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-sage-600 mb-1">Subcategory (optional)</label>
              <input
                type="text"
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm"
                placeholder="e.g., Breakfast"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-sage-600 mb-1">Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              rows={5}
              className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm"
              placeholder="The information Sage should know about this topic..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update Entry' : 'Add Entry'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sage-600 text-sm hover:text-sage-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge base..."
            className="w-full pl-9 pr-4 py-2 border border-cream-300 rounded-lg text-sm"
          />
          <svg className="w-4 h-4 text-sage-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-cream-300 rounded-lg text-sm"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <p className="text-sage-400 text-center py-8">
          {searchQuery || filterCategory !== 'all'
            ? 'No entries match your search'
            : 'No knowledge base entries yet. Add some to teach Sage!'}
        </p>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {filteredEntries.map(entry => (
            <div
              key={entry.id}
              className={`border rounded-lg p-4 ${
                entry.active === false
                  ? 'border-gray-200 bg-gray-50 opacity-60'
                  : 'border-cream-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sage-800">{entry.title}</h4>
                    <span className="text-xs bg-sage-100 text-sage-600 px-2 py-0.5 rounded">
                      {entry.category}
                    </span>
                    {entry.subcategory && (
                      <span className="text-xs bg-cream-100 text-sage-500 px-2 py-0.5 rounded">
                        {entry.subcategory}
                      </span>
                    )}
                    {entry.active === false && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sage-600 text-sm line-clamp-2">{entry.content}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(entry)}
                    className={`p-1 rounded hover:bg-cream-100 ${
                      entry.active === false ? 'text-green-600' : 'text-gray-400'
                    }`}
                    title={entry.active === false ? 'Activate' : 'Deactivate'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {entry.active === false ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={() => handleEdit(entry)}
                    className="p-1 text-sage-500 hover:text-sage-700 rounded hover:bg-cream-100"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
