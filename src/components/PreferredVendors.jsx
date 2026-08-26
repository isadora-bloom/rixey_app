import { useState, useEffect } from 'react'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'

// The couple-facing vendor directory. One surface.
//
// There used to be two: this component, which showed only published vendors
// and so showed nothing, and a /vendors page that read the table raw and
// showed all 110 with no photos or bios. The sidebar pointed at the second
// one, which made this dead code. Now the list is every vendor Rixey
// recommends, and the ones who have filled in their own profile get their
// photos, words and offer on top of Isadora's note.

const TOGGLES = [
  { key: 'is_local', label: 'Local' },
  { key: 'is_budget_friendly', label: 'Budget-friendly' },
  { key: 'has_multiple_events', label: '3+ Rixey weddings' },
]

export default function PreferredVendors() {
  const [vendors, setVendors] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [flags, setFlags] = useState({})
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    authHeaders()
      .then(hdrs => fetch(`${API_URL}/api/vendor-directory`, { headers: hdrs }))
      .then(async r => {
        if (!r.ok) throw new Error(`Directory returned ${r.status}`)
        return r.json()
      })
      .then(d => {
        setVendors(d.vendors || [])
        setCategories(d.categories || [])
      })
      // An empty list and a broken request look identical to a couple, so say
      // which one it was rather than letting a 500 read as "no vendors yet".
      .catch(err => setLoadError(err.message || 'Could not load the directory'))
      .finally(() => setLoading(false))
  }, [])

  const activeFlags = Object.keys(flags).filter(k => flags[k])
  const term = search.trim().toLowerCase()

  const filtered = vendors.filter(v => {
    if (filterCategory && v.category !== filterCategory) return false
    if (activeFlags.some(f => !v[f])) return false
    if (term) {
      const haystack = [v.name, v.category, v.notes, v.bio, v.pricing_info].join(' ').toLowerCase()
      if (!haystack.includes(term)) return false
    }
    return true
  })

  const grouped = filtered.reduce((acc, v) => {
    const cat = v.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(v)
    return acc
  }, {})

  // Vendors who wrote their own profile come first in their category. They put
  // the work in and the photos are the useful part of the page.
  Object.values(grouped).forEach(list => {
    list.sort((a, b) => (b.has_profile ? 1 : 0) - (a.has_profile ? 1 : 0) || a.name.localeCompare(b.name))
  })

  if (loading) {
    return <p className="text-sage-400 text-center py-10 text-sm">Loading…</p>
  }

  if (loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-sage-700 text-sm font-medium">The vendor directory did not load.</p>
        <p className="text-sage-400 text-xs mt-1">{loadError}</p>
        <p className="text-sage-400 text-xs mt-3">Give it a refresh, and tell us if it keeps happening.</p>
      </div>
    )
  }

  if (vendors.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sage-500 text-sm">Vendor recommendations coming soon.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-serif text-xl text-sage-800 mb-1">Vendor Directory</h2>
        <p className="text-sage-500 text-sm">
          Trusted partners who know Rixey Manor and love working here. Each one has been personally recommended by our team.
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search vendors…"
        className="w-full px-3 py-2 mb-3 border border-cream-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
      />

      {/* Toggles */}
      <div className="flex flex-wrap gap-2 mb-3">
        {TOGGLES.map(t => (
          <button
            key={t.key}
            onClick={() => setFlags({ ...flags, [t.key]: !flags[t.key] })}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              flags[t.key] ? 'bg-sage-600 text-white border-sage-600' : 'border-cream-300 text-sage-600 hover:border-sage-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setFilterCategory('')}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filterCategory === '' ? 'bg-sage-600 text-white border-sage-600' : 'border-cream-300 text-sage-600 hover:border-sage-300'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                filterCategory === cat ? 'bg-sage-600 text-white border-sage-600' : 'border-cream-300 text-sage-600 hover:border-sage-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <p className="text-sage-400 text-xs mb-6">
        {filtered.length} of {vendors.length} vendor{vendors.length === 1 ? '' : 's'}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sage-400 text-sm text-center py-10">No vendors match that. Try clearing a filter.</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catVendors]) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-sage-400 mb-3">{cat}</h3>
              <div className="space-y-3">
                {catVendors.map(v => (
                  <VendorCard
                    key={v.id}
                    vendor={v}
                    expanded={expandedId === v.id}
                    onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VendorCard({ vendor: v, expanded, onToggle }) {
  const photos = v.photos || []
  const hasPhotos = photos.length > 0
  const hasExtra = v.bio || v.special_offer || v.availability_note || v.instagram || v.facebook || hasPhotos

  return (
    <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden hover:border-sage-200 transition">
      {/* Photo strip — first photo if available */}
      {hasPhotos && (
        <div className="h-40 bg-cream-100 overflow-hidden">
          <img src={photos[0]} alt={v.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sage-800">{v.name}</h4>
              {v.is_budget_friendly && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Budget-friendly</span>
              )}
              {v.is_local && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Local</span>
              )}
              {v.has_multiple_events && (
                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Rixey veteran</span>
              )}
              {v.serves_indian && (
                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Indian</span>
              )}
              {v.serves_chinese && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Chinese</span>
              )}
            </div>

            {/* Short description — the vendor's own words if they wrote any,
                otherwise Isadora's note on them */}
            {(v.bio || v.notes) && (
              <p className="text-sage-500 text-sm mt-1 line-clamp-2">{v.bio || v.notes}</p>
            )}

            {/* Special offer highlight */}
            {v.special_offer && (
              <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs px-3 py-1 rounded-full border border-amber-200">
                <span>★</span>
                <span>{v.special_offer}</span>
              </div>
            )}
          </div>

          {hasExtra && (
            <button
              onClick={onToggle}
              className="text-sage-400 hover:text-sage-600 text-xs shrink-0 mt-0.5"
            >
              {expanded ? 'Less ↑' : 'More ↓'}
            </button>
          )}
        </div>

        {/* Inline contact / website always visible */}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-sage-500">
          {v.contact && <span>{v.contact}</span>}
          {v.pricing_info && <span className="text-sage-400">{v.pricing_info}</span>}
          {v.website && (
            <a
              href={v.website.startsWith('http') ? v.website : `https://${v.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sage-600 hover:text-sage-800 underline"
            >
              Website ↗
            </a>
          )}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-cream-100 space-y-3">

            {/* Isadora's note, once the vendor's own bio has taken the summary slot */}
            {v.bio && v.notes && v.bio !== v.notes && (
              <div>
                <p className="text-xs font-medium text-sage-500 mb-0.5">Why we recommend them</p>
                <p className="text-sm text-sage-700">{v.notes}</p>
              </div>
            )}

            {/* Full bio if bio differs from notes */}
            {v.bio && v.bio !== v.notes && (
              <p className="text-sage-600 text-sm leading-relaxed whitespace-pre-line">{v.bio}</p>
            )}

            {/* Availability */}
            {v.availability_note && (
              <div>
                <p className="text-xs font-medium text-sage-500 mb-0.5">Availability</p>
                <p className="text-sm text-sage-700">{v.availability_note}</p>
              </div>
            )}

            {/* Social links */}
            {(v.instagram || v.facebook) && (
              <div className="flex gap-3 text-xs">
                {v.instagram && (
                  <a
                    href={v.instagram.startsWith('http') ? v.instagram : `https://instagram.com/${v.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sage-600 hover:text-sage-800 underline"
                  >
                    Instagram ↗
                  </a>
                )}
                {v.facebook && (
                  <a
                    href={v.facebook.startsWith('http') ? v.facebook : `https://${v.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sage-600 hover:text-sage-800 underline"
                  >
                    Facebook ↗
                  </a>
                )}
              </div>
            )}

            {/* Photo grid if more than 1 */}
            {photos.length > 1 && (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((url, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-cream-100">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
