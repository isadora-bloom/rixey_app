import { useState, useEffect, useRef, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ── Ingredient scaling → meaningful units ─────────────────────────────────────
// Converts a raw total (e.g. 120 oz) into something you'd actually buy (2 handles)

function toOz(qty, unit) {
  const u = (unit || '').toLowerCase().trim()
  if (u === 'oz' || u === 'fl oz' || u === 'ounce' || u === 'ounces') return qty
  if (u === 'ml')                                                        return qty / 29.574
  if (u === 'l' || u === 'liter' || u === 'liters')                     return qty * 33.814
  if (u === 'cup' || u === 'cups')                                       return qty * 8
  if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons')        return qty * 0.5
  if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons')             return qty / 6
  if (u === 'shot' || u === 'shots')                                     return qty * 1.5
  return null // unknown unit — can't convert
}

function scaleIngredient(perServingQty, unit, category, guests) {
  const total = perServingQty * guests
  const u     = (unit || '').toLowerCase().trim()

  // Dashes (bitters) — ~200 dashes per bottle
  if (u === 'dash' || u === 'dashes') {
    const bottles = Math.ceil(total / 200)
    return { qty: bottles, unit: bottles === 1 ? 'bottle' : 'bottles', note: `${Math.ceil(total)} dashes` }
  }

  // Whole items (fruit, eggs, etc.) — just count
  if (!u || u === 'each' || u === 'piece' || u === 'pieces' || u === 'wedge' || u === 'wedges' || u === 'slice' || u === 'slices') {
    return { qty: Math.ceil(total), unit: u || '', note: null }
  }

  const totalOz = toOz(total, unit)
  if (totalOz === null) {
    // Can't convert — return rounded raw
    return { qty: Math.ceil(total * 10) / 10, unit, note: null }
  }

  // Spirits → handles (59 oz = 1.75L) then 750ml bottles
  if (category === 'spirits') {
    if (totalOz >= 30) {
      const handles = totalOz / 59.2
      const rounded = Math.ceil(handles * 4) / 4 // round to nearest 0.25
      return { qty: rounded, unit: rounded === 1 ? 'handle (1.75L)' : 'handles (1.75L)', note: `${Math.round(totalOz)} oz total` }
    }
    const bottles = totalOz / 25.4
    const rounded = Math.ceil(bottles * 2) / 2
    return { qty: rounded, unit: rounded === 1 ? 'bottle (750ml)' : 'bottles (750ml)', note: `${Math.round(totalOz)} oz total` }
  }

  // Mixers / juices → gallons then quarts then oz
  if (category === 'mixers') {
    if (totalOz >= 64) {
      const gallons = totalOz / 128
      const rounded = Math.ceil(gallons * 4) / 4
      return { qty: rounded, unit: rounded === 1 ? 'gallon' : 'gallons', note: `${Math.round(totalOz)} oz total` }
    }
    if (totalOz >= 24) {
      const quarts = totalOz / 32
      const rounded = Math.ceil(quarts * 2) / 2
      return { qty: rounded, unit: rounded === 1 ? 'quart' : 'quarts', note: `${Math.round(totalOz)} oz total` }
    }
    return { qty: Math.ceil(totalOz), unit: 'oz', note: null }
  }

  // Everything else (syrups, liqueurs, etc.) → 750ml bottles then oz
  if (totalOz >= 20) {
    const bottles = totalOz / 25.4
    const rounded = Math.ceil(bottles * 2) / 2
    return { qty: rounded, unit: rounded === 1 ? 'bottle (750ml)' : 'bottles (750ml)', note: `${Math.round(totalOz)} oz total` }
  }
  return { qty: Math.ceil(totalOz * 10) / 10, unit: 'oz', note: null }
}

const CATEGORIES = [
  { key: 'beer',    label: 'Beer',    emoji: '🍺' },
  { key: 'wine',    label: 'Wine',    emoji: '🍷' },
  { key: 'spirits', label: 'Spirits', emoji: '🥃' },
  { key: 'mixers',  label: 'Mixers',  emoji: '🥤' },
  { key: 'garnish', label: 'Garnish', emoji: '🍋' },
  { key: 'other',   label: 'Other',   emoji: '📦' },
]

const BAR_TYPES = [
  { key: 'beer-wine',  label: 'Beer & Wine',                      beerPct: 35, winePct: 65, spiritsPct: 0  },
  { key: 'specialty',  label: 'Beer, Wine & Signature Cocktails', beerPct: 25, winePct: 50, spiritsPct: 25 },
  { key: 'full',       label: 'Modified Full Bar',                beerPct: 25, winePct: 40, spiritsPct: 35 },
]

// ── Quantity calculator ───────────────────────────────────────────────────────
// Handbook baseline: 120 guests × 8 hrs. Sliders scale from those defaults.

function calcQuantities({ guests, hours, barType, season, beerPct, winePct, spiritsPct, nonAlcPct, champagneToast, tableWine }) {
  const bt = BAR_TYPES.find(b => b.key === barType) || BAR_TYPES[0]

  // Scale factors: slider vs bar-type default. If default is 0, use 1 as fallback.
  const beerScale    = bt.beerPct    > 0 ? beerPct    / bt.beerPct    : (beerPct    > 0 ? 1 : 0)
  const wineScale    = bt.winePct    > 0 ? winePct    / bt.winePct    : (winePct    > 0 ? 1 : 0)
  const spiritsScale = bt.spiritsPct > 0 ? spiritsPct / bt.spiritsPct : (spiritsPct > 0 ? 1 : 0)
  const nonAlcScale  = nonAlcPct / 15  // 15% is the baseline

  const s        = guests / 120
  const h        = hours  / 8
  const isWinter = season === 'winter'
  const r        = []

  // ── Beer (kegs — no half kegs at Rixey) ──
  if (beerPct > 0) {
    r.push({ item_name: '1/6th barrel keg (~55 beers each)', quantity: Math.max(1, Math.ceil(2 * s * h * beerScale)),    unit: 'kegs', category: 'beer' })
    r.push({ item_name: '1/4 barrel keg (~82 beers each)',   quantity: Math.max(1, Math.ceil(2 * s * h * beerScale)),    unit: 'kegs', category: 'beer' })
  }

  // ── Wine — base: 8 cases for beer+wine/specialty, 6 for full bar (handbook) ──
  if (winePct > 0) {
    const baseCases        = barType === 'full' ? 6 : 8
    const totalCases       = Math.max(2, Math.ceil(baseCases * s * h * wineScale))
    const sparklingCases   = Math.max(1, Math.round(totalCases / 8))
    const remaining        = totalCases - sparklingCases
    const whiteCases       = isWinter ? Math.ceil(remaining * 3 / 7) : Math.ceil(remaining * 4 / 7)
    const redCases         = remaining - whiteCases
    r.push({ item_name: 'Sparkling wine / prosecco (toasts + mimosas)',                                         quantity: sparklingCases * 12, unit: 'bottles', category: 'wine' })
    r.push({ item_name: `White wine & rosé${isWinter ? ' (winter — less white)' : ' (summer — more white)'}`,  quantity: whiteCases * 12,     unit: 'bottles', category: 'wine' })
    r.push({ item_name: `Red wine${isWinter ? ' (winter — more red)' : ' (summer — less red)'}`,               quantity: redCases * 12,       unit: 'bottles', category: 'wine' })
  }

  // ── Spirits — full bar only (handbook: handles by type) ──
  if (barType === 'full' && spiritsPct > 0) {
    r.push({ item_name: 'Vodka (1.75L handles)',         quantity: Math.max(1, Math.ceil(2   * s * h * spiritsScale)), unit: 'handles', category: 'spirits' })
    r.push({ item_name: 'Rum (1.75L handles)',           quantity: Math.max(1, Math.ceil(1.5 * s * h * spiritsScale)), unit: 'handles', category: 'spirits' })
    r.push({ item_name: 'Gin (1.75L handles)',           quantity: Math.max(1, Math.ceil(1.5 * s * h * spiritsScale)), unit: 'handles', category: 'spirits' })
    r.push({ item_name: "Jack Daniel's (1.75L handles)", quantity: Math.max(2, Math.ceil(2.5 * s * h * spiritsScale)), unit: 'handles', category: 'spirits' })
    r.push({ item_name: 'Fireball (1.75L handles)',      quantity: Math.max(1, Math.ceil(1   * s * h * spiritsScale)), unit: 'handles', category: 'spirits' })
  }

  // ── Mixers ──
  r.push({ item_name: 'Coke (12-packs)',       quantity: Math.max(2, Math.ceil(4 * s * h * nonAlcScale)), unit: 'cases',   category: 'mixers' })
  r.push({ item_name: 'Sprite (12-packs)',     quantity: Math.max(1, Math.ceil(2 * s * h * nonAlcScale)), unit: 'cases',   category: 'mixers' })
  r.push({ item_name: 'Diet Coke (12-packs)',  quantity: Math.max(1, Math.ceil(2 * s * h * nonAlcScale)), unit: 'cases',   category: 'mixers' })
  r.push({ item_name: 'Ginger Ale (12-packs)', quantity: Math.max(1, Math.ceil(1 * s * h * nonAlcScale)), unit: 'cases',   category: 'mixers' })
  // Tonic + soda water — spirits bars need more; beer+wine just soda water
  if (barType !== 'beer-wine') {
    r.push({ item_name: 'Tonic Water (12-packs)', quantity: Math.max(1, Math.ceil(2 * s * h * spiritsScale)), unit: 'cases',   category: 'mixers' })
    r.push({ item_name: 'Soda Water (12-packs)',  quantity: Math.max(1, Math.ceil(2 * s * h * spiritsScale)), unit: 'cases',   category: 'mixers' })
    r.push({ item_name: 'Sour mix',               quantity: Math.max(1, Math.ceil(guests / 30)),              unit: 'bottles', category: 'mixers' })
  } else {
    r.push({ item_name: 'Soda Water (12-packs)',  quantity: Math.max(1, Math.ceil(1 * s * h)),               unit: 'cases',   category: 'mixers' })
  }
  r.push({ item_name: 'Orange juice (mimosas, breakfast, mixing)', quantity: Math.max(1, Math.ceil(guests / 15)), unit: 'gallons',    category: 'mixers' })
  r.push({ item_name: 'Cranberry juice',                           quantity: Math.max(1, Math.ceil(guests / 20)), unit: 'gallons',    category: 'mixers' })
  r.push({ item_name: 'Pineapple juice',                           quantity: Math.max(1, Math.ceil(guests / 20)), unit: 'large cans', category: 'mixers' })
  r.push({ item_name: 'Water (small bottles)',                     quantity: Math.max(6, Math.ceil(guests / 20)), unit: 'cases',      category: 'mixers' })

  // ── Garnishes — olives/cherries only for spirits bars ──
  r.push({ item_name: 'Lemons',  quantity: Math.ceil(guests / 8),  unit: '', category: 'garnish' })
  r.push({ item_name: 'Limes',   quantity: Math.ceil(guests / 8),  unit: '', category: 'garnish' })
  r.push({ item_name: 'Oranges', quantity: Math.ceil(guests / 12), unit: '', category: 'garnish' })
  if (barType !== 'beer-wine') {
    r.push({ item_name: 'Olives',              quantity: Math.max(1, Math.ceil(guests / 30)), unit: 'jars', category: 'garnish' })
    r.push({ item_name: 'Maraschino cherries', quantity: Math.max(1, Math.ceil(guests / 30)), unit: 'jars', category: 'garnish' })
  }

  // ── Ice + other (handbook: 60–80 lbs for 120 guests) ──
  const iceLbs = Math.max(60, Math.round(guests * 0.65 / 10) * 10)
  r.push({ item_name: 'Ice',              quantity: iceLbs,                unit: 'lbs', category: 'other' })
  r.push({ item_name: 'Cups / glasses',   quantity: Math.ceil(guests * 2), unit: '',    category: 'other' })
  r.push({ item_name: 'Cocktail napkins', quantity: Math.ceil(guests * 4), unit: '',    category: 'other' })

  // ── Optional extras ──
  if (champagneToast) {
    r.push({ item_name: 'Champagne / prosecco (toast)', quantity: Math.ceil(guests / 8), unit: 'bottles', category: 'wine' })
  }
  if (tableWine) {
    r.push({ item_name: 'Red wine — poured at table',   quantity: Math.ceil(guests / 12), unit: 'bottles', category: 'wine' })
    r.push({ item_name: 'White wine — poured at table', quantity: Math.ceil(guests / 12), unit: 'bottles', category: 'wine' })
  }

  return r
}

function bartenderCount(guests) {
  // Handbook: 1 per 50 guests, Saturday minimum 2
  return Math.max(2, Math.ceil(guests / 50))
}

function seasonFromDate(dateStr) {
  if (!dateStr) return null
  const m = new Date(dateStr + 'T00:00:00').getMonth() // 0-indexed
  return (m >= 4 && m <= 9) ? 'summer' : 'winter'
}

// ── Print helper ──────────────────────────────────────────────────────────────

function printList(items, coupleNames) {
  const grouped = {}
  CATEGORIES.forEach(c => { grouped[c.key] = [] })
  items.filter(i => !i.checked).forEach(i => {
    if (grouped[i.category]) grouped[i.category].push(i)
  })
  const lines = [`Bar Shopping List${coupleNames ? ` — ${coupleNames}` : ''}`, '']
  CATEGORIES.forEach(cat => {
    if (!grouped[cat.key]?.length) return
    lines.push(`${cat.emoji} ${cat.label.toUpperCase()}`)
    grouped[cat.key].forEach(i => {
      lines.push(`  ☐  ${i.item_name}${i.quantity ? `  —  ${i.quantity} ${i.unit || ''}`.trim() : ''}${i.notes ? `  (${i.notes})` : ''}`)
    })
    lines.push('')
  })
  lines.push('Call Rixey on Monday before your wedding — we almost always have leftover soda and mixers!')
  const w = window.open('', '_blank')
  w.document.write(`<pre style="font-family:monospace;font-size:13px;padding:24px;white-space:pre-wrap">${lines.join('\n')}</pre>`)
  w.document.close()
  w.print()
}

// ── Notes box ─────────────────────────────────────────────────────────────────

function NotesBox({ value, onChange, placeholder }) {
  return (
    <div className="mt-6 border-t border-cream-100 pt-4">
      <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">Notes</p>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Any notes for this section…'}
        rows={3} className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm text-sage-700 placeholder-sage-300 focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none" />
    </div>
  )
}

// ── Shopping list row ─────────────────────────────────────────────────────────

function ShoppingRow({ item, onToggle, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState({ item_name: item.item_name, quantity: item.quantity || '', unit: item.unit || '', notes: item.notes || '' })

  const save = () => { onUpdate(item.id, draft); setEditing(false) }

  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-cream-100 last:border-0 ${item.checked ? 'opacity-50' : ''}`}>
      <button onClick={() => onToggle(item.id, !item.checked)} className="mt-0.5 flex-shrink-0">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${item.checked ? 'bg-sage-500 border-sage-500' : 'border-cream-300 hover:border-sage-300'}`}>
          {item.checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
        </div>
      </button>

      {editing ? (
        <div className="flex-1 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <input value={draft.item_name} onChange={e => setDraft(d => ({...d, item_name: e.target.value}))}
              className="flex-1 min-w-0 border border-cream-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sage-300" />
            <input value={draft.quantity} onChange={e => setDraft(d => ({...d, quantity: e.target.value}))} placeholder="Qty"
              className="w-16 border border-cream-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sage-300" />
            <input value={draft.unit} onChange={e => setDraft(d => ({...d, unit: e.target.value}))} placeholder="Unit"
              className="w-20 border border-cream-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sage-300" />
          </div>
          <input value={draft.notes} onChange={e => setDraft(d => ({...d, notes: e.target.value}))} placeholder="Notes…"
            className="w-full border border-cream-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sage-300" />
          <div className="flex gap-2">
            <button onClick={save} className="text-xs px-3 py-1 bg-sage-600 text-white rounded hover:bg-sage-700">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs px-3 py-1 text-sage-500 hover:text-sage-700">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`text-sm font-medium text-sage-700 ${item.checked ? 'line-through' : ''}`}>{item.item_name}</span>
              {(item.quantity || item.unit) && (
                <span className="text-xs text-sage-400">{item.quantity} {item.unit}</span>
              )}
            </div>
            {item.notes && <p className="text-xs text-sage-400 mt-0.5">{item.notes}</p>}
          </div>
          {/* Always visible on mobile */}
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => setEditing(true)} className="text-sage-300 hover:text-sage-600 p-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z"/></svg>
            </button>
            <button onClick={() => onDelete(item.id)} className="text-red-200 hover:text-red-500 p-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BarPlanner({ weddingId, guestCount: guestCountProp, weddingDate, coupleNames }) {
  const [tab, setTab]     = useState('calculator')
  const [items, setItems] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  // Calculator state
  const [guests, setGuests]         = useState(guestCountProp || 80)
  const [hours, setHours]           = useState(5)
  const [barType, setBarType]       = useState('beer-wine')
  const [season, setSeason]         = useState(() => seasonFromDate(weddingDate) || (new Date().getMonth() >= 4 && new Date().getMonth() <= 9 ? 'summer' : 'winter'))
  const [beerPct, setBeerPct]       = useState(35)
  const [winePct, setWinePct]       = useState(65)
  const [spiritsPct, setSpiritsPct] = useState(0)
  const [nonAlcPct, setNonAlcPct]       = useState(15)
  const [champagneToast, setChampagneToast] = useState(false)
  const [tableWine, setTableWine]           = useState(false)
  const [calcPreview, setCalcPreview] = useState([])

  // Add item form
  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem]       = useState({ item_name: '', quantity: '', unit: '', category: 'other', notes: '' })

  // Recipe form
  const [addingRecipe, setAddingRecipe]               = useState(false)
  const [recipeMode, setRecipeMode]                   = useState('url')
  const [recipeUrl, setRecipeUrl]                     = useState('')
  const [recipeName, setRecipeName]                   = useState('')
  const [recipeFile, setRecipeFile]                   = useState(null)
  const [extracting, setExtracting]                   = useState(false)
  const [editableIngredients, setEditableIngredients] = useState(null) // editable before saving
  const fileRef     = useRef()
  const notesTimer  = useRef()

  // Notes per tab
  const [notes, setNotes] = useState({ calculator: '', list: '', recipes: '' })
  // Shopping list: show calc summary
  const [showCalcSummary, setShowCalcSummary] = useState(false)

  useEffect(() => { load() }, [weddingId])

  useEffect(() => {
    setCalcPreview(calcQuantities({ guests, hours, barType, season, beerPct, winePct, spiritsPct, nonAlcPct, champagneToast, tableWine }))
  }, [guests, hours, barType, season, beerPct, winePct, spiritsPct, nonAlcPct, champagneToast, tableWine])

  // Sync season if wedding date prop changes
  useEffect(() => {
    const s = seasonFromDate(weddingDate)
    if (s) setSeason(s)
  }, [weddingDate])

  const selectBarType = (key) => {
    const bt = BAR_TYPES.find(b => b.key === key)
    setBarType(key)
    setBeerPct(bt.beerPct)
    setWinePct(bt.winePct)
    setSpiritsPct(bt.spiritsPct)
  }

  const load = async () => {
    try {
      const [itemsRes, recipesRes, notesRes] = await Promise.all([
        fetch(`${API_URL}/api/bar-shopping/${weddingId}`),
        fetch(`${API_URL}/api/bar-recipes/${weddingId}`),
        fetch(`${API_URL}/api/bar-notes/${weddingId}`),
      ])
      setItems(await itemsRes.json() || [])
      setRecipes(await recipesRes.json() || [])
      const n = await notesRes.json()
      setNotes({ calculator: '', list: '', recipes: '', ...n })
    } catch (err) { console.error('Failed to load bar planner:', err) }
    setLoading(false)
  }

  const updateNotes = useCallback((tabKey, val) => {
    setNotes(prev => {
      const next = { ...prev, [tabKey]: val }
      clearTimeout(notesTimer.current)
      notesTimer.current = setTimeout(() => {
        fetch(`${API_URL}/api/bar-notes/${weddingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        })
      }, 800)
      return next
    })
  }, [weddingId])

  // ── Shopping list ──

  const addItem = async () => {
    if (!newItem.item_name.trim()) return
    const res  = await fetch(`${API_URL}/api/bar-shopping/${weddingId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newItem, sort_order: items.length }),
    })
    const saved = await res.json()
    setItems(prev => [...prev, saved])
    setNewItem({ item_name: '', quantity: '', unit: '', category: 'other', notes: '' })
    setAddingItem(false)
  }

  const toggleItem = async (id, checked) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked } : i))
    await fetch(`${API_URL}/api/bar-shopping/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked }),
    })
  }

  const updateItem = async (id, fields) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i))
    await fetch(`${API_URL}/api/bar-shopping/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
  }

  const deleteItem = async (id) => {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`${API_URL}/api/bar-shopping/${id}`, { method: 'DELETE' })
  }

  const importFromCalculator = async () => {
    // Replace only calculator-generated items; keep anything manually added
    const toRemove = items.filter(i => i.from_calculator)
    for (const item of toRemove) {
      await fetch(`${API_URL}/api/bar-shopping/${item.id}`, { method: 'DELETE' })
    }
    const added = []
    for (const item of calcPreview) {
      // Wine: show bottles in the calculator, save as cases on the shopping list
      const listItem = (item.category === 'wine' && item.unit === 'bottles')
        ? { ...item, quantity: Math.ceil(item.quantity / 12), unit: 'cases of 12' }
        : item
      const res = await fetch(`${API_URL}/api/bar-shopping/${weddingId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...listItem, from_calculator: true, sort_order: items.length + added.length }),
      })
      added.push(await res.json())
    }
    setItems(prev => [...prev.filter(i => !i.from_calculator), ...added])
    setTab('list')
  }

  // ── Recipes ──

  const extractRecipe = async () => {
    if (!recipeName.trim()) return alert('Give this cocktail a name first.')
    if (recipeMode === 'url' && !recipeUrl.trim()) return alert('Paste a URL.')
    if (recipeMode === 'upload' && !recipeFile) return alert('Choose a file.')
    setExtracting(true)
    setEditableIngredients(null)
    try {
      let res
      if (recipeMode === 'url') {
        res = await fetch(`${API_URL}/api/bar-recipes/extract-url`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: recipeUrl, name: recipeName }),
        })
      } else {
        const form = new FormData()
        form.append('file', recipeFile)
        form.append('name', recipeName)
        res = await fetch(`${API_URL}/api/bar-recipes/extract-upload`, { method: 'POST', body: form })
      }
      const data = await res.json()
      if (data.ingredients) setEditableIngredients(data.ingredients)
      else alert(data.error || 'Could not extract ingredients.')
    } catch (err) {
      console.error(err)
      alert('Extraction failed.')
    }
    setExtracting(false)
  }

  const updateIngredient = (i, field, val) => {
    setEditableIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing))
  }

  const removeIngredient = (i) => {
    setEditableIngredients(prev => prev.filter((_, idx) => idx !== i))
  }

  const addIngredientRow = () => {
    setEditableIngredients(prev => [...prev, { name: '', quantity: '', unit: '', per_serving: true, category: 'other' }])
  }

  const saveRecipe = async () => {
    const ingredients = (editableIngredients || []).filter(i => i.name.trim())
    const res = await fetch(`${API_URL}/api/bar-recipes/${weddingId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: recipeName, source_type: recipeMode,
        source_url: recipeMode === 'url' ? recipeUrl : null,
        ingredients, servings_basis: 1,
      }),
    })
    const saved = await res.json()
    setRecipes(prev => [...prev, saved])
    setAddingRecipe(false)
    setRecipeName(''); setRecipeUrl(''); setRecipeFile(null); setEditableIngredients(null)
  }

  const deleteRecipe = async (id) => {
    setRecipes(prev => prev.filter(r => r.id !== id))
    await fetch(`${API_URL}/api/bar-recipes/${id}`, { method: 'DELETE' })
  }

  const addRecipeToList = async (recipe) => {
    const added = []
    for (const ing of recipe.ingredients) {
      const scaled = ing.per_serving
        ? scaleIngredient(ing.quantity, ing.unit, ing.category, guests)
        : { qty: ing.quantity, unit: ing.unit, note: null }
      const res = await fetch(`${API_URL}/api/bar-shopping/${weddingId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: ing.name, quantity: scaled.qty, unit: scaled.unit,
          category: ing.category || 'other',
          notes: `For ${recipe.name}${scaled.note ? ` (${scaled.note})` : ` (scaled to ${guests} guests)`}`,
          sort_order: items.length + added.length,
        }),
      })
      added.push(await res.json())
    }
    setItems(prev => [...prev, ...added])
    setTab('list')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <p className="text-sage-400 text-center py-8">Loading bar planner…</p>

  const checkedCount = items.filter(i => i.checked).length
  const totalCount   = items.length
  const unchecked    = items.filter(i => !i.checked)

  return (
    <div className="space-y-5 max-w-2xl">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-lg text-sage-700">Bar Planner</h3>
          <p className="text-sage-500 text-sm mt-0.5">Calculate quantities, build a shopping list, and add cocktail recipes.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-cream-200">
        {[
          { id: 'calculator', label: 'Quantity Guide' },
          { id: 'list',       label: `Shopping List${totalCount ? ` · ${checkedCount}/${totalCount}` : ''}` },
          { id: 'recipes',    label: `Cocktail Recipes${recipes.length ? ` (${recipes.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id ? 'border-sage-600 text-sage-700' : 'border-transparent text-sage-400 hover:text-sage-600'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* ── Quantity Guide ── */}
      {tab === 'calculator' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Based on Rixey's handbook (~1 drink/person/hour). Adjust the sliders — quantities update live on the right.
          </div>

          {/* Bar type */}
          <div>
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">Bar type</p>
            <div className="space-y-2">
              {BAR_TYPES.map(bt => (
                <label key={bt.key} className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="barType" value={bt.key} checked={barType === bt.key}
                    onChange={() => selectBarType(bt.key)} className="mt-0.5 accent-sage-600" />
                  <div>
                    <p className={`text-sm font-medium ${barType === bt.key ? 'text-sage-700' : 'text-sage-500'}`}>{bt.label}</p>
                    {bt.key === 'specialty' && <p className="text-xs text-sage-400">Add recipes in the Cocktail Recipes tab — they'll scale to your guest count</p>}
                    {bt.key === 'full' && <p className="text-xs text-sage-400">Vodka, rum, gin, Jack Daniel's, Fireball — go easy on tequila (shots-only liquors slow service)</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Season */}
          <div>
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">
              Season <span className="font-normal normal-case text-sage-400">— affects red vs white wine split</span>
              {weddingDate && <span className="font-normal normal-case text-sage-400"> (auto-detected from your wedding date)</span>}
            </p>
            <div className="flex gap-3">
              {[
                { key: 'summer', label: '☀️ Spring / Summer', note: 'More white & rosé' },
                { key: 'winter', label: '🍂 Autumn / Winter',  note: 'More red' },
              ].map(s => (
                <button key={s.key} type="button" onClick={() => setSeason(s.key)}
                  className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-sm text-left transition ${season === s.key ? 'border-sage-500 bg-sage-50' : 'border-cream-200 hover:border-sage-300'}`}
                >
                  <p className={`font-medium ${season === s.key ? 'text-sage-700' : 'text-sage-500'}`}>{s.label}</p>
                  <p className="text-xs text-sage-400 mt-0.5">{s.note}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Extras */}
          <div>
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">Extras</p>
            <div className="space-y-3">
              {[
                { state: champagneToast, set: setChampagneToast, label: '🥂 Champagne toast', note: `+${Math.ceil((guests||1) / 8)} bottles (1 per 8 guests)` },
                { state: tableWine,      set: setTableWine,      label: '🍷 Wine poured at the table', note: `+${Math.ceil((guests||1) / 12)} red + ${Math.ceil((guests||1) / 12)} white (1 bottle per 12 guests each)` },
              ].map(({ state, set, label, note }) => (
                <label key={label} className="flex items-start gap-3 cursor-pointer">
                  <button type="button" onClick={() => set(v => !v)}
                    className={`mt-0.5 w-10 h-5 rounded-full flex-shrink-0 transition-colors relative ${state ? 'bg-sage-500' : 'bg-cream-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${state ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <div>
                    <p className={`text-sm font-medium ${state ? 'text-sage-700' : 'text-sage-500'}`}>{label}</p>
                    <p className="text-xs text-sage-400">{note}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Guest count */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-sage-500 uppercase tracking-wide">Guest count</label>
              <input type="number" value={guests} onChange={e => setGuests(Math.max(1, Number(e.target.value)))}
                className="w-20 border border-cream-300 rounded-lg px-2 py-1 text-sm text-center font-medium text-sage-700 focus:outline-none focus:ring-2 focus:ring-sage-300" />
            </div>
            <input type="range" min={10} max={400} step={5} value={guests}
              onChange={e => setGuests(Number(e.target.value))} className="w-full accent-sage-600" />
            <div className="flex justify-between text-xs text-sage-300 mt-1"><span>10</span><span>100</span><span>200</span><span>300</span><span>400</span></div>
          </div>

          {/* Hours */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-sage-500 uppercase tracking-wide">Bar open for</label>
              <span className="text-sm font-medium text-sage-700">{hours} {hours === 1 ? 'hour' : 'hours'}</span>
            </div>
            <input type="range" min={1} max={8} step={0.5} value={hours}
              onChange={e => setHours(Number(e.target.value))} className="w-full accent-sage-600" />
            <div className="flex justify-between text-xs text-sage-300 mt-1"><span>1 hr</span><span>3</span><span>5</span><span>8 hrs</span></div>
          </div>

          {/* Sliders + Live quantities table — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">

            {/* Left: sliders */}
            <div>
              <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Adjust for your crowd</p>
              <p className="text-xs text-sage-400 mb-4">Quantities update live as you move these.</p>
              <div className="space-y-5">
                {[
                  { label: '🍺 Beer',                val: beerPct,    set: setBeerPct,    color: 'accent-amber-500', disabled: false },
                  { label: '🍷 Wine',                val: winePct,    set: setWinePct,    color: 'accent-rose-500',  disabled: false },
                  { label: '🥃 Spirits / cocktails', val: spiritsPct, set: setSpiritsPct, color: 'accent-sage-600',  disabled: barType === 'beer-wine' },
                  { label: '🥤 Non-alcoholic',        val: nonAlcPct,  set: setNonAlcPct,  color: 'accent-blue-400',  disabled: false },
                ].map(({ label, val, set, color, disabled }) => (
                  <div key={label} className={disabled ? 'opacity-30 pointer-events-none' : ''}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-sage-700">{label}</span>
                      <span className="text-sm font-semibold text-sage-700 w-10 text-right">{val}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={val}
                      onChange={e => set(Number(e.target.value))} className={`w-full ${color}`} />
                  </div>
                ))}
              </div>
              {(beerPct + winePct + spiritsPct) !== 100 && (
                <p className="text-xs text-amber-600 mt-3">Beer + wine + spirits = {beerPct + winePct + spiritsPct}%</p>
              )}

              {/* Per-guest summary — under the sliders */}
              <div className="bg-sage-50 border border-sage-200 rounded-xl px-4 py-3 mt-5 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Average guest over {hours}h</p>
                  {(champagneToast || tableWine) && (
                    <p className="text-xs text-amber-600 mb-1.5">Bar drinks only — champagne toast{tableWine ? ' and table wine' : ''} not included in these numbers.</p>
                  )}
                  <p className="text-sage-700 text-sm leading-relaxed">
                    {winePct > 0 && <><strong>{(hours * winePct / 100).toFixed(1)} {hours * winePct / 100 === 1 ? 'glass wine' : 'glasses wine'}</strong>{(beerPct > 0 || spiritsPct > 0) ? ', ' : ''}</>}
                    {beerPct > 0 && <><strong>{(hours * beerPct / 100).toFixed(1)} {hours * beerPct / 100 === 1 ? 'beer' : 'beers'}</strong>{spiritsPct > 0 ? ', ' : ''}</>}
                    {spiritsPct > 0 && <><strong>{(hours * spiritsPct / 100).toFixed(1)} {hours * spiritsPct / 100 === 1 ? 'cocktail' : 'cocktails'}</strong></>}
                    {nonAlcPct > 0 && <>, <strong>{(hours * nonAlcPct / 100).toFixed(1)} non-alc</strong></>}
                  </p>
                  <p className="text-xs text-sage-400 mt-0.5"><strong>{(hours * guests).toLocaleString()}</strong> drinks total across {guests} guests</p>
                </div>
                <div className="border-t border-sage-200 pt-3">
                  <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1.5">If a guest drinks only their preferred type</p>
                  <div className="space-y-1">
                    {winePct > 0 && (
                      <p className="text-sm text-sage-700">🍷 A wine drinker: <strong>{hours} {hours === 1 ? 'glass' : 'glasses'} of wine</strong></p>
                    )}
                    {beerPct > 0 && (
                      <p className="text-sm text-sage-700">🍺 A beer drinker: <strong>{hours} {hours === 1 ? 'beer' : 'beers'}</strong></p>
                    )}
                    {spiritsPct > 0 && (
                      <p className="text-sm text-sage-700">🥃 A cocktail drinker: <strong>{hours} {hours === 1 ? 'cocktail' : 'cocktails'}</strong></p>
                    )}
                    {nonAlcPct > 0 && (
                      <p className="text-sm text-sage-700">🥤 A non-drinker: <strong>{hours} {hours === 1 ? 'soft drink' : 'soft drinks'}</strong></p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: live quantities table */}
            <div>
              <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">What to buy</p>
              <div className="space-y-3">
                {CATEGORIES.filter(cat => calcPreview.some(i => i.category === cat.key)).map(cat => (
                  <div key={cat.key}>
                    <p className="text-xs font-semibold text-sage-400 uppercase tracking-wide mb-1 px-0.5">{cat.emoji} {cat.label}</p>
                    <div className="bg-white border border-cream-200 rounded-xl divide-y divide-cream-100">
                      {calcPreview.filter(i => i.category === cat.key).map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2">
                          <span className="text-xs text-sage-600 leading-snug">{item.item_name}</span>
                          <span className="text-sm font-bold text-sage-700 flex-shrink-0 ml-3 tabular-nums">{item.quantity} <span className="font-normal text-xs text-sage-400">{item.unit}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {barType === 'specialty' && (
                  <p className="text-xs text-sage-400 italic">Cocktail ingredients not listed — add recipes in the Cocktail Recipes tab.</p>
                )}
                <p className="text-xs text-sage-400">⚠️ No half kegs — can't safely come down the Rixey staircase.</p>
              </div>
            </div>
          </div>

          {/* Bartender count */}
          <div className="bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 text-sm text-sage-700">
            <p className="font-medium mb-1">🙋 Bartenders</p>
            <p>Based on {guests} guests you'll need at least <strong>{bartenderCount(guests)} bartenders</strong>. Add one more for each of: champagne welcome drink, rooftop bar, satellite bar, or table wine service.</p>
            <p className="text-xs text-sage-400 mt-1">Saturday minimum is always 2. Bartenders are $350 each.</p>
          </div>

          <button onClick={importFromCalculator}
            className="w-full py-3 bg-sage-600 text-white rounded-xl text-sm font-medium hover:bg-sage-700"
          >
            Add to shopping list
          </button>

          <NotesBox value={notes.calculator} onChange={v => updateNotes('calculator', v)}
            placeholder="Notes about the bar setup, preferences, restrictions…" />
        </div>
      )}

      {/* ── Shopping List ── */}
      {tab === 'list' && (
        <div>
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-sage-400">
              {totalCount === 0 ? 'No items yet' : `${checkedCount} of ${totalCount} items ticked off`}
            </p>
            <div className="flex items-center gap-2">
              {calcPreview.length > 0 && (
                <button onClick={() => setShowCalcSummary(v => !v)}
                  className="text-xs text-sage-500 hover:text-sage-700 border border-cream-200 rounded-lg px-3 py-1.5">
                  {showCalcSummary ? 'Hide' : 'View'} last calculation
                </button>
              )}
              {unchecked.length > 0 && (
                <button onClick={() => printList(items, coupleNames)}
                  className="flex items-center gap-1.5 text-xs text-sage-500 hover:text-sage-700 border border-cream-200 rounded-lg px-3 py-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                  Print
                </button>
              )}
            </div>
          </div>

          {/* Last calculation summary */}
          {showCalcSummary && calcPreview.length > 0 && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Last calculation — {guests} guests · {hours}h · {BAR_TYPES.find(b=>b.key===barType)?.label}</p>
              <div className="space-y-1">
                {calcPreview.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-amber-800">
                    <span>{item.item_name}</span>
                    <span className="font-semibold ml-4">{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add item — at the top, always visible */}
          {addingItem ? (
            <div className="mb-4 bg-cream-50 border border-cream-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide">Add item</p>
              <div className="flex gap-2 flex-wrap">
                <input value={newItem.item_name} onChange={e => setNewItem(p => ({...p, item_name: e.target.value}))}
                  placeholder="e.g. Lavender syrup, Honey, Elderflower cordial…" autoFocus
                  className="flex-1 min-w-0 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
                <input value={newItem.quantity} onChange={e => setNewItem(p => ({...p, quantity: e.target.value}))}
                  placeholder="Qty" className="w-16 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
                <input value={newItem.unit} onChange={e => setNewItem(p => ({...p, unit: e.target.value}))}
                  placeholder="Unit" className="w-20 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select value={newItem.category} onChange={e => setNewItem(p => ({...p, category: e.target.value}))}
                  className="border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300">
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                </select>
                <input value={newItem.notes} onChange={e => setNewItem(p => ({...p, notes: e.target.value}))}
                  placeholder="Notes (optional)"
                  className="flex-1 min-w-0 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
              </div>
              <div className="flex gap-2">
                <button onClick={addItem} className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700">Add item</button>
                <button onClick={() => setAddingItem(false)} className="px-4 py-2 text-sage-500 text-sm hover:text-sage-700">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingItem(true)}
              className="mb-4 w-full py-2.5 border-2 border-dashed border-cream-300 rounded-xl text-sm text-sage-500 hover:border-sage-400 hover:text-sage-600 transition">
              + Add item &mdash; lavender syrup, honey, anything that doesn't fit the calculator
            </button>
          )}

          {totalCount === 0 ? (
            <div className="text-center py-10 text-sage-400">
              <p className="text-3xl mb-3">🛒</p>
              <p className="text-sm mb-4">No items yet.</p>
              <button onClick={() => setTab('calculator')}
                className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700"
              >
                Go to Quantity Guide →
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {CATEGORIES.filter(cat => items.some(i => i.category === cat.key)).map(cat => (
                <div key={cat.key}>
                  <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">{cat.emoji} {cat.label}</p>
                  <div className="bg-white border border-cream-200 rounded-xl px-4">
                    {items.filter(i => i.category === cat.key).map(item => (
                      <ShoppingRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} onUpdate={updateItem} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Monday tip */}
          {totalCount > 0 && (
            <div className="mt-6 bg-sage-50 border border-sage-200 rounded-xl px-4 py-3 text-sm text-sage-600">
              💡 <strong>Call Rixey on the Monday before your wedding</strong> — we almost always have leftover soda and mixers from the weekend before. Could save you a trip.
            </div>
          )}

          <NotesBox value={notes.list} onChange={v => updateNotes('list', v)}
            placeholder="Shopping notes — where to buy, brands you like, things to remember…" />
        </div>
      )}

      {/* ── Cocktail Recipes ── */}
      {tab === 'recipes' && (
        <div className="space-y-5">
          {recipes.length === 0 && !addingRecipe && (
            <div className="text-center py-10 text-sage-400">
              <p className="text-3xl mb-3">🍹</p>
              <p className="text-sm">No cocktail recipes yet. Add one and we'll extract the ingredients and scale them to your guest count.</p>
            </div>
          )}

          {recipes.map(recipe => (
            <div key={recipe.id} className="bg-white border border-cream-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-sage-700">{recipe.name}</p>
                  {recipe.source_url && (
                    <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sage-400 hover:text-sage-600 underline">View original recipe →</a>
                  )}
                </div>
                <button onClick={() => deleteRecipe(recipe.id)} className="text-red-300 hover:text-red-500 flex-shrink-0 p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              {recipe.ingredients?.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-sage-400 uppercase tracking-wide mb-2">Ingredients scaled to {guests} guests</p>
                  <div className="bg-cream-50 rounded-xl divide-y divide-cream-100 mb-4">
                    {recipe.ingredients.map((ing, i) => {
                      const scaled = ing.per_serving
                        ? scaleIngredient(ing.quantity, ing.unit, ing.category, guests)
                        : { qty: ing.quantity, unit: ing.unit, note: null }
                      return (
                        <div key={i} className="flex items-center justify-between px-3 py-2">
                          <span className="text-sm text-sage-700">{ing.name}</span>
                          <span className="text-sm font-semibold text-sage-600 ml-4 flex-shrink-0 text-right">
                            {scaled.qty} <span className="font-normal text-xs text-sage-400">{scaled.unit}</span>
                            {scaled.note && <span className="block text-xs text-sage-300">{scaled.note}</span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={() => addRecipeToList(recipe)}
                    className="w-full py-2 bg-sage-100 hover:bg-sage-200 text-sage-700 text-sm font-medium rounded-lg transition">
                    + Add all ingredients to shopping list
                  </button>
                </>
              ) : (
                <p className="text-sm text-sage-400 italic">No ingredients saved.</p>
              )}
            </div>
          ))}

          {addingRecipe ? (
            <div className="bg-cream-50 border border-cream-200 rounded-xl p-5 space-y-4">
              <p className="font-medium text-sage-700">Add a cocktail recipe</p>
              <div>
                <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Cocktail name</label>
                <input value={recipeName} onChange={e => setRecipeName(e.target.value)}
                  placeholder="e.g. Aperol Spritz, Lavender Martini…"
                  className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
              </div>
              <div className="flex gap-2">
                {[['url', '🔗 Paste a link'], ['upload', '📷 Upload recipe card']].map(([mode, label]) => (
                  <button key={mode} onClick={() => setRecipeMode(mode)}
                    className={`flex-1 py-2 rounded-lg text-sm border-2 transition ${recipeMode === mode ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-cream-300 text-sage-500'}`}
                  >{label}</button>
                ))}
              </div>
              {recipeMode === 'url' && (
                <input value={recipeUrl} onChange={e => setRecipeUrl(e.target.value)} placeholder="https://…"
                  className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300" />
              )}
              {recipeMode === 'upload' && (
                <div>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setRecipeFile(e.target.files[0])} />
                  <button onClick={() => fileRef.current.click()}
                    className="w-full py-3 border-2 border-dashed border-cream-300 rounded-lg text-sm text-sage-500 hover:border-sage-400 hover:text-sage-600 transition"
                  >{recipeFile ? recipeFile.name : 'Choose image or PDF…'}</button>
                </div>
              )}

              {/* Editable extracted ingredients */}
              {editableIngredients && (
                <div className="bg-white border border-cream-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide">Extracted ingredients — edit before saving</p>
                  {editableIngredients.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                        placeholder="Ingredient"
                        className="flex-1 border border-cream-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sage-300" />
                      <input value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                        placeholder="Qty" className="w-16 border border-cream-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sage-300" />
                      <input value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)}
                        placeholder="Unit" className="w-16 border border-cream-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sage-300" />
                      <button onClick={() => removeIngredient(i)} className="text-red-300 hover:text-red-500 px-1 text-sm">×</button>
                    </div>
                  ))}
                  <button onClick={addIngredientRow} className="text-xs text-sage-500 hover:text-sage-700">+ Add row</button>
                  <p className="text-xs text-sage-400">Quantities will be scaled to {guests} guests when added to the shopping list.</p>
                </div>
              )}

              <div className="flex gap-2">
                {!editableIngredients ? (
                  <button onClick={extractRecipe} disabled={extracting}
                    className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50">
                    {extracting ? 'Extracting with AI…' : 'Extract ingredients'}
                  </button>
                ) : (
                  <button onClick={saveRecipe} className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700">
                    Save recipe
                  </button>
                )}
                <button onClick={() => { setAddingRecipe(false); setEditableIngredients(null) }}
                  className="px-4 py-2 text-sage-500 text-sm hover:text-sage-700">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingRecipe(true)} className="text-sage-500 hover:text-sage-700 text-sm font-medium">
              + Add cocktail recipe
            </button>
          )}

          <NotesBox value={notes.recipes} onChange={v => updateNotes('recipes', v)}
            placeholder="Notes about cocktail choices, garnish ideas, batch prep instructions…" />
        </div>
      )}
    </div>
  )
}
