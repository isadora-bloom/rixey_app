import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || '${API_URL}'

export default function InspoGallery({ weddingId, userId, isAdmin = false }) {
  const [images, setImages] = useState([])
  const [maxImages, setMaxImages] = useState(20)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [editingCaption, setEditingCaption] = useState(null)
  const [captionText, setCaptionText] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (weddingId) {
      loadImages()
    }
  }, [weddingId])

  const loadImages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/inspo/${weddingId}`)
      const data = await response.json()
      setImages(data.images || [])
      setMaxImages(data.maxImages || 20)
    } catch (error) {
      console.error('Error loading inspo images:', error)
    }
    setLoading(false)
  }

  const handleUpload = async (file) => {
    if (images.length >= maxImages) {
      alert(`Maximum ${maxImages} images allowed`)
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('image', file)
    formData.append('weddingId', weddingId)
    if (userId) formData.append('uploadedBy', userId)

    try {
      const response = await fetch(`${API_URL}/api/inspo`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json()

      if (data.error) {
        alert(data.error)
      } else if (data.image) {
        setImages([...images, data.image])
      }
    } catch (error) {
      console.error('Error uploading image:', error)
    }
    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpdateCaption = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/inspo/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: captionText })
      })
      const data = await response.json()
      if (data.image) {
        setImages(images.map(img => img.id === id ? data.image : img))
      }
    } catch (error) {
      console.error('Error updating caption:', error)
    }
    setEditingCaption(null)
    setCaptionText('')
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this image?')) return

    try {
      await fetch(`${API_URL}/api/inspo/${id}`, { method: 'DELETE' })
      setImages(images.filter(img => img.id !== id))
      if (selectedImage?.id === id) {
        setSelectedImage(null)
      }
    } catch (error) {
      console.error('Error deleting image:', error)
    }
  }

  if (loading) {
    return <div className="text-sage-400 text-center py-4">Loading gallery...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-sage-600">
          {images.length} / {maxImages} images
        </p>
        {images.length < maxImages && (
          <label className={`text-sm px-3 py-1 bg-sage-100 text-sage-700 rounded-lg hover:bg-sage-200 cursor-pointer ${
            uploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}>
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
            {uploading ? 'Uploading...' : '+ Add Image'}
          </label>
        )}
      </div>

      {/* Image Grid */}
      {images.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-cream-300 rounded-lg">
          <svg className="w-12 h-12 mx-auto text-sage-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sage-400 text-sm">No inspiration images yet</p>
          <p className="text-sage-400 text-xs mt-1">Add photos that inspire your vision</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {images.map(image => (
            <div
              key={image.id}
              className="relative aspect-square rounded-lg overflow-hidden bg-cream-100 group cursor-pointer"
              onClick={() => setSelectedImage(image)}
            >
              <img
                src={image.image_url}
                alt={image.caption || 'Inspiration'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end">
                <div className="w-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {image.caption && (
                    <p className="text-white text-xs truncate">{image.caption}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="max-w-3xl max-h-[90vh] bg-white rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.caption || 'Inspiration'}
                className="max-h-[70vh] w-auto mx-auto"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {editingCaption === selectedImage.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    placeholder="Add a caption..."
                    className="flex-1 px-3 py-2 border border-cream-300 rounded-lg text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() => handleUpdateCaption(selectedImage.id)}
                    className="px-3 py-2 bg-sage-600 text-white rounded-lg text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingCaption(null)
                      setCaptionText('')
                    }}
                    className="px-3 py-2 text-sage-600 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sage-700">
                    {selectedImage.caption || <span className="text-sage-400">No caption</span>}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCaption(selectedImage.id)
                        setCaptionText(selectedImage.caption || '')
                      }}
                      className="text-sage-500 hover:text-sage-700 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(selectedImage.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
