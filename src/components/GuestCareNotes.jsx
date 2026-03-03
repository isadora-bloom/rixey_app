import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const SECTIONS = [
  {
    key: 'children',
    icon: '👶',
    question: 'Will children be attending your wedding?',
    placeholder: 'How many, roughly what ages? Are they your own children, guests\' kids, or both? Any high chairs or a dedicated kids\' table needed?',
  },
  {
    key: 'mobility',
    icon: '♿',
    question: 'Do any guests use a wheelchair, walker, or cane — or have difficulty with stairs or uneven ground?',
    placeholder: 'Tell us who and anything we should prepare: reserved accessible parking, seating near paths, avoiding steps, etc.',
  },
  {
    key: 'vision_hearing',
    icon: '👁',
    question: 'Do any guests have vision or hearing impairments?',
    placeholder: 'Anything we should know to help them feel comfortable and fully included in the day?',
  },
  {
    key: 'sensory',
    icon: '🌿',
    question: 'Do any guests have sensory sensitivities — things like loud music, bright lights, or busy environments that can feel overwhelming?',
    placeholder: 'We can arrange a quiet space to step away to, give you a heads-up before loud moments like the send-off, or adjust how we manage certain areas. Just tell us what would help.',
  },
  {
    key: 'dietary',
    icon: '🍽',
    question: 'Any dietary restrictions or food allergies among your guests?',
    placeholder: 'Even if your caterer already knows, we like to have this too — especially severe allergies (nuts, shellfish, etc.) and whether anyone carries an EpiPen.',
  },
  {
    key: 'sobriety',
    icon: '🥤',
    question: 'Do you have guests who are sober or would prefer not to be offered alcohol?',
    placeholder: 'We can handle bar service discreetly, arrange a non-alcoholic area, or simply make sure staff know not to offer certain guests drinks. No explanation needed — just let us know.',
  },
  {
    key: 'elderly',
    icon: '🤍',
    question: 'Any elderly or frail guests who might appreciate a little extra looking after?',
    placeholder: 'Grandparents, anyone who might tire easily and need a comfortable place to rest, or someone you\'d like us to quietly check in on throughout the day?',
  },
  {
    key: 'medical',
    icon: '🏥',
    question: 'Does anyone have a medical condition our staff should know about in case of an emergency?',
    placeholder: 'Severe allergies with an EpiPen, epilepsy, heart conditions, diabetes — anything that helps us be prepared. This stays with us.',
  },
  {
    key: 'service_animals',
    icon: '🐕',
    question: 'Will any guests be accompanied by a service animal?',
    placeholder: 'Just let us know so we can make sure the space is set up and ready.',
  },
  {
    key: 'family_dynamics',
    icon: '👨‍👩‍👧',
    question: 'Any family dynamics we should quietly be aware of?',
    placeholder: 'Divorced parents who need to be on opposite sides of the room, estranged relatives, anyone who might need a little extra care or a gentle eye kept on the situation?',
  },
  {
    key: 'other',
    icon: '💬',
    question: 'Anything else we should know about your guests?',
    placeholder: 'Anything at all that would help us take the very best care of the people you love most.',
    alwaysOpen: true,
  },
]

const EMPTY_SECTION = { has: null, notes: '' }

function buildDefault() {
  const d = {}
  SECTIONS.forEach(s => { d[s.key] = { ...EMPTY_SECTION } })
  return d
}

function merge(saved) {
  const base = buildDefault()
  if (!saved) return base
  SECTIONS.forEach(s => {
    if (saved[s.key]) base[s.key] = { ...EMPTY_SECTION, ...saved[s.key] }
  })
  return base
}

export default function GuestCareNotes({ weddingId }) {
  const [formData, setFormData] = useState(buildDefault())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!weddingId) return
    fetch(`${API_URL}/api/guest-care/${weddingId}`)
      .then(r => r.json())
      .then(({ data, updated_at }) => {
        setFormData(merge(data))
        setSavedAt(updated_at)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [weddingId])

  const setHas = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: { ...prev[key], has: val } }))
    setDirty(true)
  }

  const setNotes = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: { ...prev[key], notes: val } }))
    setDirty(true)
  }

  const save = async () => {
    if (!weddingId) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/guest-care`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId, data: formData }),
      })
      const result = await res.json()
      if (result.success) {
        setSavedAt(new Date().toISOString())
        setDirty(false)
      }
    } catch (err) {
      console.error('Failed to save guest care:', err)
    }
    setSaving(false)
  }

  const filledCount = SECTIONS.filter(s => formData[s.key]?.has === true || (s.alwaysOpen && formData[s.key]?.notes)).length

  if (loading) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-cream-100">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-sage-700">Guest Care Notes</h2>
          {filledCount > 0 && (
            <span className="text-xs bg-sage-50 text-sage-600 border border-sage-200 px-2.5 py-1 rounded-full">
              {filledCount} {filledCount === 1 ? 'note' : 'notes'} added
            </span>
          )}
        </div>
        <p className="text-sage-400 text-sm mt-1">
          Help us take care of your people. The more you share, the better we can prepare for your day.
        </p>
      </div>

      {/* Sections */}
      <div className="divide-y divide-cream-100">
        {SECTIONS.map(section => {
          const val = formData[section.key]
          const isYes = val?.has === true
          const showTextarea = section.alwaysOpen || isYes

          return (
            <div key={section.key} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5 flex-shrink-0">{section.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sage-700 leading-snug mb-2">{section.question}</p>

                  {/* Yes / No toggles */}
                  {!section.alwaysOpen && (
                    <div className="flex gap-2 mb-2">
                      {[{ label: 'Yes', val: true }, { label: 'No', val: false }].map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => setHas(section.key, val?.has === opt.val ? null : opt.val)}
                          className={`px-4 py-1 rounded-full text-sm font-medium border transition ${
                            val?.has === opt.val
                              ? opt.val
                                ? 'bg-sage-600 text-white border-sage-600'
                                : 'bg-cream-200 text-sage-600 border-cream-300'
                              : 'bg-white text-sage-400 border-cream-200 hover:border-sage-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Notes textarea */}
                  {showTextarea && (
                    <textarea
                      value={val?.notes || ''}
                      onChange={e => setNotes(section.key, e.target.value)}
                      placeholder={section.placeholder}
                      rows={3}
                      className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2 text-sage-700 placeholder-sage-300 focus:outline-none focus:border-sage-400 resize-none"
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Save footer */}
      <div className="px-5 py-4 border-t border-cream-100 flex items-center justify-between gap-4">
        <p className="text-xs text-sage-400">
          {savedAt
            ? `Last saved ${new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            : 'Not saved yet'}
        </p>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-5 py-2 bg-sage-600 hover:bg-sage-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition"
        >
          {saving ? 'Saving…' : 'Save Notes'}
        </button>
      </div>
    </div>
  )
}
