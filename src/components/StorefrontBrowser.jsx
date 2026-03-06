import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const CATEGORIES = ['All', 'Partyware & Serving', 'Guest Experience', 'Décor & Lighting']

const PICK_TYPES = [
  { label: 'All', value: '' },
  { label: '💚 Best Save', value: 'Best Save' },
  { label: '✨ Best Splurge', value: 'Best Splurge' },
  { label: '💡 Best Practical', value: 'Best Practical' },
  { label: '🌸 Spring/Summer', value: 'Best Seasonal (Spring/Summer)' },
  { label: '🍂 Fall/Winter', value: 'Best Seasonal (Fall/Winter)' },
  { label: '🎨 Best Custom', value: 'Best Custom' },
]

function pickTypeBadge(type) {
  if (!type) return { bg: 'bg-cream-100 text-sage-600', dot: 'bg-sage-400' }
  if (type.includes('Save')) return { bg: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' }
  if (type.includes('Splurge')) return { bg: 'bg-purple-50 text-purple-700 border border-purple-200', dot: 'bg-purple-500' }
  if (type.includes('Practical')) return { bg: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500' }
  if (type.includes('Spring') || type.includes('Summer')) return { bg: 'bg-rose-50 text-rose-700 border border-rose-200', dot: 'bg-rose-400' }
  if (type.includes('Fall') || type.includes('Winter')) return { bg: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' }
  if (type.includes('Custom')) return { bg: 'bg-teal-50 text-teal-700 border border-teal-200', dot: 'bg-teal-500' }
  return { bg: 'bg-cream-100 text-sage-600', dot: 'bg-sage-400' }
}

export default function StorefrontBrowser() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeType, setActiveType] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/api/storefront`)
      .then(r => r.json())
      .then(({ items }) => setItems(items || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = items.filter(item => {
    if (activeCategory !== 'All' && item.category !== activeCategory) return false
    if (activeType && item.pick_type !== activeType) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        item.pick_name?.toLowerCase().includes(q) ||
        item.product_type?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Group by product_type within filtered results
  const grouped = {}
  filtered.forEach(item => {
    if (!grouped[item.product_type]) grouped[item.product_type] = []
    grouped[item.product_type].push(item)
  })

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search picks…"
          className="w-full pl-9 pr-4 py-2 border border-cream-200 rounded-xl text-sm text-sage-700 placeholder-sage-400 focus:outline-none focus:border-sage-400"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              activeCategory === cat
                ? 'bg-sage-600 text-white'
                : 'bg-white text-sage-500 border border-cream-200 hover:border-sage-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Type filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-5 scrollbar-hide">
        {PICK_TYPES.map(pt => (
          <button
            key={pt.value}
            onClick={() => setActiveType(pt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
              activeType === pt.value
                ? 'bg-sage-100 text-sage-700 border border-sage-300'
                : 'bg-white text-sage-400 border border-cream-200 hover:border-sage-200'
            }`}
          >
            {pt.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-cream-200 overflow-hidden animate-pulse">
              <div className="aspect-square bg-cream-200" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-cream-200 rounded w-2/3" />
                <div className="h-3 bg-cream-200 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-sage-400 py-12">No picks match your filters.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([productType, typeItems]) => (
            <div key={productType}>
              <h3 className="font-medium text-sage-600 text-sm mb-3 flex items-center gap-2">
                <span className="flex-1 border-t border-cream-200" />
                {productType}
                <span className="flex-1 border-t border-cream-200" />
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {typeItems.map(item => {
                  const badge = pickTypeBadge(item.pick_type)
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-cream-200 overflow-hidden flex flex-col hover:shadow-md transition group"
                    >
                      {/* Image */}
                      <div className="aspect-square bg-cream-50 overflow-hidden relative">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.pick_name}
                            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl text-cream-300">🛍</div>
                        )}
                        {/* Badge overlay */}
                        {item.pick_type && (
                          <span className={`absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full ${badge.bg}`}>
                            {item.pick_type.replace('Best ', '').replace(' (Spring/Summer)', ' 🌸').replace(' (Fall/Winter)', ' 🍂')}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 flex flex-col flex-1">
                        <p className="font-medium text-sage-800 text-sm leading-snug mb-1">{item.pick_name}</p>
                        {item.description && (
                          <p className="text-sage-500 text-xs leading-snug line-clamp-2 flex-1">{item.description}</p>
                        )}
                        {item.color_options && (
                          <p className="text-sage-400 text-xs mt-1 italic truncate">{item.color_options}</p>
                        )}

                        {/* Shop button */}
                        {item.affiliate_link && (
                          <a
                            href={item.affiliate_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 block w-full text-center py-1.5 bg-sage-600 hover:bg-sage-700 text-white text-xs font-medium rounded-lg transition"
                          >
                            Shop →
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-sage-400 text-xs mt-8">
        Links may contain affiliate commissions that support Rixey Manor at no cost to you.
      </p>
    </div>
  )
}
