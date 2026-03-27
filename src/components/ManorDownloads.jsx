import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

function publicUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/manor-assets/${storagePath}`
}

// ── Asset Card ─────────────────────────────────────────────────────────────

function AssetCard({ asset, isAdmin, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState({ title: asset.title, description: asset.description || '' })
  const [saving, setSaving]   = useState(false)
  const url = publicUrl(asset.storage_path)

  const save = async () => {
    setSaving(true)
    await onUpdate(asset.id, draft)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="bg-white border border-cream-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition">
      {/* Thumbnail */}
      <div className="bg-cream-50 aspect-[4/3] flex items-center justify-center overflow-hidden border-b border-cream-100">
        <img src={url} alt={asset.title}
          className="w-full h-full object-contain p-4" />
      </div>

      {/* Body */}
      <div className="p-4">
        {editing ? (
          <div className="space-y-2">
            <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sage-300" />
            <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              rows={2} placeholder="Description…"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage-300" />
            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving}
                className="flex-1 py-1.5 bg-sage-600 text-white text-xs rounded-lg hover:bg-sage-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)}
                className="flex-1 py-1.5 border border-cream-300 text-sage-500 text-xs rounded-lg hover:border-sage-300">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="font-medium text-sage-800 text-sm leading-snug mb-1">{asset.title}</p>
            {asset.description && (
              <p className="text-xs text-sage-500 leading-relaxed mb-3">{asset.description}</p>
            )}
            <div className="flex gap-2">
              <a href={url} download={asset.file_name} target="_blank" rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-sage-600 text-white text-xs font-medium rounded-lg hover:bg-sage-700 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </a>
              {isAdmin && (
                <>
                  <button onClick={() => setEditing(true)}
                    className="p-2 border border-cream-200 text-sage-400 hover:text-sage-600 rounded-lg hover:border-sage-300 transition">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z" />
                    </svg>
                  </button>
                  <button onClick={() => onDelete(asset.id)}
                    className="p-2 border border-cream-200 text-red-300 hover:text-red-500 rounded-lg hover:border-red-200 transition">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Upload form (admin only) ───────────────────────────────────────────────

function UploadForm({ onUploaded }) {
  const [open, setOpen]           = useState(false)
  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [file, setFile]           = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const [uploadError, setUploadError] = useState('')

  const submit = async () => {
    if (!file || !title.trim()) return
    setUploading(true)
    setUploadError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title)
    fd.append('description', description)
    try {
      const hdrs = await authHeaders()
      const res  = await fetch(`${API_URL}/api/manor-assets`, { method: 'POST', headers: { 'Authorization': hdrs['Authorization'] }, body: fd })
      const data = await res.json()
      if (!res.ok) { setUploadError(data.error || 'Upload failed'); setUploading(false); return }
      onUploaded(data)
      setTitle(''); setDesc(''); setFile(null); setOpen(false)
    } catch (err) { setUploadError(err.message || 'Upload failed'); console.error(err) }
    setUploading(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full border-2 border-dashed border-cream-300 rounded-2xl p-8 text-sage-400 hover:border-sage-300 hover:text-sage-500 transition flex flex-col items-center gap-2">
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
      <span className="text-sm font-medium">Add asset</span>
    </button>
  )

  return (
    <div className="border-2 border-sage-200 rounded-2xl p-5 bg-sage-50 space-y-3">
      <p className="text-sm font-semibold text-sage-700">Upload new asset</p>

      <div className="border-2 border-dashed border-cream-300 rounded-xl p-4 text-center cursor-pointer hover:border-sage-300 transition"
        onClick={() => fileRef.current.click()}>
        {file ? (
          <p className="text-sm text-sage-700 font-medium">{file.name}</p>
        ) : (
          <p className="text-sm text-sage-400">Click to choose a file</p>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf,.svg" className="hidden"
          onChange={e => setFile(e.target.files[0])} />
      </div>

      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title *"
        className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />

      <textarea value={description} onChange={e => setDesc(e.target.value)}
        placeholder="Description — what is this file and when should couples use it?"
        rows={2} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage-300" />

      {uploadError && <p className="text-red-500 text-xs">{uploadError}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={uploading || !file || !title.trim()}
          className="flex-1 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition">
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <button onClick={() => setOpen(false)}
          className="flex-1 py-2 border border-cream-300 text-sage-500 text-sm rounded-lg hover:border-sage-300 transition">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ManorDownloads({ isAdmin = false }) {
  const [assets, setAssets]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/manor-assets`, { headers: await authHeaders() })
      const data = await res.json()
      setAssets(Array.isArray(data) ? data : [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleUpdate = async (id, fields) => {
    await fetch(`${API_URL}/api/manor-assets/${id}`, {
      method: 'PUT', headers: await authHeaders(),
      body: JSON.stringify(fields),
    })
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...fields } : a))
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this asset?')) return
    await fetch(`${API_URL}/api/manor-assets/${id}`, { method: 'DELETE', headers: await authHeaders() })
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  if (loading) return <div className="text-sage-400 text-center py-8">Loading…</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-sage-700">Manor Downloads</h2>
        <p className="text-sage-500 text-sm mt-1">
          Logos, sketches, and brand assets from Rixey Manor — use these for your wedding website, save-the-dates, and stationery.
        </p>
      </div>

      {assets.length === 0 && !isAdmin && (
        <p className="text-sage-400 text-center py-12 italic">No assets available yet — check back soon.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map(asset => (
          <AssetCard key={asset.id} asset={asset} isAdmin={isAdmin}
            onUpdate={handleUpdate} onDelete={handleDelete} />
        ))}
        {isAdmin && <UploadForm onUploaded={newAsset => setAssets(prev => [...prev, newAsset])} />}
      </div>
    </div>
  )
}
