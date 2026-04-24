import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'


// All timeline event definitions (mirrored from TimelineBuilder for rendering)
const ALL_TIMELINE_EVENTS = {
  'hair-makeup-done': 'Hair & Makeup Complete',
  'buffer-break': 'Buffer / Lunch Break',
  'bridesmaids-dressed': 'Bridesmaids & Groomsmen Get Dressed',
  'bride-dress': 'Bride Gets Dressed',
  'groom-getting-ready': 'Groom Getting Ready Photos',
  'bride-getting-ready-photos': 'Bride Getting Ready Photos',
  'details-photos': 'Details Photos',
  'robe-photos': 'Robe / Casual Photos',
  'first-look-dad': 'First Look with Dad',
  'first-look-groom': 'First Look with Groom',
  'private-vows': 'Private Vows',
  'couple-portraits': 'Couple Portraits',
  'wedding-party-photos': 'Wedding Party Photos',
  'family-formals': 'Immediate Family Photos',
  'extended-family': 'Extended Family Photos',
  'hide-bride': 'Put Bride Away',
  'last-shuttle': 'Last Shuttle Arrives',
  'travel-to-church': 'Travel to Ceremony Venue',
  'guests-arrive': 'Guest Arrival',
  'ceremony-music': 'Ceremony Music Begins',
  'ceremony': 'Ceremony',
  'group-photo': 'Big Group Photo',
  'travel-from-church': 'Travel Back from Ceremony',
  'cocktail-hour': 'Cocktail Hour',
  'remaining-photos': 'Remaining Photos',
  'couple-break': 'B&G Take A Break',
  'sunset-photos': 'Sunset / Golden Hour Photos',
  'doors-open': 'Ballroom/Patio Opens',
  'grand-entrance': 'Introductions',
  'welcome-toast': 'Welcome & Blessing',
  'first-dance': 'First Dance',
  'parent-dances': 'Parent Dances',
  'toasts': 'Toasts & Speeches',
  'cake-cutting': 'Cake Cutting',
  'anniversary-dance': 'Anniversary Dance',
  'newlywed-game': 'Newlywed Game',
  'bouquet-toss': 'Bouquet Toss',
  'garter-toss': 'Garter Toss',
  'dinner': 'Dinner Service',
  'open-dancing': 'Open Dancing Begins',
  'grand-exit': 'Sparkler / Grand Exit',
  'last-dance': 'Last Dance',
  'private-last-dance': 'Private Last Dance',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function SectionHeader({ title, icon }) {
  return (
    <div className="section-header">
      <span className="section-icon">{icon}</span>
      <span>{title}</span>
    </div>
  )
}

function DataRow({ label, value }) {
  if (!value && value !== 0 && value !== false) return null
  const display = value === true ? 'Yes' : value === false ? 'No' : String(value)
  if (!display.trim()) return null
  return (
    <div className="data-row">
      <span className="data-label">{label}</span>
      <span className="data-value">{display}</span>
    </div>
  )
}

export default function PrintView() {
  const { weddingId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sections, setSections] = useState({
    timeline: true,
    tables: true,
    seating: true,
    staffing: true,
    ceremony: true,
    ceremonyChairs: true,
    bedrooms: true,
    rehearsal: true,
    shuttle: true,
    makeup: true,
    decor: true,
    vendors: true,
    allergies: true,
    guestCare: true,
    parents: true,
    details: true,
    highlights: true,
  })

  // Data
  const [wedding, setWedding] = useState(null)
  const [timeline, setTimeline] = useState(null)
  const [tables, setTables] = useState(null)
  const [staffing, setStaffing] = useState(null)
  const [ceremonyOrder, setCeremonyOrder] = useState([])
  const [bedrooms, setBedrooms] = useState([])
  const [rehearsal, setRehearsal] = useState(null)
  const [shuttle, setShuttle] = useState([])
  const [makeup, setMakeup] = useState([])
  const [decor, setDecor] = useState([])
  const [vendors, setVendors] = useState([])
  const [allergies, setAllergies] = useState([])
  const [weddingDetails, setWeddingDetails] = useState(null)
  const [ceremonyChairs, setCeremonyChairs] = useState(null)
  const [guestCare, setGuestCare] = useState([])
  const [guests, setGuests] = useState([])
  const [highlights, setHighlights] = useState(null)
  const [loadingHighlights, setLoadingHighlights] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const hdrs = await authHeaders()
        const [
          weddingsRes, timelineRes, tablesRes, staffingRes,
          ceremonyRes, bedroomsRes, rehearsalRes, shuttleRes,
          makeupRes, decorRes, vendorsRes, allergiesRes,
          ceremonyChairsRes, guestCareRes, guestsRes,
          detailsRes,
        ] = await Promise.all([
          fetch(`${API_URL}/api/admin/weddings`, { headers: hdrs }),
          fetch(`${API_URL}/api/timeline/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/tables/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/staffing/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/ceremony-order/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/bedrooms/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/rehearsal-dinner/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/shuttle/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/makeup/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/decor/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/vendors/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/allergies/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/ceremony-plan/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/guest-care/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/guests/${weddingId}`, { headers: hdrs }),
          fetch(`${API_URL}/api/wedding-details/${weddingId}`, { headers: hdrs }),
        ])

        const weddingsData = await weddingsRes.json()
        const found = (weddingsData.weddings || []).find(w => w.id === weddingId)
        setWedding(found || null)

        const tl = await timelineRes.json()
        setTimeline(tl.timeline || null)

        const tb = await tablesRes.json()
        setTables(tb.tables || null)

        const st = await staffingRes.json()
        setStaffing(st.staffing || null)

        setCeremonyOrder(await ceremonyRes.json() || [])
        setBedrooms(await bedroomsRes.json() || [])
        setRehearsal(await rehearsalRes.json() || null)
        setShuttle(await shuttleRes.json() || [])
        setMakeup(await makeupRes.json() || [])
        setDecor(await decorRes.json() || [])

        const vd = await vendorsRes.json()
        setVendors(vd.vendors || [])

        setAllergies(await allergiesRes.json() || [])

        try { const cp = await ceremonyChairsRes.json(); setCeremonyChairs(cp?.plan || null) } catch {}
        try { const gc = await guestCareRes.json(); setGuestCare(Array.isArray(gc) ? gc : []) } catch {}
        try { const gd = await guestsRes.json(); setGuests(gd?.guests || []) } catch {}

        setWeddingDetails(await detailsRes.json() || null)

      } catch (err) {
        console.error('PrintView fetch error:', err)
        setError('Failed to load wedding data.')
      }
      setLoading(false)
    }
    fetchAll()
  }, [weddingId])

  // Generate highlights separately (slower AI call — don't block the page)
  useEffect(() => {
    async function fetchHighlights() {
      setLoadingHighlights(true)
      try {
        const res = await fetch(`${API_URL}/api/notes-highlights`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ weddingId }),
        })
        const data = await res.json()
        setHighlights(data.highlights || null)
      } catch (err) {
        console.error('Highlights fetch error:', err)
        setHighlights(null)
      }
      setLoadingHighlights(false)
    }
    fetchHighlights()
  }, [weddingId])

  // Build sorted timeline events
  function getTimelineEvents() {
    if (!timeline?.timeline_data?.events) return []
    const events = timeline.timeline_data.events
    const customEvents = timeline.timeline_data.customEvents || []

    const rows = []
    Object.entries(events).forEach(([id, ev]) => {
      if (!ev.included) return
      if (!ev.calculatedTime) return
      const name = ALL_TIMELINE_EVENTS[id] || ev.name || id
      rows.push({ time: ev.calculatedTime, name, duration: ev.duration, id })
    })
    customEvents.forEach(ev => {
      if (!ev.time) return
      rows.push({ time: ev.time, name: ev.name, duration: ev.duration, id: ev.id, custom: true })
    })
    rows.sort((a, b) => {
      const toMin = t => {
        const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
        if (!m) return 0
        let h = parseInt(m[1]), min = parseInt(m[2])
        if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
        if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
        return h * 60 + min
      }
      return toMin(a.time) - toMin(b.time)
    })
    return rows
  }

  // Group decor by space
  function getDecorBySpace() {
    const spaces = {}
    decor.forEach(item => {
      if (!spaces[item.space_name]) spaces[item.space_name] = []
      spaces[item.space_name].push(item)
    })
    return spaces
  }

  const toggleSection = (key) => setSections(prev => ({ ...prev, [key]: !prev[key] }))

  const printedAt = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Georgia, serif', color: '#4a5568' }}>
      Loading wedding data…
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Georgia, serif', color: '#e53e3e' }}>
      {error}
    </div>
  )

  const timelineEvents = getTimelineEvents()
  const decorBySpace = getDecorBySpace()
  const bookedVendors = vendors.filter(v => v.vendor_name)

  return (
    <>
      <style>{`
        /* ===== SCREEN STYLES ===== */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f5f0eb; font-family: 'Georgia', serif; }

        .screen-controls {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: #3d5a47; color: white;
          padding: 12px 24px;
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .screen-controls h2 { font-size: 16px; font-weight: 600; margin-right: auto; letter-spacing: 0.02em; }
        .btn-print {
          background: white; color: #3d5a47;
          border: none; border-radius: 6px;
          padding: 8px 20px; font-size: 14px; font-weight: 600;
          cursor: pointer; letter-spacing: 0.02em;
        }
        .btn-print:hover { background: #e8f0eb; }
        .btn-back {
          background: transparent; color: rgba(255,255,255,0.8);
          border: 1px solid rgba(255,255,255,0.3); border-radius: 6px;
          padding: 7px 14px; font-size: 13px; cursor: pointer;
        }
        .btn-back:hover { color: white; border-color: white; }

        .section-toggles {
          display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;
        }
        .toggle-chip {
          font-size: 11px; padding: 4px 10px; border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.4); cursor: pointer;
          color: rgba(255,255,255,0.8); background: transparent;
          transition: all 0.15s;
        }
        .toggle-chip.active {
          background: rgba(255,255,255,0.2); color: white;
          border-color: rgba(255,255,255,0.7);
        }

        .print-container {
          max-width: 900px; margin: 100px auto 40px;
          background: white;
          box-shadow: 0 4px 24px rgba(0,0,0,0.12);
        }

        /* ===== PRINT CONTENT STYLES ===== */
        .print-header {
          background: #3d5a47; color: white;
          padding: 40px 48px 32px;
        }
        .print-header .venue { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.7; margin-bottom: 8px; }
        .print-header h1 { font-size: 32px; font-weight: normal; line-height: 1.2; margin-bottom: 8px; }
        .print-header .meta { font-size: 14px; opacity: 0.8; display: flex; gap: 24px; flex-wrap: wrap; margin-top: 12px; }
        .print-header .meta span { display: flex; align-items: center; gap: 6px; }

        .print-section {
          border-bottom: 1px solid #e8e0d8;
          padding: 32px 48px;
        }
        .print-section:last-child { border-bottom: none; }

        .section-header {
          display: flex; align-items: center; gap: 10px;
          font-size: 13px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: #3d5a47;
          margin-bottom: 20px; padding-bottom: 10px;
          border-bottom: 2px solid #3d5a47;
        }
        .section-icon { font-size: 16px; }

        /* Timeline */
        .timeline-grid {
          display: grid; grid-template-columns: 90px 1fr;
          gap: 0;
        }
        .tl-time {
          font-size: 12px; color: #7a6b5a; font-variant-numeric: tabular-nums;
          padding: 6px 12px 6px 0; border-right: 2px solid #e8e0d8;
          text-align: right; line-height: 1.4;
        }
        .tl-event {
          font-size: 13px; color: #2d3748;
          padding: 6px 0 6px 16px; line-height: 1.4;
          position: relative;
        }
        .tl-event::before {
          content: ''; position: absolute; left: -5px; top: 11px;
          width: 8px; height: 8px; border-radius: 50%;
          background: #3d5a47; border: 2px solid white;
          box-shadow: 0 0 0 1px #3d5a47;
        }
        .tl-duration { font-size: 11px; color: #9a8b7a; margin-left: 6px; }

        /* Tables */
        .info-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
        }
        .info-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
        .data-row {
          display: flex; flex-direction: column; gap: 2px;
          padding: 10px 14px; background: #faf8f5; border-radius: 6px;
          border: 1px solid #ede8e0;
        }
        .data-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #9a8b7a; }
        .data-value { font-size: 14px; color: #2d3748; }

        /* Ceremony Order */
        .ceremony-list { list-style: none; }
        .ceremony-item {
          display: flex; align-items: baseline; gap: 12px;
          padding: 7px 0; border-bottom: 1px solid #f0ebe3;
        }
        .ceremony-item:last-child { border-bottom: none; }
        .ceremony-num {
          font-size: 11px; color: #9a8b7a; width: 20px; flex-shrink: 0; text-align: right;
        }
        .ceremony-role { font-size: 11px; color: #7a6b5a; min-width: 120px; }
        .ceremony-name { font-size: 13px; color: #2d3748; flex: 1; }

        /* Bedrooms */
        .bedroom-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .bedroom-card {
          padding: 12px 16px; border: 1px solid #ede8e0; border-radius: 8px;
          background: #faf8f5;
        }
        .bedroom-name { font-size: 13px; font-weight: 600; color: #2d3748; margin-bottom: 2px; }
        .bedroom-desc { font-size: 11px; color: #9a8b7a; margin-bottom: 6px; }
        .bedroom-occupants { font-size: 13px; color: #4a5568; }
        .bedroom-notes { font-size: 11px; color: #7a6b5a; margin-top: 4px; font-style: italic; }
        .bedroom-empty { color: #c8bfb5; font-style: italic; font-size: 12px; }

        /* Shuttle */
        .shuttle-run {
          padding: 12px 16px; border: 1px solid #ede8e0; border-radius: 8px;
          margin-bottom: 8px; background: #faf8f5;
        }
        .shuttle-label { font-size: 12px; font-weight: 700; color: #3d5a47; margin-bottom: 6px; }
        .shuttle-detail { font-size: 12px; color: #4a5568; margin-bottom: 2px; }

        /* Makeup */
        .makeup-table { width: 100%; border-collapse: collapse; }
        .makeup-table th {
          text-align: left; font-size: 10px; letter-spacing: 0.08em;
          text-transform: uppercase; color: #9a8b7a;
          padding: 8px 12px; background: #faf8f5; border-bottom: 1px solid #ede8e0;
        }
        .makeup-table td {
          font-size: 13px; color: #2d3748;
          padding: 8px 12px; border-bottom: 1px solid #f5f0e8;
        }
        .makeup-table tr:last-child td { border-bottom: none; }

        /* Decor */
        .decor-space { margin-bottom: 20px; }
        .decor-space-name {
          font-size: 12px; font-weight: 700; color: #3d5a47;
          letter-spacing: 0.06em; text-transform: uppercase;
          margin-bottom: 8px; padding-bottom: 4px;
          border-bottom: 1px solid #e0d8cc;
        }
        .decor-item {
          display: flex; gap: 12px; align-items: baseline;
          padding: 6px 0; border-bottom: 1px solid #f5f0e8; font-size: 13px;
        }
        .decor-item:last-child { border-bottom: none; }
        .decor-item-name { color: #2d3748; flex: 1; }
        .decor-item-qty { color: #9a8b7a; font-size: 12px; min-width: 60px; text-align: right; }
        .decor-item-color { color: #7a6b5a; font-size: 12px; }

        /* Vendors */
        .vendor-table { width: 100%; border-collapse: collapse; }
        .vendor-table th {
          text-align: left; font-size: 10px; letter-spacing: 0.08em;
          text-transform: uppercase; color: #9a8b7a;
          padding: 8px 12px; background: #faf8f5; border-bottom: 1px solid #ede8e0;
        }
        .vendor-table td {
          font-size: 13px; color: #2d3748;
          padding: 8px 12px; border-bottom: 1px solid #f5f0e8; vertical-align: top;
        }
        .vendor-table tr:last-child td { border-bottom: none; }
        .vendor-booked { font-size: 10px; color: #3d5a47; background: #e8f0eb; padding: 2px 7px; border-radius: 10px; white-space: nowrap; }

        /* Allergies */
        .allergy-table { width: 100%; border-collapse: collapse; }
        .allergy-table th {
          text-align: left; font-size: 10px; letter-spacing: 0.08em;
          text-transform: uppercase; color: #9a8b7a;
          padding: 8px 12px; background: #faf8f5; border-bottom: 1px solid #ede8e0;
        }
        .allergy-table td {
          font-size: 13px; color: #2d3748;
          padding: 8px 12px; border-bottom: 1px solid #f5f0e8;
        }
        .allergy-table tr:last-child td { border-bottom: none; }
        .allergy-severity {
          display: inline-block; font-size: 10px; padding: 2px 7px; border-radius: 10px;
        }
        .allergy-severity.severe { background: #fff5f5; color: #e53e3e; }
        .allergy-severity.moderate { background: #fffbeb; color: #d97706; }
        .allergy-severity.mild { background: #f0fdf4; color: #16a34a; }

        /* Highlights */
        .highlights-body { font-size: 13px; color: #2d3748; line-height: 1.7; }
        .highlights-body .hl-heading {
          font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase; color: #3d5a47;
          margin-top: 16px; margin-bottom: 4px;
        }
        .highlights-body .hl-heading:first-child { margin-top: 0; }
        .highlights-body .hl-bullet {
          display: flex; gap: 8px; padding: 2px 0;
        }
        .highlights-body .hl-bullet::before {
          content: '–'; color: #9a8b7a; flex-shrink: 0;
        }
        .highlights-loading {
          font-size: 13px; color: #9a8b7a; font-style: italic;
          display: flex; align-items: center; gap: 8px;
        }

        /* Print footer */
        .print-footer {
          background: #faf8f5; padding: 20px 48px;
          display: flex; justify-content: space-between; align-items: center;
          border-top: 1px solid #e8e0d8;
        }
        .print-footer span { font-size: 11px; color: #9a8b7a; }

        /* Empty state */
        .empty-note { font-size: 13px; color: #c0b5a8; font-style: italic; }

        /* ===== PRINT MEDIA ===== */
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .screen-controls { display: none !important; }
          .print-container { margin: 0; box-shadow: none; max-width: none; }
          .print-section { padding: 24px 40px; }
          .print-header { padding: 32px 40px 24px; }
          .print-footer { padding: 16px 40px; }
          .print-section { page-break-inside: avoid; }
          .section-start { page-break-before: always; }
          .section-start:first-child { page-break-before: avoid; }
        }
      `}</style>

      {/* Screen-only controls */}
      <div className="screen-controls">
        <button className="btn-back" onClick={() => navigate('/admin')}>← Admin</button>
        <h2>Print / Export — {wedding?.couple_names || 'Wedding'}</h2>
        <button className="btn-print" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
      </div>
      <div className="screen-controls" style={{ top: 52, paddingTop: 8, paddingBottom: 8, background: '#2e4535' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginRight: 4 }}>Sections:</span>
        {Object.entries({
          timeline: '📋 Timeline',
          tables: '🪑 Tables',
          staffing: '👥 Staffing',
          ceremony: '💒 Ceremony',
          bedrooms: '🛏 Bedrooms',
          rehearsal: '🍽 Rehearsal',
          seating: '🪑 Seating Chart',
          ceremonyChairs: '🪑 Ceremony Chairs',
          shuttle: '🚌 Shuttle',
          makeup: '💄 Makeup',
          decor: '🌿 Decor',
          vendors: '📇 Vendors',
          allergies: '⚠️ Allergies',
          guestCare: '💝 Guest Care',
          parents: '👨‍👩‍👧 Parents',
          details: '📋 Details',
          highlights: '✨ Highlights',
        }).map(([key, label]) => (
          <button
            key={key}
            className={`toggle-chip ${sections[key] ? 'active' : ''}`}
            onClick={() => toggleSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Print document */}
      <div className="print-container">
        {/* Header */}
        <div className="print-header">
          <div className="venue">Rixey Manor · Rapidan, Virginia</div>
          <h1>{wedding?.couple_names || 'Wedding'}</h1>
          <div className="meta">
            {wedding?.wedding_date && (
              <span>📅 {formatDate(wedding.wedding_date)}</span>
            )}
            {wedding?.event_code && (
              <span>🔑 Code: {wedding.event_code}</span>
            )}
            <span>🖨️ Printed {printedAt}</span>
          </div>
        </div>

        {/* TIMELINE */}
        {sections.timeline && timelineEvents.length > 0 && (
          <div className="print-section section-start">
            <SectionHeader title="Wedding Day Timeline" icon="📋" />
            {timeline?.ceremony_start && (
              <div style={{ marginBottom: 16, fontSize: 12, color: '#7a6b5a' }}>
                Ceremony: <strong>{timeline.ceremony_start}</strong>
                {timeline?.reception_end && <> · End: <strong>{timeline.reception_end}</strong></>}
              </div>
            )}
            <div className="timeline-grid">
              {timelineEvents.map((ev, i) => (
                <>
                  <div key={`t-${i}`} className="tl-time">{ev.time}</div>
                  <div key={`e-${i}`} className="tl-event">
                    {ev.name}
                    {ev.duration > 0 && <span className="tl-duration">({ev.duration} min)</span>}
                  </div>
                </>
              ))}
            </div>
            {timeline?.notes && (
              <div style={{ marginTop: 16, fontSize: 12, color: '#4a5568', background: '#faf8f5', padding: '10px 14px', borderRadius: 6 }}>
                <strong>Notes:</strong> {timeline.notes}
              </div>
            )}
          </div>
        )}

        {/* TABLES & STAFFING */}
        {(sections.tables && tables) || (sections.staffing && staffing) ? (
          <div className="print-section section-start">
            {sections.tables && tables && (
              <>
                <SectionHeader title="Table Setup" icon="🪑" />
                <div className="info-grid" style={{ marginBottom: sections.staffing && staffing ? 28 : 0 }}>
                  <DataRow label="Guest Count" value={tables.guest_count} />
                  <DataRow label="Table Shape" value={tables.table_shape} />
                  <DataRow label="Guests per Table" value={tables.guests_per_table} />
                  <DataRow label="Chargers" value={tables.chair_sash ? `Yes — ${tables.guest_count || ''} needed (reduces ~2 seats per round; ~6" centre space on rectangles)` : 'No'} />
                  <DataRow label="Linen Color" value={tables.linen_color} />
                  <DataRow label="Napkin Color" value={tables.napkin_color} />
                  <DataRow label="Head Table" value={tables.head_table ? `Yes — ${tables.head_table_size || ''} seats` : 'No'} />
                  <DataRow label="Sweetheart Table" value={tables.sweetheart_table ? 'Yes' : 'No'} />
                  <DataRow label="Kids Table" value={tables.kids_count > 0 ? `${tables.kids_count} kids` : null} />
                  <DataRow label="Extra Round Tables" value={tables.extra_rounds > 0 ? tables.extra_rounds : null} />
                  <DataRow label="Extra Long Tables" value={tables.extra_longs > 0 ? tables.extra_longs : null} />
                </div>
              </>
            )}
            {sections.staffing && staffing && (
              <>
                <SectionHeader title="Staffing Estimate" icon="👥" />
                <div className="info-grid">
                  <DataRow label="Friday Bartenders" value={staffing.friday_bartenders} />
                  <DataRow label="Friday Extra Hands" value={staffing.friday_extra_hands} />
                  <DataRow label="Saturday Bartenders" value={staffing.saturday_bartenders} />
                  <DataRow label="Saturday Extra Hands" value={staffing.saturday_extra_hands} />
                  <DataRow label="Total Staff" value={staffing.total_staff} />
                  <DataRow label="Estimated Cost" value={staffing.total_cost ? `$${staffing.total_cost.toLocaleString()}` : null} />
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* CEREMONY ORDER */}
        {sections.ceremony && ceremonyOrder.length > 0 && (
          <div className="print-section section-start">
            <SectionHeader title="Ceremony Processional Order" icon="💒" />
            <ul className="ceremony-list">
              {(() => {
                // Group by sort_order (same sort_order = walk together)
                const groups = []
                let currentGroup = []
                let currentOrder = null
                ceremonyOrder.forEach(item => {
                  if (currentOrder !== null && item.sort_order !== currentOrder) {
                    groups.push({ order: currentOrder, items: currentGroup })
                    currentGroup = []
                  }
                  currentOrder = item.sort_order
                  currentGroup.push(item)
                })
                if (currentGroup.length) groups.push({ order: currentOrder, items: currentGroup })

                return groups.map((group, gi) => (
                  <li key={gi} className="ceremony-item">
                    <span className="ceremony-num">{gi + 1}.</span>
                    <span className="ceremony-name">
                      {group.items.map((item, ii) => (
                        <span key={item.id}>
                          {ii > 0 && <span style={{ color: '#9a8b7a', margin: '0 6px' }}>&</span>}
                          {item.person_name || <em style={{ color: '#c0b5a8' }}>TBD</em>}
                          {item.role && <span className="ceremony-role" style={{ marginLeft: 6 }}>({item.role})</span>}
                        </span>
                      ))}
                    </span>
                  </li>
                ))
              })()}
            </ul>
          </div>
        )}

        {/* BEDROOMS */}
        {sections.bedrooms && bedrooms.length > 0 && (
          <div className="print-section section-start">
            <SectionHeader title="Bedroom Assignments" icon="🛏" />
            <div className="bedroom-list">
              {bedrooms.map(room => (
                <div key={room.id} className="bedroom-card">
                  <div className="bedroom-name">{room.room_name}</div>
                  <div className="bedroom-desc">{room.room_description}</div>
                  {room.occupants ? (
                    <div className="bedroom-occupants">{room.occupants}</div>
                  ) : (
                    <div className="bedroom-empty">Unassigned</div>
                  )}
                  {room.notes && <div className="bedroom-notes">{room.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REHEARSAL DINNER */}
        {sections.rehearsal && rehearsal && (
          <div className="print-section section-start">
            <SectionHeader title="Rehearsal Dinner" icon="🍽" />
            <div className="info-grid">
              <DataRow label="Guest Count" value={rehearsal.guest_count} />
              <DataRow label="Location" value={rehearsal.location} />
              <DataRow label="Bar" value={rehearsal.bar_type} />
              <DataRow label="Food Type" value={rehearsal.food_type} />
              <DataRow label="Seating" value={rehearsal.seating_type} />
              <DataRow label="Table Layout" value={rehearsal.table_layout} />
              <DataRow label="High Chairs" value={rehearsal.high_chairs_needed === 'Yes' ? `Yes — ${rehearsal.high_chairs_count || '?'} needed` : rehearsal.high_chairs_needed} />
              <DataRow label="Disposables" value={rehearsal.using_disposables} />
              <DataRow label="Renting China" value={rehearsal.renting_china} />
              <DataRow label="Renting Flatware" value={rehearsal.renting_flatware} />
              <DataRow label="Linens" value={rehearsal.linens_source} />
              <DataRow label="Decor" value={rehearsal.decor_source} />
            </div>
            {rehearsal.food_notes && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#4a5568', background: '#faf8f5', padding: '10px 14px', borderRadius: 6 }}>
                <strong>Food notes:</strong> {rehearsal.food_notes}
              </div>
            )}
            {rehearsal.location_notes && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#4a5568', background: '#faf8f5', padding: '10px 14px', borderRadius: 6 }}>
                <strong>Location notes:</strong> {rehearsal.location_notes}
              </div>
            )}
            {rehearsal.notes && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#4a5568', background: '#faf8f5', padding: '10px 14px', borderRadius: 6 }}>
                <strong>Notes:</strong> {rehearsal.notes}
              </div>
            )}
          </div>
        )}

        {/* SHUTTLE */}
        {sections.shuttle && shuttle.length > 0 && (
          <div className="print-section section-start">
            <SectionHeader title="Shuttle Schedule" icon="🚌" />
            {shuttle.map(run => (
              <div key={run.id} className="shuttle-run">
                <div className="shuttle-label">{run.label || `Run ${run.sort_order + 1}`}</div>
                <div className="shuttle-detail">📍 Pickup: {run.pickup_location} · {run.pickup_time}</div>
                <div className="shuttle-detail">📍 Dropoff: {run.dropoff_location} · {run.dropoff_time}</div>
                {run.notes && <div className="shuttle-detail" style={{ color: '#7a6b5a', marginTop: 4 }}>📝 {run.notes}</div>}
              </div>
            ))}
          </div>
        )}

        {/* MAKEUP SCHEDULE */}
        {sections.makeup && makeup.length > 0 && (
          <div className="print-section section-start">
            <SectionHeader title="Hair & Makeup Schedule" icon="💄" />
            <table className="makeup-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Name</th>
                  <th>Service</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {makeup.map(slot => (
                  <tr key={slot.id}>
                    <td>{slot.time || '—'}</td>
                    <td>{slot.person_name || '—'}</td>
                    <td>{slot.service_type || '—'}</td>
                    <td>{slot.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DECOR INVENTORY */}
        {sections.decor && Object.keys(decorBySpace).length > 0 && (
          <div className="print-section section-start">
            <SectionHeader title="Decor Inventory" icon="🌿" />
            {Object.entries(decorBySpace).map(([space, items]) => (
              <div key={space} className="decor-space">
                <div className="decor-space-name">{space}</div>
                {items.map(item => (
                  <div key={item.id} className="decor-item">
                    <span className="decor-item-name">{item.item_name}</span>
                    {item.color && <span className="decor-item-color">{item.color}</span>}
                    {(item.quantity || item.quantity === 0) && (
                      <span className="decor-item-qty">Qty: {item.quantity}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* VENDORS */}
        {sections.vendors && bookedVendors.length > 0 && (
          <div className="print-section section-start">
            <SectionHeader title="Vendors" icon="📇" />
            <table className="vendor-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {bookedVendors.map(v => (
                  <tr key={v.id}>
                    <td>{v.vendor_type}</td>
                    <td>{v.vendor_name || '—'}</td>
                    <td>{v.vendor_contact || '—'}</td>
                    <td>{v.is_booked ? <span className="vendor-booked">Booked ✓</span> : <span style={{ color: '#9a8b7a', fontSize: 12 }}>Pending</span>}</td>
                    <td>{v.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ALLERGIES */}
        {sections.allergies && allergies.length > 0 && (
          <div className="print-section section-start">
            <SectionHeader title="Dietary Restrictions & Allergies" icon="⚠️" />
            <table className="allergy-table">
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Restriction</th>
                  <th>Severity</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {allergies.map(a => (
                  <tr key={a.id}>
                    <td>{a.guest_name || '—'}</td>
                    <td>{a.restriction_type || '—'}</td>
                    <td>
                      {a.severity && (
                        <span className={`allergy-severity ${a.severity.toLowerCase()}`}>{a.severity}</span>
                      )}
                    </td>
                    <td>{a.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* WEDDING DETAILS */}
        {sections.details && weddingDetails && (
          <div className="print-section section-start">
            <SectionHeader title="Wedding Details" icon="📋" />
            <div className="info-grid">
              <DataRow label="Colors" value={weddingDetails.wedding_colors} />
              <DataRow label="Ceremony Location" value={weddingDetails.ceremony_location} />
              <DataRow label="Arbor Choice" value={weddingDetails.arbor_choice} />
              <DataRow label="Unity Table" value={weddingDetails.unity_table} />
              <DataRow label="Seating Method" value={weddingDetails.seating_method} />
              <DataRow label="Send-Off Type" value={weddingDetails.send_off_type} />
              <DataRow label="Dogs Coming" value={weddingDetails.dogs_coming === true ? `Yes — ${weddingDetails.dogs_description || ''}` : weddingDetails.dogs_coming === false ? 'No' : null} />
              <DataRow label="Table Numbers" value={weddingDetails.providing_table_numbers === true ? 'Couple providing' : weddingDetails.providing_table_numbers === false ? 'Not needed' : null} />
              <DataRow label="Charger Plates" value={weddingDetails.providing_charger_plates === true ? 'Couple providing' : weddingDetails.providing_charger_plates === false ? 'Not providing' : null} />
              <DataRow label="Champagne Glasses" value={weddingDetails.providing_champagne_glasses === true ? 'Couple providing' : weddingDetails.providing_champagne_glasses === false ? 'Not providing' : null} />
              <DataRow label="Cake Cutter" value={weddingDetails.providing_cake_cutter === true ? 'Couple providing' : weddingDetails.providing_cake_cutter === false ? 'Not providing' : null} />
              <DataRow label="Cake Topper" value={weddingDetails.providing_cake_topper === true ? 'Couple providing' : weddingDetails.providing_cake_topper === false ? 'Not providing' : null} />
              <DataRow label="Favors" value={weddingDetails.favors_description} />
            </div>
            {weddingDetails.ceremony_notes && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#4a5568', background: '#faf8f5', padding: '10px 14px', borderRadius: 6 }}>
                <strong>Ceremony notes:</strong> {weddingDetails.ceremony_notes}
              </div>
            )}
            {weddingDetails.reception_notes && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#4a5568', background: '#faf8f5', padding: '10px 14px', borderRadius: 6 }}>
                <strong>Reception notes:</strong> {weddingDetails.reception_notes}
              </div>
            )}
            {weddingDetails.send_off_notes && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#4a5568', background: '#faf8f5', padding: '10px 14px', borderRadius: 6 }}>
                <strong>Send-off notes:</strong> {weddingDetails.send_off_notes}
              </div>
            )}
          </div>
        )}

        {/* CEREMONY CHAIRS */}
        {(() => {
          const fr = ceremonyChairs?.frontRows
          const splitNames = s => (s || '').split('\n').map(x => x.trim()).filter(Boolean)
          const row1L = splitNames(fr?.row1?.left)
          const row1R = splitNames(fr?.row1?.right)
          const row2Enabled = !!fr?.row2?.enabled
          const row2L = row2Enabled ? splitNames(fr?.row2?.left) : []
          const row2R = row2Enabled ? splitNames(fr?.row2?.right) : []
          const hasFrontRows = row1L.length + row1R.length + row2L.length + row2R.length > 0
          const hasChairRows = ceremonyChairs?.rows?.length > 0
          if (!sections.ceremonyChairs || (!hasChairRows && !hasFrontRows)) return null
          return (
          <div className="print-section section-start">
            <SectionHeader title="Ceremony Chair Plan" icon="🪑" />

            {hasFrontRows && (
              <div style={{ fontSize: 12, marginBottom: 14 }}>
                <p style={{ fontWeight: 600, marginBottom: 6 }}>Front row seating</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #333' }}>
                      <th style={{ textAlign: 'left', padding: '3px 6px', width: 70 }}>Row</th>
                      <th style={{ textAlign: 'left', padding: '3px 6px' }}>Left side</th>
                      <th style={{ textAlign: 'left', padding: '3px 6px' }}>Right side</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 600 }}>Row 1</td>
                      <td style={{ padding: '4px 6px' }}>{row1L.length ? row1L.join(', ') : <span style={{ color: '#aaa' }}>—</span>}</td>
                      <td style={{ padding: '4px 6px' }}>{row1R.length ? row1R.join(', ') : <span style={{ color: '#aaa' }}>—</span>}</td>
                    </tr>
                    {row2Enabled && (
                      <tr style={{ borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                        <td style={{ padding: '4px 6px', fontWeight: 600 }}>Row 2</td>
                        <td style={{ padding: '4px 6px' }}>{row2L.length ? row2L.join(', ') : <span style={{ color: '#aaa' }}>—</span>}</td>
                        <td style={{ padding: '4px 6px' }}>{row2R.length ? row2R.join(', ') : <span style={{ color: '#aaa' }}>—</span>}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {hasChairRows && (
              <div style={{ fontSize: 12 }}>
                <p style={{ marginBottom: 8 }}>
                  <strong>{ceremonyChairs.rows.reduce((s, r) => s + (r.left || 0) + (r.right || 0), 0)} total chairs</strong> across {ceremonyChairs.rows.length} rows
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #333' }}>
                      <th style={{ textAlign: 'left', padding: '3px 6px' }}>Row</th>
                      <th style={{ textAlign: 'center', padding: '3px 6px' }}>Left</th>
                      <th style={{ textAlign: 'center', padding: '3px 6px' }}>Right</th>
                      <th style={{ textAlign: 'center', padding: '3px 6px' }}>Total</th>
                      <th style={{ textAlign: 'left', padding: '3px 6px' }}>Label</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ceremonyChairs.rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '3px 6px' }}>R{i + 1}</td>
                        <td style={{ textAlign: 'center', padding: '3px 6px' }}>{row.left}</td>
                        <td style={{ textAlign: 'center', padding: '3px 6px' }}>{row.right}</td>
                        <td style={{ textAlign: 'center', padding: '3px 6px', fontWeight: 600 }}>{(row.left || 0) + (row.right || 0)}</td>
                        <td style={{ padding: '3px 6px', color: '#666' }}>{row.label || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )
        })()}

        {/* SEATING BY TABLE */}
        {sections.seating && guests.length > 0 && (
          <div className="print-section section-start">
            <SectionHeader title="Seating Chart" icon="🪑" />
            {(() => {
              const byTable = {}
              const unassigned = []
              guests.forEach(g => {
                if (g.table_assignment) {
                  if (!byTable[g.table_assignment]) byTable[g.table_assignment] = []
                  byTable[g.table_assignment].push(g)
                } else {
                  unassigned.push(g)
                }
              })
              return (
                <div style={{ fontSize: 12 }}>
                  {Object.entries(byTable).sort((a, b) => a[0].localeCompare(b[0])).map(([table, tableGuests]) => (
                    <div key={table} style={{ marginBottom: 12 }}>
                      <p style={{ fontWeight: 600, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 4 }}>
                        {table} <span style={{ fontWeight: 400, color: '#888' }}>({tableGuests.length} guest{tableGuests.length !== 1 ? 's' : ''})</span>
                      </p>
                      {tableGuests.map(g => (
                        <p key={g.id} style={{ paddingLeft: 12, lineHeight: 1.6 }}>
                          {g.first_name} {g.last_name || ''}
                          {g.dietary_restrictions && <span style={{ color: '#c53030', marginLeft: 8, fontSize: 10 }}>⚠ {g.dietary_restrictions}</span>}
                          {g.meal_choice && <span style={{ color: '#666', marginLeft: 8, fontSize: 10 }}>({g.meal_choice})</span>}
                        </p>
                      ))}
                    </div>
                  ))}
                  {unassigned.length > 0 && (
                    <div>
                      <p style={{ fontWeight: 600, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 4 }}>
                        Unassigned <span style={{ fontWeight: 400, color: '#888' }}>({unassigned.length})</span>
                      </p>
                      {unassigned.map(g => (
                        <p key={g.id} style={{ paddingLeft: 12, lineHeight: 1.6 }}>{g.first_name} {g.last_name || ''}</p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* GUEST CARE NOTES */}
        {sections.guestCare && guestCare.length > 0 && (
          <div className="print-section section-start">
            <SectionHeader title="Guest Care Notes" icon="💝" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Guest</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Category</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {guestCare.map((n, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '4px 8px' }}>{n.guest_name || '—'}</td>
                    <td style={{ padding: '4px 8px' }}>{n.category || '—'}</td>
                    <td style={{ padding: '4px 8px' }}>{n.content || n.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PARENTS INFO */}
        {sections.parents && weddingDetails && (weddingDetails.partner1_parents || weddingDetails.partner2_parents) && (
          <div className="print-section section-start">
            <SectionHeader title="Parents & Family" icon="👨‍👩‍👧" />
            <div className="info-grid">
              <DataRow label="Partner 1 Parents" value={weddingDetails.partner1_parents} />
              {weddingDetails.partner1_parents_met !== null && (
                <DataRow label="Have We Met Them?" value={weddingDetails.partner1_parents_met ? 'Yes' : 'No'} />
              )}
              <DataRow label="Partner 2 Parents" value={weddingDetails.partner2_parents} />
              {weddingDetails.partner2_parents_met !== null && (
                <DataRow label="Have We Met Them?" value={weddingDetails.partner2_parents_met ? 'Yes' : 'No'} />
              )}
              <DataRow label="Wedding Party (Side 1)" value={weddingDetails.wedding_party_count_1} />
              <DataRow label="Wedding Party (Side 2)" value={weddingDetails.wedding_party_count_2} />
              {weddingDetails.dogs_coming && (
                <>
                  <DataRow label="Dog" value={weddingDetails.dogs_description} />
                  <DataRow label="Dog Sitter" value={weddingDetails.dog_sitter_name} />
                  <DataRow label="Sitter Time" value={weddingDetails.dog_sitter_time} />
                </>
              )}
            </div>
          </div>
        )}

        {/* PLANNING HIGHLIGHTS */}
        {sections.highlights && (
          <div className="print-section section-start">
            <SectionHeader title="Planning Highlights" icon="✨" />
            {loadingHighlights ? (
              <div className="highlights-loading">
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #c8bfb5', borderTopColor: '#3d5a47', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Generating highlights…
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : highlights ? (
              <div className="highlights-body">
                {highlights.split('\n').map((line, i) => {
                  const heading = line.match(/^\*\*(.+)\*\*$/)
                  const bullet = line.match(/^[-•*]\s+(.*)/)
                  const numbered = line.match(/^\d+\.\s+\*\*(.+)\*\*/)
                  if (numbered) {
                    return <div key={i} className="hl-heading">{numbered[1]}</div>
                  }
                  if (heading) {
                    return <div key={i} className="hl-heading">{heading[1]}</div>
                  }
                  if (bullet) {
                    // Render inline bold within bullet
                    const parts = bullet[1].split(/\*\*(.+?)\*\*/)
                    return (
                      <div key={i} className="hl-bullet">
                        <span>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</span>
                      </div>
                    )
                  }
                  if (!line.trim()) return <div key={i} style={{ height: 6 }} />
                  // Plain line — render inline bold
                  const parts = line.split(/\*\*(.+?)\*\*/)
                  return (
                    <div key={i} style={{ marginBottom: 2 }}>
                      {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="empty-note">No planning notes found for this wedding.</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="print-footer">
          <span>Rixey Manor · Rapidan, Virginia</span>
          <span>{wedding?.couple_names} · {formatDate(wedding?.wedding_date)}</span>
          <span>Printed {printedAt}</span>
        </div>
      </div>
    </>
  )
}
