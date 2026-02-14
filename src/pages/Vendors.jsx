import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Vendors() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [vendors, setVendors] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    local: false,
    budgetFriendly: false,
    multipleEvents: false
  })

  useEffect(() => {
    loadVendors()
  }, [])

  const loadVendors = async () => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('category')
      .order('name')

    if (error) {
      console.error('Error loading vendors:', error)
    } else {
      setVendors(data || [])
      // Extract unique categories
      const cats = [...new Set(data.map(v => v.category))].sort()
      setCategories(cats)
    }
    setLoading(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  // Filter vendors
  const filteredVendors = vendors.filter(vendor => {
    if (selectedCategory !== 'all' && vendor.category !== selectedCategory) return false
    if (filters.local && !vendor.is_local) return false
    if (filters.budgetFriendly && !vendor.is_budget_friendly) return false
    if (filters.multipleEvents && !vendor.has_multiple_events) return false
    return true
  })

  // Group by category for display
  const groupedVendors = filteredVendors.reduce((acc, vendor) => {
    if (!acc[vendor.category]) acc[vendor.category] = []
    acc[vendor.category].push(vendor)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="bg-white border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl text-sage-700">Vendor Directory</h1>
            <p className="text-sage-400 text-sm">Recommended vendors for your Rixey Manor wedding</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sage-500 hover:text-sage-700 text-sm font-medium transition"
            >
              Back to Dashboard
            </button>
            <button
              onClick={handleSignOut}
              className="text-sage-500 hover:text-sage-700 text-sm font-medium transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Category filter */}
            <div>
              <label className="block text-sm font-medium text-sage-600 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-300 bg-cream-50"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Toggle filters */}
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer bg-cream-50 px-3 py-2 rounded-lg">
                <input
                  type="checkbox"
                  checked={filters.local}
                  onChange={(e) => setFilters({ ...filters, local: e.target.checked })}
                  className="w-4 h-4 text-sage-600 rounded"
                />
                <span className="text-sm text-sage-600">Local</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-cream-50 px-3 py-2 rounded-lg">
                <input
                  type="checkbox"
                  checked={filters.budgetFriendly}
                  onChange={(e) => setFilters({ ...filters, budgetFriendly: e.target.checked })}
                  className="w-4 h-4 text-sage-600 rounded"
                />
                <span className="text-sm text-sage-600">Budget Friendly</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-cream-50 px-3 py-2 rounded-lg">
                <input
                  type="checkbox"
                  checked={filters.multipleEvents}
                  onChange={(e) => setFilters({ ...filters, multipleEvents: e.target.checked })}
                  className="w-4 h-4 text-sage-600 rounded"
                />
                <span className="text-sm text-sage-600">3+ Rixey Events</span>
              </label>
            </div>

            <div className="ml-auto text-sage-400 text-sm">
              {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Vendor List */}
        {loading ? (
          <div className="text-center text-sage-400 py-12">Loading vendors...</div>
        ) : Object.keys(groupedVendors).length === 0 ? (
          <div className="text-center text-sage-400 py-12">No vendors match your filters</div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedVendors).sort((a, b) => a[0].localeCompare(b[0])).map(([category, categoryVendors]) => (
              <div key={category}>
                <h2 className="font-serif text-xl text-sage-700 mb-4 flex items-center gap-2">
                  {category}
                  <span className="text-sage-400 text-sm font-normal">({categoryVendors.length})</span>
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryVendors.map(vendor => (
                    <div
                      key={vendor.id}
                      className="bg-white rounded-xl shadow-sm border border-cream-200 p-5 hover:shadow-md transition"
                    >
                      <h3 className="font-medium text-sage-800 mb-2">{vendor.name}</h3>

                      {vendor.notes && (
                        <p className="text-sage-500 text-sm mb-3">{vendor.notes}</p>
                      )}

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {vendor.is_local && (
                          <span className="px-2 py-0.5 bg-sage-100 text-sage-600 text-xs rounded-full">Local</span>
                        )}
                        {vendor.is_budget_friendly && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded-full">Budget Friendly</span>
                        )}
                        {vendor.has_multiple_events && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">3+ Events</span>
                        )}
                        {vendor.serves_indian && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">Indian</span>
                        )}
                        {vendor.serves_chinese && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">Chinese</span>
                        )}
                      </div>

                      {/* Contact info */}
                      <div className="space-y-1 text-sm">
                        {vendor.contact && (
                          <p className="text-sage-500">
                            <span className="text-sage-400">Contact:</span> {vendor.contact}
                          </p>
                        )}
                        {vendor.website && (
                          <a
                            href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sage-600 hover:text-sage-800 hover:underline block truncate"
                          >
                            Visit Website →
                          </a>
                        )}
                        {vendor.pricing_info && (
                          <p className="text-sage-500">
                            <span className="text-sage-400">Pricing:</span> {vendor.pricing_info}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
