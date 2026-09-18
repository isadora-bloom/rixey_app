import { getLastActivity } from './adminUtils'
import { formatDateOnly } from '../../utils/dates'
import { weddingName } from '../../../shared/wedding-name.js'
import AskSageBar from '../../components/admin/AskSageBar'
import NeedsYou from '../../components/admin/NeedsYou'
import IntegrationsCard from '../../components/admin/IntegrationsCard'
import WeddingCard from '../../components/admin/WeddingCard'

/**
 * The admin home.
 *
 * Two columns. On the left, what happened and who it happened to: the last 24
 * hours, then the weddings. On the right, what is waiting on her: one "Needs
 * you" list, one Integrations card, Quick Links.
 *
 * What used to be here: four stat tiles repeating the tab badges, a red strip
 * of escalated couples, three more coloured summary cards, three integration
 * cards carrying nine buttons, a second Sage card, an amber unlinked-accounts
 * box inside the wedding list, and a sync history panel. "Sage Needs Help 38"
 * was on the screen four times and five colours competed for the same glance.
 * Nothing has been dropped: the counts are in NeedsYou, the buttons are in
 * IntegrationsCard, and the tab badges were already carrying the totals.
 *
 * On a phone the right-hand column comes up directly under the feed rather
 * than below every wedding card, which is the only place "Needs you" would be
 * of no use.
 */
export default function AdminWeddingList({
  weddings,
  unlinkedProfiles,
  setUnlinkedProfiles,
  displayedWeddings,
  allMessages,
  directConversations,
  escalations,
  couplePhotos,
  showArchived,
  setShowArchived,
  listSearch,
  setListSearch,
  sortBy,
  setSortBy,
  stats,
  editingWedding,
  setEditingWedding,
  honeybook,
  setHoneybook,
  googleSheets,
  setGoogleSheets,
  projectName,
  setProjectName,
  saving,
  saveLinks,
  startEditing,
  toggleArchive,
  markEscalationHandled,
  viewWeddingProfile,
  setEnlargedPhoto,
  // Last 24h
  last24h,
  last24hLoading,
  // Uncertain questions
  uncertainQuestions,
  setAnsweringQuestion,
  setShowUncertainModal,
  // Notifications
  notifications,
  markAsRead,
  // Things the matcher would not guess at. Filed on the Meetings tab, which
  // is where the queue itself lives and where its badge points.
  reviewItems,
  setMainView,
  // Sync history, shared by "Needs you" and the Integrations card
  syncJobs,
  syncJobsLoading,
  syncJobsError,
  reloadSyncJobs,
  historyOpen,
  setHistoryOpen,
  // Integrations
  gmailConnected,
  gmailCanSend = true,
  gmailSyncing,
  gmailStatus,
  gmailInfo,
  connectGmail,
  syncEmails,
  recoverEmailBodies,
  bodyBackfillPlanned,
  disconnectGmail,
  quoConnected,
  quoSyncing,
  quoStatus,
  quoInfo,
  syncQuo,
  sweepCallers,
  zoomConnected,
  zoomSyncing,
  zoomStatus,
  zoomInfo,
  connectZoom,
  syncZoom,
  reextractZoom,
  clearZoom,
  disconnectZoom,
}) {
  // An unknown type falls through to its own name with the underscores taken
  // out, which reads well enough, so this only needs the ones where that would
  // be clumsy. The details line carries the specifics.
  const ACTIVITY_LABELS = {
    timeline_updated:    'updated their timeline',
    tables_updated:      'updated their table layout',
    floor_plan_needed:   'saved table setup — floor plan needed',
    staffing_updated:    'updated their staffing plan',
    vendor_added:        'added a new vendor',
    vendor_updated:      'updated a vendor',
    contract_uploaded:   'uploaded a vendor contract',
    checklist_completed: 'completed a checklist item',
    inspo_uploaded:      'added inspiration photos',
    website_updated:     'changed their wedding website',
    wedding_party_shown: 'wedding party',
    wedding_party_hidden:'wedding party',
    wedding_details_updated: 'updated their wedding details',
    budget_updated:      'updated their budget',
    guest_care_updated:  'updated their guest care notes',
    table_layout_updated:'updated their reception layout',
    guest_list_emptied:  'emptied their guest list',
  }

  // Deduplicate activity: one line per wedding per activity_type
  const seen = new Set()
  const deduped = (last24h.activity || []).filter(a => {
    const key = `${a.wedding_id}-${a.activity_type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const hasAnything = last24h.signups.length > 0 || deduped.length > 0

  return (
    <div className="space-y-4 sm:space-y-6">

    {/* Ask Sage about any wedding, above everything, because it is the one
        thing here that does not need her to know where to look first. It loads
        nothing, so a slow answer holds up nothing below it. */}
    <AskSageBar weddings={weddings} onOpenProfile={viewWeddingProfile} />

    {/* Stacked on a phone, two columns from lg up. The right-hand column is
        pinned to column three across both left-hand rows, so the DOM order
        (feed, needs-you, weddings) is also the phone order. */}
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">

      {/* LEFT, row one: Last 24 hours */}
      {(hasAnything || last24hLoading) && (
        <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-cream-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sage-400 animate-pulse" />
              <h3 className="font-medium text-sage-700 text-sm">Last 24 hours</h3>
            </div>

            {last24hLoading ? (
              <div className="px-4 py-3 text-sm text-sage-400">Loading...</div>
            ) : !hasAnything ? null : (
              <div className="divide-y divide-cream-50">

                {/* New signups */}
                {last24h.signups.map(w => (
                  <div key={w.id}
                    onClick={() => { const wed = weddings.find(x => x.id === w.id); if (wed) viewWeddingProfile(wed) }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream-50 cursor-pointer transition">
                    <span className="text-base">🎉</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-sage-800">{w.couple_names}</span>
                      <span className="text-sm text-sage-500"> signed up</span>
                      {w.wedding_date && <span className="text-xs text-sage-400 ml-2">· {formatDateOnly(w.wedding_date, 'short')}</span>}
                    </div>
                    <span className="text-xs text-sage-300 flex-shrink-0">{new Date(w.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                ))}

                {/* Activity updates */}
                {deduped.map(a => {
                  const coupleName = weddingName(a.weddings || weddings.find(w => w.id === a.wedding_id))
                  const label = ACTIVITY_LABELS[a.activity_type] || a.activity_type.replace(/_/g, ' ')
                  const emoji = {
                    timeline_updated: '📅', tables_updated: '🪑', floor_plan_needed: '📐',
                    vendor_added: '🤝', vendor_updated: '🤝', contract_uploaded: '📄',
                    checklist_completed: '✅', inspo_uploaded: '📸', staffing_updated: '👥',
                  }[a.activity_type] || '✏️'
                  return (
                    <div key={a.id}
                      onClick={() => { const wed = weddings.find(w => w.id === a.wedding_id); if (wed) viewWeddingProfile(wed) }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream-50 cursor-pointer transition">
                      <span className="text-base">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-sage-800">{coupleName}</span>
                        <span className="text-sm text-sage-500"> {label}</span>
                        {a.details && <span className="text-xs text-sage-400 ml-1">· {a.details}</span>}
                      </div>
                      <span className="text-xs text-sage-300 flex-shrink-0">{new Date(a.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  )
                })}

              </div>
            )}
          </div>
        </div>
      )}

      {/* RIGHT: what is waiting on her */}
      <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2 space-y-4">
        <NeedsYou
          weddings={weddings}
          escalations={escalations}
          needsAttentionList={stats.needsAttentionList || []}
          viewWeddingProfile={viewWeddingProfile}
          uncertainQuestions={uncertainQuestions}
          setAnsweringQuestion={setAnsweringQuestion}
          setShowUncertainModal={setShowUncertainModal}
          reviewItems={reviewItems}
          setMainView={setMainView}
          unlinkedProfiles={unlinkedProfiles}
          setUnlinkedProfiles={setUnlinkedProfiles}
          syncJobs={syncJobs}
          onOpenSyncHistory={() => setHistoryOpen(true)}
          notifications={notifications}
          markAsRead={markAsRead}
        />

        <IntegrationsCard
          syncJobs={syncJobs}
          syncJobsLoading={syncJobsLoading}
          syncJobsError={syncJobsError}
          reloadSyncJobs={reloadSyncJobs}
          historyOpen={historyOpen}
          setHistoryOpen={setHistoryOpen}
          gmailConnected={gmailConnected}
          gmailCanSend={gmailCanSend}
          gmailSyncing={gmailSyncing}
          gmailStatus={gmailStatus}
          gmailInfo={gmailInfo}
          connectGmail={connectGmail}
          syncEmails={syncEmails}
          recoverEmailBodies={recoverEmailBodies}
          bodyBackfillPlanned={bodyBackfillPlanned}
          disconnectGmail={disconnectGmail}
          quoConnected={quoConnected}
          quoSyncing={quoSyncing}
          quoStatus={quoStatus}
          quoInfo={quoInfo}
          syncQuo={syncQuo}
          sweepCallers={sweepCallers}
          zoomConnected={zoomConnected}
          zoomSyncing={zoomSyncing}
          zoomStatus={zoomStatus}
          zoomInfo={zoomInfo}
          connectZoom={connectZoom}
          syncZoom={syncZoom}
          reextractZoom={reextractZoom}
          clearZoom={clearZoom}
          disconnectZoom={disconnectZoom}
        />

        {/* Quick Links */}
        <div className="bg-white rounded-xl border border-cream-200 p-4">
          <h3 className="font-medium text-sage-700 mb-3 text-sm">Quick Links</h3>
          <div className="space-y-2 text-sm">
            <a
              href="https://calendly.com/rixeymanor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sage-600 hover:text-sage-800"
            >
              Calendly
              <span className="ml-auto text-sage-300">↗</span>
            </a>
            <a
              href="https://www.honeybook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sage-600 hover:text-sage-800"
            >
              HoneyBook
              <span className="ml-auto text-sage-300">↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* LEFT, row two: the weddings */}
      <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2">
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-serif text-xl text-sage-700">
                {listSearch?.trim()
                  ? 'Search Results'
                  : showArchived ? 'Archived Weddings' : 'Active Weddings'}
              </h2>
              {/* Two of the four stat tiles counted things nothing else does:
                  who has been active this week, and who is getting married
                  inside a month. The tiles are gone; the numbers are not, they
                  are one grey line on the list they describe. */}
              {!listSearch?.trim() && !showArchived && (
                <p className="text-xs text-sage-400 mt-0.5">
                  {stats.active} active
                  <span className="mx-1.5 text-sage-300">·</span>
                  {stats.activeThisWeek} active this week
                  <span className="mx-1.5 text-sage-300">·</span>
                  {stats.upcoming} in the next 30 days
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {!showArchived && (
                <div className="flex items-center gap-1 bg-cream-50 rounded-lg p-1">
                  <button
                    onClick={() => setSortBy('lastActivity')}
                    className={`px-3 py-1 text-sm rounded-md transition ${
                      sortBy === 'lastActivity' ? 'bg-white text-sage-700 shadow-sm' : 'text-sage-500 hover:text-sage-700'
                    }`}
                  >
                    Last Active
                  </button>
                  <button
                    onClick={() => setSortBy('weddingDate')}
                    className={`px-3 py-1 text-sm rounded-md transition ${
                      sortBy === 'weddingDate' ? 'bg-white text-sage-700 shadow-sm' : 'text-sage-500 hover:text-sage-700'
                    }`}
                  >
                    Date
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="text-sage-500 hover:text-sage-700 text-sm"
              >
                {showArchived ? 'Show Active' : `Archived (${stats.archived})`}
              </button>
            </div>
          </div>

          {/* Search — spans all weddings (including past & archived) by couple name or vendor */}
          <div className="relative mb-4">
            <svg className="w-4 h-4 text-sage-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={listSearch || ''}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search by couple name or vendor…"
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-cream-300 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
            {listSearch?.trim() && (
              <button
                onClick={() => setListSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="space-y-3">
            {displayedWeddings.length === 0 ? (
              <p className="text-sage-400 text-sm py-8 text-center">
                {listSearch?.trim()
                  ? 'No weddings match your search'
                  : showArchived ? 'No archived weddings' : 'No active weddings'}
              </p>
            ) : (
              displayedWeddings.map(wedding => (
                <WeddingCard
                  key={wedding.id}
                  wedding={wedding}
                  escalation={escalations[wedding.id]}
                  lastActivity={getLastActivity(wedding, allMessages[wedding.id], directConversations?.[wedding.id])}
                  couplePhoto={couplePhotos[wedding.id]}
                  viewWeddingProfile={viewWeddingProfile}
                  setEnlargedPhoto={setEnlargedPhoto}
                  startEditing={startEditing}
                  toggleArchive={toggleArchive}
                  markEscalationHandled={markEscalationHandled}
                  editingWedding={editingWedding}
                  setEditingWedding={setEditingWedding}
                  honeybook={honeybook}
                  setHoneybook={setHoneybook}
                  googleSheets={googleSheets}
                  setGoogleSheets={setGoogleSheets}
                  projectName={projectName}
                  setProjectName={setProjectName}
                  saving={saving}
                  saveLinks={saveLinks}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>

    </div>
  )
}
