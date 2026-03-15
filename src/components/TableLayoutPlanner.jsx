import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const TABLE_SHAPES = [
  { id: 'round',       name: 'Round Tables',  icon: '⭕', description: '60" rounds, great for conversation', defaultSeats: 8 },
  { id: 'rectangular', name: 'Rectangular',   icon: '▭',  description: '6ft banquet tables',                defaultSeats: 8 },
  { id: 'farm',        name: 'Farm Tables',   icon: '🪵', description: 'Long rustic wood tables',           defaultSeats: 10 },
  { id: 'mixed',       name: 'Mixed',         icon: '🔀', description: 'Combination of styles',             defaultSeats: 8 },
]

const LINEN_COLORS = [
  { id: 'venue',      name: 'Leave to Rixey', color: '#f0f0f0', border: '#aaa' },
  { id: 'white',      name: 'White',          color: '#ffffff', border: '#e5e5e5' },
  { id: 'ivory',      name: 'Ivory',          color: '#fffff0' },
  { id: 'champagne',  name: 'Champagne',      color: '#f7e7ce' },
  { id: 'blush',      name: 'Blush',          color: '#ffc0cb' },
  { id: 'dusty-rose', name: 'Dusty Rose',     color: '#dcae96' },
  { id: 'sage',       name: 'Sage',           color: '#9caf88' },
  { id: 'dusty-blue', name: 'Dusty Blue',     color: '#6699cc' },
  { id: 'navy',       name: 'Navy',           color: '#000080' },
  { id: 'burgundy',   name: 'Burgundy',       color: '#722f37' },
  { id: 'black',      name: 'Black',          color: '#000000' },
]

const RUNNER_STYLES = [
  { key: 'none',     label: 'No runner',       desc: 'Cloth only' },
  { key: 'runner',   label: 'Runner',          desc: 'Fabric runner down the centre of each table' },
  { key: 'overlay',  label: 'Overlay',         desc: 'Sheer or satin layer over the base cloth' },
  { key: 'greenery', label: 'Greenery runner', desc: 'Florals or greenery down the centre' },
]

// Head table: 6ft rectangular tables pushed together
// One-sided:  ceil((people + 2) / 6) tables
// Two-sided:  ceil((people + 4) / 12) tables
function headTableCount(people, sided) {
  if (!people || people < 1) return 1
  return sided === 'two'
    ? Math.ceil(((people + 4) / 2) / 3)
    : Math.ceil((people + 2) / 3)
}

// Rixey inventory: all round dining tables → 132" round
// 6ft rectangle → 90"×132"
// Cocktail high-tops → 120" round
function getLinenSizes({ tableShape, tablesNeeded, rectTableCount, cocktailTables,
                         headTable, headTablePeople, headTableSided,
                         sweetheartTable, extraTablesLinenCount }) {
  const sizes = []

  if (tableShape === 'round') {
    sizes.push({ label: '132" round',  qty: tablesNeeded, note: 'Round dining tables' })
  } else if (tableShape === 'rectangular') {
    sizes.push({ label: '90"×132"',   qty: tablesNeeded, note: '6ft rectangular dining tables' })
  } else if (tableShape === 'farm') {
    sizes.push({ label: '14"×108" runner', qty: tablesNeeded, note: 'Farm tables — runner over bare wood' })
  } else if (tableShape === 'mixed') {
    const roundCount = tablesNeeded - (rectTableCount || 0)
    if (roundCount > 0)    sizes.push({ label: '132" round', qty: roundCount,          note: 'Round dining tables' })
    if (rectTableCount > 0) sizes.push({ label: '90"×132"',  qty: rectTableCount,      note: '6ft rectangular dining tables' })
  }

  if (headTable) {
    const n = headTableCount(headTablePeople, headTableSided)
    sizes.push({ label: '90"×132"', qty: n,
      note: `Head table — ${n} × 6ft rect (${headTablePeople} people, ${headTableSided === 'two' ? 'seated both sides' : 'one side only'})` })
  }

  if (sweetheartTable) {
    sizes.push({ label: '132" round', qty: 1, note: 'Sweetheart table (5ft round)' })
  }

  if (cocktailTables > 0) {
    sizes.push({ label: '120" round', qty: cocktailTables, note: 'Cocktail high-tops (floor length)' })
  }

  if (extraTablesLinenCount > 0) {
    sizes.push({ label: '90"×132"', qty: extraTablesLinenCount, note: 'Auxiliary tables (6ft rectangles) — excluding cake table' })
  }

  return sizes
}

const EXTRA_TABLES = [
  {
    category: 'Food & Beverage',
    note: 'Some of these may be included in your catering quote — check with your caterer',
    tables: [
      { id: 'cake',          name: 'Cake / Dessert Table',              icon: '🎂', needsLinen: true },
      { id: 'candy-bar',     name: 'Candy Bar / Sweets Table',          icon: '🍬', needsLinen: true },
      { id: 'late-night',    name: 'Late Night Snack Station',          icon: '🌙', needsLinen: true },
      { id: 'coffee-tea',    name: 'Coffee & Tea Station',              icon: '☕', needsLinen: true },
      { id: 'cigar-bar',     name: 'Cigar Bar',                         icon: '🚬', needsLinen: true },
      { id: 'smores',        name: "S'mores Station",                   icon: '🔥', needsLinen: false },
      { id: 'buffet',        name: 'Buffet Tables',                     icon: '🍽️', needsLinen: true, hasCount: true },
      { id: 'welcome-drinks',name: 'Welcome Drinks / Specialty Tasting', icon: '🥂', needsLinen: true },
    ]
  },
  {
    category: 'Guest Experience',
    note: 'Guest book, programs, and gift tables may be combined into one table depending on your decor choices',
    tables: [
      { id: 'guest-book',  name: 'Guest Book / Sign-In Table',    icon: '📖', needsLinen: true },
      { id: 'place-cards', name: 'Place Card / Escort Card Table', icon: '💌', needsLinen: true },
      { id: 'gifts',       name: 'Gift Table',                     icon: '🎁', needsLinen: true },
      { id: 'card-box',    name: 'Card Box Table',                 icon: '💳', needsLinen: true },
      { id: 'favors',      name: 'Favor Table',                    icon: '🎀', needsLinen: true },
      { id: 'photo-booth', name: 'Photo Booth Props Table',        icon: '📸', needsLinen: true },
      { id: 'polaroid',    name: 'Polaroid / Guest Photo Station', icon: '🖼️', needsLinen: true },
      { id: 'programs',    name: 'Programs Table',                 icon: '📜', needsLinen: true },
    ]
  },
  {
    category: 'Memory & Tribute',
    tables: [
      { id: 'memorial',     name: 'Memorial Table',       icon: '🕯️', needsLinen: true, description: 'Honoring deceased loved ones' },
      { id: 'family-photos',name: 'Family Photo Display', icon: '👨‍👩‍👧‍👦', needsLinen: true },
    ]
  },
  {
    category: 'Ceremony',
    note: 'Ceremony tables rarely require linens — decorative options are typically used instead',
    tables: [
      { id: 'unity',       name: 'Unity Candle / Sand Ceremony Table', icon: '🕯️', needsLinen: false },
      { id: 'ring-bearer', name: 'Ring Bearer Stand / Table',          icon: '💍', needsLinen: false },
    ]
  },
  {
    category: 'Reception Extras',
    tables: [
      { id: 'dj',            name: 'DJ / Band Table',         icon: '🎧', needsLinen: true },
      { id: 'seating-chart', name: 'Seating Chart Display',   icon: '📋', needsLinen: false },
      { id: 'lawn-games',    name: 'Lawn Games Station',      icon: '🎯', needsLinen: false },
      { id: 'kids-activity', name: 'Kids Activity Table',     icon: '🖍️', needsLinen: true },
    ]
  },
]

// ── Toggle helper ──────────────────────────────────────────────────────────────
function Toggle({ on, onToggle, label, sublabel }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button type="button" onClick={onToggle}
        className={`w-10 h-5 rounded-full flex-shrink-0 transition-colors relative ${on ? 'bg-sage-500' : 'bg-cream-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <div>
        <p className={`text-sm ${on ? 'text-sage-700 font-medium' : 'text-sage-500'}`}>{label}</p>
        {sublabel && <p className="text-xs text-sage-400">{sublabel}</p>}
      </div>
    </label>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TableLayoutPlanner({ weddingId, userId, isAdmin = false }) {
  const [guestCount, setGuestCount]         = useState(100)
  const [tableShape, setTableShape]         = useState('round')
  const [guestsPerTable, setGuestsPerTable] = useState(8)
  const [rectTableCount, setRectTableCount] = useState(0)

  // Special tables
  const [sweetheartTable, setSweetheartTable] = useState(true)
  const [headTable, setHeadTable]             = useState(false)
  const [headTablePeople, setHeadTablePeople] = useState(10)
  const [headTableSided, setHeadTableSided]   = useState('one')  // 'one' | 'two'
  const [kidsTable, setKidsTable]             = useState(false)
  const [kidsCount, setKidsCount]             = useState(0)
  const [cocktailTables, setCocktailTables]   = useState(0)

  // Linens
  const [linenColor, setLinenColor]         = useState('white')
  const [napkinColor, setNapkinColor]       = useState('sage')
  const [linenVenueChoice, setLinenVenueChoice] = useState(false)
  const [runnerStyle, setRunnerStyle]       = useState('none')
  const [chargersOn, setChargersOn]         = useState(false)

  // Layout
  const [checkeredDanceFloor, setCheckeredDanceFloor] = useState(false)
  const [loungeArea, setLoungeArea]                   = useState(false)

  // Notes
  const [centerpieceNotes, setCenterpieceNotes] = useState('')
  const [layoutNotes, setLayoutNotes]           = useState('')
  const [linenNotes, setLinenNotes]             = useState('')

  // Extra tables
  const [extraTables, setExtraTables] = useState({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    if (weddingId) loadTableSetup()
  }, [weddingId])

  const loadTableSetup = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tables/${weddingId}`)
      const data = await response.json()
      if (data.tables) {
        const t = data.tables
        setGuestCount(t.guest_count || 100)
        setTableShape(t.table_shape || 'round')
        setGuestsPerTable(t.guests_per_table || 8)
        setSweetheartTable(t.sweetheart_table ?? true)
        setHeadTable(t.head_table || false)
        setHeadTablePeople(t.head_table_size || 10)
        // head_table_placement is repurposed to store sided-ness
        setHeadTableSided(t.head_table_placement === 'two' ? 'two' : 'one')
        setCocktailTables(t.cocktail_tables || 0)
        setKidsTable(t.kids_table || false)
        setKidsCount(t.kids_count || 0)
        setLinenColor(t.linen_color || 'white')
        setNapkinColor(t.napkin_color || 'sage')
        setLinenVenueChoice(t.linen_venue_choice || false)
        setRunnerStyle(t.runner_style || 'none')
        // chair_sash is repurposed to store chargersOn
        setChargersOn(t.chair_sash || false)
        setCheckeredDanceFloor(t.dance_floor_size === 'checkered')
        setLoungeArea(t.lounge_area || false)
        setCenterpieceNotes(t.centerpiece_notes || '')
        setLayoutNotes(t.layout_notes || '')
        setLinenNotes(t.linen_notes || '')
        setExtraTables(t.extra_tables || {})
        if (t.table_shape === 'mixed') setRectTableCount(0)
      }
    } catch (err) {
      console.error('Failed to load table setup:', err)
    }
    setLoading(false)
  }

  const saveTableSetup = async () => {
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weddingId,
          userId,
          guestCount,
          tableShape,
          guestsPerTable,
          headTable,
          headTableSize: headTablePeople,    // stored as head_table_size
          headTableSided,                    // stored as head_table_placement (repurposed)
          sweetheartTable,
          cocktailTables,
          kidsTable,
          kidsCount,
          linenColor,
          napkinColor,
          linenVenueChoice,
          runnerStyle,
          chargersOn,                        // stored as chair_sash (repurposed)
          checkeredDanceFloor,               // stored as dance_floor_size = 'checkered'/'none'
          loungeArea,
          centerpieceNotes,
          layoutNotes,
          linenNotes,
          extraTables,
        })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save table setup:', err)
    }
    setSaving(false)
  }

  // ── Calculations ──────────────────────────────────────────────────────────

  const htCount = headTable ? headTableCount(headTablePeople, headTableSided) : 0
  const seatedGuests = guestCount
    - (sweetheartTable ? 2 : 0)
    - (headTable ? headTablePeople : 0)
    - (kidsTable ? kidsCount : 0)
  const tablesNeeded = Math.ceil(Math.max(0, seatedGuests) / guestsPerTable)
  const totalTables  = tablesNeeded + (sweetheartTable ? 1 : 0) + htCount + (kidsTable ? 1 : 0)

  const extraTablesLinenCount = EXTRA_TABLES.flatMap(cat => cat.tables).reduce((count, table) => {
    const ts = extraTables[table.id]
    if (ts?.selected && table.needsLinen) return count + (table.hasCount ? (ts.count || 1) : 1)
    return count
  }, 0)
  const extraTablesCount = EXTRA_TABLES.flatMap(cat => cat.tables).reduce((count, table) => {
    const ts = extraTables[table.id]
    if (ts?.selected) return count + (table.hasCount ? (ts.count || 1) : 1)
    return count
  }, 0)

  const linensNeeded  = totalTables + cocktailTables + extraTablesLinenCount
  const napkinsNeeded = guestCount + 10

  if (loading) return <div className="text-sage-400 text-center py-8">Loading table setup…</div>

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Table & Seating Planner</h2>
          <p className="text-sage-500 text-sm">Calculate tables, linens, and layout</p>
        </div>
        <button onClick={saveTableSetup} disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${saved ? 'bg-green-500 text-white' : 'bg-sage-600 text-white hover:bg-sage-700'} disabled:opacity-50`}>
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Setup'}
        </button>
      </div>

      {/* Guest Count */}
      <div className="bg-sage-50 rounded-xl p-4">
        <label className="block text-sage-700 font-medium mb-2">Total Guest Count</label>
        <div className="flex items-center gap-4">
          <input type="range" min="20" max="300" value={guestCount}
            onChange={e => setGuestCount(Number(e.target.value))}
            className="flex-1 h-2 bg-sage-200 rounded-lg appearance-none cursor-pointer" />
          <input type="number" min="1" max="500" value={guestCount}
            onChange={e => setGuestCount(Number(e.target.value))}
            className="w-20 px-3 py-2 border border-sage-200 rounded-lg text-center font-medium" />
          <span className="text-sage-500">guests</span>
        </div>
      </div>

      {/* Table Style */}
      <div>
        <label className="block text-sage-700 font-medium mb-3">Table Style</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TABLE_SHAPES.map(shape => (
            <button key={shape.id}
              onClick={() => { setTableShape(shape.id); setGuestsPerTable(shape.defaultSeats) }}
              className={`p-4 rounded-xl border-2 text-center transition ${tableShape === shape.id ? 'border-sage-600 bg-sage-50' : 'border-cream-200 bg-white hover:border-sage-300'}`}>
              <span className="text-3xl block mb-1">{shape.icon}</span>
              <span className="font-medium text-sage-800 text-sm">{shape.name}</span>
              <p className="text-sage-400 text-xs mt-1">{shape.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Guests per table */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-sage-700 font-medium">Guests per table:</label>
        <select value={guestsPerTable} onChange={e => setGuestsPerTable(Number(e.target.value))}
          className="px-3 py-2 border border-cream-300 rounded-lg">
          {[6, 8, 10, 12].map(n => <option key={n} value={n}>{n} guests</option>)}
        </select>
        {(tableShape === 'rectangular' || tableShape === 'mixed') && (
          <p className="text-xs text-sage-400 italic">We assume 6 guests per rectangular table.</p>
        )}
      </div>

      {/* Mixed split */}
      {tableShape === 'mixed' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-amber-800 mb-2">How many of your dining tables will be rectangular?</p>
          <div className="flex items-center gap-3">
            <input type="number" min={0} max={tablesNeeded} value={rectTableCount}
              onChange={e => setRectTableCount(Math.min(tablesNeeded, Math.max(0, Number(e.target.value))))}
              className="w-20 px-3 py-2 border border-amber-300 rounded-lg text-center font-medium" />
            <span className="text-sm text-amber-700">rectangular, {Math.max(0, tablesNeeded - rectTableCount)} round</span>
          </div>
        </div>
      )}

      {/* Special Tables */}
      <div className="bg-cream-50 rounded-xl p-4 space-y-5">
        <h3 className="font-medium text-sage-700">Special Tables</h3>

        {/* Sweetheart */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={sweetheartTable} onChange={e => setSweetheartTable(e.target.checked)}
            className="w-5 h-5 rounded border-sage-300 text-sage-600" />
          <span className="text-2xl">💕</span>
          <div>
            <p className="font-medium text-sage-800">Sweetheart Table</p>
            <p className="text-sage-500 text-sm">Just for the two of you</p>
          </div>
        </label>

        {/* Head Table */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={headTable} onChange={e => setHeadTable(e.target.checked)}
              className="w-5 h-5 rounded border-sage-300 text-sage-600" />
            <span className="text-2xl">👑</span>
            <div>
              <p className="font-medium text-sage-800">Head Table</p>
              <p className="text-sage-500 text-sm">Long table for wedding party</p>
            </div>
          </label>

          {headTable && (
            <div className="mt-3 ml-8 space-y-3 bg-white border border-cream-200 rounded-xl p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="text-sm text-sage-600 font-medium">How many people at the head table?</label>
                <input type="number" min={2} max={30} value={headTablePeople}
                  onChange={e => setHeadTablePeople(Math.max(2, Number(e.target.value)))}
                  className="w-20 px-3 py-2 border border-cream-300 rounded-lg text-center font-medium" />
              </div>
              <div>
                <p className="text-sm text-sage-600 font-medium mb-2">Seated one side or both?</p>
                <div className="flex gap-3">
                  {[
                    { key: 'one', label: 'One side only', desc: 'All facing guests' },
                    { key: 'two', label: 'Both sides',    desc: 'Like a dinner party' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setHeadTableSided(opt.key)}
                      className={`flex-1 px-3 py-2 rounded-xl border-2 text-left transition ${headTableSided === opt.key ? 'border-sage-500 bg-sage-50' : 'border-cream-200 hover:border-sage-300'}`}>
                      <p className={`text-sm font-medium ${headTableSided === opt.key ? 'text-sage-700' : 'text-sage-500'}`}>{opt.label}</p>
                      <p className="text-xs text-sage-400">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-sage-400">
                That's <strong>{htCount} × 6ft table{htCount !== 1 ? 's' : ''}</strong> pushed together for your head table.
              </p>
            </div>
          )}
        </div>

        {/* Kids Table */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={kidsTable} onChange={e => setKidsTable(e.target.checked)}
            className="w-5 h-5 rounded border-sage-300 text-sage-600" />
          <span className="text-2xl">👶</span>
          <div className="flex-1">
            <p className="font-medium text-sage-800">Kids Table</p>
            <p className="text-sage-500 text-sm">Separate table for children</p>
          </div>
          {kidsTable && (
            <input type="number" min={1} max={20} value={kidsCount}
              onChange={e => setKidsCount(Number(e.target.value))}
              className="w-16 px-2 py-1 border border-cream-300 rounded text-center" placeholder="# kids" />
          )}
        </label>

        {/* Cocktail Tables */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍸</span>
          <div className="flex-1">
            <p className="font-medium text-sage-800">Cocktail Tables</p>
            <p className="text-sage-500 text-sm">High-tops for mingling — Rixey has 5</p>
          </div>
          <input type="number" min={0} max={5} value={Math.min(5, cocktailTables)}
            onChange={e => setCocktailTables(Math.min(5, Math.max(0, Number(e.target.value))))}
            className="w-16 px-2 py-1 border border-cream-300 rounded text-center" />
        </div>
        {cocktailTables > 5 && (
          <p className="text-xs text-amber-600 ml-11">Rixey has 5 cocktail tables — additional tables would need to be rented.</p>
        )}
      </div>

      {/* Linens */}
      <div>
        <h3 className="font-medium text-sage-700 mb-3">Linen Colors</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Tablecloth', color: linenColor, set: setLinenColor },
            { label: 'Napkins',    color: napkinColor, set: setNapkinColor },
          ].map(({ label, color, set }) => (
            <div key={label}>
              <label className="block text-sage-600 text-sm mb-2">{label}</label>
              <div className="flex flex-wrap gap-2">
                {LINEN_COLORS.map(c => (
                  <button key={c.id} onClick={() => set(c.id)}
                    className={`w-8 h-8 rounded-full border-2 transition ${color === c.id ? 'scale-110' : ''}`}
                    style={{ backgroundColor: c.color, borderColor: c.border || (color === c.id ? '#4a7c59' : '#e5e5e5') }}
                    title={c.name} />
                ))}
              </div>
              <p className="text-sage-500 text-xs mt-1">Selected: {LINEN_COLORS.find(c => c.id === color)?.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tablecloth Sizes */}
      <div className="border border-cream-200 rounded-xl overflow-hidden">
        <div className="bg-cream-50 px-4 py-3 border-b border-cream-200 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sage-700">Tablecloth Sizes</h3>
            <p className="text-sage-500 text-xs mt-0.5">All linens are floor length</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-sage-500 cursor-pointer">
            <input type="checkbox" checked={linenVenueChoice} onChange={e => setLinenVenueChoice(e.target.checked)}
              className="rounded border-sage-300 text-sage-600" />
            Leave to Rixey
          </label>
        </div>

        {!linenVenueChoice ? (
          <div className="p-4 space-y-5">
            {/* Size guide */}
            <div>
              <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">What to order</p>
              <div className="bg-white border border-cream-200 rounded-xl divide-y divide-cream-100">
                {getLinenSizes({ tableShape, tablesNeeded, rectTableCount,
                  cocktailTables, headTable, headTablePeople, headTableSided,
                  sweetheartTable, extraTablesLinenCount
                }).map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-sage-700">{row.label}</p>
                      <p className="text-xs text-sage-400">{row.note}</p>
                    </div>
                    <span className="text-lg font-bold text-sage-600 ml-4 flex-shrink-0">×{row.qty}</span>
                  </div>
                ))}
                {extraTablesLinenCount > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-sage-700">Match your dining tables</p>
                      <p className="text-xs text-sage-400">Additional / specialty tables needing cloths</p>
                    </div>
                    <span className="text-lg font-bold text-sage-600 ml-4 flex-shrink-0">×{extraTablesLinenCount}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-sage-400 mt-2">Total tablecloths needed: <strong>{linensNeeded}</strong></p>
            </div>

            {/* Runner */}
            <div>
              <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">Table runner / overlay</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {RUNNER_STYLES.map(r => (
                  <button key={r.key} onClick={() => setRunnerStyle(r.key)}
                    className={`p-3 rounded-xl border-2 text-left transition ${runnerStyle === r.key ? 'border-sage-500 bg-sage-50' : 'border-cream-200 hover:border-sage-300'}`}>
                    <p className={`text-sm font-medium ${runnerStyle === r.key ? 'text-sage-700' : 'text-sage-500'}`}>{r.label}</p>
                    {r.desc && <p className="text-xs text-sage-400 mt-0.5">{r.desc}</p>}
                  </button>
                ))}
              </div>
            </div>

            {/* Chargers */}
            <div>
              <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">Charger plates</p>
              <Toggle on={chargersOn} onToggle={() => setChargersOn(v => !v)}
                label="Add charger plates"
                sublabel={chargersOn ? `${guestCount} chargers needed` : 'Decorative base plates under the dinner plate'} />
            </div>

            {/* Linen notes */}
            <div>
              <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">Linen notes</label>
              <textarea value={linenNotes} onChange={e => setLinenNotes(e.target.value)}
                placeholder="Specific linen requests, rental company, any constraints…"
                rows={2} className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none" />
            </div>
          </div>
        ) : (
          <p className="px-4 py-3 text-sm text-sage-400 italic">Rixey will select appropriate linens for your table style and colour scheme.</p>
        )}
      </div>

      {/* Layout Preferences */}
      <div className="bg-cream-50 rounded-xl p-4 space-y-4">
        <h3 className="font-medium text-sage-700">Layout Preferences</h3>
        <p className="text-sage-400 text-xs -mt-2">This helps us build your floor plan — the more detail the better.</p>

        {/* Checkered dance floor */}
        <div>
          <label className="block text-sage-600 text-sm font-medium mb-2">Dance floor</label>
          <Toggle on={checkeredDanceFloor} onToggle={() => setCheckeredDanceFloor(v => !v)}
            label="We'd like to rent a chequered dance floor"
            sublabel={checkeredDanceFloor ? 'We recommend 12×12 or 12×16 ft — we\'ll confirm the size with you' : undefined} />
          {checkeredDanceFloor && (
            <p className="text-xs text-sage-400 mt-2 ml-13 pl-0.5">Popular sizes at Rixey are 12×12 ft and 12×16 ft.</p>
          )}
        </div>

        {/* Lounge area */}
        <Toggle on={loungeArea} onToggle={() => setLoungeArea(v => !v)}
          label="Lounge seating area"
          sublabel="Sofas / armchairs — takes up roughly 10×12 ft of floor space" />
      </div>

      {/* Centerpieces */}
      <div>
        <label className="block text-sage-700 font-medium mb-2">Centerpiece Ideas</label>
        <textarea value={centerpieceNotes} onChange={e => setCenterpieceNotes(e.target.value)}
          placeholder="Describe your centerpiece vision… (flowers, candles, greenery, height, etc.)"
          className="w-full px-4 py-3 border border-cream-300 rounded-lg text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-sage-300" />
      </div>

      {/* Layout Notes */}
      <div>
        <label className="block text-sage-700 font-medium mb-2">Layout Notes</label>
        <textarea value={layoutNotes} onChange={e => setLayoutNotes(e.target.value)}
          placeholder="Any special seating requests, table placement preferences, accessibility needs…"
          className="w-full px-4 py-3 border border-cream-300 rounded-lg text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-sage-300" />
      </div>

      {/* Extra Tables */}
      <div className="border border-cream-200 rounded-xl overflow-hidden">
        <div className="bg-cream-50 px-4 py-3 border-b border-cream-200">
          <h3 className="font-medium text-sage-700">Additional Tables</h3>
          <p className="text-sage-500 text-sm">Select any specialty tables you'll need</p>
        </div>
        <div className="divide-y divide-cream-100">
          {EXTRA_TABLES.map(category => (
            <div key={category.category} className="p-4">
              <h4 className="font-medium text-sage-700 mb-1">{category.category}</h4>
              {category.note && <p className="text-sage-400 text-xs mb-3 italic">{category.note}</p>}
              <div className="space-y-2">
                {category.tables.map(table => {
                  const ts = extraTables[table.id] || { selected: false, count: 1, notes: '' }
                  const toggle = () => setExtraTables(prev => ({
                    ...prev,
                    [table.id]: { ...prev[table.id], selected: !ts.selected, count: prev[table.id]?.count || 1 }
                  }))
                  const updateCount = count => setExtraTables(prev => ({
                    ...prev, [table.id]: { ...prev[table.id], count: Number(count) }
                  }))
                  return (
                    <div key={table.id} className={`rounded-lg p-3 transition ${ts.selected ? 'bg-sage-50 border border-sage-200' : 'bg-white border border-cream-100'}`}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={ts.selected} onChange={toggle}
                          className="w-4 h-4 rounded border-sage-300 text-sage-600" />
                        <span className="text-xl">{table.icon}</span>
                        <div className="flex-1">
                          <p className={`text-sm ${ts.selected ? 'font-medium text-sage-800' : 'text-sage-600'}`}>{table.name}</p>
                          {table.description && <p className="text-sage-400 text-xs">{table.description}</p>}
                        </div>
                        {table.hasCount && ts.selected && (
                          <input type="number" min="1" max="10" value={ts.count || 1}
                            onChange={e => updateCount(e.target.value)} onClick={e => e.stopPropagation()}
                            className="w-14 px-2 py-1 border border-sage-200 rounded text-center text-sm" />
                        )}
                        {table.needsLinen && ts.selected && (
                          <span className="text-xs text-sage-400 bg-sage-100 px-2 py-0.5 rounded">+ linen</span>
                        )}
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-sage-600 text-white rounded-xl p-4 sm:p-6">
        <h3 className="font-serif text-lg mb-4">What You'll Need</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold">{totalTables}</p>
            <p className="text-sage-200 text-sm">Guest Tables</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{cocktailTables + extraTablesCount}</p>
            <p className="text-sage-200 text-sm">Other Tables</p>
            {extraTablesCount > 0 && (
              <p className="text-sage-300 text-xs">{cocktailTables} cocktail + {extraTablesCount} extra</p>
            )}
          </div>
          <div>
            <p className="text-3xl font-bold">{linensNeeded}</p>
            <p className="text-sage-200 text-sm">Tablecloths</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{napkinsNeeded}</p>
            <p className="text-sage-200 text-sm">Napkins</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-sage-500 space-y-2 text-center text-sage-200 text-sm">
          {linenVenueChoice ? (
            <p>Linens: leaving colour choice to Rixey</p>
          ) : (
            <p>{LINEN_COLORS.find(c => c.id === linenColor)?.name} tablecloths · {LINEN_COLORS.find(c => c.id === napkinColor)?.name} napkins · floor length</p>
          )}
          {!linenVenueChoice && runnerStyle !== 'none' && (
            <p>{RUNNER_STYLES.find(r => r.key === runnerStyle)?.label} on dining tables</p>
          )}
          {chargersOn && <p>Charger plates: {guestCount} needed</p>}
          {checkeredDanceFloor && <p>Chequered dance floor (12×12 or 12×16 ft)</p>}
          {loungeArea && <p>Lounge seating area included</p>}
        </div>

        {/* Linen size breakdown */}
        {!linenVenueChoice && (
          <div className="mt-4 pt-4 border-t border-sage-500">
            <p className="text-sage-200 text-sm mb-2">Tablecloth sizes to order:</p>
            <div className="space-y-1">
              {getLinenSizes({ tableShape, tablesNeeded, rectTableCount,
                cocktailTables, headTable, headTablePeople, headTableSided,
                sweetheartTable, extraTablesLinenCount
              }).map((row, i) => (
                <div key={i} className="flex justify-between text-sm text-sage-100">
                  <span>{row.note}</span>
                  <span className="font-bold ml-4">{row.qty} × {row.label}</span>
                </div>
              ))}
              {extraTablesLinenCount > 0 && (
                <div className="flex justify-between text-sm text-sage-100">
                  <span>Additional tables</span>
                  <span className="font-bold ml-4">{extraTablesLinenCount} × match dining</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected extra tables */}
        {extraTablesCount > 0 && (
          <div className="mt-4 pt-4 border-t border-sage-500">
            <p className="text-sage-200 text-sm mb-2">Additional tables selected:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXTRA_TABLES.flatMap(cat => cat.tables).filter(t => extraTables[t.id]?.selected).map(table => (
                <span key={table.id} className="text-xs bg-sage-500 px-2 py-1 rounded">
                  {table.icon} {table.name}
                  {table.hasCount && extraTables[table.id]?.count > 1 && ` (×${extraTables[table.id].count})`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floor plan note + save */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">📐</span>
          <div>
            <p className="text-sm font-medium text-amber-800">We'll build your floor plan</p>
            <p className="text-sm text-amber-700">Once you save, we'll be alerted and will build your custom floor plan. We'll still customise it with you — this just gives us everything we need to get started.</p>
          </div>
        </div>
      </div>

      {/* Bottom Save Button */}
      <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent pt-4 pb-2">
        <button onClick={saveTableSetup} disabled={saving}
          className={`w-full px-5 py-3 rounded-lg font-medium transition text-lg ${saved ? 'bg-green-500 text-white' : 'bg-sage-600 text-white hover:bg-sage-700'} disabled:opacity-50 shadow-lg`}>
          {saved ? '✓ Table Setup Saved!' : saving ? 'Saving…' : 'Save Table Setup'}
        </button>
      </div>
    </div>
  )
}
