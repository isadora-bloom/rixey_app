import { useState, useEffect } from 'react'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'
import SaveIndicator from './ui/SaveIndicator'
const SaveIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
const CheckIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>


const defaultDetails = {
  // The Basics
  wedding_colors: '',
  partner1_social: '',
  partner2_social: '',
  partner1_parents: '',
  partner1_parents_met: null,
  partner2_parents: '',
  partner2_parents_met: null,
  wedding_party_count_1: '',
  wedding_party_count_2: '',
  dogs_coming: null,
  dogs_description: '',
  dog_sitter_name: '',
  dog_sitter_time: '',
  // Contract terms
  contract_checkin: '',
  contract_checkout: '',
  contract_max_rehearsal: '',
  contract_max_wedding: '',
  contract_overnights: '',
  contract_rehearsal_hours: '',
  contract_wedding_hours: '',
  // Ceremony
  ceremony_location: null,
  arbor_choice: null,
  unity_table: null,
  ceremony_notes: '',
  // Reception
  seating_method: '',
  providing_table_numbers: null,
  providing_charger_plates: null,
  providing_champagne_glasses: null,
  providing_cake_cutter: null,
  providing_cake_cutter_notes: '',
  providing_cake_topper: null,
  high_chairs_needed: null,
  high_chairs_count: '',
  favors_description: '',
  reception_notes: '',
  // Send-off
  send_off_type: null,
  send_off_notes: '',
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
  const [saveError, setSaveError] = useState(null)
  const [saveState, setSaveState] = useState('idle')

  useEffect(() => {
    if (!weddingId) return
    setLoading(true)
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/wedding-details/${weddingId}`, {
          headers: await authHeaders()
        })
        const data = await res.json()
        if (data && !data.error) {
          setDetails({ ...defaultDetails, ...data })
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [weddingId])

  const set = (field) => (val) =>
    setDetails((prev) => ({ ...prev, [field]: val }))

  const setInput = (field) => (e) =>
    setDetails((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaveState('saving')
    try {
      const res = await fetch(`${API_URL}/api/wedding-details`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ weddingId, userId, ...details }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      setSaved(true)
      setSaveState('saved')
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error(err)
      setSaveError('Save failed — please try again.')
      setSaveState('idle')
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow label="Partner 1's parents">
            <input type="text" value={details.partner1_parents} onChange={setInput('partner1_parents')}
              placeholder="e.g. Susan and Scott Gibney"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-sage-500">Have we met them?</span>
              <YesNoToggle value={details.partner1_parents_met} onChange={set('partner1_parents_met')} />
            </div>
          </FieldRow>
          <FieldRow label="Partner 2's parents">
            <input type="text" value={details.partner2_parents} onChange={setInput('partner2_parents')}
              placeholder="e.g. Anja Putman, Jay Kennedy"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-sage-500">Have we met them?</span>
              <YesNoToggle value={details.partner2_parents_met} onChange={set('partner2_parents_met')} />
            </div>
          </FieldRow>
        </div>

        <FieldRow label="Wedding party count (per side)">
          <div className="flex items-center gap-3">
            <input type="number" min="0" max="20" value={details.wedding_party_count_1}
              onChange={setInput('wedding_party_count_1')} placeholder="Side 1"
              className="w-24 border border-cream-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sage-300" />
            <span className="text-sage-400">+</span>
            <input type="number" min="0" max="20" value={details.wedding_party_count_2}
              onChange={setInput('wedding_party_count_2')} placeholder="Side 2"
              className="w-24 border border-cream-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sage-300" />
          </div>
        </FieldRow>

        <FieldRow label="Are dogs coming?">
          <YesNoToggle value={details.dogs_coming} onChange={set('dogs_coming')} />
        </FieldRow>

        {details.dogs_coming === true && (
          <>
            <FieldRow label="Breed & name">
              <input type="text" value={details.dogs_description} onChange={setInput('dogs_description')}
                placeholder="e.g. Captain - Golden Retriever - 4 years old"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
            </FieldRow>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldRow label="Dog sitter name">
                <input type="text" value={details.dog_sitter_name} onChange={setInput('dog_sitter_name')}
                  placeholder="e.g. Piper"
                  className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
              </FieldRow>
              <FieldRow label="Dog sitter time">
                <input type="text" value={details.dog_sitter_time} onChange={setInput('dog_sitter_time')}
                  placeholder="e.g. 3:45 PM - end of night"
                  className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
              </FieldRow>
            </div>
          </>
        )}
      </SectionCard>

      {/* Contract Terms */}
      <SectionCard title="Per Current Contract">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <FieldRow label="Check-in time">
            <input type="text" value={details.contract_checkin} onChange={setInput('contract_checkin')}
              placeholder="e.g. 3:00 PM Friday"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
          </FieldRow>
          <FieldRow label="Check-out time">
            <input type="text" value={details.contract_checkout} onChange={setInput('contract_checkout')}
              placeholder="e.g. 1:00 PM Sunday"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
          </FieldRow>
          <FieldRow label="Max rehearsal guests">
            <input type="number" value={details.contract_max_rehearsal} onChange={setInput('contract_max_rehearsal')}
              placeholder="e.g. 50"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
          </FieldRow>
          <FieldRow label="Max wedding guests">
            <input type="number" value={details.contract_max_wedding} onChange={setInput('contract_max_wedding')}
              placeholder="e.g. 200"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
          </FieldRow>
          <FieldRow label="Overnights booked">
            <input type="number" value={details.contract_overnights} onChange={setInput('contract_overnights')}
              placeholder="e.g. 2"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
          </FieldRow>
          <FieldRow label="Rehearsal dinner hours">
            <input type="text" value={details.contract_rehearsal_hours} onChange={setInput('contract_rehearsal_hours')}
              placeholder="e.g. 4-10 PM"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
          </FieldRow>
          <FieldRow label="Wedding day hours">
            <input type="text" value={details.contract_wedding_hours} onChange={setInput('contract_wedding_hours')}
              placeholder="e.g. 12-10 PM"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
          </FieldRow>
        </div>
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
            value={details.arbor_choice}
            onChange={set('arbor_choice')}
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
          {details.providing_cake_cutter === true && (
            <div className="px-4 pb-2">
              <input type="text" value={details.providing_cake_cutter_notes} onChange={setInput('providing_cake_cutter_notes')}
                placeholder="Details (e.g. Dad's sword, silver set, etc.)"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
            </div>
          )}
          <SmallYesNoRow
            label="Providing cake topper"
            value={details.providing_cake_topper}
            onChange={set('providing_cake_topper')}
          />
          <SmallYesNoRow
            label="High chairs / booster seats needed"
            value={details.high_chairs_needed}
            onChange={set('high_chairs_needed')}
          />
          {details.high_chairs_needed === true && (
            <div className="px-4 pb-2">
              <input type="text" value={details.high_chairs_count} onChange={setInput('high_chairs_count')}
                placeholder="How many, and at which table?"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
            </div>
          )}
        </div>

        <FieldRow label="Favors / guest gifts">
          <textarea
            rows={2}
            value={details.favors_description}
            onChange={setInput('favors_description')}
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
            value={details.send_off_type}
            onChange={set('send_off_type')}
          />
        </FieldRow>

        {details.send_off_type && details.send_off_type !== 'None' && (
          <FieldRow label="Send-off notes">
            <input
              type="text"
              value={details.send_off_notes}
              onChange={setInput('send_off_notes')}
              placeholder="Any details about the send-off…"
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          </FieldRow>
        )}
      </SectionCard>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cream-200 px-6 py-3 flex items-center justify-end gap-3 z-20 lg:pl-64">
        <SaveIndicator state={saveState} />
        {saveError && (
          <span className="text-sm text-red-600">{saveError}</span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-50 transition-colors text-white ${saveError ? 'bg-red-500 hover:bg-red-600' : 'bg-sage-600 hover:bg-sage-700'}`}
        >
          <SaveIcon />
          {saving ? 'Saving…' : saveError ? 'Retry' : 'Save Details'}
        </button>
      </div>
    </div>
  )
}
