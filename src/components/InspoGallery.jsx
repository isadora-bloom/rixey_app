import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../config/api'
import { apiFetch, loadJson } from '../utils/api'
import { useToast } from './ui/Toast'
import LoadError from './ui/LoadError'
import { shrinkImageForUpload } from '../utils/image'

const CATEGORIES = ['All', 'Flowers', 'Decor', 'Table Settings', 'Cake & Dessert', 'Ceremony', 'Reception', 'Attire', 'Other']

export default function InspoGallery({ weddingId, userId, isAdmin = false }) {
  const { error: toastError } = useToast()
  const [images, setImages] = useState([])
  const [maxImages, setMaxImages] = useState(20)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [editingCaption, setEditingCaption] = useState(null)
  const [captionText, setCaptionText] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [uploadCategory, setUploadCategory] = useState('Other')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (weddingId) {
      loadImages()
    }
  }, [weddingId])

  const loadImages = async () => {
    setLoadError(null)
    try {
      const data = await loadJson(`${API_URL}/api/inspo/${weddingId}`)
      setImages(data.images || [])
      setMaxImages(data.maxImages || 20)
    } catch (error) {
      console.error('Error loading inspo images:', error)
      setLoadError(error)
    }
    setLoading(false)
  }

  const handleUpload = async (file) => {
    if (images.length >= maxImages) {
      alert(`Maximum ${maxImages} images allowed`)
      return
    }

    setUploading(true)
    // inspo-gallery bucket caps at 5MB — shrink before sending.
    const upload = await shrinkImageForUpload(file)
    const formData = new FormData()
    formData.append('image', upload)
    formData.append('weddingId', weddingId)
    formData.append('category', uploadCategory)
    if (userId) formData.append('uploadedBy', userId)

    try {
      const data = await apiFetch(`${API_URL}/api/inspo`, {
        method: 'POST',
        body: formData
      })

      if (data?.image) {
        setImages([...images, data.image])
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      toastError(`Could not upload image: ${error.message}`)
    }
    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpdateCaption = async (id) => {
    try {
      const data = await apiFetch(`${API_URL}/api/inspo/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ caption: captionText })
      })
      if (data?.image) {
        setImages(images.map(img => img.id === id ? data.image : img))
      }
    } catch (error) {
      console.error('Error updating caption:', error)
      toastError(`Could not save caption: ${error.message}`)
    }
    setEditingCaption(null)
    setCaptionText('')
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this image?')) return

    const snapshot = images
    const prevSelected = selectedImage
    setImages(images.filter(img => img.id !== id))
    if (selectedImage?.id === id) {
      setSelectedImage(null)
    }
    try {
      await apiFetch(`${API_URL}/api/inspo/${id}`, { method: 'DELETE' })
    } catch (error) {
      console.error('Error deleting image:', error)
      setImages(snapshot)
      setSelectedImage(prevSelected)
      toastError(`Could not delete image: ${error.message}`)
    }
  }

  // Only the person who uploaded an image, or an admin, can delete it — a
  // venue viewing a couple's gallery used to see delete on every photo,
  // including ones it never uploaded.
  const canDelete = (image) => isAdmin || (!!userId && image.uploaded_by === userId)

  // Up/down swaps display_order with the visible neighbour (respecting the
  // active category filter, since that's the order the couple is looking at)
  // and writes both rows through the gallery's existing PUT route.
  const handleReorder = async (image, direction) => {
    const list = filteredImages
    const idx = list.findIndex(img => img.id === image.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx === -1 || swapIdx < 0 || swapIdx >= list.length) return
    const other = list[swapIdx]
    const aOrder = image.display_order
    const bOrder = other.display_order
    const snapshot = images
    setImages(prev => prev.map(img => {
      if (img.id === image.id) return { ...img, display_order: bOrder }
      if (img.id === other.id) return { ...img, display_order: aOrder }
      return img
    }))
    try {
      await Promise.all([
        apiFetch(`${API_URL}/api/inspo/${image.id}`, { method: 'PUT', body: JSON.stringify({ displayOrder: bOrder }) }),
        apiFetch(`${API_URL}/api/inspo/${other.id}`, { method: 'PUT', body: JSON.stringify({ displayOrder: aOrder }) }),
      ])
    } catch (error) {
      console.error('Error reordering images:', error)
      setImages(snapshot)
      toastError(`Could not reorder images: ${error.message}`)
    }
  }

  if (loading) {
    return <div className="text-sage-400 text-center py-4">Loading gallery...</div>
  }

  if (loadError) {
    return <LoadError what="the inspiration gallery" error={loadError} onRetry={loadImages} />
  }

  const filteredImages = activeCategory === 'All'
    ? images
    : activeCategory === 'Other'
      ? images.filter(img => !img.category || img.category === 'Other')
      : images.filter(img => img.category === activeCategory)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-sage-600">
          {images.length} / {maxImages} images
        </p>
        {images.length < maxImages && (
          <div className="flex items-center gap-2">
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="text-xs border border-cream-200 rounded-lg px-2 py-1 text-sage-600 focus:outline-none focus:border-sage-400"
            >
              {CATEGORIES.filter(c => c !== 'All').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
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
          </div>
        )}
      </div>

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
                {cat === 'Other'
                  ? images.filter(i => !i.category || i.category === 'Other').length
                  : images.filter(i => i.category === cat).length}
              </span>
            )}
          </button>
        ))}
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
      ) : filteredImages.length === 0 ? (
        <div className="text-center py-8 text-sage-400 text-sm">
          No images in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {filteredImages.map((image, i) => (
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
              <div className="absolute top-1 left-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReorder(image, 'up') }}
                  disabled={i === 0}
                  className="w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move earlier"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReorder(image, 'down') }}
                  disabled={i === filteredImages.length - 1}
                  className="w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move later"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
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
            className="w-full max-w-3xl max-h-[90vh] bg-white rounded-lg overflow-hidden mx-2"
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
                    {canDelete(selectedImage) && (
                      <button
                        onClick={() => handleDelete(selectedImage.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    )}
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
