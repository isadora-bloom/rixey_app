import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function CouplePhoto({ weddingId, userId, compact = false }) {
  const [photo, setPhoto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (weddingId) {
      loadPhoto()
    }
  }, [weddingId])

  const loadPhoto = async () => {
    try {
      const response = await fetch(`${API_URL}/api/couple-photo/${weddingId}`)
      const data = await response.json()
      setPhoto(data.photo)
    } catch (error) {
      console.error('Error loading couple photo:', error)
    }
    setLoading(false)
  }

  const handleUpload = async (file) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('photo', file)
    formData.append('weddingId', weddingId)
    if (userId) formData.append('uploadedBy', userId)

    try {
      const response = await fetch(`${API_URL}/api/couple-photo`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json()

      if (data.photo) {
        setPhoto(data.photo)
      }
    } catch (error) {
      console.error('Error uploading photo:', error)
    }
    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    if (!confirm('Remove your couple photo?')) return

    try {
      await fetch(`${API_URL}/api/couple-photo/${weddingId}`, { method: 'DELETE' })
      setPhoto(null)
    } catch (error) {
      console.error('Error deleting photo:', error)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${compact ? 'w-16 h-16' : 'w-32 h-32'} rounded-full bg-cream-100`}>
        <span className="text-sage-400 text-xs">...</span>
      </div>
    )
  }

  // Compact view (for sidebar)
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <label className={`relative cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleUpload(e.target.files[0])
              }
            }}
            disabled={uploading}
          />
          {photo ? (
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-sage-200 hover:border-sage-400 transition">
              <img
                src={photo.image_url}
                alt="Couple"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-cream-100 border-2 border-dashed border-cream-300 hover:border-sage-400 transition flex items-center justify-center">
              {uploading ? (
                <span className="text-sage-400 text-xs">...</span>
              ) : (
                <svg className="w-6 h-6 text-sage-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </div>
          )}
        </label>
        <div className="flex-1">
          <p className="text-sage-700 text-sm font-medium">
            {photo ? 'Your Photo' : 'Add Photo'}
          </p>
          {photo && (
            <button
              onClick={handleDelete}
              className="text-sage-400 text-xs hover:text-red-500"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    )
  }

  // Full view
  return (
    <div className="space-y-4">
      <label className={`relative block mx-auto cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleUpload(e.target.files[0])
            }
          }}
          disabled={uploading}
        />
        {photo ? (
          <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-sage-200 hover:border-sage-400 transition shadow-lg">
            <img
              src={photo.image_url}
              alt="Couple"
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-32 h-32 mx-auto rounded-full bg-cream-100 border-4 border-dashed border-cream-300 hover:border-sage-400 transition flex flex-col items-center justify-center">
            {uploading ? (
              <span className="text-sage-400">Uploading...</span>
            ) : (
              <>
                <svg className="w-8 h-8 text-sage-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sage-400 text-xs">Add photo</span>
              </>
            )}
          </div>
        )}
      </label>

      {photo && (
        <div className="text-center">
          <p className="text-sage-500 text-xs mb-1">Click photo to change</p>
          <button
            onClick={handleDelete}
            className="text-red-400 text-xs hover:text-red-600"
          >
            Remove photo
          </button>
        </div>
      )}
    </div>
  )
}
