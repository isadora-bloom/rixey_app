import { useState, useEffect } from 'react'
import { Save, Check } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const defaultDetails = {
  wedding_colors: '',
  partner1_social: '',
  partner2_social: '',
  dogs_coming: null,
  dog_info: '',
  ceremony_location: null,
  arbor: null,
  unity_table: null,
  ceremony_notes: '',
  seating_method: '',
  providing_table_numbers: null,
  providing_charger_plates: null,
  providing_champagne_glasses: null,
  providing_cake_cutter: null,
  providing_cake_topper: null,
  favors: '',
  reception_notes: '',
  sendoff_type: null,
  sendoff_notes: '',
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const optValue = typeof opt === 'string' ? opt : opt.value
        const optLabel = typeof opt === 'string' ? opt : opt.label
        const isSelected = value === optValue
        return (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(isSelected ? null : optValue)}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              isSelected
                ? 'bg-sage-600 text-white border-sage-600'
                : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
            }`}
          >
            {optLabel}
          </button>
        )
      })}
    </div>
  )
}

function YesNoToggle({ value, onChange }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(value === true ? null : true)}
        className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
          value === true
            ? 'bg-sage-600 text-white border-sage-600'
            : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(value === false ? null : false)}
        className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
          value === false
            ? 'bg-sage-600 text-white border-sage-600'
            : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
        }`}
      >
        No
      </button>
    </div>
  )
}

function SmallYesNoRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-cream-100 last:border-b-0">
      <span className="text-sm text-sage-700">{label}</span>
      <YesNoToggle value={value} onChange={onChange} />
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
      <div className="px-6 py-4 bg-cream-50 border-b border-cream-200">
        <h2 className="text-base font-semibold text-sage-700">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-sage-600">{label}</label>
      {children}
    </div>
  )
}

export default function WeddingDetails({ weddingId, userId }) {
  const [details, setDetails] = useState(defaultDetails)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!weddingId) return
    setLoading(true)
    fetch(`${API_URL}/api/wedding-details/${weddingId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setDetails({ ...defaultDetails, ...data })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [weddingId])

  const set = (field) => (val) =>
    setDetails((prev) => ({ ...prev, [field]: val }))

  const setInput = (field) => (e) =>
    setDetails((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/wedding-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId, userId, ...details }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sage-400 text-sm">
        Loading wedding details…
      </div>
    )
  }

  return (
    <div className="pb-24 space-y-6">
      {/* The Basics */}
      <SectionCard title="The Basics">
        <FieldRow label="Wedding colors">
          <input
            type="text"
            value={details.wedding_colors}
            onChange={setInput('wedding_colors')}
            placeholder="e.g. dusty blue, sage green, ivory"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
        </FieldRow>

        <FieldRow label="Partner 1 Instagram / social handle">
          <input
            type="text"
            value={details.partner1_social}
            onChange={setInput('partner1_social')}
            placeholder="@handle"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
        </FieldRow>

        <FieldRow label="Partner 2 Instagram / social handle">
          <input
            type="text"
            value={details.partner2_social}
            onChange={setInput('partner2_social')}
            placeholder="@handle"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
        </FieldRow>

        <FieldRow label="Are dogs coming?">
          <YesNoToggle value={details.dogs_coming} onChange={set('dogs_coming')} />
        </FieldRow>

        {details.dogs_coming === true && (
          <FieldRow label="Breed & name">
            <input
              type="text"
              value={details.dog_info}
              onChange={setInput('dog_info')}
              placeholder="e.g. Rosie the golden retriever"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          </FieldRow>
        )}
      </SectionCard>

      {/* Ceremony */}
      <SectionCard title="Ceremony">
        <FieldRow label="Location">
          <ToggleGroup
            options={['Outside', 'Inside']}
            value={details.ceremony_location}
            onChange={set('ceremony_location')}
          />
        </FieldRow>

        <FieldRow label="Arbor">
          <ToggleGroup
            options={['White Birch', 'Hexagon', 'Other']}
            value={details.arbor}
            onChange={set('arbor')}
          />
        </FieldRow>

        <FieldRow label="Unity table?">
          <YesNoToggle value={details.unity_table} onChange={set('unity_table')} />
        </FieldRow>

        <FieldRow label="Ceremony notes">
          <textarea
            rows={2}
            value={details.ceremony_notes}
            onChange={setInput('ceremony_notes')}
            placeholder="Anything the team should know about your ceremony…"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
          />
        </FieldRow>
      </SectionCard>

      {/* Reception */}
      <SectionCard title="Reception">
        <FieldRow label="How are guests finding their seats?">
          <input
            type="text"
            value={details.seating_method}
            onChange={setInput('seating_method')}
            placeholder="e.g. escort cards on the arch, open seating, seating chart board"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
        </FieldRow>

        <div className="rounded-lg border border-cream-200 divide-y divide-cream-100 px-4">
          <SmallYesNoRow
            label="Providing table numbers"
            value={details.providing_table_numbers}
            onChange={set('providing_table_numbers')}
          />
          <SmallYesNoRow
            label="Providing charger plates"
            value={details.providing_charger_plates}
            onChange={set('providing_charger_plates')}
          />
          <SmallYesNoRow
            label="Providing champagne glasses"
            value={details.providing_champagne_glasses}
            onChange={set('providing_champagne_glasses')}
          />
          <SmallYesNoRow
            label="Providing cake cutter"
            value={details.providing_cake_cutter}
            onChange={set('providing_cake_cutter')}
          />
          <SmallYesNoRow
            label="Providing cake topper"
            value={details.providing_cake_topper}
            onChange={set('providing_cake_topper')}
          />
        </div>

        <FieldRow label="Favors / guest gifts">
          <textarea
            rows={2}
            value={details.favors}
            onChange={setInput('favors')}
            placeholder="Describe any favors or gifts for guests"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
          />
        </FieldRow>

        <FieldRow label="Reception notes">
          <textarea
            rows={2}
            value={details.reception_notes}
            onChange={setInput('reception_notes')}
            placeholder="Anything else about the reception…"
            className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
          />
        </FieldRow>
      </SectionCard>

      {/* Send-Off */}
      <SectionCard title="Send-Off">
        <FieldRow label="Send-off type">
          <ToggleGroup
            options={['Sparklers', 'Wands', 'Bubbles', 'None', 'Other']}
            value={details.sendoff_type}
            onChange={set('sendoff_type')}
          />
        </FieldRow>

        {details.sendoff_type && details.sendoff_type !== 'None' && (
          <FieldRow label="Send-off notes">
            <input
              type="text"
              value={details.sendoff_notes}
              onChange={setInput('sendoff_notes')}
              placeholder="Any details about the send-off…"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          </FieldRow>
        )}
      </SectionCard>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cream-200 px-6 py-3 flex items-center justify-end gap-3 z-20 lg:pl-64">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-sage-600">
            <Check size={15} />
            Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50 transition-colors"
        >
          <Save size={15} />
          {saving ? 'Saving…' : 'Save Details'}
        </button>
      </div>
    </div>
  )
}
