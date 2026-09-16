import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../config/api'
import { apiFetch, loadJson } from '../utils/api'
import { shrinkImageForUpload } from '../utils/image'
import { useToast } from './ui/Toast'
import ConfirmDialog from './ui/ConfirmDialog'

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

function MediaTile({ item, isAdmin, onDelete, onCaptionChange, onReorder, canMoveUp, canMoveDown }) {
  const { error: toastError } = useToast()
  const video = isVideo(item.mime_type)
  const [caption, setCaption] = useState(item.caption || '')
  const [savingCaption, setSavingCaption] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleBlur = async () => {
    if (caption === (item.caption || '')) return
    setSavingCaption(true)
    try {
      await onCaptionChange(item.id, caption)
    } finally {
      setSavingCaption(false)
    }
  }

  // A plain <a download> is ignored once the href crosses origins, and
  // storage is always a different origin from the app — this used to just
  // open the file in a new tab instead of saving it.
  const download = async () => {
    setDownloading(true)
    try {
      const res = await fetch(item.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = item.filename || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
    } catch (err) {
      toastError(`Could not download that: ${err.message}`)
    }
    setDownloading(false)
  }

  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden flex flex-col">
      <div className="relative bg-cream-50 aspect-video flex items-center justify-center">
        {video ? (
          <video controls preload="metadata" className="w-full h-full object-contain bg-black">
            <source src={item.url} type={item.mime_type} />
          </video>
        ) : (
          <img src={item.url} alt={item.caption || item.filename} className="w-full h-full object-cover" />
        )}
        {isAdmin && onReorder && (
          <div className="absolute top-1 left-1 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onReorder(item, 'up')}
              disabled={!canMoveUp}
              className="w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move earlier"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            </button>
            <button
              type="button"
              onClick={() => onReorder(item, 'down')}
              disabled={!canMoveDown}
              className="w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move later"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
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
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="text-sage-600 hover:text-sage-800 underline disabled:opacity-50"
            >
              {downloading ? 'Downloading…' : 'Download'}
            </button>
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
  const { error: toastError } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('media')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (weddingId) fetchItems()
  }, [weddingId])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    try {
      setItems(await loadJson(`${API_URL}/api/day-of-media/${weddingId}`))
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
    // One failed upload used to abandon the whole batch — someone dropping in
    // twenty photos lost everything after the one that was too big or timed
    // out, with no way to tell which had actually made it.
    const failed = []

    for (const file of files) {
      setUploadProgress({ current: done + 1, total, name: file.name })
      const fd = new FormData()
      fd.append('file', await shrinkImageForUpload(file))
      fd.append('category', category)
      try {
        const result = await apiFetch(`${API_URL}/api/day-of-media/${weddingId}/upload`, {
          method: 'POST',
          body: fd,
        })
        if (result) uploaded.push(result)
      } catch (err) {
        failed.push({ name: file.name, message: err.message })
      }
      done++
    }

    if (uploaded.length) setItems(prev => [...prev, ...uploaded])
    if (failed.length) {
      const msg = failed.length === 1
        ? `Couldn't upload ${failed[0].name}: ${failed[0].message}`
        : `${failed.length} of ${total} failed to upload: ${failed.map(f => f.name).join(', ')}`
      setError(msg)
      toastError(msg)
    }
    setUploading(false)
    setUploadProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete(id) {
    const snapshot = items
    setItems(prev => prev.filter(i => i.id !== id))
    try {
      await apiFetch(`${API_URL}/api/day-of-media/${id}`, {
        method: 'DELETE',
      })
    } catch (err) {
      setItems(snapshot)
      setError(`Couldn't delete: ${err.message}`)
      toastError(`Could not delete: ${err.message}`)
    }
  }

  // Swaps sort_order with the neighbour within the same category (the order
  // is grouped by category server-side and in this view), through the
  // existing PUT route, optimistic with rollback on failure.
  async function handleReorder(item, direction, categoryItems) {
    const idx = categoryItems.findIndex(i => i.id === item.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx === -1 || swapIdx < 0 || swapIdx >= categoryItems.length) return
    const other = categoryItems[swapIdx]
    const aOrder = item.sort_order
    const bOrder = other.sort_order
    const snapshot = items
    setItems(prev => prev.map(i => {
      if (i.id === item.id) return { ...i, sort_order: bOrder }
      if (i.id === other.id) return { ...i, sort_order: aOrder }
      return i
    }))
    try {
      await Promise.all([
        apiFetch(`${API_URL}/api/day-of-media/${item.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: bOrder }) }),
        apiFetch(`${API_URL}/api/day-of-media/${other.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: aOrder }) }),
      ])
    } catch (err) {
      setItems(snapshot)
      setError(`Couldn't reorder: ${err.message}`)
      toastError(`Could not reorder: ${err.message}`)
    }
  }

  async function handleCaptionChange(id, caption) {
    try {
      const updated = await apiFetch(`${API_URL}/api/day-of-media/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ caption }),
      })
      if (updated) {
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i))
      }
    } catch (err) {
      setError(`Couldn't save caption: ${err.message}`)
      toastError(`Could not save caption: ${err.message}`)
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
                {categoryItems.map((item, i) => (
                  <MediaTile
                    key={item.id}
                    item={item}
                    isAdmin={isAdmin}
                    onDelete={setConfirmDeleteId}
                    onCaptionChange={handleCaptionChange}
                    onReorder={(it, dir) => handleReorder(it, dir, categoryItems)}
                    canMoveUp={i > 0}
                    canMoveDown={i < categoryItems.length - 1}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => { const id = confirmDeleteId; setConfirmDeleteId(null); if (id) handleDelete(id) }}
        title="Delete this item?"
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
