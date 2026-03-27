import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config/api'


const PRIORITY_CATS = [
  'The venue and setting',
  'The food and drinks',
  'Photography and video',
  'Music and dancing',
  'Flowers and décor',
  'Attire and beauty',
  'Guest experience and comfort',
  'Overall guest count',
  'Formality and style',
  'Religious or cultural elements',
]

const SKIP_OPTIONS = [
  'Favors',
  'Programs',
  'Formal exit / sparklers',
  'Elaborate centerpieces',
  'Welcome bags',
  'Photo booth',
  'Guestbook',
  'Elaborate cake',
  'Bouquet/garter toss',
  'Formal receiving line',
  'Multiple outfit changes',
  'Unity ceremony',
  'Full wedding party processional',
]


function SectionCard({ title, isOpen, onToggle, hasData, children }) {
  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-cream-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {hasData && (
            <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" title="Saved" />
          )}
          {!hasData && (
            <span className="w-2 h-2 bg-cream-200 rounded-full flex-shrink-0" />
          )}
          <span className="font-semibold text-sage-800 text-base">{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-sage-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-6 pt-1 border-t border-cream-100">
          {children}
        </div>
      )}
    </div>
  )
}

function SaveButton({ onClick, label = 'Save draft', saving, saved, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${className}`}
    >
      {saving ? 'Saving…' : saved ? '✓ Saved' : label}
    </button>
  )
}

export default function WeddingWorksheets({ weddingId, userId }) {
  const [loading, setLoading] = useState(true)
  const [worksheets, setWorksheets] = useState({})
  const [openSection, setOpenSection] = useState('priorities')

  // Section 1 — Priorities
  const [p1Ranks, setP1Ranks] = useState({})
  const [p2Ranks, setP2Ranks] = useState({})
  const [skipped, setSkipped] = useState([])
  const [values, setValues] = useState({
    about1: '', about2: '',
    feel: '',
    splurge_on: '', splurge_because: '',
    skip: '', skip_because: '',
    remember: '',
  })
  const [prioritiesSaving, setPrioritiesSaving] = useState(false)
  const [prioritiesSaved, setPrioritiesSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Section 2 — Guest rules
  const [guestRules, setGuestRules] = useState({
    count_min: '', count_max: '', count_contracted: '',
    rule_family: '', rule_friends: '', rule_work: '', rule_plusones: '', rule_children: '',
  })
  const [guestSaving, setGuestSaving] = useState(false)
  const [guestSaved, setGuestSaved] = useState(false)

  // Section 3 — Budget
  const [budget, setBudget] = useState({
    p1_savings: '', p1_future: '',
    p2_savings: '', p2_future: '',
    family: '',
  })
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetSaved, setBudgetSaved] = useState(false)

  // Load data
  useEffect(() => {
    if (!weddingId) return
    fetch(`${API_URL}/api/worksheets/${weddingId}`)
      .then(r => r.json())
      .then(({ worksheets: ws }) => {
        setWorksheets(ws || {})
        if (ws?.worksheet_priorities && Object.keys(ws.worksheet_priorities).length > 0) {
          const p = ws.worksheet_priorities
          if (p.p1) setP1Ranks(p.p1)
          if (p.p2) setP2Ranks(p.p2)
          if (p.skipped) setSkipped(p.skipped)
          if (p.values) setValues(v => ({ ...v, ...p.values }))
          if (p.values_statement_submitted) setSubmitted(true)
        }
        if (ws?.worksheet_guest_rules && Object.keys(ws.worksheet_guest_rules).length > 0) {
          setGuestRules(r => ({ ...r, ...ws.worksheet_guest_rules }))
        }
        if (ws?.worksheet_budget_alignment && Object.keys(ws.worksheet_budget_alignment).length > 0) {
          setBudget(b => ({ ...b, ...ws.worksheet_budget_alignment }))
        }
      })
      .catch(err => console.error('Load worksheets error:', err))
      .finally(() => setLoading(false))
  }, [weddingId])

  const showSaved = useCallback((setSaved) => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }, [])

  // Alignment check
  const agreements = PRIORITY_CATS.filter(cat => {
    const r1 = parseInt(p1Ranks[cat])
    const r2 = parseInt(p2Ranks[cat])
    return !isNaN(r1) && !isNaN(r2) && r1 <= 3 && r2 <= 3
  })
  const differences = PRIORITY_CATS.filter(cat => {
    const r1 = parseInt(p1Ranks[cat])
    const r2 = parseInt(p2Ranks[cat])
    return !isNaN(r1) && !isNaN(r2) && Math.abs(r1 - r2) >= 5
  })

  // Computed budget total
  const budgetTotal = [budget.p1_savings, budget.p1_future, budget.p2_savings, budget.p2_future, budget.family]
    .map(v => parseFloat(v) || 0)
    .reduce((a, b) => a + b, 0)

  const savePriorities = async (notify = false) => {
    if (notify) setSubmitting(true); else setPrioritiesSaving(true)
    try {
      const sectionData = {
        p1: p1Ranks,
        p2: p2Ranks,
        skipped,
        values,
        ...(notify ? { values_statement_submitted: true } : {}),
      }
      await fetch(`${API_URL}/api/worksheets/${weddingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'worksheet_priorities', data: sectionData, notify }),
      })
      if (notify) {
        setSubmitted(true)
        showSaved(setSubmitted)
      } else {
        showSaved(setPrioritiesSaved)
      }
    } catch (err) {
      console.error('Save priorities error:', err)
    } finally {
      if (notify) setSubmitting(false); else setPrioritiesSaving(false)
    }
  }

  const saveGuestRules = async () => {
    setGuestSaving(true)
    try {
      await fetch(`${API_URL}/api/worksheets/${weddingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'worksheet_guest_rules', data: guestRules }),
      })
      showSaved(setGuestSaved)
    } catch (err) {
      console.error('Save guest rules error:', err)
    } finally {
      setGuestSaving(false)
    }
  }

  const saveBudgetAlignment = async () => {
    setBudgetSaving(true)
    try {
      await fetch(`${API_URL}/api/worksheets/${weddingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'worksheet_budget_alignment', data: { ...budget, total: budgetTotal } }),
      })
      // Also update main budget total
      await fetch(`${API_URL}/api/budget/${weddingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_budget: budgetTotal }),
      })
      showSaved(setBudgetSaved)
    } catch (err) {
      console.error('Save budget alignment error:', err)
    } finally {
      setBudgetSaving(false)
    }
  }

  const hasPrioritiesData = worksheets?.worksheet_priorities && Object.keys(worksheets.worksheet_priorities).length > 0
  const hasGuestData = worksheets?.worksheet_guest_rules && Object.keys(worksheets.worksheet_guest_rules).length > 0
  const hasBudgetData = worksheets?.worksheet_budget_alignment && Object.keys(worksheets.worksheet_budget_alignment).length > 0

  if (loading) {
    return (
      <div className="text-sage-500 text-sm py-8 text-center">Loading worksheets…</div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-sage-800">Planning Worksheets</h2>
        <p className="text-sage-500 text-sm mt-1">Work through these together before diving into the details. They'll save you a lot of back-and-forth later.</p>
      </div>

      {/* Section 1: Priorities */}
      <SectionCard
        title="What Actually Matters To You"
        isOpen={openSection === 'priorities'}
        onToggle={() => setOpenSection(openSection === 'priorities' ? null : 'priorities')}
        hasData={hasPrioritiesData}
      >
        <div className="mt-4 space-y-6">
          <p className="text-sm text-sage-600">Rank each category 1–10 (1 = most important). Do this independently first, then compare.</p>

          {/* Priority ranking table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200">
                  <th className="text-left py-2 pr-4 text-sage-600 font-medium">Category</th>
                  <th className="text-center py-2 px-3 text-sage-600 font-medium w-28">Partner 1<br /><span className="text-xs font-normal">(1–10)</span></th>
                  <th className="text-center py-2 px-3 text-sage-600 font-medium w-28">Partner 2<br /><span className="text-xs font-normal">(1–10)</span></th>
                </tr>
              </thead>
              <tbody>
                {PRIORITY_CATS.map(cat => (
                  <tr key={cat} className="border-b border-cream-50 hover:bg-cream-50">
                    <td className="py-2 pr-4 text-sage-700">{cat}</td>
                    <td className="py-2 px-3 text-center">
                      <select
                        value={p1Ranks[cat] || ''}
                        onChange={e => setP1Ranks(prev => ({ ...prev, [cat]: e.target.value }))}
                        className="border border-cream-200 rounded-lg px-2 py-1 text-sage-700 bg-white focus:outline-none focus:border-sage-400 w-full"
                      >
                        <option value="">—</option>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <select
                        value={p2Ranks[cat] || ''}
                        onChange={e => setP2Ranks(prev => ({ ...prev, [cat]: e.target.value }))}
                        className="border border-cream-200 rounded-lg px-2 py-1 text-sage-700 bg-white focus:outline-none focus:border-sage-400 w-full"
                      >
                        <option value="">—</option>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Alignment Check */}
          {(agreements.length > 0 || differences.length > 0) && (
            <div className="bg-cream-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-sage-700">Alignment Check</p>
              {agreements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-green-700 mb-1">You agree on (both top 3):</p>
                  <div className="flex flex-wrap gap-2">
                    {agreements.map(cat => (
                      <span key={cat} className="text-xs bg-green-100 text-green-800 rounded-full px-3 py-1">{cat}</span>
                    ))}
                  </div>
                </div>
              )}
              {differences.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-700 mb-1">Worth a conversation (5+ apart):</p>
                  <div className="flex flex-wrap gap-2">
                    {differences.map(cat => (
                      <span key={cat} className="text-xs bg-amber-100 text-amber-800 rounded-full px-3 py-1">{cat}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Things we're happily skipping */}
          <div>
            <p className="text-sm font-semibold text-sage-700 mb-2">Things we're happily skipping</p>
            <p className="text-xs text-sage-500 mb-3">Check everything that doesn't matter to either of you — this frees up budget and energy for what does.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SKIP_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={skipped.includes(opt)}
                    onChange={e => {
                      setSkipped(prev =>
                        e.target.checked ? [...prev, opt] : prev.filter(s => s !== opt)
                      )
                    }}
                    className="rounded border-cream-300 text-sage-600 focus:ring-sage-400"
                  />
                  <span className="text-sm text-sage-600 group-hover:text-sage-800">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Values Statement */}
          <div>
            <p className="text-sm font-semibold text-sage-700 mb-1">Your Wedding Values Statement</p>
            <p className="text-xs text-sage-500 mb-4">Fill this in together. It becomes a filter for every decision you make.</p>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-sage-700">
                <span className="flex-shrink-0">Our wedding is about</span>
                <input
                  type="text"
                  value={values.about1}
                  onChange={e => setValues(v => ({ ...v, about1: e.target.value }))}
                  placeholder="connection"
                  className="border-b border-cream-300 focus:border-sage-500 focus:outline-none px-1 py-0.5 min-w-32 text-sage-800 bg-transparent"
                />
                <span className="flex-shrink-0">and</span>
                <input
                  type="text"
                  value={values.about2}
                  onChange={e => setValues(v => ({ ...v, about2: e.target.value }))}
                  placeholder="celebration"
                  className="border-b border-cream-300 focus:border-sage-500 focus:outline-none px-1 py-0.5 min-w-32 text-sage-800 bg-transparent"
                />
                <span className="flex-shrink-0">.</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-sage-700">
                <span className="flex-shrink-0">We want our guests to feel</span>
                <input
                  type="text"
                  value={values.feel}
                  onChange={e => setValues(v => ({ ...v, feel: e.target.value }))}
                  placeholder="welcomed and at ease"
                  className="border-b border-cream-300 focus:border-sage-500 focus:outline-none px-1 py-0.5 min-w-48 text-sage-800 bg-transparent"
                />
                <span className="flex-shrink-0">.</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-sage-700">
                <span className="flex-shrink-0">We're willing to splurge on</span>
                <input
                  type="text"
                  value={values.splurge_on}
                  onChange={e => setValues(v => ({ ...v, splurge_on: e.target.value }))}
                  placeholder="photography"
                  className="border-b border-cream-300 focus:border-sage-500 focus:outline-none px-1 py-0.5 min-w-32 text-sage-800 bg-transparent"
                />
                <span className="flex-shrink-0">because</span>
                <input
                  type="text"
                  value={values.splurge_because}
                  onChange={e => setValues(v => ({ ...v, splurge_because: e.target.value }))}
                  placeholder="we want to remember every moment"
                  className="border-b border-cream-300 focus:border-sage-500 focus:outline-none px-1 py-0.5 min-w-48 text-sage-800 bg-transparent"
                />
                <span className="flex-shrink-0">.</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-sage-700">
                <span className="flex-shrink-0">We're okay skipping</span>
                <input
                  type="text"
                  value={values.skip}
                  onChange={e => setValues(v => ({ ...v, skip: e.target.value }))}
                  placeholder="favors"
                  className="border-b border-cream-300 focus:border-sage-500 focus:outline-none px-1 py-0.5 min-w-32 text-sage-800 bg-transparent"
                />
                <span className="flex-shrink-0">because</span>
                <input
                  type="text"
                  value={values.skip_because}
                  onChange={e => setValues(v => ({ ...v, skip_because: e.target.value }))}
                  placeholder="no one really keeps them"
                  className="border-b border-cream-300 focus:border-sage-500 focus:outline-none px-1 py-0.5 min-w-48 text-sage-800 bg-transparent"
                />
                <span className="flex-shrink-0">.</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-sage-700">
                <span className="flex-shrink-0">In 20 years, we want to remember</span>
                <input
                  type="text"
                  value={values.remember}
                  onChange={e => setValues(v => ({ ...v, remember: e.target.value }))}
                  placeholder="how happy everyone felt dancing together"
                  className="border-b border-cream-300 focus:border-sage-500 focus:outline-none px-1 py-0.5 min-w-64 text-sage-800 bg-transparent"
                />
                <span className="flex-shrink-0">.</span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => savePriorities(true)}
              disabled={submitting || submitted}
              className="px-5 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {submitting ? 'Sending…' : submitted ? '✓ Sent to Rixey team' : 'Save & Send to Rixey Team'}
            </button>
            <SaveButton
              onClick={() => savePriorities(false)}
              saving={prioritiesSaving}
              saved={prioritiesSaved}
              className="border border-cream-200 text-sage-600 hover:bg-cream-50"
            />
          </div>
        </div>
      </SectionCard>

      {/* Section 2: Guest List Ground Rules */}
      <SectionCard
        title="Guest List Ground Rules"
        isOpen={openSection === 'guests'}
        onToggle={() => setOpenSection(openSection === 'guests' ? null : 'guests')}
        hasData={hasGuestData}
      >
        <div className="mt-4 space-y-5">
          <p className="text-sm text-sage-600">Set your rules before anyone asks to be invited. It's much easier to say no when you have a clear policy.</p>

          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Our realistic guest count range</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={guestRules.count_min}
                onChange={e => setGuestRules(r => ({ ...r, count_min: e.target.value }))}
                placeholder="75"
                className="border border-cream-200 rounded-lg px-3 py-2 text-sage-700 w-24 focus:outline-none focus:border-sage-400"
              />
              <span className="text-sage-500 text-sm">to</span>
              <input
                type="number"
                value={guestRules.count_max}
                onChange={e => setGuestRules(r => ({ ...r, count_max: e.target.value }))}
                placeholder="120"
                className="border border-cream-200 rounded-lg px-3 py-2 text-sage-700 w-24 focus:outline-none focus:border-sage-400"
              />
              <span className="text-sage-500 text-sm">guests</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-sage-700 mb-1">Our contracted maximum</label>
            <p className="text-xs text-sage-400 mb-2">Per your contract with Rixey Manor</p>
            <input
              type="number"
              value={guestRules.count_contracted}
              onChange={e => setGuestRules(r => ({ ...r, count_contracted: e.target.value }))}
              placeholder="150"
              className="border border-cream-200 rounded-lg px-3 py-2 text-sage-700 w-32 focus:outline-none focus:border-sage-400"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-sage-700 mb-3">Our rules</p>
            <div className="space-y-3">
              {[
                { key: 'rule_family', label: 'Extended family', placeholder: 'e.g. First cousins only' },
                { key: 'rule_friends', label: 'Friends', placeholder: "e.g. Only friends we've seen in the past year" },
                { key: 'rule_work', label: 'Work colleagues', placeholder: 'e.g. No work people' },
                { key: 'rule_plusones', label: 'Plus-ones', placeholder: "e.g. Only married or engaged partners we've met" },
                { key: 'rule_children', label: 'Children', placeholder: 'e.g. Adults only' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="text-sm text-sage-600 w-36 flex-shrink-0">{label}:</label>
                  <input
                    type="text"
                    value={guestRules[key]}
                    onChange={e => setGuestRules(r => ({ ...r, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="flex-1 border border-cream-200 rounded-lg px-3 py-2 text-sage-700 text-sm focus:outline-none focus:border-sage-400"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <SaveButton
              onClick={saveGuestRules}
              label="Save guest rules"
              saving={guestSaving}
              saved={guestSaved}
              className="px-5 py-2 bg-sage-600 hover:bg-sage-700 text-white"
            />
          </div>
        </div>
      </SectionCard>

      {/* Section 3: Budget Starting Point */}
      <SectionCard
        title="Budget Starting Point"
        isOpen={openSection === 'budget'}
        onToggle={() => setOpenSection(openSection === 'budget' ? null : 'budget')}
        hasData={hasBudgetData}
      >
        <div className="mt-4 space-y-5">
          <p className="text-sm text-sage-600">Do this privately first, then share with each other. Being honest now saves arguments later.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Partner 1 */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-sage-700">Partner 1</p>
              <div>
                <label className="block text-xs text-sage-500 mb-1">Savings I can contribute now</label>
                <div className="flex items-center gap-1">
                  <span className="text-sage-500 text-sm">$</span>
                  <input
                    type="number"
                    value={budget.p1_savings}
                    onChange={e => setBudget(b => ({ ...b, p1_savings: e.target.value }))}
                    placeholder="0"
                    className="border border-cream-200 rounded-lg px-3 py-2 text-sage-700 w-full focus:outline-none focus:border-sage-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-sage-500 mb-1">Amount I'll save by wedding date</label>
                <div className="flex items-center gap-1">
                  <span className="text-sage-500 text-sm">$</span>
                  <input
                    type="number"
                    value={budget.p1_future}
                    onChange={e => setBudget(b => ({ ...b, p1_future: e.target.value }))}
                    placeholder="0"
                    className="border border-cream-200 rounded-lg px-3 py-2 text-sage-700 w-full focus:outline-none focus:border-sage-400"
                  />
                </div>
              </div>
            </div>

            {/* Partner 2 */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-sage-700">Partner 2</p>
              <div>
                <label className="block text-xs text-sage-500 mb-1">Savings I can contribute now</label>
                <div className="flex items-center gap-1">
                  <span className="text-sage-500 text-sm">$</span>
                  <input
                    type="number"
                    value={budget.p2_savings}
                    onChange={e => setBudget(b => ({ ...b, p2_savings: e.target.value }))}
                    placeholder="0"
                    className="border border-cream-200 rounded-lg px-3 py-2 text-sage-700 w-full focus:outline-none focus:border-sage-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-sage-500 mb-1">Amount I'll save by wedding date</label>
                <div className="flex items-center gap-1">
                  <span className="text-sage-500 text-sm">$</span>
                  <input
                    type="number"
                    value={budget.p2_future}
                    onChange={e => setBudget(b => ({ ...b, p2_future: e.target.value }))}
                    placeholder="0"
                    className="border border-cream-200 rounded-lg px-3 py-2 text-sage-700 w-full focus:outline-none focus:border-sage-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-sage-700 mb-1">Confirmed family contributions</label>
            <div className="flex items-center gap-1">
              <span className="text-sage-500 text-sm">$</span>
              <input
                type="number"
                value={budget.family}
                onChange={e => setBudget(b => ({ ...b, family: e.target.value }))}
                placeholder="0"
                className="border border-cream-200 rounded-lg px-3 py-2 text-sage-700 w-40 focus:outline-none focus:border-sage-400"
              />
            </div>
          </div>

          {/* Total */}
          <div className="bg-sage-50 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-sage-700">Total confirmed budget</span>
            <span className="text-2xl font-bold text-sage-800">
              ${budgetTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 flex gap-2">
            <span className="text-amber-600 flex-shrink-0">⚠️</span>
            <p className="text-sm text-amber-800">Don't count money you "hope" someone might give you, or credit cards. Only confirmed amounts.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <SaveButton
              onClick={saveBudgetAlignment}
              label="Save & set as my budget"
              saving={budgetSaving}
              saved={budgetSaved}
              className="px-5 py-2 bg-sage-600 hover:bg-sage-700 text-white"
            />
          </div>
        </div>
      </SectionCard>

    </div>
  )
}
