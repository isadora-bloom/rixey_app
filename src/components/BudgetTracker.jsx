import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const DEFAULT_CATEGORIES = {
  catering:    { label: 'Catering / Food',      budgeted: 0, committed: 0 },
  photography: { label: 'Photography',           budgeted: 0, committed: 0 },
  videography: { label: 'Videography',           budgeted: 0, committed: 0 },
  flowers:     { label: 'Flowers & Florals',     budgeted: 0, committed: 0 },
  music:       { label: 'Music (DJ / Band)',      budgeted: 0, committed: 0 },
  cake:        { label: 'Cake & Desserts',        budgeted: 0, committed: 0 },
  officiant:   { label: 'Officiant',             budgeted: 0, committed: 0 },
  hair_makeup: { label: 'Hair & Makeup',          budgeted: 0, committed: 0 },
  attire:      { label: 'Attire & Accessories',  budgeted: 0, committed: 0 },
  other:       { label: 'Other',                 budgeted: 0, committed: 0 },
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US')
}

export default function BudgetTracker({ weddingId }) {
  const [totalBudget, setTotalBudget] = useState(0)
  const [isShared, setIsShared] = useState(false)
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadBudget()
  }, [weddingId])

  const loadBudget = async () => {
    try {
      const res = await fetch(`${API_URL}/api/budget/${weddingId}`)
      if (res.status === 404) {
        setLoading(false)
        return
      }
      const data = await res.json()
      if (data.budget) {
        setTotalBudget(data.budget.total_budget || 0)
        setIsShared(data.budget.is_shared || false)
        // Merge saved categories: start with defaults, overlay saved data, then add any custom keys
        const merged = { ...DEFAULT_CATEGORIES }
        Object.entries(data.budget.categories || {}).forEach(([key, val]) => {
          if (merged[key]) {
            merged[key] = { ...merged[key], ...val }
          } else {
            // Custom key saved previously
            merged[key] = { label: val.label || key, budgeted: val.budgeted || 0, committed: val.committed || 0, isCustom: true }
          }
        })
        setCategories(merged)
      }
    } catch (err) {
      console.error('Failed to load budget:', err)
    }
    setLoading(false)
  }

  const updateCategory = (key, field, value) => {
    const num = parseInt(value.replace(/\D/g, ''), 10) || 0
    setCategories(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: num }
    }))
  }

  const updateCategoryLabel = (key, label) => {
    setCategories(prev => ({
      ...prev,
      [key]: { ...prev[key], label }
    }))
  }

  const deleteCategory = (key) => {
    setCategories(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const addCustomCategory = () => {
    const key = `custom_${Date.now()}`
    setCategories(prev => ({
      ...prev,
      [key]: { label: '', budgeted: 0, committed: 0, isCustom: true }
    }))
  }

  const totalBudgeted = Object.values(categories).reduce((s, c) => s + (c.budgeted || 0), 0)
  const totalCommitted = Object.values(categories).reduce((s, c) => s + (c.committed || 0), 0)
  const overallBudget = totalBudget || totalBudgeted
  const overallPercent = overallBudget > 0 ? Math.min(100, Math.round((totalCommitted / overallBudget) * 100)) : 0
  const isOverall = totalCommitted > overallBudget && overallBudget > 0

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId, totalBudget, isShared, categories })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Failed to save budget:', err)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-cream-100 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Total budget input */}
      <div>
        <label className="block text-sm font-medium text-sage-700 mb-1">Total Wedding Budget</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-500 font-medium">$</span>
          <input
            type="text"
            value={totalBudget === 0 ? '' : totalBudget.toLocaleString('en-US')}
            onChange={(e) => setTotalBudget(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
            placeholder="e.g. 25,000"
            className="w-full pl-7 pr-4 py-3 rounded-xl border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-300 text-lg font-semibold text-sage-800"
          />
        </div>
      </div>

      {/* Overall progress bar */}
      {overallBudget > 0 && (
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-sage-600 font-medium">${fmt(totalCommitted)} committed</span>
            <span className={isOverall ? 'text-red-600 font-semibold' : 'text-sage-500'}>
              {isOverall ? 'OVER BUDGET' : `${overallPercent}% of $${fmt(overallBudget)}`}
            </span>
          </div>
          <div className="h-3 bg-cream-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isOverall ? 'bg-red-500' : 'bg-sage-500'}`}
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Category rows */}
      <div>
        <div className="grid grid-cols-[1fr_100px_100px_60px_28px] gap-2 text-xs font-medium text-sage-500 uppercase tracking-wide mb-2 px-1">
          <span>Category</span>
          <span className="text-right">Budgeted</span>
          <span className="text-right">Committed</span>
          <span className="text-right">%</span>
          <span></span>
        </div>
        <div className="space-y-2">
          {Object.entries(categories).map(([key, cat]) => {
            const catPercent = cat.budgeted > 0 ? Math.min(100, Math.round((cat.committed / cat.budgeted) * 100)) : 0
            const isOver = cat.committed > cat.budgeted && cat.budgeted > 0

            return (
              <div key={key} className={`rounded-xl border p-3 ${isOver ? 'border-amber-300 bg-amber-50' : 'border-cream-200 bg-white'}`}>
                <div className="grid grid-cols-[1fr_100px_100px_60px_28px] gap-2 items-center">
                  {/* Label — editable for custom rows */}
                  {cat.isCustom ? (
                    <input
                      type="text"
                      value={cat.label}
                      onChange={(e) => updateCategoryLabel(key, e.target.value)}
                      placeholder="Category name"
                      className="text-sm font-medium text-sage-800 border-b border-dashed border-sage-300 bg-transparent focus:outline-none focus:border-sage-500 truncate"
                    />
                  ) : (
                    <span className="text-sm font-medium text-sage-800 truncate">{cat.label}</span>
                  )}
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sage-400 text-xs">$</span>
                    <input
                      type="text"
                      value={cat.budgeted === 0 ? '' : cat.budgeted.toLocaleString('en-US')}
                      onChange={(e) => updateCategory(key, 'budgeted', e.target.value)}
                      placeholder="0"
                      className="w-full pl-5 pr-1 py-1.5 rounded-lg border border-cream-200 text-right text-sm text-sage-700 focus:outline-none focus:ring-1 focus:ring-sage-300"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sage-400 text-xs">$</span>
                    <input
                      type="text"
                      value={cat.committed === 0 ? '' : cat.committed.toLocaleString('en-US')}
                      onChange={(e) => updateCategory(key, 'committed', e.target.value)}
                      placeholder="0"
                      className={`w-full pl-5 pr-1 py-1.5 rounded-lg border text-right text-sm focus:outline-none focus:ring-1 focus:ring-sage-300 ${
                        isOver ? 'border-amber-300 text-amber-700' : 'border-cream-200 text-sage-700'
                      }`}
                    />
                  </div>
                  <span className={`text-right text-sm font-medium ${isOver ? 'text-red-600' : 'text-sage-500'}`}>
                    {cat.budgeted > 0 ? `${catPercent}%` : '—'}
                  </span>
                  {/* Delete button */}
                  <button
                    onClick={() => deleteCategory(key)}
                    title="Remove row"
                    className="flex items-center justify-center w-6 h-6 rounded-full text-sage-300 hover:text-red-500 hover:bg-red-50 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {cat.budgeted > 0 && (
                  <div className="mt-1.5 h-1 bg-cream-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isOver ? 'bg-amber-500' : 'bg-sage-400'}`}
                      style={{ width: `${catPercent}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add custom category */}
        <button
          onClick={addCustomCategory}
          className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-cream-300 text-sage-500 hover:border-sage-400 hover:text-sage-600 transition text-sm font-medium"
        >
          + Add category
        </button>
      </div>

      {/* Privacy toggle */}
      <div className="bg-cream-50 rounded-xl p-4 border border-cream-200">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-sage-600"
          />
          <div>
            <p className="text-sm font-medium text-sage-800">Share with the Rixey Manor team</p>
            <p className="text-xs text-sage-500 mt-0.5">
              Allow your coordinator to see your budget breakdown so they can give better recommendations.
              {!isShared && ' Your budget is currently private.'}
            </p>
          </div>
        </label>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-medium transition text-white ${
          saved ? 'bg-green-600' : 'bg-sage-600 hover:bg-sage-700'
        } disabled:opacity-50`}
      >
        {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Budget'}
      </button>
    </div>
  )
}
