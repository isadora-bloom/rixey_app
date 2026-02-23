import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const CATEGORIES = [
  'All',
  'Arbors',
  'Candles & Lighting',
  'Card Boxes',
  'Ceremony',
  'Dessert & Cake',
  'Extras',
  'Signs',
  'Silk Florals',
  'Stands & Displays',
  'Table Numbers',
  'Vases',
]

export default function BorrowCatalog({ onAskSage }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [hoveredItem, setHoveredItem] = useState(null)

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    try {
      const res = await fetch(`${API_URL}/api/borrow-catalog`)
      const data = await res.json()
      setItems(data.items || data || [])
    } catch (err) {
      console.error('Failed to load borrow catalog:', err)
    }
    setLoading(false)
  }

  const filtered = activeCategory === 'All'
    ? items
    : items.filter(item => item.category === activeCategory)

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Filter skeleton */}
        <div className="flex gap-2 flex-wrap">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-cream-200 rounded-full animate-pulse" />
          ))}
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-cream-200 rounded-xl mb-2" />
              <div className="h-4 bg-cream-200 rounded w-3/4 mb-1" />
              <div className="h-3 bg-cream-100 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-sage-600 text-white'
                : 'bg-cream-100 text-sage-600 hover:bg-cream-200'
            }`}
          >
            {cat}
            {cat !== 'All' && (
              <span className={`ml-1.5 text-xs ${activeCategory === cat ? 'text-sage-200' : 'text-sage-400'}`}>
                {items.filter(i => i.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Item count */}
      <p className="text-sage-400 text-sm">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
        {activeCategory !== 'All' ? ` in ${activeCategory}` : ' available'}
      </p>

      {/* Photo grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sage-400">
          <p>No items in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filtered.map(item => (
            <div
              key={item.id}
              className="group relative bg-white rounded-xl border border-cream-200 overflow-hidden hover:border-sage-300 hover:shadow-md transition"
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {/* Image */}
              <div className="aspect-square bg-cream-100 overflow-hidden">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.item_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-cream-300">
                    🛖
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-medium text-sage-800 text-sm leading-tight">{item.item_name}</p>
                {item.description && (
                  <p className="text-sage-500 text-xs mt-1 line-clamp-2">{item.description}</p>
                )}
              </div>

              {/* Ask Sage hover overlay */}
              {onAskSage && hoveredItem === item.id && (
                <div className="absolute inset-0 bg-sage-900/60 flex items-center justify-center">
                  <button
                    onClick={() => onAskSage(item.item_name)}
                    className="px-4 py-2 bg-white text-sage-800 rounded-xl text-sm font-semibold hover:bg-cream-50 transition shadow-lg"
                  >
                    Ask Sage →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
