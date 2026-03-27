import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../config/api'


// ── Tag definitions ────────────────────────────────────────────────────────────

const CONTEXT_TAGS = [
  { tag: 'couples',       label: 'Couple',        color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { tag: 'wedding-party', label: 'Wedding Party',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { tag: 'dress-code',    label: 'Dress Code',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { tag: 'ceremony',      label: 'Ceremony',       color: 'bg-sage-100 text-sage-700 border-sage-200' },
  { tag: 'reception',     label: 'Reception',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { tag: 'venue',         label: 'Venue / Decor',  color: 'bg-green-100 text-green-700 border-green-200' },
]

const WEBSITE_TAG = { tag: 'website', label: 'Show on website', color: 'bg-sage-600 text-white border-sage-600' }
const HERO_TAG    = { tag: 'hero',    label: 'Hero / Banner',   color: 'bg-amber-500 text-white border-amber-500' }

function tagColor(tag, guestNames = []) {
  if (tag === 'website') return 'bg-sage-600 text-white'
  if (tag === 'hero')    return 'bg-amber-500 text-white'
  const ctx = CONTEXT_TAGS.find(t => t.tag === tag)
  if (ctx) return ctx.color.replace(' border-sage-200', '').replace(' border-rose-200', '').replace(' border-purple-200', '').replace(' border-amber-200', '').replace(' border-blue-200', '').replace(' border-green-200', '')
  if (guestNames.includes(tag)) return 'bg-cream-200 text-sage-700'
  return 'bg-gray-100 text-gray-600'
}

// ── Small tag chip ─────────────────────────────────────────────────────────────

function TagChip({ tag, onRemove, guestNames }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tagColor(tag, guestNames)}`}>
      {tag}
      {onRemove && (
        <button type="button" onClick={() => onRemove(tag)} className="hover:opacity-70 leading-none">×</button>
      )}
    </span>
  )
}

// ── Tag editor panel ───────────────────────────────────────────────────────────

function TagEditor({ photo, guestNames, onUpdate, onDelete, onClose }) {
  const [tags, setTags]       = useState(photo.tags || [])
  const [caption, setCaption] = useState(photo.caption || '')
  const [custom, setCustom]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toggle = (tag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const addCustom = () => {
    const t = custom.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setCustom('')
  }

  const handleSave = async () => {
    setSaving(true)
    await onUpdate(photo.id, { tags, caption: caption.trim() || null })
    setSaving(false)
    onClose()
  }

  const hasTag = (tag) => tags.includes(tag)
  const isOnWebsite = hasTag('website')

  return (
    <div className="flex flex-col h-full">
      {/* Photo preview */}
      <div className="relative bg-gray-100 flex-shrink-0" style={{ height: 200 }}>
        <img src={photo.url} alt="" className="w-full h-full object-cover" />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 text-sm"
        >×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Website toggle — most prominent */}
        <button
          type="button"
          onClick={() => toggle('website')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition ${
            isOnWebsite
              ? 'border-sage-500 bg-sage-50'
              : 'border-cream-300 bg-white hover:border-sage-300'
          }`}
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            isOnWebsite ? 'border-sage-500 bg-sage-500' : 'border-cream-400'
          }`}>
            {isOnWebsite && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
          </div>
          <div className="text-left">
            <p className={`text-sm font-medium ${isOnWebsite ? 'text-sage-700' : 'text-sage-600'}`}>
              Show on wedding website
            </p>
            <p className="text-xs text-sage-400">Guests will see this photo</p>
          </div>
        </button>

        {/* Hero toggle */}
        <button
          type="button"
          onClick={() => toggle('hero')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition ${
            hasTag('hero')
              ? 'border-amber-400 bg-amber-50'
              : 'border-cream-300 bg-white hover:border-amber-300'
          }`}
        >
          <span className="text-xl">✨</span>
          <div className="text-left">
            <p className={`text-sm font-medium ${hasTag('hero') ? 'text-amber-700' : 'text-sage-600'}`}>
              Use as hero / banner photo
            </p>
            <p className="text-xs text-sage-400">The big image at the top of your website</p>
          </div>
        </button>

        {/* Context tags */}
        <div>
          <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">Section</p>
          <div className="flex flex-wrap gap-2">
            {CONTEXT_TAGS.map(({ tag, label, color }) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className={`px-3 py-1.5 rounded-full text-xs border font-medium transition ${
                  hasTag(tag) ? color : 'bg-white text-sage-500 border-cream-300 hover:border-sage-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* People tags */}
        {guestNames.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">People in this photo</p>
            <div className="flex flex-wrap gap-2">
              {guestNames.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggle(name)}
                  className={`px-3 py-1.5 rounded-full text-xs border font-medium transition ${
                    hasTag(name)
                      ? 'bg-cream-200 text-sage-800 border-cream-400'
                      : 'bg-white text-sage-500 border-cream-300 hover:border-sage-400'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom tag */}
        <div>
          <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">Custom tag</p>
          <div className="flex gap-2">
            <input
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              placeholder="Type and press Enter…"
              className="flex-1 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
            <button
              type="button"
              onClick={addCustom}
              className="px-3 py-2 bg-cream-100 text-sage-600 rounded-lg text-sm hover:bg-cream-200"
            >Add</button>
          </div>
        </div>

        {/* Current tags */}
        {tags.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">All tags on this photo</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <TagChip key={tag} tag={tag} guestNames={guestNames} onRemove={(t) => setTags(prev => prev.filter(x => x !== t))} />
              ))}
            </div>
          </div>
        )}

        {/* Caption */}
        <div>
          <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">Caption (optional)</p>
          <input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Add a caption…"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-cream-200 p-4 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {confirmDelete ? (
          <>
            <button
              onClick={() => { onDelete(photo.id); onClose() }}
              className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
            >Confirm delete</button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-2 text-sage-500 text-sm"
            >Cancel</button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-2 text-red-400 hover:text-red-600 rounded-lg text-sm"
            title="Delete photo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PhotoBucket({ weddingId, readOnly = false }) {
  const [photos, setPhotos]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [uploading, setUploading]         = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [guestNames, setGuestNames]       = useState([])
  const [filterTag, setFilterTag]         = useState('all')
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadPhotos()
    loadGuestNames()
  }, [weddingId])

  const loadPhotos = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wedding-photos/${weddingId}`)
      const data = await res.json()
      setPhotos(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load photos:', err)
    }
    setLoading(false)
  }

  const loadGuestNames = async () => {
    try {
      const res = await fetch(`${API_URL}/api/guests/${weddingId}`)
      const data = await res.json()
      const guests = data.guests || data || []
      // Prioritise wedding party tagged guests first, then all
      const names = guests
        .filter(g => g.first_name)
        .map(g => [g.first_name, g.last_name].filter(Boolean).join(' '))
      setGuestNames([...new Set(names)])
    } catch (err) {
      // non-fatal
    }
  }

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return
    setUploading(true)

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('photo', file)
        formData.append('tags', JSON.stringify([]))
        const res = await fetch(`${API_URL}/api/wedding-photos/${weddingId}/upload`, {
          method: 'POST',
          body: formData
        })
        if (res.ok) {
          const photo = await res.json()
          setPhotos(prev => [...prev, photo])
        }
      } catch (err) {
        console.error('Upload error:', err)
      }
    }
    setUploading(false)
  }

  const handleUpdate = async (photoId, updates) => {
    try {
      const res = await fetch(`${API_URL}/api/wedding-photos/${photoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (res.ok) {
        const updated = await res.json()
        setPhotos(prev => prev.map(p => p.id === photoId ? updated : p))
        if (selectedPhoto?.id === photoId) setSelectedPhoto(updated)
      }
    } catch (err) {
      console.error('Update error:', err)
    }
  }

  const handleDelete = async (photoId) => {
    try {
      await fetch(`${API_URL}/api/wedding-photos/${photoId}`, { method: 'DELETE' })
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      if (selectedPhoto?.id === photoId) setSelectedPhoto(null)
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  // Filter options
  const allTags = ['website', 'hero', ...CONTEXT_TAGS.map(t => t.tag)]
  const filteredPhotos = filterTag === 'all'
    ? photos
    : photos.filter(p => p.tags?.includes(filterTag))

  const websiteCount = photos.filter(p => p.tags?.includes('website')).length

  if (loading) return <p className="text-sage-400 text-center py-8">Loading photos…</p>

  return (
    <div className="flex gap-0 h-full min-h-[500px]">

      {/* Main panel */}
      <div className={`flex-1 min-w-0 flex flex-col transition-all ${selectedPhoto ? 'mr-0' : ''}`}>

        {/* Testing banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-4">
          <strong>In testing.</strong> This feature is still being refined — let us know if anything feels off.
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-serif text-lg text-sage-700">Photo Library</h3>
            <p className="text-sage-500 text-sm">
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
              {websiteCount > 0 && ` · ${websiteCount} on website`}
            </p>
          </div>
          {!readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleUpload(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload photos
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Filter bar */}
        {photos.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            <button
              onClick={() => setFilterTag('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                filterTag === 'all' ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-sage-500 border-cream-300 hover:border-sage-400'
              }`}
            >All ({photos.length})</button>
            <button
              onClick={() => setFilterTag('website')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                filterTag === 'website' ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-sage-500 border-cream-300 hover:border-sage-400'
              }`}
            >On website ({websiteCount})</button>
            {CONTEXT_TAGS.map(({ tag, label }) => {
              const count = photos.filter(p => p.tags?.includes(tag)).length
              if (count === 0) return null
              return (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? 'all' : tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    filterTag === tag ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-sage-500 border-cream-300 hover:border-sage-400'
                  }`}
                >{label} ({count})</button>
              )
            })}
          </div>
        )}

        {/* Grid or empty state */}
        {photos.length === 0 ? (
          <div
            className="flex-1 border-2 border-dashed border-cream-300 rounded-xl flex flex-col items-center justify-center gap-3 p-8 text-center cursor-pointer hover:border-sage-400 transition"
            onClick={() => !readOnly && fileInputRef.current?.click()}
          >
            <svg className="w-10 h-10 text-cream-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="text-sage-500 font-medium">Upload your photos</p>
              <p className="text-sage-400 text-sm mt-1">Engagement photos, wedding party portraits, venue inspiration — tag them to control where they appear</p>
            </div>
            {!readOnly && <p className="text-sage-400 text-xs">Click to browse or drag & drop</p>}
          </div>
        ) : (
          <div className={`grid gap-2 ${selectedPhoto ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
            {filteredPhotos.map(photo => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setSelectedPhoto(selectedPhoto?.id === photo.id ? null : photo)}
                className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition ${
                  selectedPhoto?.id === photo.id
                    ? 'border-sage-500 ring-2 ring-sage-300'
                    : 'border-transparent hover:border-sage-300'
                }`}
              >
                <img src={photo.url} alt={photo.caption || ''} className="w-full h-full object-cover" />

                {/* Overlay: tag indicators */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                <div className="absolute bottom-1 left-1 flex gap-1 flex-wrap">
                  {photo.tags?.includes('website') && (
                    <span className="w-4 h-4 bg-sage-600 rounded-full flex items-center justify-center" title="On website">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                  {photo.tags?.includes('hero') && (
                    <span className="w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center" title="Hero photo">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </span>
                  )}
                </div>

                {/* Caption on hover */}
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition truncate">
                    {photo.caption}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tag editor panel — slides in on the right */}
      {selectedPhoto && (
        <div className="w-72 flex-shrink-0 border-l border-cream-200 bg-white ml-4 rounded-xl overflow-hidden flex flex-col">
          <TagEditor
            photo={selectedPhoto}
            guestNames={guestNames}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onClose={() => setSelectedPhoto(null)}
          />
        </div>
      )}
    </div>
  )
}
