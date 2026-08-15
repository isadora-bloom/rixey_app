import { useEffect, useState } from 'react'
import { apiFetch } from '../../utils/api'
import { partnerLabels } from '../../../shared/partner-labels'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * The alignment worksheets, from the venue's side.
 *
 * Couples have been filling these in since they were built and nobody at Rixey
 * could read them. The only code that touched those three columns was the
 * couple's own form, so sixteen couples had answered questions about their
 * priorities, their guest rules and who is paying, straight into a column
 * nothing rendered.
 *
 * The ranking grid is the reason this is worth a screen of its own. Each
 * partner ranks the same ten things 1 to 10 on their own, without seeing the
 * other's answers. Where they agree is pleasant. Where they are five or more
 * apart is the actual information: that is the conversation the couple has not
 * had yet, and knowing it before a planning meeting is the difference between
 * asking a good question and finding out at the tasting.
 *
 * So this sorts by distance rather than by category, biggest gap first.
 */
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

const GUEST_RULE_LABELS = {
  rule_family: 'Extended family',
  rule_friends: 'Friends',
  rule_work: 'Work colleagues',
  rule_plusones: 'Plus-ones',
  rule_children: 'Children',
}

const money = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString()}` : null
}

const filled = (o) => o && typeof o === 'object' && Object.keys(o).length > 0

function Empty({ what }) {
  return <p className="text-sage-400 text-sm italic">{what} not filled in yet.</p>
}

export default function AdminWorksheets({ wedding }) {
  const weddingId = wedding?.id
  const [ws, setWs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!weddingId) return
    setLoading(true)
    apiFetch(`${API_URL}/api/worksheets/${weddingId}`)
      .then(d => setWs(d?.worksheets || {}))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [weddingId])

  if (loading) return <p className="text-sage-500 text-sm">Loading worksheets…</p>
  if (error) return <p className="text-red-600 text-sm">Could not load worksheets: {error}</p>

  const priorities = ws?.worksheet_priorities || {}
  const guests = ws?.worksheet_guest_rules || {}
  const budget = ws?.worksheet_budget_alignment || {}
  const { p1: label1, p2: label2 } = partnerLabels(wedding)

  const p1 = priorities.p1 || {}
  const p2 = priorities.p2 || {}
  const rows = PRIORITY_CATS
    .map(cat => {
      const a = parseInt(p1[cat], 10)
      const b = parseInt(p2[cat], 10)
      const bothAnswered = !Number.isNaN(a) && !Number.isNaN(b)
      return { cat, a, b, gap: bothAnswered ? Math.abs(a - b) : null }
    })
    .filter(r => !Number.isNaN(r.a) || !Number.isNaN(r.b))
    .sort((x, y) => (y.gap ?? -1) - (x.gap ?? -1))

  const bothTopThree = rows.filter(r => r.gap !== null && r.a <= 3 && r.b <= 3)
  const farApart = rows.filter(r => r.gap !== null && r.gap >= 5)

  const budgetTotal = ['p1_savings', 'p1_future', 'p2_savings', 'p2_future', 'family']
    .map(k => parseFloat(budget[k]) || 0)
    .reduce((a, b) => a + b, 0)

  const nothingAtAll = !filled(priorities) && !filled(guests) && !filled(budget)
  if (nothingAtAll) {
    return (
      <p className="text-sage-500 text-sm">
        This couple has not filled in any of the alignment worksheets yet.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {/* Priorities */}
      <div>
        <h4 className="font-serif text-lg text-sage-700">What matters most</h4>
        {!rows.length ? <Empty what="Priorities" /> : (
          <>
            {farApart.length > 0 && (
              <div className="mt-2 mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-amber-900 text-sm font-medium">
                  They are far apart on {farApart.length === 1 ? 'one thing' : `${farApart.length} things`}
                </p>
                <p className="text-amber-800 text-sm mt-0.5">
                  {farApart.map(r => r.cat).join(', ')}. Worth raising gently rather than assuming it is settled.
                </p>
              </div>
            )}
            {bothTopThree.length > 0 && (
              <p className="text-sage-600 text-sm mb-3">
                Both put these in their top three: {bothTopThree.map(r => r.cat).join(', ')}.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-sage-500 border-b border-cream-200">
                    <th className="py-1.5 pr-3 font-normal">Ranked 1 = most important</th>
                    <th className="py-1.5 px-2 font-normal whitespace-nowrap">{label1}</th>
                    <th className="py-1.5 px-2 font-normal whitespace-nowrap">{label2}</th>
                    <th className="py-1.5 pl-2 font-normal">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.cat} className="border-b border-cream-100 last:border-0">
                      <td className="py-1.5 pr-3 text-sage-700">{r.cat}</td>
                      <td className="py-1.5 px-2 tabular-nums">{Number.isNaN(r.a) ? '—' : r.a}</td>
                      <td className="py-1.5 px-2 tabular-nums">{Number.isNaN(r.b) ? '—' : r.b}</td>
                      <td className={`py-1.5 pl-2 tabular-nums ${r.gap >= 5 ? 'text-amber-700 font-medium' : 'text-sage-400'}`}>
                        {r.gap ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Guest rules */}
      <div>
        <h4 className="font-serif text-lg text-sage-700">Guest list rules</h4>
        {!filled(guests) ? <Empty what="Guest rules" /> : (
          <div className="mt-1 space-y-1.5 text-sm">
            {(guests.count_min || guests.count_max || guests.count_contracted) && (
              <p className="text-sage-700">
                Aiming for {guests.count_min || '?'}–{guests.count_max || '?'} guests
                {guests.count_contracted ? `, contracted for ${guests.count_contracted}` : ''}.
              </p>
            )}
            {Object.entries(GUEST_RULE_LABELS).map(([key, label]) => (
              guests[key] ? (
                <p key={key} className="text-sage-600">
                  <span className="text-sage-500">{label}:</span> {guests[key]}
                </p>
              ) : null
            ))}
          </div>
        )}
      </div>

      {/* Budget */}
      <div>
        <h4 className="font-serif text-lg text-sage-700">How it is being paid for</h4>
        {!filled(budget) ? <Empty what="Budget alignment" /> : (
          <div className="mt-1 space-y-1.5 text-sm">
            {money(budget.total) && <p className="text-sage-700">Their stated total: {money(budget.total)}</p>}
            {money(budget.p1_savings) && <p className="text-sage-600">{label1} savings: {money(budget.p1_savings)}</p>}
            {money(budget.p1_future) && <p className="text-sage-600">{label1} from future income: {money(budget.p1_future)}</p>}
            {money(budget.p2_savings) && <p className="text-sage-600">{label2} savings: {money(budget.p2_savings)}</p>}
            {money(budget.p2_future) && <p className="text-sage-600">{label2} from future income: {money(budget.p2_future)}</p>}
            {money(budget.family) && <p className="text-sage-600">From family: {money(budget.family)}</p>}
            {budgetTotal > 0 && (
              <p className="text-sage-500 pt-1 border-t border-cream-200">
                Adds up to {money(budgetTotal)}
                {money(budget.total) && budgetTotal !== (parseFloat(budget.total) || 0)
                  ? `, which does not match the ${money(budget.total)} they wrote down.`
                  : '.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
