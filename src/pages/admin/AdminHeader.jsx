import { supabase } from '../../lib/supabase'
import NotificationBell from '../../components/NotificationBell'

/**
 * The top-level admin views, once.
 *
 * The phone dropdown and the desktop tabs were two hand-kept lists, and Manor
 * Downloads only ever existed in one of them. On a phone the tab was
 * unreachable, and because the select's value had no matching option whenever
 * that view was open, the dropdown also went blank and looked broken.
 */
function views({ stats, unreadMessages, unansweredCount, tourCount, crashCount }) {
  return [
    { id: 'weddings', label: 'Weddings', count: stats.active },
    { id: 'messages', label: 'Messages', count: unreadMessages, alert: unreadMessages > 0 },
    { id: 'sage-help', label: 'Sage Help', count: unansweredCount, alert: unansweredCount > 0 },
    { id: 'vendors', label: 'Vendors' },
    { id: 'meetings', label: 'Meetings' },
    // Tours sit next to Meetings on purpose: same diary, but these are the
    // people who have not booked, who had nowhere in the portal at all.
    { id: 'tours', label: 'Tours', count: tourCount, alert: false },
    { id: 'borrow-catalog', label: 'Borrow Catalog' },
    { id: 'picks', label: 'Picks' },
    { id: 'manor-downloads', label: 'Manor Downloads' },
    { id: 'knowledge-base', label: 'Knowledge Base' },
    { id: 'venue-settings', label: 'Venue Settings' },
    { id: 'usage', label: 'Usage' },
    // Badged red on purpose. The whole point is that a crash is noticed
    // without anybody going looking for it.
    { id: 'errors', label: 'Errors', count: crashCount, alert: crashCount > 0 },
  ]
}

export default function AdminHeader({
  navigate,
  mainView,
  setMainView,
  stats,
  unreadMessages,
  setUnreadMessages,
  unansweredCount,
  setShowUncertainModal,
  fetchUnreadMessages,
  setViewingWedding,
  setActiveTab,
  tourCount = 0,
  crashCount = 0,
}) {
  const VIEWS = views({ stats, unreadMessages, unansweredCount, tourCount, crashCount })

  return (
    <header
      className="bg-white border-b border-cream-200 sticky z-40"
      // Sticks below the recording bar when there is one. See RecordingBar.
      style={{ top: 'var(--recording-bar-h, 0px)' }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between py-3">
          <button onClick={() => { setViewingWedding(null); setActiveTab('overview'); }} className="inline-block">
            <img src="/icons/icon-192x192.png" alt="Rixey Manor" className="h-9 w-auto" />
          </button>
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <NotificationBell
              recipientType="admin"
              extraItems={[
                {
                  count: unreadMessages,
                  label: `${unreadMessages} unread message${unreadMessages !== 1 ? 's' : ''}`,
                  sublabel: 'Go to Messages tab \u2192',
                  dotColor: 'bg-red-500',
                  onClick: () => setMainView('messages'),
                },
                {
                  count: unansweredCount,
                  label: `${unansweredCount} Sage question${unansweredCount !== 1 ? 's' : ''} to review`,
                  sublabel: "Sage wasn't fully confident \u2192",
                  dotColor: 'bg-amber-400',
                  onClick: () => setShowUncertainModal(true),
                },
              ]}
            />
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/staff'); }}
              className="text-sage-500 hover:text-sage-700 text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
        {/* Navigation -- mobile select / desktop tabs */}
        <div className="pb-px">
          {/* Mobile select */}
          <div className="sm:hidden py-2">
            <select
              value={mainView}
              onChange={e => { setMainView(e.target.value); if (e.target.value === 'messages') setTimeout(fetchUnreadMessages, 2000) }}
              className="w-full px-3 py-2 border border-cream-200 rounded-lg bg-white text-sage-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sage-300"
            >
              {VIEWS.map(v => (
                <option key={v.id} value={v.id}>
                  {v.label}{v.count > 0 ? ` (${v.count})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* Desktop tabs */}
        <div className="hidden sm:flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
          {VIEWS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setMainView(tab.id); if (tab.id === 'messages') setTimeout(fetchUnreadMessages, 2000) }}
              className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition relative whitespace-nowrap ${
                mainView === tab.id
                  ? 'border-sage-600 text-sage-700'
                  : 'border-transparent text-sage-500 hover:text-sage-700 hover:border-sage-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                  tab.alert ? 'bg-red-500 text-white' : 'bg-sage-100 text-sage-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
