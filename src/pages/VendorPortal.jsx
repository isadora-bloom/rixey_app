import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { API_URL } from '../config/api'
import { authHeaders, apiFetch } from '../utils/api'
import { shrinkImageForUpload } from '../utils/image'
import { useToast } from '../components/ui/Toast'
import ConfirmDialog from '../components/ui/ConfirmDialog'


export default function VendorPortal() {
  const { error: toastError } = useToast()
  const { token } = useParams()
  const [vendor, setVendor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photos, setPhotos] = useState([])
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [photoToRemove, setPhotoToRemove] = useState(null)
  const logoInputRef = useRef()
  const photoInputRef = useRef()

  useEffect(() => {
    authHeaders().then(hdrs => fetch(`${API_URL}/api/vendor-portal/${token}`, { headers: hdrs }))
      .then(r => {
        // A dead link and a server having a bad moment used to look
        // identical: both landed a vendor on "Link not found", which sent
        // them straight to us asking for a fresh one they didn't need.
        if (r.status === 404) { setNotFound(true); return null }
        if (!r.ok) { setLoadError(true); return null }
        return r.json()
      })
      .then(d => {
        if (!d) return
        if (!d.vendor) { setNotFound(true); return }
        setVendor(d.vendor)
        setPhotos(d.vendor.photos || [])
        setForm({
          bio: d.vendor.bio || '',
          contact: d.vendor.contact || '',
          website: d.vendor.website || '',
          pricing_info: d.vendor.pricing_info || '',
          instagram: d.vendor.instagram || '',
          facebook: d.vendor.facebook || '',
          special_offer: d.vendor.special_offer || '',
          special_expiry: d.vendor.special_expiry || '',
          availability_note: d.vendor.availability_note || '',
        })
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [token])

  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const data = await apiFetch(`${API_URL}/api/vendor-portal/${token}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      setVendor(data.vendor)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError(err.message)
      toastError(`Could not save profile: ${err.message}`)
    }
    setSaving(false)
  }

  const uploadPhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (photos.length >= 8) { alert('Maximum 8 photos allowed'); return }
    setUploadingPhoto(true)
    const fd = new FormData()
    fd.append('photo', await shrinkImageForUpload(file))
    try {
      const data = await apiFetch(`${API_URL}/api/vendor-portal/${token}/photos`, { method: 'POST', body: fd })
      setPhotos(data.photos)
      // Uploading can be the thing that puts them live, so the badge in the
      // header has to hear about it.
      if (data.is_published !== undefined) setVendor(v => ({ ...v, is_published: data.is_published }))
    } catch (err) {
      toastError(`Photo upload failed: ${err.message}`)
    }
    setUploadingPhoto(false)
    e.target.value = ''
  }

  const uploadLogo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingLogo(true)
    const fd = new FormData()
    fd.append('logo', await shrinkImageForUpload(file))
    try {
      const data = await apiFetch(`${API_URL}/api/vendor-portal/${token}/logo`, { method: 'POST', body: fd })
      if (data?.vendor) setVendor(data.vendor)
      else if (data?.logo_url) setVendor(v => ({ ...v, logo_url: data.logo_url }))
    } catch (err) {
      toastError(`Logo upload failed: ${err.message}`)
    }
    setUploadingLogo(false)
    e.target.value = ''
  }

  const removePhoto = async (url) => {
    const snapshot = photos
    setPhotos(prev => prev.filter(p => p !== url))
    try {
      const data = await apiFetch(`${API_URL}/api/vendor-portal/${token}/photos`, {
        method: 'DELETE',
        body: JSON.stringify({ url }),
      })
      setPhotos(data.photos)
    } catch (err) {
      setPhotos(snapshot)
      toastError(`Failed to remove photo: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <p className="text-sage-400">Loading your profile…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-sage-700 font-medium mb-2">Link not found</p>
          <p className="text-sage-400 text-sm">This link may be invalid or expired. Contact Rixey Manor to get a fresh one.</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-sage-700 font-medium mb-2">Could not load your profile</p>
          <p className="text-sage-400 text-sm mb-4">Something went wrong on our end. Your link is fine — try reloading.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm px-4 py-2 bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  const f = (field, val) => setForm(prev => ({ ...prev, [field]: val }))
  const lastUpdated = vendor.last_vendor_update
    ? new Date(vendor.last_vendor_update).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="bg-white border-b border-cream-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <img src="/rixey-manor-logo-optimized.png" alt="Rixey Manor" className="h-10 w-auto mb-1" />
            <p className="text-sage-400 text-xs">Vendor Partner Portal</p>
          </div>
          {vendor.is_published === true && (
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">Live to couples</span>
          )}
          {vendor.is_published === false && (
            <span className="text-xs bg-cream-200 text-sage-600 px-3 py-1 rounded-full font-medium">Not showing</span>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-serif text-sage-800">{vendor.name}</h1>
          <p className="text-sage-500 text-sm mt-0.5">{vendor.category} · Keep your profile up to date so Rixey couples can find you</p>
          {lastUpdated && <p className="text-sage-400 text-xs mt-1">Last saved {lastUpdated}</p>}
        </div>

        {/* Business Info */}
        <section className="bg-white rounded-2xl shadow-sm border border-cream-200 p-5 space-y-4">
          <h2 className="font-semibold text-sage-700">About Your Business</h2>

          <div>
            <label className="block text-xs font-medium text-sage-600 mb-1">Bio / Description</label>
            <textarea
              className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
              rows={4}
              value={form.bio}
              onChange={e => f('bio', e.target.value)}
              placeholder="Tell couples a bit about your style, experience, and what makes you special…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Contact (email or phone)</label>
              <input
                className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.contact}
                onChange={e => f('contact', e.target.value)}
                placeholder="hello@yourbusiness.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Website</label>
              <input
                className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.website}
                onChange={e => f('website', e.target.value)}
                placeholder="https://yourbusiness.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Instagram</label>
              <input
                className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.instagram}
                onChange={e => f('instagram', e.target.value)}
                placeholder="@yourbusiness"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Facebook</label>
              <input
                className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.facebook}
                onChange={e => f('facebook', e.target.value)}
                placeholder="facebook.com/yourbusiness"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-sage-600 mb-1">Pricing Info</label>
            <input
              className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              value={form.pricing_info}
              onChange={e => f('pricing_info', e.target.value)}
              placeholder="e.g. Packages from $2,500 · Full-day coverage available"
            />
          </div>
        </section>

        {/* Logo */}
        <section className="bg-white rounded-2xl shadow-sm border border-cream-200 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-sage-700">Your Logo</h2>
              <p className="text-xs text-sage-400 mt-0.5">Shown beside your name in the couples&apos; directory</p>
            </div>
            {/* No SVG here: the server's upload filter refuses it (an SVG can
                carry script and this bucket is served publicly off Rixey's
                own origin — see server/index.js), so offering it just sent a
                vendor's file straight into a confusing 400. */}
            <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadLogo} />
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="text-sm px-4 py-2 bg-sage-600 text-white rounded-xl hover:bg-sage-700 disabled:opacity-50 transition shrink-0"
            >
              {uploadingLogo ? 'Uploading…' : vendor.logo_url ? 'Replace logo' : '+ Add logo'}
            </button>
          </div>
          {vendor.logo_url ? (
            <div className="mt-4 w-24 h-24 rounded-xl overflow-hidden bg-cream-50 border border-cream-200 flex items-center justify-center">
              <img src={vendor.logo_url} alt={`${vendor.name} logo`} className="w-full h-full object-contain" />
            </div>
          ) : (
            <p className="mt-4 text-sage-400 text-sm">No logo uploaded yet.</p>
          )}
        </section>

        {/* Photos */}
        <section className="bg-white rounded-2xl shadow-sm border border-cream-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sage-700">Photos</h2>
              <p className="text-xs text-sage-400 mt-0.5">Up to 8 photos · JPG or PNG, max 5MB each</p>
            </div>
            {photos.length < 8 && (
              <>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadPhoto} />
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="text-sm px-4 py-2 bg-sage-600 text-white rounded-xl hover:bg-sage-700 disabled:opacity-50 transition"
                >
                  {uploadingPhoto ? 'Uploading…' : '+ Add Photo'}
                </button>
              </>
            )}
          </div>

          {photos.length === 0 ? (
            <div
              onClick={() => !uploadingPhoto && photoInputRef.current?.click()}
              className="border-2 border-dashed border-cream-300 rounded-xl p-10 text-center cursor-pointer hover:border-sage-300 transition"
            >
              <p className="text-sage-400 text-sm">Click to upload your first photo</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {photos.map((url, i) => (
                <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-cream-100">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotoToRemove(url)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Rixey Special */}
        <section className="bg-white rounded-2xl shadow-sm border border-cream-200 p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-sage-700">Special Offer for Rixey Couples</h2>
            <p className="text-xs text-sage-400 mt-0.5">Optional — shown as a highlight on your profile</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-sage-600 mb-1">Offer Details</label>
            <input
              className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              value={form.special_offer}
              onChange={e => f('special_offer', e.target.value)}
              placeholder="e.g. 10% off for Rixey couples booking 2026"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-sage-600 mb-1">Offer expires (optional)</label>
            <input
              type="date"
              className="border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
              value={form.special_expiry}
              onChange={e => f('special_expiry', e.target.value)}
            />
          </div>
        </section>

        {/* Availability */}
        <section className="bg-white rounded-2xl shadow-sm border border-cream-200 p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-sage-700">Availability</h2>
            <p className="text-xs text-sage-400 mt-0.5">Let couples know what dates or seasons you're booking</p>
          </div>
          <textarea
            className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
            rows={3}
            value={form.availability_note}
            onChange={e => f('availability_note', e.target.value)}
            placeholder="e.g. Booking Fall 2026 and Spring 2027 · A few dates still open in Summer 2026"
          />
        </section>

        {/* Save */}
        <div className="pb-8">
          {saveError && <p className="text-red-500 text-sm mb-3">{saveError}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3 bg-sage-600 text-white rounded-2xl font-medium hover:bg-sage-700 disabled:opacity-50 transition text-sm"
          >
            {saving ? 'Saving…' : saved ? '✓ Profile saved' : 'Save Profile'}
          </button>
          <p className="text-xs text-sage-400 text-center mt-3">
            {vendor.is_published === false
              ? 'Your profile is not currently showing in the couples’ directory. Get in touch with us if that is a surprise.'
              : 'Whatever you save here goes straight into the directory Rixey couples browse.'}
          </p>
        </div>
      </main>

      <ConfirmDialog
        open={!!photoToRemove}
        onClose={() => setPhotoToRemove(null)}
        onConfirm={() => { const url = photoToRemove; setPhotoToRemove(null); if (url) removePhoto(url) }}
        danger
        title="Remove this photo?"
        message="It comes out of your directory listing right away."
        confirmLabel="Remove photo"
      />
    </div>
  )
}
