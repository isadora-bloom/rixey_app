import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const FIELDS = [
  { key: 'venue_name',        label: 'Venue name',             placeholder: 'Rixey Manor',                type: 'text' },
  { key: 'tagline',           label: 'Tagline',                placeholder: 'Set on 38 acres…',           type: 'text' },
  { key: 'address_line1',     label: 'Address line 1',         placeholder: '6359 Rapidan Rd',            type: 'text' },
  { key: 'address_line2',     label: 'Address line 2',         placeholder: 'Leon, VA 22725',             type: 'text' },
  { key: 'google_maps_url',   label: 'Google Maps link',       placeholder: 'https://maps.google.com/…', type: 'url' },
  { key: 'parking_note',      label: 'Parking instructions',   placeholder: 'Free parking on site…',     type: 'textarea' },
  { key: 'arrival_note',      label: 'Arrival note',           placeholder: 'Allow extra time…',          type: 'textarea' },
  { key: 'cell_service_note', label: 'Cell service note',      placeholder: 'Signal can be patchy…',     type: 'textarea' },
  { key: 'venue_description', label: 'Venue description',      placeholder: 'A few sentences about the venue…', type: 'textarea' },
  { key: 'website_url',       label: 'Venue website',          placeholder: 'https://rixeymanor.com',    type: 'url' },
  { key: 'logo_url',          label: 'Logo URL',               placeholder: 'https://…/logo.png',        type: 'url' },
  { key: 'footer_credit',     label: 'Footer credit text',     placeholder: 'Hosted by Rixey Manor',     type: 'text' },
]

export default function VenueSettings() {
  const [values, setValues]   = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/venue-settings`)
      const data = await res.json()
      setValues(data || {})
    } catch (err) {
      console.error('Failed to load venue settings:', err)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/venue-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Save error:', err)
    }
    setSaving(false)
  }

  const set = (key, val) => setValues(prev => ({ ...prev, [key]: val }))

  if (loading) return <p className="text-sage-400 text-center py-8">Loading venue settings…</p>

  return (
    <div className="max-w-2xl space-y-6">

      <div>
        <h2 className="font-serif text-xl text-sage-700">Venue Settings</h2>
        <p className="text-sage-500 text-sm mt-1">
          This information appears on every couple's public wedding website.
          Change it here and it updates everywhere — no code changes needed.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <strong>White-label ready.</strong> When you set up additional venues, each gets their own row here.
        Everything couples see on their website will reflect their venue automatically.
      </div>

      <div className="space-y-4">
        {FIELDS.map(({ key, label, placeholder, type }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-sage-600 mb-1">{label}</label>
            {type === 'textarea' ? (
              <textarea
                value={values[key] || ''}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                rows={2}
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
              />
            ) : (
              <input
                type={type}
                value={values[key] || ''}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {saved && <span className="text-sm text-green-600 font-medium">Saved ✓</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save venue settings'}
        </button>
      </div>
    </div>
  )
}
