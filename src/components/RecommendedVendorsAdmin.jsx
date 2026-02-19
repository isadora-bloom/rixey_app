import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function RecommendedVendorsAdmin() {
  const [vendors, setVendors] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingVendor, setEditingVendor] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const emptyVendor = {
    category: '',
    name: '',
    notes: '',
    contact: '',
    website: '',
    pricing_info: '',
    has_multiple_events: false,
    is_local: false,
    is_budget_friendly: false,
    serves_indian: false,
    serves_chinese: false
  }

  const [formData, setFormData] = useState(emptyVendor)

  useEffect(() => {
    loadVendors()
  }, [filterCategory])

  const loadVendors = async () => {
    try {
      const url = filterCategory
        ? `${API_URL}/api/recommended-vendors?category=${encodeURIComponent(filterCategory)}`
        : `${API_URL}/api/recommended-vendors`
      const response = await fetch(url)
      const data = await response.json()
      setVendors(data.vendors || [])
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Failed to load vendors:', error)
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingVendor
        ? `${API_URL}/api/recommended-vendors/${editingVendor.id}`
        : `${API_URL}/api/recommended-vendors`

      const response = await fetch(url, {
        method: editingVendor ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await loadVendors()
        setShowForm(false)
        setEditingVendor(null)
        setFormData(emptyVendor)
      }
    } catch (error) {
      console.error('Failed to save vendor:', error)
    }
    setSaving(false)
  }

  const handleEdit = (vendor) => {
    setFormData({
      category: vendor.category || '',
      name: vendor.name || '',
      notes: vendor.notes || '',
      contact: vendor.contact || '',
      website: vendor.website || '',
      pricing_info: vendor.pricing_info || '',
      has_multiple_events: vendor.has_multiple_events || false,
      is_local: vendor.is_local || false,
      is_budget_friendly: vendor.is_budget_friendly || false,
      serves_indian: vendor.serves_indian || false,
      serves_chinese: vendor.serves_chinese || false
    })
    setEditingVendor(vendor)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return

    try {
      await fetch(`${API_URL}/api/recommended-vendors/${id}`, {
        method: 'DELETE'
      })
      await loadVendors()
    } catch (error) {
      console.error('Failed to delete vendor:', error)
    }
  }

  // Filter vendors by search term
  const filteredVendors = vendors.filter(vendor => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      vendor.name?.toLowerCase().includes(term) ||
      vendor.category?.toLowerCase().includes(term) ||
      vendor.notes?.toLowerCase().includes(term) ||
      vendor.contact?.toLowerCase().includes(term)
    )
  })

  // Group vendors by category
  const groupedVendors = filteredVendors.reduce((acc, vendor) => {
    const cat = vendor.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(vendor)
    return acc
  }, {})

  if (loading) {
    return <p className="text-sage-500 text-center py-8">Loading vendors...</p>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Recommended Vendors</h2>
          <p className="text-sage-500 text-sm">{vendors.length} vendors across {categories.length} categories</p>
        </div>
        <button
          onClick={() => {
            setFormData(emptyVendor)
            setEditingVendor(null)
            setShowForm(true)
          }}
          className="bg-sage-600 text-white px-4 py-2 rounded-lg hover:bg-sage-700 transition-colors text-sm"
        >
          + Add Vendor
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search vendors..."
          className="flex-1 px-3 py-2 border border-cream-200 rounded-lg text-sm"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-cream-200 rounded-lg text-sm bg-white"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Vendor List */}
      {filteredVendors.length === 0 ? (
        <div className="text-center py-12 bg-cream-50 rounded-xl">
          <p className="text-sage-500">
            {searchTerm ? 'No vendors match your search.' : 'No vendors yet. Add your first recommendation!'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedVendors).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryVendors]) => (
            <div key={category}>
              <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
                {category}
                <span className="text-xs bg-sage-100 text-sage-600 px-2 py-0.5 rounded-full">
                  {categoryVendors.length}
                </span>
              </h3>
              <div className="space-y-2">
                {categoryVendors.map(vendor => (
                  <div
                    key={vendor.id}
                    className="bg-white rounded-xl border border-cream-200 p-4 hover:border-sage-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sage-800">{vendor.name}</h4>
                          {vendor.is_budget_friendly && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                              Budget-Friendly
                            </span>
                          )}
                          {vendor.is_local && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                              Local
                            </span>
                          )}
                          {vendor.has_multiple_events && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              Multi-Event
                            </span>
                          )}
                        </div>

                        {vendor.notes && (
                          <p className="text-sage-500 text-sm mt-1">{vendor.notes}</p>
                        )}

                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-sage-500">
                          {vendor.contact && <span>{vendor.contact}</span>}
                          {vendor.website && (
                            <a
                              href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sage-600 hover:text-sage-800 underline"
                            >
                              Website
                            </a>
                          )}
                        </div>

                        {vendor.pricing_info && (
                          <p className="text-xs text-sage-400 mt-2">
                            Pricing: {vendor.pricing_info}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                          {vendor.serves_indian && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                              Indian Cuisine
                            </span>
                          )}
                          {vendor.serves_chinese && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                              Chinese Cuisine
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(vendor)}
                          className="text-sage-600 hover:text-sage-800 text-sm px-3 py-1 border border-sage-200 rounded-lg"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(vendor.id)}
                          className="text-red-500 hover:text-red-700 text-sm px-3 py-1 border border-red-200 rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-xl text-sage-700">
                  {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingVendor(null)
                    setFormData(emptyVendor)
                  }}
                  className="text-sage-400 hover:text-sage-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    list="categories"
                    className="w-full px-3 py-2 border border-cream-200 rounded-lg"
                    placeholder="e.g., Photography, Catering, Florist"
                  />
                  <datalist id="categories">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-cream-200 rounded-lg"
                    placeholder="Vendor name"
                  />
                </div>

                {/* Contact */}
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">
                    Contact Info
                  </label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full px-3 py-2 border border-cream-200 rounded-lg"
                    placeholder="Email, phone, or contact name"
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">
                    Website
                  </label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3 py-2 border border-cream-200 rounded-lg"
                    placeholder="https://..."
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">
                    Notes / Description
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-cream-200 rounded-lg resize-none"
                    placeholder="What makes this vendor special, style notes, etc."
                  />
                </div>

                {/* Pricing */}
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">
                    Pricing Info
                  </label>
                  <input
                    type="text"
                    value={formData.pricing_info}
                    onChange={(e) => setFormData({ ...formData, pricing_info: e.target.value })}
                    className="w-full px-3 py-2 border border-cream-200 rounded-lg"
                    placeholder="e.g., Starting at $X, packages from $X-$X"
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium text-sage-700">Tags</p>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_budget_friendly}
                      onChange={(e) => setFormData({ ...formData, is_budget_friendly: e.target.checked })}
                      className="w-4 h-4 text-sage-600 rounded"
                    />
                    <span className="text-sm text-sage-700">Budget-Friendly</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_local}
                      onChange={(e) => setFormData({ ...formData, is_local: e.target.checked })}
                      className="w-4 h-4 text-sage-600 rounded"
                    />
                    <span className="text-sm text-sage-700">Local Vendor</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.has_multiple_events}
                      onChange={(e) => setFormData({ ...formData, has_multiple_events: e.target.checked })}
                      className="w-4 h-4 text-sage-600 rounded"
                    />
                    <span className="text-sm text-sage-700">Has done multiple events at Rixey</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.serves_indian}
                      onChange={(e) => setFormData({ ...formData, serves_indian: e.target.checked })}
                      className="w-4 h-4 text-sage-600 rounded"
                    />
                    <span className="text-sm text-sage-700">Serves Indian Cuisine</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.serves_chinese}
                      onChange={(e) => setFormData({ ...formData, serves_chinese: e.target.checked })}
                      className="w-4 h-4 text-sage-600 rounded"
                    />
                    <span className="text-sm text-sage-700">Serves Chinese Cuisine</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-cream-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingVendor(null)
                      setFormData(emptyVendor)
                    }}
                    className="px-4 py-2 text-sage-600 hover:text-sage-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : (editingVendor ? 'Save Changes' : 'Add Vendor')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
