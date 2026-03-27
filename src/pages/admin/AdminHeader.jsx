import { supabase } from '../../lib/supabase'
import NotificationBell from '../../components/NotificationBell'

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
}) {
  return (
    <header className="bg-white border-b border-cream-200 sticky top-0 z-40">
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
              <option value="weddings">Weddings {stats.active > 0 ? `(${stats.active})` : ''}</option>
              <option value="messages">Messages {unreadMessages > 0 ? `(${unreadMessages} unread)` : ''}</option>
              <option value="vendors">Vendors</option>
              <option value="meetings">Meetings</option>
              <option value="borrow-catalog">Borrow Catalog</option>
              <option value="picks">Picks</option>
              <option value="knowledge-base">Knowledge Base</option>
              <option value="venue-settings">Venue Settings</option>
              <option value="usage">Usage</option>
            </select>
          </div>
        </div>
        {/* Desktop tabs */}
        <div className="hidden sm:flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
          {[
            { id: 'weddings', label: 'Weddings', count: stats.active },
            { id: 'messages', label: 'Messages', count: unreadMessages, alert: unreadMessages > 0 },
            { id: 'vendors', label: 'Vendors' },
            { id: 'meetings', label: 'Meetings' },
            { id: 'borrow-catalog', label: 'Borrow Catalog' },
            { id: 'picks', label: 'Picks' },
            { id: 'manor-downloads', label: 'Manor Downloads' },
            { id: 'knowledge-base', label: 'Knowledge Base' },
            { id: 'venue-settings', label: 'Venue Settings' },
            { id: 'usage', label: 'Usage' },
          ].map(tab => (
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
