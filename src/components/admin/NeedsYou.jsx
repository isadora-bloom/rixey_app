import { useState } from 'react'
import { weddingName } from '../../../shared/wedding-name.js'
import { formatDateOnly } from '../../utils/dates'
import { apiFetch } from '../../utils/api'
import { API_URL } from '../../config/api'
import { useToast } from '../ui/Toast'

/**
 * Everything waiting on the venue owner, in one list.
 *
 * Before this, the same admin home carried a red strip of escalated couples, a
 * yellow "things I can't place" panel, three coloured summary cards, an amber
 * unlinked-accounts box inside the wedding list, and a second Sage card in the
 * sidebar. "Sage Needs Help 38" was on the screen four times. None of it was
 * wrong; all of it was shouting at once, and a screen that shouts evenly is a
 * screen with no priority in it.
 *
 * So: one list, groups in the order she would work through them, a count each,
 * one line per item, and a link that opens the place the thing is actually
 * done. Only the first group with anything in it is open, Sage questions
 * aside, which stay shut until asked for. A group with nothing in it is not
 * drawn at all, which is how "nothing needs you" ends up looking like nothing
 * rather than like five empty boxes.
 *
 * Amber is the only accent. Red appears on one kind of row only, a sync that
 * actually failed.
 */

function timeLabel(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Runs from the last day that failed or stopped partway.
 *
 * Module level on purpose: reading the clock inside a component body is a
 * render that cannot be repeated, which the purity lint rightly objects to.
 * Same shape as timeAgo in NotificationBell.
 */
function failedSyncsToday(jobs) {
  const cutoff = Date.now() - DAY_MS
  return (jobs || []).filter(j => {
    const when = j.finished_at || j.started_at
    if (!when) return false
    if (new Date(when).getTime() < cutoff) return false
    return j.status === 'failed' || j.stalled
  })
}

/** One tappable line. Grey text, no colour of its own. */
function Row({ onClick, title, children }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      title={title}
      className={`w-full text-left px-4 py-2 text-sm border-t border-cream-100 ${onClick ? 'hover:bg-cream-50 transition' : ''}`}
    >
      {children}
    </Tag>
  )
}

function Group({ group, open, onToggle }) {
  return (
    <div className="border-t border-cream-100 first:border-t-0">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-cream-50 transition"
      >
        <svg
          className={`w-3.5 h-3.5 text-sage-300 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-medium text-sage-700 flex-1">{group.label}</span>
        <span className="text-xs font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">{group.count}</span>
      </button>
      {open && <div className="pb-1">{group.render()}</div>}
    </div>
  )
}

export default function NeedsYou({
  // Clients needing attention
  weddings,
  escalations,
  needsAttentionList = [],
  viewWeddingProfile,
  // Sage questions
  uncertainQuestions = [],
  setAnsweringQuestion,
  setShowUncertainModal,
  // Could not be placed
  reviewItems = [],
  setMainView,
  // Accounts with no wedding
  unlinkedProfiles = [],
  setUnlinkedProfiles,
  // Failed syncs
  syncJobs = [],
  onOpenSyncHistory,
  // Notifications she has not read. Same rows as the header bell, kept here
  // because the blue Notifications panel this replaced had a tick on each one.
  notifications = [],
  markAsRead,
}) {
  const { error: toastError, success: toastSuccess } = useToast()
  // Which group she has opened by hand. Undefined means "not chosen yet", so
  // the first non-empty group is open, which is different from having closed
  // every group.
  const [openKey, setOpenKey] = useState(undefined)
  // Wedding chosen per unlinked account, and which one (if any) is mid-request.
  const [linkChoice, setLinkChoice] = useState({})
  const [linking, setLinking] = useState(null)

  // Sets profiles.wedding_id server-side. Was: nothing -- the banner used to
  // point at a wedding "Access tab" that has never existed, so there was no
  // way to link an orphaned login to its wedding at all.
  const linkProfileToWedding = async (profileId) => {
    const weddingId = linkChoice[profileId]
    if (!weddingId) return
    setLinking(profileId)
    try {
      await apiFetch(`${API_URL}/api/admin/profiles/${profileId}`, {
        method: 'PATCH',
        body: JSON.stringify({ wedding_id: weddingId }),
      })
      setUnlinkedProfiles?.(prev => prev.filter(p => p.id !== profileId))
      toastSuccess('Linked. They will see their wedding next time they load the portal.')
    } catch (err) {
      if (err.status === 404) {
        toastError('Not live yet — the linking endpoint has not been deployed here.')
      } else {
        toastError(`Could not link that account: ${err.message}`)
      }
    }
    setLinking(null)
  }

  const failedSyncs = failedSyncsToday(syncJobs)

  const unread = (notifications || []).filter(n => !n.read)

  const groups = [
    {
      key: 'attention',
      label: needsAttentionList.length === 1 ? 'Client needs attention' : 'Clients need attention',
      count: needsAttentionList.length,
      render: () => needsAttentionList.map(w => {
        const escalation = escalations?.[w.id]
        const first = escalation?.messages?.[0]
        return (
          <Row
            key={w.id}
            onClick={() => viewWeddingProfile(w, {
              focusUserId: first?.user_id,
              focusTab: first?.source === 'direct' ? 'inbox' : undefined,
            })}
            title={first?.content ? `Open the conversation: "${String(first.content).slice(0, 120)}"` : 'Open this profile'}
          >
            <span className="block font-medium text-sage-800">{weddingName(w)}</span>
            <span className="block text-xs text-sage-400">
              {w.wedding_date ? formatDateOnly(w.wedding_date) : 'No date set'}
              {escalation?.count ? ` · ${escalation.count} flagged message${escalation.count === 1 ? '' : 's'}` : ' · waiting on a reply'}
            </span>
          </Row>
        )
      }),
    },
    {
      key: 'sage',
      label: 'Sage questions to answer',
      count: uncertainQuestions.length,
      render: () => uncertainQuestions.map(q => (
        <Row
          key={q.id}
          onClick={() => { setAnsweringQuestion(q.id); setShowUncertainModal(true) }}
          title="Open this question and answer it"
        >
          <span className="block text-sage-700 line-clamp-1">{q.question}</span>
          <span className="block text-xs text-sage-400">{weddingName(weddings?.find(w => w.id === q.wedding_id))}</span>
        </Row>
      )),
    },
    {
      key: 'review',
      label: 'Could not be placed',
      count: reviewItems.length,
      render: () => (
        <>
          {reviewItems.slice(0, 8).map(item => (
            <Row
              key={item.id}
              onClick={() => setMainView?.('meetings')}
              title="File it on the Meetings tab"
            >
              <span className="block text-sage-700 line-clamp-1">
                {item.title || (item.source === 'gmail' ? 'No subject' : item.source === 'quo_call' ? 'Calls from an unknown number' : 'Untitled meeting')}
              </span>
              <span className="block text-xs text-sage-400">
                {item.source === 'gmail' ? 'Email' : item.source === 'quo_call' ? 'Call' : 'Meeting'}
                {item.reason ? ` · ${item.reason}` : ''}
              </span>
            </Row>
          ))}
          <Row onClick={() => setMainView?.('meetings')} title="Open the Meetings tab">
            <span className="text-sage-600">Say whose these are on the Meetings tab →</span>
          </Row>
        </>
      ),
    },
    {
      key: 'unlinked',
      label: unlinkedProfiles.length === 1 ? 'Account not linked to a wedding' : 'Accounts not linked to a wedding',
      count: unlinkedProfiles.length,
      render: () => (
        <>
          <p className="px-4 py-1 text-xs text-sage-400">
            They can sign in and see nothing until you link them to a wedding.
          </p>
          {unlinkedProfiles.map(p => (
            <Row key={p.id}>
              <span className="font-medium text-sage-800">{p.name || 'Unnamed'}</span>{' '}
              <span className="text-sage-400">&lt;{p.email}&gt;</span>
              <span className="block text-xs text-sage-400">
                {p.role || 'no role'} · since {String(p.created_at).slice(0, 10)}
              </span>
              <span className="flex flex-wrap items-center gap-2 mt-1.5">
                <select
                  value={linkChoice[p.id] || ''}
                  onChange={e => setLinkChoice(prev => ({ ...prev, [p.id]: e.target.value }))}
                  className="border border-cream-300 rounded-lg px-2 py-1 bg-white text-sage-700 text-xs"
                >
                  <option value="">Link to this wedding…</option>
                  {(weddings || []).filter(w => !w.archived).map(w => (
                    <option key={w.id} value={w.id}>{weddingName(w)}</option>
                  ))}
                </select>
                <button
                  onClick={() => linkProfileToWedding(p.id)}
                  disabled={!linkChoice[p.id] || linking === p.id}
                  className="px-2.5 py-1 rounded-lg bg-sage-600 text-white text-xs disabled:opacity-40"
                >
                  {linking === p.id ? 'Linking…' : 'Link'}
                </button>
              </span>
            </Row>
          ))}
        </>
      ),
    },
    {
      key: 'syncs',
      label: 'Syncs that failed today',
      count: failedSyncs.length,
      render: () => failedSyncs.map(j => (
        <Row key={j.id} onClick={onOpenSyncHistory} title="Open the sync history">
          <span className="font-medium text-sage-800 capitalize">{j.kind}</span>
          <span className="text-sage-500"> · {j.stalled ? 'stopped partway' : 'failed'} {timeLabel(j.finished_at || j.started_at)}</span>
          {j.last_error && <span className="block text-xs text-red-600 line-clamp-2">{j.last_error}</span>}
        </Row>
      )),
    },
    {
      key: 'notifications',
      label: 'Notifications',
      count: unread.length,
      render: () => unread.slice(0, 10).map(n => (
        <Row key={n.id}>
          <span className="flex items-start justify-between gap-2">
            <span className="text-sage-700 line-clamp-2">{n.message}</span>
            <button
              onClick={() => markAsRead?.(n.id)}
              className="text-sage-300 hover:text-sage-600 flex-shrink-0"
              title="Mark as read"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </span>
        </Row>
      )),
    },
  ].filter(g => g.count > 0)

  const total = groups.reduce((sum, g) => sum + g.count, 0)
  // Sage questions never open themselves. There are routinely dozens, and on a
  // phone an open Sage group is the whole screen before anything else is read.
  // It opens on a tap like any other group; the count on the header is enough
  // to say it is there.
  const defaultKey = groups.find(g => g.key !== 'sage')?.key ?? null
  const activeKey = openKey === undefined ? defaultKey : openKey

  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-cream-100">
        <h3 className="font-medium text-sage-700 text-sm flex-1">Needs you</h3>
        {total > 0 && (
          <span className="text-xs font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">{total}</span>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-sage-400 text-center">Nothing needs you right now.</p>
      ) : (
        groups.map(g => (
          <Group
            key={g.key}
            group={g}
            open={activeKey === g.key}
            onToggle={() => setOpenKey(activeKey === g.key ? null : g.key)}
          />
        ))
      )}
    </div>
  )
}
