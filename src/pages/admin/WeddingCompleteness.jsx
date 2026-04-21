import { useState, useEffect } from 'react'
import { API_URL } from '../../config/api'
import { authHeaders } from '../../utils/api'

// Each check: { label, check: (data) => boolean, tab?, inlineField? }
// tab = clicking "Go" switches to that admin tab
// inlineField = field key on wedding_details for quick inline edit

const SECTIONS = [
  {
    title: 'The Basics',
    items: [
      { label: 'Wedding date', check: d => !!d.wedding?.wedding_date, tab: 'overview' },
      { label: 'Couple names', check: d => !!d.wedding?.couple_names, tab: 'overview' },
      { label: 'Wedding colors', check: d => !!d.details?.wedding_colors, inlineField: 'wedding_colors', placeholder: 'e.g. dusty blue, sage' },
      { label: 'Partner 1 parents', check: d => !!d.details?.partner1_parents, inlineField: 'partner1_parents', placeholder: 'Names' },
      { label: 'Partner 2 parents', check: d => !!d.details?.partner2_parents, inlineField: 'partner2_parents', placeholder: 'Names' },
      { label: 'Wedding party count', check: d => !!d.details?.wedding_party_count_1 || !!d.details?.wedding_party_count_2, tab: 'wedding-details' },
      { label: 'Dogs info', check: d => d.details?.dogs_coming !== null, tab: 'wedding-details' },
      { label: 'Partner 1 social/IG', check: d => !!d.details?.partner1_social, inlineField: 'partner1_social', placeholder: '@handle' },
      { label: 'Partner 2 social/IG', check: d => !!d.details?.partner2_social, inlineField: 'partner2_social', placeholder: '@handle' },
    ],
  },
  {
    title: 'Contract Terms',
    items: [
      { label: 'Check-in time', check: d => !!d.details?.contract_checkin, inlineField: 'contract_checkin', placeholder: 'e.g. 3 PM Friday' },
      { label: 'Check-out time', check: d => !!d.details?.contract_checkout, inlineField: 'contract_checkout', placeholder: 'e.g. 1 PM Sunday' },
      { label: 'Max rehearsal guests', check: d => !!d.details?.contract_max_rehearsal, inlineField: 'contract_max_rehearsal', placeholder: '50' },
      { label: 'Max wedding guests', check: d => !!d.details?.contract_max_wedding, inlineField: 'contract_max_wedding', placeholder: '200' },
      { label: 'Overnights booked', check: d => !!d.details?.contract_overnights, inlineField: 'contract_overnights', placeholder: '2' },
      { label: 'Wedding day hours', check: d => !!d.details?.contract_wedding_hours, inlineField: 'contract_wedding_hours', placeholder: '12-10 PM' },
    ],
  },
  {
    title: 'Ceremony',
    items: [
      { label: 'Ceremony location', check: d => !!d.details?.ceremony_location, tab: 'wedding-details' },
      { label: 'Arbor choice', check: d => !!d.details?.arbor_choice, tab: 'wedding-details' },
      { label: 'Unity table', check: d => d.details?.unity_table !== null, tab: 'wedding-details' },
      { label: 'Ceremony notes', check: d => !!d.details?.ceremony_notes, tab: 'wedding-details' },
      { label: 'Ceremony order (processional)', check: d => d.ceremonyCount > 0, tab: 'ceremony-order' },
      { label: 'Ceremony chair plan', check: d => d.ceremonyChairs > 0, tab: 'ceremony-chairs' },
    ],
  },
  {
    title: 'Reception',
    items: [
      { label: 'Seating method', check: d => !!d.details?.seating_method, tab: 'wedding-details' },
      { label: 'Table numbers', check: d => d.details?.providing_table_numbers !== null, tab: 'wedding-details' },
      { label: 'Charger plates', check: d => d.details?.providing_charger_plates !== null, tab: 'wedding-details' },
      { label: 'Champagne glasses', check: d => d.details?.providing_champagne_glasses !== null, tab: 'wedding-details' },
      { label: 'Cake cutter', check: d => d.details?.providing_cake_cutter !== null, tab: 'wedding-details' },
      { label: 'Cake topper', check: d => d.details?.providing_cake_topper !== null, tab: 'wedding-details' },
      { label: 'High chairs needed', check: d => d.details?.high_chairs_needed !== null, tab: 'wedding-details' },
      { label: 'Favors / guest gifts', check: d => !!d.details?.favors_description, tab: 'wedding-details' },
      { label: 'Send-off type', check: d => !!d.details?.send_off_type, tab: 'wedding-details' },
    ],
  },
  {
    title: 'Guest List',
    items: [
      { label: 'Guests added', check: d => d.guestCount > 0, tab: 'guests', valueLabel: d => d.guestCount > 0 ? `${d.guestCount} guests` : null },
      { label: 'RSVPs collected', check: d => d.rsvpDone > 0, tab: 'guests', valueLabel: d => d.rsvpDone > 0 ? `${d.rsvpDone} confirmed` : null },
      { label: 'Allergies logged', check: d => d.allergyCount > 0, tab: 'allergies', valueLabel: d => d.allergyCount > 0 ? `${d.allergyCount} entries` : null },
    ],
  },
  {
    title: 'Vendors',
    items: [
      { label: 'Catering', check: d => d.vendorTypes.has('caterer') || d.vendorTypes.has('catering'), tab: 'vendors' },
      { label: 'Florist', check: d => d.vendorTypes.has('florist'), tab: 'vendors' },
      { label: 'Photographer', check: d => d.vendorTypes.has('photographer'), tab: 'vendors' },
      { label: 'DJ / Band', check: d => d.vendorTypes.has('dj') || d.vendorTypes.has('band'), tab: 'vendors' },
      { label: 'Officiant', check: d => d.vendorTypes.has('officiant'), tab: 'vendors' },
      { label: 'Videographer', check: d => d.vendorTypes.has('videographer'), tab: 'vendors' },
      { label: 'Hair & Makeup', check: d => d.vendorTypes.has('hair') || d.vendorTypes.has('makeup') || d.vendorTypes.has('hair & makeup'), tab: 'vendors' },
      { label: 'Shuttles', check: d => d.vendorTypes.has('transportation') || d.vendorTypes.has('shuttle'), tab: 'vendors' },
      { label: 'Linens / Rentals', check: d => d.vendorTypes.has('rentals') || d.vendorTypes.has('linens'), tab: 'vendors' },
      { label: 'Cake / Dessert', check: d => d.vendorTypes.has('cake') || d.vendorTypes.has('dessert'), tab: 'vendors' },
      { label: 'At least 1 contract uploaded', check: d => d.contractCount > 0, tab: 'contract-upload', valueLabel: d => d.contractCount > 0 ? `${d.contractCount} on file` : null },
    ],
  },
  {
    title: 'Day-Of Planning',
    items: [
      { label: 'Timeline built', check: d => d.hasTimeline, tab: 'timeline' },
      { label: 'Table layout done', check: d => d.hasTableLayout, tab: 'tables' },
      { label: 'Table map (floor plan)', check: d => d.hasTableMap, tab: 'table-map' },
      { label: 'Staffing plan', check: d => d.hasStaffing, tab: 'staffing' },
      { label: 'Bar planner', check: d => d.hasBar, tab: 'bar' },
      { label: 'Shuttle schedule', check: d => d.hasShuttles, tab: 'shuttle' },
      { label: 'Hair & makeup schedule', check: d => d.hasMakeup, tab: 'makeup' },
      { label: 'Rehearsal dinner details', check: d => d.hasRehearsal, tab: 'rehearsal' },
      { label: 'Bedroom assignments', check: d => d.hasBedrooms, tab: 'bedrooms' },
      { label: 'Decor inventory', check: d => d.hasDecor, tab: 'decor' },
    ],
  },
]

export default function WeddingCompleteness({ weddingId, wedding, onSwitchTab }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inlineEdits, setInlineEdits] = useState({})
  const [savingField, setSavingField] = useState(null)

  useEffect(() => {
    if (weddingId) load()
  }, [weddingId])

  const load = async () => {
    try {
      const hdrs = await authHeaders()
      const [detailsRes, vendorsRes, guestsRes, allergyRes, contractsRes,
             timelineRes, tablesRes, layoutRes, staffingRes, barRes,
             shuttleRes, makeupRes, rehearsalRes, bedroomsRes, decorRes,
             ceremonyRes, ceremonyPlanRes] = await Promise.all([
        fetch(`${API_URL}/api/wedding-details/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/vendors/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/guests/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/allergies/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/contracts/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/timeline/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/tables/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/table-layout/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/staffing/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/bar-shopping/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/shuttle/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/makeup/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/rehearsal-dinner/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/bedrooms/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/decor/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/ceremony-order/${weddingId}`, { headers: hdrs }),
        fetch(`${API_URL}/api/ceremony-plan/${weddingId}`, { headers: hdrs }),
      ])

      const safeJson = async (res) => { try { return res.ok ? await res.json() : null } catch { return null } }

      const [details, vendors, guests, allergies, contracts,
             timeline, tables, layout, staffing, bar,
             shuttles, makeup, rehearsal, bedrooms, decor,
             ceremony, ceremonyPlan] = await Promise.all([
        safeJson(detailsRes), safeJson(vendorsRes), safeJson(guestsRes),
        safeJson(allergyRes), safeJson(contractsRes), safeJson(timelineRes),
        safeJson(tablesRes), safeJson(layoutRes), safeJson(staffingRes),
        safeJson(barRes), safeJson(shuttleRes), safeJson(makeupRes),
        safeJson(rehearsalRes), safeJson(bedroomsRes), safeJson(decorRes),
        safeJson(ceremonyRes), safeJson(ceremonyPlanRes),
      ])

      const vendorList = vendors?.vendors || vendors || []
      const guestList = guests?.guests || guests || []
      const allergyList = Array.isArray(allergies) ? allergies : []
      const contractData = contracts || {}

      setData({
        wedding,
        details: details || {},
        vendorTypes: new Set(vendorList.map(v => (v.vendor_type || '').toLowerCase())),
        vendorCount: vendorList.length,
        contractCount: (contractData.contracts?.length || 0) + (contractData.vendorContracts?.length || 0),
        guestCount: guestList.length,
        rsvpDone: guestList.filter(g => g.rsvp === 'yes').length,
        allergyCount: allergyList.length,
        hasTimeline: !!(timeline?.events && Object.keys(timeline.events).length > 0),
        hasTableLayout: !!(tables?.tables),
        hasTableMap: !!(layout?.layout?.elements?.length > 0),
        hasStaffing: !!(staffing?.staffing?.answers),
        hasBar: Array.isArray(bar) && bar.length > 0,
        hasShuttles: Array.isArray(shuttles) && shuttles.length > 0,
        hasMakeup: Array.isArray(makeup) && makeup.length > 0,
        hasRehearsal: !!(rehearsal?.bar_type || rehearsal?.food_type || rehearsal?.location),
        hasBedrooms: !!(bedrooms && Object.values(bedrooms).some(r => r.friday || r.saturday)),
        hasDecor: Array.isArray(decor) && decor.length > 0,
        ceremonyCount: Array.isArray(ceremony) ? ceremony.length : 0,
        ceremonyChairs: ceremonyPlan?.plan?.rows?.length || 0,
      })
    } catch (err) {
      console.error('Completeness load error:', err)
    }
    setLoading(false)
  }

  const saveInlineField = async (field, value) => {
    setSavingField(field)
    try {
      await fetch(`${API_URL}/api/wedding-details`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ weddingId, [field]: value }),
      })
      setData(prev => ({
        ...prev,
        details: { ...prev.details, [field]: value },
      }))
      setInlineEdits(prev => { const n = { ...prev }; delete n[field]; return n })
    } catch (err) {
      console.error('Inline save error:', err)
    }
    setSavingField(null)
  }

  if (loading) return <p className="text-sage-400 text-sm text-center py-8">Loading completeness check...</p>
  if (!data) return <p className="text-sage-400 text-sm text-center py-8">Could not load data.</p>

  let totalChecks = 0
  let totalDone = 0
  SECTIONS.forEach(s => s.items.forEach(item => {
    totalChecks++
    if (item.check(data)) totalDone++
  }))
  const pct = totalChecks > 0 ? Math.round((totalDone / totalChecks) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-cream-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sage-800">Wedding File Completeness</h3>
          <span className="text-lg font-bold text-sage-700">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-cream-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct >= 70 ? 'bg-sage-500' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-sage-500 mt-1.5">{totalDone} of {totalChecks} items completed</p>
      </div>

      {/* Sections */}
      {SECTIONS.map(section => {
        const done = section.items.filter(i => i.check(data)).length
        const total = section.items.length
        const allDone = done === total

        return (
          <div key={section.title} className="bg-white rounded-xl border border-cream-200 overflow-hidden">
            <div className={`px-5 py-3 border-b border-cream-200 flex items-center justify-between ${allDone ? 'bg-green-50' : 'bg-cream-50'}`}>
              <h4 className="text-sm font-semibold text-sage-700">{section.title}</h4>
              <span className={`text-xs font-medium ${allDone ? 'text-green-600' : 'text-sage-500'}`}>
                {done}/{total}
              </span>
            </div>
            <div className="divide-y divide-cream-100">
              {section.items.map(item => {
                const isDone = item.check(data)
                const valueStr = item.valueLabel ? item.valueLabel(data) : null
                const isEditing = item.inlineField && inlineEdits[item.inlineField] !== undefined

                return (
                  <div key={item.label} className="flex items-center gap-3 px-5 py-2.5">
                    {/* Status dot */}
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isDone ? 'bg-green-100 text-green-600' : 'bg-cream-200 text-sage-400'
                    }`}>
                      {isDone ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-sage-300" />
                      )}
                    </span>

                    {/* Label + value */}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${isDone ? 'text-sage-700' : 'text-sage-500'}`}>{item.label}</span>
                      {isDone && valueStr && (
                        <span className="text-xs text-sage-400 ml-2">{valueStr}</span>
                      )}
                    </div>

                    {/* Inline edit for simple fields */}
                    {!isDone && item.inlineField && !isEditing && (
                      <button
                        onClick={() => setInlineEdits(prev => ({ ...prev, [item.inlineField]: data.details?.[item.inlineField] || '' }))}
                        className="text-xs text-sage-500 hover:text-sage-700 px-2 py-1 rounded hover:bg-cream-50 transition"
                      >
                        Add
                      </button>
                    )}
                    {isEditing && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={inlineEdits[item.inlineField]}
                          onChange={e => setInlineEdits(prev => ({ ...prev, [item.inlineField]: e.target.value }))}
                          placeholder={item.placeholder || ''}
                          className="border border-cream-300 rounded-lg px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-sage-300"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveInlineField(item.inlineField, inlineEdits[item.inlineField])
                            if (e.key === 'Escape') setInlineEdits(prev => { const n = { ...prev }; delete n[item.inlineField]; return n })
                          }}
                        />
                        <button
                          onClick={() => saveInlineField(item.inlineField, inlineEdits[item.inlineField])}
                          disabled={savingField === item.inlineField}
                          className="text-xs px-2 py-1 bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50"
                        >
                          {savingField === item.inlineField ? '...' : 'Save'}
                        </button>
                      </div>
                    )}

                    {/* Link to tab */}
                    {!isDone && item.tab && !item.inlineField && onSwitchTab && (
                      <button
                        onClick={() => onSwitchTab(item.tab)}
                        className="text-xs text-sage-500 hover:text-sage-700 px-2 py-1 rounded hover:bg-cream-50 transition"
                      >
                        Go
                      </button>
                    )}
                    {isDone && item.tab && onSwitchTab && (
                      <button
                        onClick={() => onSwitchTab(item.tab)}
                        className="text-xs text-sage-400 hover:text-sage-600 px-2 py-1 rounded hover:bg-cream-50 transition"
                      >
                        View
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
