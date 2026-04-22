import { useState, useEffect } from 'react'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'

const RSVP_FIELDS = [
  { key: 'ask_dietary', label: 'Dietary restrictions / allergies', default: true },
  { key: 'ask_phone', label: 'Phone number', default: false },
  { key: 'ask_email', label: 'Email address', default: false },
  { key: 'ask_address', label: 'Mailing address', default: false },
  { key: 'ask_hotel', label: 'Hotel preference', default: false },
  { key: 'ask_shuttle', label: 'Shuttle preference', default: false },
  { key: 'ask_accessibility', label: 'Accessibility needs', default: false },
  { key: 'ask_song', label: 'Song request', default: false },
  { key: 'ask_message', label: 'Message to the couple', default: false },
]

export default function RsvpSettings({ weddingId }) {
  const [config, setConfig] = useState({})
  const [customQuestions, setCustomQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!weddingId) return
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/wedding-website/${weddingId}`, { headers: await authHeaders() })
        const data = await res.json()
        if (data?.rsvp_config) {
          setConfig(data.rsvp_config.fields || {})
          setCustomQuestions(data.rsvp_config.custom_questions || [])
        }
      } catch {}
      setLoading(false)
    })()
  }, [weddingId])

  const toggle = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/wedding-website/${weddingId}`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({
          rsvp_config: {
            fields: config,
            custom_questions: customQuestions.filter(q => q.label.trim()),
          },
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  const addCustomQuestion = () => {
    setCustomQuestions(prev => [...prev, { label: '', type: 'text', options: '' }])
  }

  const updateQuestion = (idx, field, value) => {
    setCustomQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }

  const removeQuestion = (idx) => {
    setCustomQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  if (loading) return <div className="text-sage-500 text-center py-8">Loading RSVP settings...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl text-sage-700">RSVP Settings</h2>
          <p className="text-sage-600 text-sm">Choose what guests are asked when they RSVP on your website</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-green-600 text-xs">Saved</span>}
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm font-medium hover:bg-sage-700 disabled:opacity-50 transition">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <p className="text-sage-600 text-xs bg-sage-50 rounded-lg px-4 py-3 border border-sage-200">
        Attending/not attending and meal choice (if plated) are always included. Toggle the extra fields below.
      </p>

      {/* Field toggles */}
      <div className="border border-cream-200 rounded-xl divide-y divide-cream-100">
        {RSVP_FIELDS.map(field => {
          const isOn = config[field.key] !== undefined ? config[field.key] : field.default
          return (
            <div key={field.key} className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-sage-700">{field.label}</span>
              <div
                onClick={() => toggle(field.key)}
                className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer relative ${isOn ? 'bg-sage-500' : 'bg-cream-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Custom questions */}
      <div className="border border-cream-200 rounded-xl overflow-hidden">
        <div className="bg-cream-50 px-5 py-3 border-b border-cream-200 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sage-700 text-sm">Custom Questions</h3>
            <p className="text-xs text-sage-500 mt-0.5">Add your own questions to the RSVP form</p>
          </div>
          <button onClick={addCustomQuestion}
            className="text-xs px-3 py-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition">
            + Add
          </button>
        </div>
        {customQuestions.length === 0 ? (
          <p className="text-sage-400 text-sm text-center py-6">No custom questions yet</p>
        ) : (
          <div className="divide-y divide-cream-100">
            {customQuestions.map((q, idx) => (
              <div key={idx} className="px-5 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={q.label}
                    onChange={e => updateQuestion(idx, 'label', e.target.value)}
                    placeholder="Question text"
                    className="flex-1 px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  />
                  <select
                    value={q.type}
                    onChange={e => updateQuestion(idx, 'type', e.target.value)}
                    className="px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  >
                    <option value="text">Text</option>
                    <option value="select">Dropdown</option>
                    <option value="boolean">Yes / No</option>
                  </select>
                  <button onClick={() => removeQuestion(idx)}
                    className="text-sage-300 hover:text-red-500 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {q.type === 'select' && (
                  <input
                    type="text"
                    value={q.options || ''}
                    onChange={e => updateQuestion(idx, 'options', e.target.value)}
                    placeholder="Options (comma-separated, e.g. Hotel A, Hotel B, Airbnb)"
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sage-300"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
