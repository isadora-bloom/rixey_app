import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const CATEGORIES = [
  { key: 'beer',    label: 'Beer',     emoji: '🍺' },
  { key: 'wine',    label: 'Wine',     emoji: '🍷' },
  { key: 'spirits', label: 'Spirits',  emoji: '🥃' },
  { key: 'mixers',  label: 'Mixers',   emoji: '🥤' },
  { key: 'garnish', label: 'Garnish',  emoji: '🍋' },
  { key: 'other',   label: 'Other',    emoji: '📦' },
]

// ── Quantity calculator logic ─────────────────────────────────────────────────
// Based on Rixey Manor Handbook 2026 recommendations.
// Base reference: 120 guests × 8 hours.

const BAR_TYPES = [
  { key: 'beer-wine',  label: 'Beer & Wine',                       beerPct: 35, winePct: 65, spiritsPct: 0  },
  { key: 'specialty',  label: 'Beer, Wine & Signature Cocktails',  beerPct: 25, winePct: 50, spiritsPct: 25 },
  { key: 'full',       label: 'Modified Full Bar',                 beerPct: 25, winePct: 40, spiritsPct: 35 },
]

function calcQuantities({ guests, hours, barType, season }) {
  const s = guests / 120       // guest scale relative to handbook base
  const h = hours / 8          // hour scale relative to handbook base
  const r = [ ]                // results

  // ── Beer (kegs — NO half kegs, unsafe on Rixey staircase) ──
  const sixths   = Math.max(1, Math.ceil(2 * s * h))
  const quarters = Math.max(1, Math.ceil(2 * s * h))
  r.push({ item_name: '1/6th barrel keg (~55 beers each)',  quantity: sixths,   unit: 'kegs', category: 'beer' })
  r.push({ item_name: '1/4 barrel keg (~82 beers each)',    quantity: quarters, unit: 'kegs', category: 'beer' })

  // ── Wine ──
  // Handbook: 8 cases for 120 guests × 8 hrs. 1 sparkling, rest split seasonally.
  const totalCases    = Math.max(2, Math.ceil(8 * s * h))
  const sparklingCases = Math.max(1, Math.round(totalCases / 8))
  const remaining      = totalCases - sparklingCases
  const isWinter       = season === 'winter'
  // Summer: 4 white/rosé : 3 red. Winter: 3 white/rosé : 4 red (handbook exact)
  const whiteCases = isWinter ? Math.ceil(remaining * 3 / 7) : Math.ceil(remaining * 4 / 7)
  const redCases   = remaining - whiteCases
  r.push({ item_name: 'Sparkling wine / prosecco (for toasts + mimosas)', quantity: sparklingCases, unit: 'cases of 12', category: 'wine' })
  r.push({ item_name: `White wine & rosé${isWinter ? ' (winter — less white)' : ' (summer — more white)'}`, quantity: whiteCases, unit: 'cases of 12', category: 'wine' })
  r.push({ item_name: `Red wine${isWinter ? ' (winter — more red)' : ' (summer — less red)'}`, quantity: redCases, unit: 'cases of 12', category: 'wine' })

  // ── Spirits (Modified Full Bar only) ──
  // Handbook: 1–2 handles each of rum/gin/vodka/fireball, 2–3 handles Jack Daniel's
  if (barType === 'full') {
    r.push({ item_name: 'Vodka (1.75L handles)',         quantity: Math.max(1, Math.ceil(2   * s * h)), unit: 'handles', category: 'spirits' })
    r.push({ item_name: 'Rum (1.75L handles)',           quantity: Math.max(1, Math.ceil(1.5 * s * h)), unit: 'handles', category: 'spirits' })
    r.push({ item_name: 'Gin (1.75L handles)',           quantity: Math.max(1, Math.ceil(1.5 * s * h)), unit: 'handles', category: 'spirits' })
    r.push({ item_name: "Jack Daniel's (1.75L handles)", quantity: Math.max(2, Math.ceil(2.5 * s * h)), unit: 'handles', category: 'spirits' })
    r.push({ item_name: 'Fireball (1.75L handles)',      quantity: Math.max(1, Math.ceil(1   * s * h)), unit: 'handles', category: 'spirits' })
  }
  // Specialty cocktail bar: quantities come from the Cocktail Recipes tool

  // ── Mixers ──
  // Handbook specifics: Coke (4 cases 12-packs), Sprite, Diet Coke, Tonic, Soda Water (2 cases each)
  r.push({ item_name: 'Coke (12-packs)',         quantity: Math.max(2, Math.ceil(4 * s * h)), unit: 'cases', category: 'mixers' })
  r.push({ item_name: 'Sprite (12-packs)',        quantity: Math.max(1, Math.ceil(2 * s * h)), unit: 'cases', category: 'mixers' })
  r.push({ item_name: 'Diet Coke (12-packs)',     quantity: Math.max(1, Math.ceil(2 * s * h)), unit: 'cases', category: 'mixers' })
  r.push({ item_name: 'Ginger Ale (12-packs)',    quantity: Math.max(1, Math.ceil(1 * s * h)), unit: 'cases', category: 'mixers' })
  r.push({ item_name: 'Tonic Water (12-packs)',   quantity: Math.max(1, Math.ceil(2 * s * h)), unit: 'cases', category: 'mixers' })
  r.push({ item_name: 'Soda Water (12-packs)',    quantity: Math.max(1, Math.ceil(2 * s * h)), unit: 'cases', category: 'mixers' })
  r.push({ item_name: 'Orange juice (for mimosas, breakfast, mixing)', quantity: Math.max(1, Math.ceil(guests / 15)), unit: 'gallons', category: 'mixers' })
  r.push({ item_name: 'Cranberry juice',          quantity: Math.max(1, Math.ceil(guests / 20)), unit: 'gallons', category: 'mixers' })
  r.push({ item_name: 'Pineapple juice',          quantity: Math.max(1, Math.ceil(guests / 20)), unit: 'large cans', category: 'mixers' })
  r.push({ item_name: 'Sour mix',                 quantity: Math.max(1, Math.ceil(guests / 30)), unit: 'bottles', category: 'mixers' })
  r.push({ item_name: 'Water (small bottles)',     quantity: Math.max(6, Math.ceil(guests / 20)), unit: 'cases', category: 'mixers' })

  // ── Garnishes ── (handbook: olives, cherries, oranges, lemons, limes)
  r.push({ item_name: 'Lemons',              quantity: Math.ceil(guests / 8),   unit: '',      category: 'garnish' })
  r.push({ item_name: 'Limes',               quantity: Math.ceil(guests / 8),   unit: '',      category: 'garnish' })
  r.push({ item_name: 'Oranges',             quantity: Math.ceil(guests / 12),  unit: '',      category: 'garnish' })
  r.push({ item_name: 'Olives',              quantity: Math.max(1, Math.ceil(guests / 30)), unit: 'jars', category: 'garnish' })
  r.push({ item_name: 'Maraschino cherries', quantity: Math.max(1, Math.ceil(guests / 30)), unit: 'jars', category: 'garnish' })

  // ── Ice & other ── (handbook: 60–80 lbs for 120 guests, i.e. ~0.6 lbs/person)
  const iceLbs = Math.max(60, Math.round(guests * 0.65 / 10) * 10)
  r.push({ item_name: 'Ice',               quantity: iceLbs,                  unit: 'lbs',   category: 'other' })
  r.push({ item_name: 'Cups / glasses',    quantity: Math.ceil(guests * 2),   unit: '',      category: 'other' })
  r.push({ item_name: 'Cocktail napkins',  quantity: Math.ceil(guests * 4),   unit: '',      category: 'other' })

  return r
}

// ── Shopping list row ─────────────────────────────────────────────────────────

function ShoppingRow({ item, onToggle, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState({ item_name: item.item_name, quantity: item.quantity || '', unit: item.unit || '', notes: item.notes || '' })

  const save = () => {
    onUpdate(item.id, draft)
    setEditing(false)
  }

  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-cream-100 last:border-0 group ${item.checked ? 'opacity-50' : ''}`}>
      <button onClick={() => onToggle(item.id, !item.checked)} className="mt-0.5 flex-shrink-0">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${item.checked ? 'bg-sage-500 border-sage-500' : 'border-cream-300 group-hover:border-sage-300'}`}>
          {item.checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
        </div>
      </button>

      {editing ? (
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <input value={draft.item_name} onChange={e => setDraft(d => ({...d, item_name: e.target.value}))}
              className="flex-1 border border-cream-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sage-300" />
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
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={`text-sm font-medium text-sage-700 ${item.checked ? 'line-through' : ''}`}>{item.item_name}</span>
            {(item.quantity || item.unit) && (
              <span className="text-xs text-sage-400">{item.quantity} {item.unit}</span>
            )}
          </div>
          {item.notes && <p className="text-xs text-sage-400 mt-0.5">{item.notes}</p>}
        </div>
      )}

      {!editing && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
          <button onClick={() => setEditing(true)} className="text-sage-400 hover:text-sage-600 p-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z"/></svg>
          </button>
          <button onClick={() => onDelete(item.id)} className="text-red-300 hover:text-red-500 p-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BarPlanner({ weddingId, guestCount: guestCountProp }) {
  const [tab, setTab]                 = useState('list')
  const [items, setItems]             = useState([])
  const [recipes, setRecipes]         = useState([])
  const [loading, setLoading]         = useState(true)

  // Calculator state
  const [guests, setGuests]           = useState(guestCountProp || 80)
  const [hours, setHours]             = useState(8)
  const [barType, setBarType]         = useState('beer-wine')
  const [season, setSeason]           = useState(() => {
    const m = new Date().getMonth() // 0-indexed
    return (m >= 4 && m <= 9) ? 'summer' : 'winter' // May–Oct = summer
  })
  const [beerPct, setBeerPct]         = useState(35)
  const [winePct, setWinePct]         = useState(65)
  const [spiritsPct, setSpiritsPct]   = useState(0)
  const [nonAlcPct, setNonAlcPct]     = useState(15)
  const [calcPreview, setCalcPreview] = useState([])

  // Add item form
  const [addingItem, setAddingItem]   = useState(false)
  const [newItem, setNewItem]         = useState({ item_name: '', quantity: '', unit: '', category: 'other', notes: '' })

  // Recipe form
  const [addingRecipe, setAddingRecipe] = useState(false)
  const [recipeMode, setRecipeMode]     = useState('url') // url | upload
  const [recipeUrl, setRecipeUrl]       = useState('')
  const [recipeName, setRecipeName]     = useState('')
  const [recipeFile, setRecipeFile]     = useState(null)
  const [extracting, setExtracting]     = useState(false)
  const [extractedIngredients, setExtractedIngredients] = useState(null)
  const fileRef = useRef()

  useEffect(() => { load() }, [weddingId])

  useEffect(() => {
    setCalcPreview(calcQuantities({ guests, hours, barType, season }))
  }, [guests, hours, barType, season])

  const selectBarType = (key) => {
    const bt = BAR_TYPES.find(b => b.key === key)
    setBarType(key)
    setBeerPct(bt.beerPct)
    setWinePct(bt.winePct)
    setSpiritsPct(bt.spiritsPct)
  }

  const load = async () => {
    try {
      const [itemsRes, recipesRes] = await Promise.all([
        fetch(`${API_URL}/api/bar-shopping/${weddingId}`),
        fetch(`${API_URL}/api/bar-recipes/${weddingId}`),
      ])
      setItems(await itemsRes.json() || [])
      setRecipes(await recipesRes.json() || [])
    } catch (err) {
      console.error('Failed to load bar planner:', err)
    }
    setLoading(false)
  }

  // ── Shopping list actions ──

  const addItem = async () => {
    if (!newItem.item_name.trim()) return
    try {
      const res  = await fetch(`${API_URL}/api/bar-shopping/${weddingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newItem, sort_order: items.length }),
      })
      const data = await res.json()
      setItems(prev => [...prev, data])
      setNewItem({ item_name: '', quantity: '', unit: '', category: 'other', notes: '' })
      setAddingItem(false)
    } catch (err) { console.error(err) }
  }

  const toggleItem = async (id, checked) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked } : i))
    await fetch(`${API_URL}/api/bar-shopping/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked }),
    })
  }

  const updateItem = async (id, fields) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i))
    await fetch(`${API_URL}/api/bar-shopping/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
  }

  const deleteItem = async (id) => {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`${API_URL}/api/bar-shopping/${id}`, { method: 'DELETE' })
  }

  const importFromCalculator = async () => {
    const existing = new Set(items.filter(i => i.from_calculator).map(i => i.item_name))
    // Remove old calculator items first
    const toRemove = items.filter(i => i.from_calculator)
    for (const item of toRemove) {
      await fetch(`${API_URL}/api/bar-shopping/${item.id}`, { method: 'DELETE' })
    }
    // Insert new ones
    const added = []
    for (const item of calcPreview) {
      const res  = await fetch(`${API_URL}/api/bar-shopping/${weddingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, from_calculator: true, sort_order: items.length + added.length }),
      })
      added.push(await res.json())
    }
    setItems(prev => [...prev.filter(i => !i.from_calculator), ...added])
    setTab('list')
  }

  // ── Recipe actions ──

  const extractRecipe = async () => {
    if (!recipeName.trim()) return alert('Give this cocktail a name first.')
    if (recipeMode === 'url' && !recipeUrl.trim()) return alert('Paste a URL.')
    if (recipeMode === 'upload' && !recipeFile) return alert('Choose a file.')
    setExtracting(true)
    setExtractedIngredients(null)
    try {
      let res
      if (recipeMode === 'url') {
        res = await fetch(`${API_URL}/api/bar-recipes/extract-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: recipeUrl, name: recipeName }),
        })
      } else {
        const form = new FormData()
        form.append('file', recipeFile)
        form.append('name', recipeName)
        res = await fetch(`${API_URL}/api/bar-recipes/extract-upload`, { method: 'POST', body: form })
      }
      const data = await res.json()
      if (data.ingredients) setExtractedIngredients(data.ingredients)
      else alert(data.error || 'Could not extract ingredients.')
    } catch (err) {
      console.error(err)
      alert('Extraction failed. Try entering ingredients manually.')
    }
    setExtracting(false)
  }

  const saveRecipe = async (ingredients) => {
    try {
      const res = await fetch(`${API_URL}/api/bar-recipes/${weddingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: recipeName,
          source_type: recipeMode,
          source_url: recipeMode === 'url' ? recipeUrl : null,
          ingredients,
          servings_basis: 1,
        }),
      })
      const saved = await res.json()
      setRecipes(prev => [...prev, saved])
      setAddingRecipe(false)
      setRecipeName('')
      setRecipeUrl('')
      setRecipeFile(null)
      setExtractedIngredients(null)
    } catch (err) { console.error(err) }
  }

  const deleteRecipe = async (id) => {
    setRecipes(prev => prev.filter(r => r.id !== id))
    await fetch(`${API_URL}/api/bar-recipes/${id}`, { method: 'DELETE' })
  }

  const addRecipeToList = async (recipe) => {
    const scale = guests // scale ingredients to guest count (1 per person)
    const added = []
    for (const ing of recipe.ingredients) {
      const scaledQty = ing.per_serving ? Math.ceil(ing.quantity * scale) : ing.quantity
      const res = await fetch(`${API_URL}/api/bar-shopping/${weddingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: ing.name,
          quantity: scaledQty,
          unit: ing.unit,
          category: ing.category || 'other',
          notes: `For ${recipe.name} (scaled to ${scale} guests)`,
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

  const checked   = items.filter(i => i.checked).length
  const total     = items.length

  return (
    <div className="space-y-5 max-w-2xl">

      <div>
        <h3 className="font-serif text-lg text-sage-700">Bar Planner</h3>
        <p className="text-sage-500 text-sm mt-0.5">
          Calculate quantities, build a shopping list, and add your signature cocktail recipes.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-cream-200">
        {[
          { id: 'list',       label: `Shopping List${total ? ` (${checked}/${total})` : ''}` },
          { id: 'calculator', label: 'Quantity Guide' },
          { id: 'recipes',    label: `Cocktail Recipes${recipes.length ? ` (${recipes.length})` : ''}` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? 'border-sage-600 text-sage-700'
                : 'border-transparent text-sage-400 hover:text-sage-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Shopping List ── */}
      {tab === 'list' && (
        <div>
          {items.length === 0 ? (
            <div className="text-center py-10 text-sage-400">
              <p className="text-3xl mb-3">🛒</p>
              <p className="text-sm">No items yet. Use the Quantity Guide to generate a list, or add items manually.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {CATEGORIES.filter(cat => items.some(i => i.category === cat.key)).map(cat => (
                <div key={cat.key}>
                  <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">
                    {cat.emoji} {cat.label}
                  </p>
                  <div className="bg-white border border-cream-200 rounded-xl px-4">
                    {items
                      .filter(i => i.category === cat.key)
                      .map(item => (
                        <ShoppingRow
                          key={item.id}
                          item={item}
                          onToggle={toggleItem}
                          onDelete={deleteItem}
                          onUpdate={updateItem}
                        />
                      ))
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add item */}
          {addingItem ? (
            <div className="mt-4 bg-cream-50 border border-cream-200 rounded-xl p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  value={newItem.item_name}
                  onChange={e => setNewItem(p => ({...p, item_name: e.target.value}))}
                  placeholder="Item name"
                  autoFocus
                  className="flex-1 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
                <input
                  value={newItem.quantity}
                  onChange={e => setNewItem(p => ({...p, quantity: e.target.value}))}
                  placeholder="Qty"
                  className="w-16 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
                <input
                  value={newItem.unit}
                  onChange={e => setNewItem(p => ({...p, unit: e.target.value}))}
                  placeholder="Unit"
                  className="w-20 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={newItem.category}
                  onChange={e => setNewItem(p => ({...p, category: e.target.value}))}
                  className="border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                >
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                </select>
                <input
                  value={newItem.notes}
                  onChange={e => setNewItem(p => ({...p, notes: e.target.value}))}
                  placeholder="Notes (optional)"
                  className="flex-1 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addItem} className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700">Add item</button>
                <button onClick={() => setAddingItem(false)} className="px-4 py-2 text-sage-500 text-sm hover:text-sage-700">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingItem(true)}
              className="mt-4 text-sage-500 hover:text-sage-700 text-sm font-medium"
            >
              + Add item manually
            </button>
          )}
        </div>
      )}

      {/* ── Calculator ── */}
      {tab === 'calculator' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Based on Rixey's handbook recommendations (~1 drink/person/hour). Adjust sliders to match your crowd — the quantities table updates live.
          </div>

          {/* Bar type */}
          <div>
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">Bar type</p>
            <div className="space-y-2">
              {BAR_TYPES.map(bt => (
                <label key={bt.key} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio" name="barType" value={bt.key} checked={barType === bt.key}
                    onChange={() => selectBarType(bt.key)}
                    className="mt-0.5 accent-sage-600"
                  />
                  <div>
                    <p className={`text-sm font-medium ${barType === bt.key ? 'text-sage-700' : 'text-sage-500'}`}>{bt.label}</p>
                    {bt.key === 'specialty' && <p className="text-xs text-sage-400">Add your recipes in the Cocktail Recipes tab — they'll scale to your guest count</p>}
                    {bt.key === 'full' && <p className="text-xs text-sage-400">Vodka, rum, gin, Jack Daniel's, Fireball — limit shots-only liquors (go easy on tequila)</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Season */}
          <div>
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">Season <span className="font-normal normal-case text-sage-400">(affects red vs white wine split)</span></p>
            <div className="flex gap-3">
              {[
                { key: 'summer', label: '☀️ Spring / Summer', note: 'More white & rosé' },
                { key: 'winter', label: '🍂 Autumn / Winter',  note: 'More red' },
              ].map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSeason(s.key)}
                  className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-sm text-left transition ${
                    season === s.key ? 'border-sage-500 bg-sage-50' : 'border-cream-200 hover:border-sage-300'
                  }`}
                >
                  <p className={`font-medium ${season === s.key ? 'text-sage-700' : 'text-sage-500'}`}>{s.label}</p>
                  <p className="text-xs text-sage-400 mt-0.5">{s.note}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Guest count slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-sage-500 uppercase tracking-wide">Guest count</label>
              <input
                type="number" value={guests}
                onChange={e => setGuests(Math.max(1, Number(e.target.value)))}
                className="w-20 border border-cream-300 rounded-lg px-2 py-1 text-sm text-center font-medium text-sage-700 focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <input type="range" min={10} max={400} step={5} value={guests}
              onChange={e => setGuests(Number(e.target.value))} className="w-full accent-sage-600" />
            <div className="flex justify-between text-xs text-sage-300 mt-1">
              <span>10</span><span>100</span><span>200</span><span>300</span><span>400</span>
            </div>
          </div>

          {/* Hours slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-sage-500 uppercase tracking-wide">Bar open for</label>
              <span className="text-sm font-medium text-sage-700">{hours} {hours === 1 ? 'hour' : 'hours'}</span>
            </div>
            <input type="range" min={1} max={12} step={0.5} value={hours}
              onChange={e => setHours(Number(e.target.value))} className="w-full accent-sage-600" />
            <div className="flex justify-between text-xs text-sage-300 mt-1">
              <span>1 hr</span><span>3</span><span>5</span><span>8</span><span>12 hrs</span>
            </div>
          </div>

          {/* Drink split sliders — drive the per-guest summary */}
          <div>
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Adjust for your crowd</p>
            <p className="text-xs text-sage-400 mb-4">These sliders don't change the quantities table — they tune the per-guest summary below.</p>
            <div className="space-y-4">
              {[
                { label: '🍺 Beer',               val: beerPct,    set: setBeerPct,    color: 'accent-amber-500', disabled: false },
                { label: '🍷 Wine',               val: winePct,    set: setWinePct,    color: 'accent-rose-500',  disabled: false },
                { label: '🥃 Spirits / cocktails', val: spiritsPct, set: setSpiritsPct, color: 'accent-sage-600',  disabled: barType === 'beer-wine' },
                { label: '🥤 Non-alcoholic',       val: nonAlcPct,  set: setNonAlcPct,  color: 'accent-blue-400',  disabled: false },
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
              <p className="text-xs text-amber-600 mt-2">Beer + wine + spirits = {beerPct + winePct + spiritsPct}%</p>
            )}
          </div>

          {/* Per-guest running summary */}
          <div className="bg-sage-50 border border-sage-200 rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">What this means per guest</p>
            <p className="text-sage-700 text-sm leading-relaxed">
              Over <strong>{hours} {hours === 1 ? 'hour' : 'hours'}</strong>, each guest could have around{' '}
              {winePct > 0 && <><strong>{(hours * winePct / 100).toFixed(1)} {hours * winePct / 100 === 1 ? 'glass' : 'glasses'} of wine</strong>{beerPct > 0 || spiritsPct > 0 ? ', ' : ''}</>}
              {beerPct > 0 && <><strong>{(hours * beerPct / 100).toFixed(1)} {hours * beerPct / 100 === 1 ? 'beer' : 'beers'}</strong>{spiritsPct > 0 ? ', and ' : ''}</>}
              {spiritsPct > 0 && <><strong>{(hours * spiritsPct / 100).toFixed(1)} {hours * spiritsPct / 100 === 1 ? 'mixed drink' : 'mixed drinks'}</strong></>}
              {nonAlcPct > 0 && <> — plus <strong>{(hours * nonAlcPct / 100).toFixed(1)} non-alcoholic {hours * nonAlcPct / 100 === 1 ? 'drink' : 'drinks'}</strong></>}.
            </p>
            <p className="text-xs text-sage-400 mt-2">
              Total estimated drinks: <strong>{(hours * guests).toLocaleString()}</strong> across all {guests} guests.
            </p>
          </div>

          {/* Quantities table by category */}
          <div>
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-3">Suggested quantities to buy</p>
            {CATEGORIES.filter(cat => calcPreview.some(i => i.category === cat.key)).map(cat => (
              <div key={cat.key} className="mb-4">
                <p className="text-xs font-semibold text-sage-400 uppercase tracking-wide mb-1 px-1">{cat.emoji} {cat.label}</p>
                <div className="bg-white border border-cream-200 rounded-xl divide-y divide-cream-100">
                  {calcPreview.filter(i => i.category === cat.key).map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-sage-700">{item.item_name}</span>
                      <span className="text-sm font-semibold text-sage-600 flex-shrink-0 ml-4">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {barType === 'specialty' && (
              <p className="text-xs text-sage-400 italic mt-2">
                Signature cocktail ingredients aren't listed here — add your recipes in the Cocktail Recipes tab and they'll scale to {guests} guests automatically.
              </p>
            )}
            <p className="text-xs text-sage-400 mt-3">
              ⚠️ No half kegs (1/2 barrel) — they can't safely be moved down the Rixey staircase.
            </p>
          </div>

          <button
            onClick={importFromCalculator}
            className="w-full py-3 bg-sage-600 text-white rounded-xl text-sm font-medium hover:bg-sage-700"
          >
            Import to shopping list (replaces any previous calculator items)
          </button>
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

          {/* Existing recipes */}
          {recipes.map(recipe => (
            <div key={recipe.id} className="bg-white border border-cream-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-medium text-sage-700">{recipe.name}</p>
                  {recipe.source_url && (
                    <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sage-400 hover:text-sage-600 underline">
                      View source →
                    </a>
                  )}
                </div>
                <button onClick={() => deleteRecipe(recipe.id)} className="text-red-300 hover:text-red-500 flex-shrink-0 p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              {recipe.ingredients?.length > 0 ? (
                <>
                  <div className="space-y-1 mb-4">
                    {recipe.ingredients.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-sage-600">{ing.name}</span>
                        <span className="text-sage-400 text-xs">
                          {ing.per_serving
                            ? `${Math.ceil(ing.quantity * guests)} ${ing.unit} (for ${guests} guests)`
                            : `${ing.quantity} ${ing.unit}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => addRecipeToList(recipe)}
                    className="text-sm text-sage-600 hover:text-sage-800 font-medium"
                  >
                    + Add scaled quantities to shopping list
                  </button>
                </>
              ) : (
                <p className="text-sm text-sage-400 italic">No ingredients extracted.</p>
              )}
            </div>
          ))}

          {/* Add recipe form */}
          {addingRecipe ? (
            <div className="bg-cream-50 border border-cream-200 rounded-xl p-5 space-y-4">
              <p className="font-medium text-sage-700">Add a cocktail recipe</p>

              <div>
                <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wide mb-1">Cocktail name</label>
                <input
                  value={recipeName}
                  onChange={e => setRecipeName(e.target.value)}
                  placeholder="e.g. Aperol Spritz, Lavender Martini…"
                  className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setRecipeMode('url')}
                  className={`flex-1 py-2 rounded-lg text-sm border-2 transition ${recipeMode === 'url' ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-cream-300 text-sage-500'}`}
                >
                  🔗 Paste a link
                </button>
                <button
                  onClick={() => setRecipeMode('upload')}
                  className={`flex-1 py-2 rounded-lg text-sm border-2 transition ${recipeMode === 'upload' ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-cream-300 text-sage-500'}`}
                >
                  📷 Upload recipe card
                </button>
              </div>

              {recipeMode === 'url' && (
                <input
                  value={recipeUrl}
                  onChange={e => setRecipeUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
              )}

              {recipeMode === 'upload' && (
                <div>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setRecipeFile(e.target.files[0])} />
                  <button
                    onClick={() => fileRef.current.click()}
                    className="w-full py-3 border-2 border-dashed border-cream-300 rounded-lg text-sm text-sage-500 hover:border-sage-400 hover:text-sage-600 transition"
                  >
                    {recipeFile ? recipeFile.name : 'Choose image or PDF…'}
                  </button>
                </div>
              )}

              {/* Extracted ingredients preview */}
              {extractedIngredients && (
                <div className="bg-white border border-cream-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide">Extracted ingredients</p>
                  {extractedIngredients.map((ing, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-sage-700">{ing.name}</span>
                      <span className="text-sage-400">{ing.quantity} {ing.unit} per serving</span>
                    </div>
                  ))}
                  <p className="text-xs text-sage-400 mt-2">
                    These will be scaled to {guests} guests when added to your shopping list.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {!extractedIngredients ? (
                  <button
                    onClick={extractRecipe}
                    disabled={extracting}
                    className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
                  >
                    {extracting ? 'Extracting with AI…' : 'Extract ingredients'}
                  </button>
                ) : (
                  <button
                    onClick={() => saveRecipe(extractedIngredients)}
                    className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700"
                  >
                    Save recipe
                  </button>
                )}
                <button onClick={() => { setAddingRecipe(false); setExtractedIngredients(null) }} className="px-4 py-2 text-sage-500 text-sm hover:text-sage-700">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingRecipe(true)}
              className="text-sage-500 hover:text-sage-700 text-sm font-medium"
            >
              + Add cocktail recipe
            </button>
          )}
        </div>
      )}
    </div>
  )
}
