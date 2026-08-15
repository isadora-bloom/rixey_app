import { useEffect, useState } from 'react'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../components/ui/Toast'
import WalkthroughNotes from '../../components/WalkthroughNotes'
import { venueWhen, venueDate, venueToday, venueDateTime } from '../../../shared/venue-time'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * The diary: who is coming, and what is already known about them.
 *
 * Every other screen in this portal starts from a wedding. This one cannot,
 * because the people on it have not booked. A venue tour is the conversation
 * that decides whether there is a wedding at all, and until now it happened
 * with nothing to hand: the booking in Calendly, the enquiry in Gmail, and
 * nowhere to write down what was said.
 *
 * Two lists on purpose. A tour with someone new is a different job from a
 * planning meeting with a couple whose file you already have, and running them
 * off one list makes both worse.
 */

const isTour = (kind) => /tour|site visit|venue visit/i.test(String(kind || ''))

/**
 * Meeting times are the venue's, not the reader's.
 *
 * Calendly hands back UTC and the browser renders in whatever timezone it is
 * set to. Correct on a laptop in Virginia, wrong by four hours on one that is
 * not, and silently so. A tour at 11am reading as 3pm is the sort of mistake
 * that is only noticed by missing it.
 */
function whenLabel(iso) {
  if (!iso) return 'no date'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'no date'
  if (venueDate(d) < venueToday()) return `${venueDateTime(d)} (past)`
  return venueWhen(d)
}

function Brief({ enquiry, onClose, onLink }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    setLoading(true)
    apiFetch(`${API_URL}/api/admin/enquiries/${enquiry.id}/brief`)
      .then(setBrief)
      .catch(() => setBrief(null))
      .finally(() => setLoading(false))
  }, [enquiry.id])

  const e = enquiry
  const facts = [
    e.preferred_date && ['Date they want', e.preferred_date],
    e.guest_estimate && ['Guests', e.guest_estimate],
    e.package_interest && ['Package', e.package_interest],
    e.used_calculator && ['Used the calculator', e.used_calculator],
    e.heard_about && ['Heard about us via', e.heard_about],
  ].filter(Boolean)

  // Anything the booking form asked that has no column of its own. Shown rather
  // than dropped: the form changes and a new question is still information.
  const extra = (e.answers || []).filter(a =>
    a.answer && !/partner|phone|date in mind|available weekends|guests|hear about|package|calculator/i.test(a.question))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full my-8">
        <div className="flex items-start justify-between p-4 border-b border-cream-200">
          <div>
            <h3 className="font-serif text-xl text-sage-700">
              {e.name}{e.partner_name ? ` & ${e.partner_name}` : ''}
            </h3>
            <p className="text-sage-500 text-sm">
              {e.meeting_kind} · {whenLabel(e.meeting_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-sage-400 hover:text-sage-600 p-2 text-xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-5">
          {/* Before anything else. Walking into a tour not knowing the date
              they have come to talk about is already sold is the one mistake
              this screen exists to prevent, so it goes above the contact
              details rather than below the fold. */}
          {!e.wedding_id && (loading ? (
            <p className="text-sage-400 text-sm">Checking their date…</p>
          ) : brief?.date_verdict && (
            <div className={`rounded-xl p-4 ${
              brief.date_taken_by
                ? 'bg-amber-50 border-2 border-amber-300'
                : 'bg-cream-50 border border-cream-300'
            }`}>
              <p className={brief.date_taken_by ? 'text-amber-900 font-medium' : 'text-sage-700'}>
                {brief.date_verdict}
                {brief.date_taken_by && ` — ${brief.date_taken_by.map(w => w.coupleNames).join(', ')}.`}
              </p>
              {brief.date_taken_by && (
                <>
                  <p className="text-amber-800 text-sm mt-1">
                    They wrote “{e.preferred_date}” on the booking form. Either that date has gone
                    and they need to hear it today, or this meeting is about that wedding and they
                    booked under a different name.
                  </p>
                  {brief.date_taken_by.length === 1 && (
                    <button
                      onClick={() => onLink?.(e, brief.date_taken_by[0].id)}
                      className="mt-2 text-sm px-3 py-1.5 rounded-lg bg-amber-700 text-white">
                      This meeting is about that wedding
                    </button>
                  )}
                </>
              )}

              {/* Free is not the same as uncontested. */}
              {brief.also_wanted_by?.length > 0 && (
                <p className="text-sage-700 text-sm mt-2">
                  Also being looked at by{' '}
                  {brief.also_wanted_by.map(o => o.name).join(', ')}
                  {brief.also_wanted_by.length === 1 ? ', who is touring too.' : ', who are touring too.'}
                </p>
              )}
            </div>
          ))}

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {e.email && <span className="text-sage-600">{e.email}</span>}
            {e.phone && <span className="text-sage-600">{e.phone}</span>}
            {e.partner_email && e.partner_email !== e.email && (
              <span className="text-sage-500">{e.partner_email}</span>
            )}
          </div>

          {facts.length > 0 && (
            <div className="bg-cream-50 rounded-xl p-3">
              <h4 className="text-sage-700 font-medium text-sm mb-2">What they told the booking form</h4>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-sage-500 shrink-0">{k}:</dt>
                    <dd className="text-sage-700">{v}</dd>
                  </div>
                ))}
              </dl>
              {extra.map((a, i) => (
                <p key={i} className="text-sm text-sage-600 mt-2">
                  <span className="text-sage-500">{a.question}</span> {a.answer}
                </p>
              ))}
            </div>
          )}

          <div>
            <h4 className="text-sage-700 font-medium text-sm mb-1">What we already have</h4>
            {loading ? (
              <p className="text-sage-400 text-sm">Looking…</p>
            ) : !brief ? (
              <p className="text-red-600 text-sm">Could not load their history.</p>
            ) : (
              <>
                <p className="text-sage-500 text-sm mb-2">{brief.summary}</p>
                {brief.emails.slice(0, 6).map((m, i) => (
                  <div key={i} className="text-sm border-l-2 border-cream-300 pl-3 py-1">
                    <span className="text-sage-500">{String(m.processed_at || '').slice(0, 10)}</span>{' '}
                    <span className="text-sage-700">{m.subject || '(no subject)'}</span>
                  </div>
                ))}
                {brief.texts.slice(0, 6).map((t, i) => (
                  <div key={i} className="text-sm border-l-2 border-sage-200 pl-3 py-1">
                    <span className="text-sage-500">{t.direction === 'outgoing' ? 'us' : 'them'}</span>{' '}
                    <span className="text-sage-700">{String(t.body_text || '').slice(0, 110)}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="border-t border-cream-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sage-700 font-medium text-sm">Notes from the meeting</h4>
              {!recording && (
                <button onClick={() => setRecording(true)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-sage-600 text-white">
                  Record / take notes
                </button>
              )}
            </div>
            {recording
              ? <WalkthroughNotes enquiryId={e.id} />
              : <p className="text-sage-400 text-sm">
                  Nothing recorded yet. Anything captured here comes across with them if they book.
                </p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConvertDialog({ enquiry, onDone, onClose }) {
  const { error: toastError, success: toastSuccess } = useToast()
  const [date, setDate] = useState(enquiry.preferred_date || '')
  const [names, setNames] = useState(
    [enquiry.name, enquiry.partner_name].filter(Boolean).join(' & '))
  const [busy, setBusy] = useState(false)

  const go = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toastError('The wedding date needs to be a real date, as YYYY-MM-DD.')
      return
    }
    setBusy(true)
    try {
      const r = await apiFetch(`${API_URL}/api/admin/enquiries/${enquiry.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({ weddingDate: date, coupleNames: names }),
      })
      toastSuccess(`Created ${names}. Their join code is ${r.eventCode}.`)
      onDone()
    } catch (err) {
      toastError(`Could not create the wedding: ${err.message}`)
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5">
        <h3 className="font-serif text-lg text-sage-700">They booked</h3>
        <p className="text-sage-500 text-sm mt-1 mb-4">
          Creates the wedding and brings the enquiry across, including anything recorded at the tour.
        </p>
        <label className="block text-sm text-sage-600 mb-1">Couple names</label>
        <input value={names} onChange={e => setNames(e.target.value)}
          className="w-full border border-cream-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-sm text-sage-600 mb-1">Wedding date</label>
        <input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm" />
        {enquiry.preferred_date && !/^\d{4}-\d{2}-\d{2}$/.test(enquiry.preferred_date) && (
          <p className="text-sage-500 text-xs mt-1">
            They wrote “{enquiry.preferred_date}” on the form, which needs turning into a real date.
          </p>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={go} disabled={busy}
            className="flex-1 px-4 py-2 rounded-lg bg-sage-600 text-white text-sm disabled:opacity-50">
            {busy ? 'Creating…' : 'Create the wedding'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-cream-300 text-sage-600 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ToursPanel({ onCountChange }) {
  const { error: toastError, success: toastSuccess } = useToast()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [briefing, setBriefing] = useState(null)
  const [converting, setConverting] = useState(null)

  const load = async () => {
    try {
      const d = await apiFetch(`${API_URL}/api/admin/enquiries`)
      const rows = d.enquiries || []
      setList(rows)
      onCountChange?.(rows.filter(e => !e.wedding_id && e.status !== 'lost').length)
    } catch (err) {
      toastError(`Could not load the diary: ${err.message}`)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const sync = async () => {
    setSyncing(true)
    try {
      const r = await apiFetch(`${API_URL}/api/admin/enquiries/sync`, { method: 'POST' })
      toastSuccess(r.message)
      await load()
    } catch (err) {
      toastError(`Could not read Calendly: ${err.message}`)
    }
    setSyncing(false)
  }

  const link = async (e, weddingId) => {
    try {
      const r = await apiFetch(`${API_URL}/api/admin/enquiries/${e.id}/link`, {
        method: 'POST', body: JSON.stringify({ weddingId }),
      })
      toastSuccess(`Linked to ${r.coupleNames}.`)
      await load()
    } catch (err) {
      toastError(`Could not link that: ${err.message}`)
    }
  }

  const dismissSuggestion = async (e) => {
    try {
      await apiFetch(`${API_URL}/api/admin/enquiries/${e.id}/dismiss-suggestion`, { method: 'POST' })
      setList(prev => prev.map(x => x.id === e.id ? { ...x, suggestion_dismissed: true } : x))
    } catch (err) {
      toastError(`Could not dismiss that: ${err.message}`)
    }
  }

  const setStatus = async (e, status) => {
    try {
      await apiFetch(`${API_URL}/api/admin/enquiries/${e.id}`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      })
      setList(prev => prev.map(x => x.id === e.id ? { ...x, status } : x))
    } catch (err) {
      toastError(`Could not update that: ${err.message}`)
    }
  }

  const newPeople = list.filter(e => !e.wedding_id && e.status !== 'lost')
  const knownCouples = list.filter(e => e.wedding_id)
  const lost = list.filter(e => !e.wedding_id && e.status === 'lost')

  const Row = ({ e }) => (
    <div className="bg-white rounded-xl border border-cream-200 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sage-700">
              {e.name}{e.partner_name ? ` & ${e.partner_name}` : ''}
            </span>
            {isTour(e.meeting_kind) && !e.wedding_id && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Tour</span>
            )}
            {e.wedding?.couple_names && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-sage-100 text-sage-700">
                {e.wedding.couple_names}
              </span>
            )}
          </div>
          <p className="text-sage-500 text-sm mt-0.5">
            {whenLabel(e.meeting_at)} · {e.meeting_kind}
          </p>
          {(e.preferred_date || e.guest_estimate || e.package_interest) && (
            <p className="text-sage-500 text-sm mt-0.5">
              {[e.preferred_date && `wants ${e.preferred_date}`,
                e.guest_estimate && `${e.guest_estimate} guests`,
                e.package_interest].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* The date they asked for is already somebody's. Said plainly rather
              than interpreted: it is either a clash you need to raise in the
              room, or it is their own wedding and they booked as a guest. You
              can tell which at a glance and no rule can. */}
          {e.date_taken_by && !e.wedding_id && (
            <div className="mt-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="text-amber-900">
                {e.stated_date} is already {e.date_taken_by.map(w => w.coupleNames).join(', ')}.
              </span>
              <span className="text-amber-800">
                {' '}Either that date is gone, or this is their own wedding booked by someone else.
              </span>
              {e.date_taken_by.length === 1 && (
                <button onClick={() => link(e, e.date_taken_by[0].id)}
                  className="ml-2 underline text-amber-900">
                  It’s them
                </button>
              )}
            </div>
          )}

          {/* A near-miss on email or an exact name match. Suggested, never
              applied: a wrong guess files a stranger's meeting onto a real
              couple's record. */}
          {e.suggested_wedding_id && !e.wedding_id && !e.suggestion_dismissed && (
            <div className="mt-2 text-sm bg-cream-100 border border-cream-300 rounded-lg px-3 py-2">
              <span className="text-sage-700">This might be a couple you already have.</span>
              {e.suggestion_reason && <span className="text-sage-500"> {e.suggestion_reason}.</span>}
              <button onClick={() => link(e, e.suggested_wedding_id)}
                className="ml-2 underline text-sage-700">Yes, link them</button>
              <button onClick={() => dismissSuggestion(e)}
                className="ml-2 underline text-sage-500">No</button>
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setBriefing(e)}
            className="text-sm px-3 py-1.5 rounded-lg bg-sage-600 text-white">
            Open
          </button>
          {!e.wedding_id && (
            <>
              <button onClick={() => setConverting(e)}
                className="text-sm px-3 py-1.5 rounded-lg border border-sage-300 text-sage-700">
                They booked
              </button>
              <button onClick={() => setStatus(e, e.status === 'lost' ? 'upcoming' : 'lost')}
                className="text-sm px-3 py-1.5 rounded-lg border border-cream-300 text-sage-500">
                {e.status === 'lost' ? 'Undo' : 'Not proceeding'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Tours &amp; meetings</h2>
          <p className="text-sage-500 text-sm mt-0.5">
            Who is coming, what they have already told us, and somewhere to write down what was said.
          </p>
        </div>
        <button onClick={sync} disabled={syncing}
          className="shrink-0 text-sm px-4 py-2 rounded-lg bg-sage-600 text-white disabled:opacity-50">
          {syncing ? 'Reading Calendly…' : 'Refresh from Calendly'}
        </button>
      </div>

      {loading ? (
        <p className="text-sage-500 text-sm">Loading…</p>
      ) : !list.length ? (
        <div className="bg-cream-50 border border-cream-200 rounded-xl p-4">
          <p className="text-sage-600 text-sm">
            Nothing here yet. Press “Refresh from Calendly” to bring the diary in.
          </p>
        </div>
      ) : (
        <>
          {newPeople.length > 0 && (
            <section>
              <h3 className="text-sage-600 text-sm font-medium mb-2">
                Not booked yet · {newPeople.length}
              </h3>
              <div className="space-y-2">{newPeople.map(e => <Row key={e.id} e={e} />)}</div>
            </section>
          )}
          {knownCouples.length > 0 && (
            <section>
              <h3 className="text-sage-600 text-sm font-medium mb-2">
                Couples you already have · {knownCouples.length}
              </h3>
              <div className="space-y-2">{knownCouples.map(e => <Row key={e.id} e={e} />)}</div>
            </section>
          )}
          {lost.length > 0 && (
            <section>
              <h3 className="text-sage-400 text-sm font-medium mb-2">Not proceeding · {lost.length}</h3>
              <div className="space-y-2 opacity-60">{lost.map(e => <Row key={e.id} e={e} />)}</div>
            </section>
          )}
        </>
      )}

      {briefing && (
        <Brief
          enquiry={briefing}
          onClose={() => setBriefing(null)}
          onLink={async (e, weddingId) => { await link(e, weddingId); setBriefing(null) }}
        />
      )}
      {converting && (
        <ConvertDialog
          enquiry={converting}
          onClose={() => setConverting(null)}
          onDone={() => { setConverting(null); load() }}
        />
      )}
    </div>
  )
}
