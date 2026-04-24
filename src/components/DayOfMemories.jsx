import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'

const CATEGORIES = [
  { key: 'video_message', label: 'Video messages', hint: 'Short phone clips captured during the day' },
  { key: 'media', label: 'Photos & videos from your day', hint: 'Everything else from the day' },
]

function isVideo(mime) { return (mime || '').startsWith('video/') }

function formatSize(bytes) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

function MediaTile({ item, isAdmin, onDelete, onCaptionChange }) {
  const video = isVideo(item.mime_type)
  const [caption, setCaption] = useState(item.caption || '')
  const [savingCaption, setSavingCaption] = useState(false)

  const handleBlur = async () => {
    if (caption === (item.caption || '')) return
    setSavingCaption(true)
    try {
      await onCaptionChange(item.id, caption)
    } finally {
      setSavingCaption(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden flex flex-col">
      <div className="bg-cream-50 aspect-video flex items-center justify-center">
        {video ? (
          <video controls preload="metadata" className="w-full h-full object-contain bg-black">
            <source src={item.url} type={item.mime_type} />
          </video>
        ) : (
          <img src={item.url} alt={item.caption || item.filename} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col gap-2">
        {isAdmin ? (
          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            onBlur={handleBlur}
            placeholder="Add a caption (optional)"
            className="w-full text-sm px-2 py-1 border border-cream-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-300"
          />
        ) : item.caption ? (
          <p className="text-sm text-sage-700">{item.caption}</p>
        ) : null}

        <div className="flex items-center justify-between text-xs text-sage-400 mt-auto">
          <span className="truncate">{formatSize(item.size_bytes)}</span>
          <div className="flex items-center gap-3">
            <a
              href={item.url}
              download={item.filename || true}
              className="text-sage-600 hover:text-sage-800 underline"
            >
              Download
            </a>
            {isAdmin && (
              <button
                onClick={() => onDelete(item.id)}
                className="text-rose-500 hover:text-rose-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>
        {savingCaption && <span className="text-xs text-sage-400">Saving…</span>}
      </div>
    </div>
  )
}

export default function DayOfMemories({ weddingId, isAdmin = false }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('media')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (weddingId) fetchItems()
  }, [weddingId])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/day-of-media/${weddingId}`, { headers: await authHeaders() })
      if (!res.ok) throw new Error('Failed to load media')
      setItems(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e, category) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    setError(null)

    const total = files.length
    let done = 0
    const uploaded = []

    for (const file of files) {
      setUploadProgress({ current: done + 1, total, name: file.name })
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', category)
      try {
        const headers = await authHeaders()
        delete headers['Content-Type']
        const res = await fetch(`${API_URL}/api/day-of-media/${weddingId}/upload`, {
          method: 'POST',
          headers,
          body: fd,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Upload failed (${res.status})`)
        }
        uploaded.push(await res.json())
      } catch (err) {
        setError(`Couldn't upload ${file.name}: ${err.message}`)
        break
      }
      done++
    }

    if (uploaded.length) setItems(prev => [...prev, ...uploaded])
    setUploading(false)
    setUploadProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this item? This cannot be undone.')) return
    try {
      const res = await fetch(`${API_URL}/api/day-of-media/${id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      })
      if (!res.ok) throw new Error('Delete failed')
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      setError(`Couldn't delete: ${err.message}`)
    }
  }

  async function handleCaptionChange(id, caption) {
    try {
      const res = await fetch(`${API_URL}/api/day-of-media/${id}`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ caption }),
      })
      if (!res.ok) throw new Error('Caption save failed')
      const updated = await res.json()
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i))
    } catch (err) {
      setError(`Couldn't save caption: ${err.message}`)
    }
  }

  if (loading) {
    return <div className="p-6 text-sage-500 text-sm">Loading day-of memories…</div>
  }

  const byCategory = Object.fromEntries(CATEGORIES.map(c => [c.key, []]))
  items.forEach(i => {
    if (byCategory[i.category]) byCategory[i.category].push(i)
  })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-sage-700">Day-of Memories</h2>
        <p className="text-sage-600 text-sm mt-1">
          {isAdmin
            ? 'Upload phone videos, photos and other media captured on the wedding day. The couple sees everything you upload here.'
            : 'Videos, photos and moments captured on your wedding day.'}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          <span className="text-rose-500 mt-0.5">⚠</span>
          <p className="text-sm text-rose-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 text-sm">✕</button>
        </div>
      )}

      {uploading && uploadProgress && (
        <div className="bg-sage-50 border border-sage-200 rounded-lg px-4 py-3 text-sm text-sage-700">
          Uploading {uploadProgress.current} of {uploadProgress.total}: <span className="font-medium">{uploadProgress.name}</span>
        </div>
      )}

      {CATEGORIES.map(cat => {
        const categoryItems = byCategory[cat.key]
        return (
          <section key={cat.key} className="space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-medium text-sage-700 text-lg">{cat.label}</h3>
                <p className="text-sage-500 text-sm">{cat.hint}</p>
              </div>
              {isAdmin && (
                <label className="cursor-pointer text-sm px-4 py-2 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition inline-flex items-center gap-2">
                  + Upload to {cat.label}
                  <input
                    ref={selectedCategory === cat.key ? fileInputRef : null}
                    type="file"
                    multiple
                    accept={cat.key === 'video_message' ? 'video/*' : 'image/*,video/*'}
                    onChange={e => { setSelectedCategory(cat.key); handleUpload(e, cat.key) }}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {categoryItems.length === 0 ? (
              <div className="bg-cream-50 border border-cream-200 rounded-xl px-6 py-10 text-center text-sage-400 text-sm">
                {isAdmin
                  ? 'Nothing uploaded here yet.'
                  : cat.key === 'video_message'
                    ? 'No video messages yet.'
                    : 'No photos or videos yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryItems.map(item => (
                  <MediaTile
                    key={item.id}
                    item={item}
                    isAdmin={isAdmin}
                    onDelete={handleDelete}
                    onCaptionChange={handleCaptionChange}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
