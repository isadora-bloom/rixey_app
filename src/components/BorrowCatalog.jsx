import { useState, useEffect } from 'react'
import { API_URL } from '../config/api'
import { authHeaders, apiFetch } from '../utils/api'
import { useToast } from './ui/Toast'


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

export default function BorrowCatalog({ onAskSage, weddingId, isAdmin, refreshKey }) {
  const { error: toastError } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [hoveredItem, setHoveredItem] = useState(null)
  // The item being viewed full size. Same pattern as InspoGallery's lightbox.
  const [zoomed, setZoomed] = useState(null)
  // Set of selected item IDs (for couple mode) or from server (for admin read-only)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [toggling, setToggling] = useState(new Set()) // item IDs being toggled

  useEffect(() => {
    loadItems()
  }, [refreshKey])

  useEffect(() => {
    if (weddingId) {
      loadSelections()
    }
  }, [weddingId])

  const loadItems = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/borrow-catalog`, { headers: await authHeaders() })
      const data = await res.json()
      setItems(data.items || data || [])
    } catch (err) {
      console.error('Failed to load borrow catalog:', err)
    }
    setLoading(false)
  }

  const loadSelections = async () => {
    try {
      const res = await fetch(`${API_URL}/api/borrow-selections/${weddingId}`, { headers: await authHeaders() })
      const data = await res.json()
      setSelectedIds(new Set((data.selections || []).map(s => s.item_id)))
    } catch (err) {
      console.error('Failed to load borrow selections:', err)
    }
  }

  const toggleSelection = async (item) => {
    if (isAdmin) return // read-only for admin
    if (toggling.has(item.id)) return // already in flight

    const nowSelected = !selectedIds.has(item.id)
    // Optimistic update
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (nowSelected) next.add(item.id)
      else next.delete(item.id)
      return next
    })
    setToggling(prev => new Set(prev).add(item.id))

    try {
      await apiFetch(`${API_URL}/api/borrow-selections`, {
        method: 'POST',
        body: JSON.stringify({ weddingId, itemId: item.id, selected: nowSelected })
      })
    } catch (err) {
      // Revert optimistic update on error
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (nowSelected) next.delete(item.id)
        else next.add(item.id)
        return next
      })
      console.error('Failed to toggle selection:', err)
      toastError(`Could not save selection: ${err.message}`)
    }
    setToggling(prev => {
      const next = new Set(prev)
      next.delete(item.id)
      return next
    })
  }

  const filtered = activeCategory === 'All'
    ? items
    : items.filter(item => item.category === activeCategory)

  const selectedCount = selectedIds.size

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Filter skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-cream-200 rounded-full animate-pulse" />
          ))}
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
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
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
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

      {/* Item count + selection count */}
      <div className="flex items-center justify-between">
        <p className="text-sage-400 text-sm">
          {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          {activeCategory !== 'All' ? ` in ${activeCategory}` : ' available'}
        </p>
        {weddingId && (
          <p className="text-sage-600 text-sm font-medium">
            {selectedCount > 0
              ? `${selectedCount} ${selectedCount === 1 ? 'item' : 'items'} selected`
              : isAdmin ? 'No items selected yet' : 'Tap to select items'}
          </p>
        )}
      </div>

      {/* Photo grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sage-400">
          <p>No items in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map(item => {
            const isSelected = selectedIds.has(item.id)
            const isToggling = toggling.has(item.id)
            return (
              <div
                key={item.id}
                className={`group relative bg-white rounded-xl border overflow-hidden transition flex flex-col ${
                  isSelected
                    ? 'border-sage-400 shadow-md ring-2 ring-sage-300'
                    : 'border-cream-200 hover:border-sage-300 hover:shadow-md'
                } ${weddingId && !isAdmin ? 'cursor-pointer' : ''}`}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => weddingId && !isAdmin && toggleSelection(item)}
              >
                {/* Selection indicator */}
                {weddingId && (
                  <div className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition ${
                    isSelected
                      ? 'bg-sage-600 text-white'
                      : 'bg-white/80 border border-cream-300 text-transparent'
                  } ${isToggling ? 'opacity-50' : ''}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                {/* Image.
                    object-contain, not object-cover. These are decor items
                    photographed however they happened to be photographed, and
                    most of them are wider than they are tall — arbors,
                    benches, long tables. Cropping to a square cut the ends off,
                    so you saw the middle of an arbor rather than an arbor.
                    A 4:3 box with the whole item inside it fits far more of
                    them, and nothing is hidden. */}
                <div className="relative aspect-[4/3] bg-cream-50 overflow-hidden">
                  {item.image_url ? (
                    <>
                      <img
                        src={item.image_url}
                        alt={item.item_name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {/* Always visible, not hover-only: on a phone there is no
                          hover, and a thumbnail with no way to enlarge it was
                          the other half of why these were hard to see.
                          stopPropagation because tapping the card itself
                          selects the item. */}
                      <button
                        type="button"
                        aria-label={`View ${item.item_name} larger`}
                        onClick={(e) => { e.stopPropagation(); setZoomed(item) }}
                        className="absolute bottom-2 right-2 p-2 rounded-full bg-white/85 border border-cream-300 text-sage-600 hover:bg-white shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16zM11 8v6M8 11h6" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-cream-300">
                      📦
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex-1">
                  <p className="font-medium text-sage-800 text-sm leading-tight">{item.item_name}</p>
                  {item.description && (
                    <p className="text-sage-500 text-xs mt-1 line-clamp-2">{item.description}</p>
                  )}
                </div>

                {/* Ask Sage hover overlay — only in client mode (no weddingId checkbox mode) */}
                {onAskSage && !weddingId && hoveredItem === item.id && (
                  <div className="absolute inset-0 bg-sage-900/60 flex items-center justify-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); onAskSage(item.item_name); }}
                      className="px-4 py-2 bg-white text-sage-800 rounded-xl text-sm font-semibold hover:bg-cream-50 transition shadow-lg"
                    >
                      Ask Sage →
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Full-size view. Decor gets chosen off these pictures, so being able
          to actually look at one matters more than the grid being tidy. */}
      {zoomed && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setZoomed(null)}
        >
          <div className="w-full max-w-3xl bg-white rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative bg-cream-50">
              <img
                src={zoomed.image_url}
                alt={zoomed.item_name}
                className="max-h-[70vh] w-auto mx-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setZoomed(null)}
                aria-label="Close"
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <p className="font-medium text-sage-800">{zoomed.item_name}</p>
              {zoomed.description && <p className="text-sage-500 text-sm mt-1">{zoomed.description}</p>}
              {zoomed.category && <p className="text-sage-400 text-xs mt-2">{zoomed.category}</p>}
            </div>
          </div>
        </div>
      )}
    </div>

  )
}
