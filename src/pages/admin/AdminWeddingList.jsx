import { getLastActivity } from './adminUtils'

export default function AdminWeddingList({
  weddings,
  displayedWeddings,
  allMessages,
  escalations,
  couplePhotos,
  showArchived,
  setShowArchived,
  sortBy,
  setSortBy,
  stats,
  editingWedding,
  setEditingWedding,
  honeybook,
  setHoneybook,
  googleSheets,
  setGoogleSheets,
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
  unreadCount,
  markAsRead,
  // Sidebar integration props
  gmailConnected,
  gmailSyncing,
  gmailStatus,
  connectGmail,
  syncEmails,
  disconnectGmail,
  quoConnected,
  quoSyncing,
  quoStatus,
  syncQuo,
  zoomConnected,
  zoomSyncing,
  zoomStatus,
  connectZoom,
  syncZoom,
  reextractZoom,
  clearZoom,
  disconnectZoom,
}) {
  const ACTIVITY_LABELS = {
    timeline_updated:    'updated their timeline',
    tables_updated:      'updated their table layout',
    floor_plan_needed:   'saved table setup \u2014 floor plan needed',
    staffing_updated:    'updated their staffing plan',
    vendor_added:        'added a new vendor',
    vendor_updated:      'updated a vendor',
    contract_uploaded:   'uploaded a vendor contract',
    checklist_completed: 'completed a checklist item',
    inspo_uploaded:      'added inspiration photos',
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
    <>
      {/* Last 24 Hours */}
      {(hasAnything || last24hLoading) && (
        <div className="mb-6 bg-white rounded-2xl border border-cream-200 overflow-hidden">
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
                    {w.wedding_date && <span className="text-xs text-sage-400 ml-2">· {new Date(w.wedding_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                  </div>
                  <span className="text-xs text-sage-300 flex-shrink-0">{new Date(w.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              ))}

              {/* Activity updates */}
              {deduped.map(a => {
                const coupleName = a.weddings?.couple_names || weddings.find(w => w.id === a.wedding_id)?.couple_names || 'Unknown'
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
      )}

      {/* Needs Attention Section */}
      {(uncertainQuestions.length > 0 || stats.needsAttention > 0 || unreadCount > 0) && (
        <div className="mb-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Uncertain Questions */}
          {uncertainQuestions.length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <h3 className="font-medium text-amber-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sage Needs Help ({uncertainQuestions.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {uncertainQuestions.slice(0, 3).map(q => {
                  const wedding = weddings.find(w => w.id === q.wedding_id)
                  return (
                    <div
                      key={q.id}
                      onClick={() => { setAnsweringQuestion(q.id); setShowUncertainModal(true) }}
                      className="bg-white rounded-lg p-2 text-sm cursor-pointer hover:bg-amber-100 transition"
                    >
                      <p className="text-sage-700 line-clamp-1">{q.question}</p>
                      <p className="text-sage-400 text-xs">{wedding?.couple_names}</p>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={() => setShowUncertainModal(true)}
                className="text-amber-700 text-sm mt-2 hover:underline"
              >
                {uncertainQuestions.length > 3 ? `+${uncertainQuestions.length - 3} more` : 'View all'} →
              </button>
            </div>
          )}

          {/* Notifications */}
          {unreadCount > 0 && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <h3 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Notifications ({unreadCount})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {notifications.filter(n => !n.read).slice(0, 3).map(notif => (
                  <div key={notif.id} className="bg-white rounded-lg p-2 text-sm flex items-start justify-between gap-2">
                    <p className="text-sage-700 line-clamp-2">{notif.message}</p>
                    <button onClick={() => markAsRead(notif.id)} className="text-sage-400 hover:text-sage-600 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Escalations Summary */}
          {stats.needsAttention > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <h3 className="font-medium text-red-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Clients Need Attention ({stats.needsAttention})
              </h3>
              <p className="text-red-700 text-sm">
                {stats.needsAttention} client(s) may be stressed. Check their profiles for details.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Weddings List + Sidebar */}
      <div className="grid lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Weddings List - Takes 3/4 */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="font-serif text-xl text-sage-700">
                {showArchived ? 'Archived Weddings' : 'Active Weddings'}
              </h2>
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

            <div className="space-y-3">
              {displayedWeddings.length === 0 ? (
                <p className="text-sage-400 text-sm py-8 text-center">
                  {showArchived ? 'No archived weddings' : 'No active weddings'}
                </p>
              ) : (
                displayedWeddings.map(wedding => {
                  const escalation = escalations[wedding.id]
                  const lastActivity = getLastActivity(allMessages[wedding.id])
                  const couplePhoto = couplePhotos[wedding.id]

                  return (
                    <div
                      key={wedding.id}
                      className={`border rounded-xl p-3 sm:p-4 hover:shadow-md transition ${
                        escalation?.hasEscalation ? 'border-red-200 bg-red-50/30' : 'border-cream-200 hover:border-sage-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                        {/* Top row on mobile: Photo + Actions */}
                        <div className="flex items-center justify-between sm:contents">
                          {/* Photo */}
                          {couplePhoto ? (
                            <img
                              src={couplePhoto}
                              alt={wedding.couple_names}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-sage-200 flex-shrink-0 cursor-pointer hover:opacity-80 transition"
                              onClick={(e) => { e.stopPropagation(); setEnlargedPhoto(couplePhoto); }}
                              title="Click to enlarge"
                            />
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-cream-100 flex items-center justify-center border-2 border-cream-200 flex-shrink-0">
                              <span className="text-sage-400 text-lg sm:text-xl">{wedding.couple_names?.charAt(0) || '?'}</span>
                            </div>
                          )}
                          {/* Mobile-only view button */}
                          <button onClick={() => viewWeddingProfile(wedding)} className="sm:hidden px-3 py-1.5 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700">
                            View
                          </button>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sage-800 text-sm sm:text-base">{wedding.couple_names || 'Unnamed'}</h3>
                            {lastActivity ? (
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                lastActivity.status === 'recent' ? 'bg-green-100 text-green-700' :
                                lastActivity.status === 'active' ? 'bg-sage-100 text-sage-700' :
                                lastActivity.status === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {lastActivity.display}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">No activity</span>
                            )}
                            {escalation?.hasEscalation && (
                              <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                                Needs attention
                                <button onClick={(e) => { e.stopPropagation(); markEscalationHandled(wedding.id) }} className="ml-1 text-green-600 hover:text-green-800" title="Mark handled">✓</button>
                              </span>
                            )}
                          </div>
                          <p className="text-sage-500 text-xs sm:text-sm">
                            {wedding.wedding_date ? new Date(wedding.wedding_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date set'}
                            <span className="mx-1 sm:mx-2 text-sage-300">·</span>
                            <span className="font-mono text-xs">{wedding.event_code}</span>
                          </p>
                          {wedding.profiles?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5 sm:mt-2">
                              {wedding.profiles.slice(0, 2).map(p => (
                                <span key={p.id} className="bg-cream-100 text-sage-600 text-xs px-2 py-0.5 rounded truncate max-w-[100px]">
                                  {p.name}
                                </span>
                              ))}
                              {wedding.profiles.length > 2 && (
                                <span className="text-sage-400 text-xs">+{wedding.profiles.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions - Hidden on mobile, visible on sm+ */}
                        <div className="hidden sm:flex flex-col gap-2 flex-shrink-0">
                          <button onClick={() => viewWeddingProfile(wedding)} className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700">
                            View Profile
                          </button>
                          <button onClick={() => startEditing(wedding)} className="text-sage-500 hover:text-sage-700 text-xs">
                            Edit Links
                          </button>
                        </div>
                      </div>

                      {/* Edit Form */}
                      {editingWedding === wedding.id && (
                        <div className="bg-cream-50 rounded-lg p-4 mt-4 space-y-3">
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-sage-600 mb-1">HoneyBook Link</label>
                              <input type="url" value={honeybook} onChange={(e) => setHoneybook(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-cream-300 text-sm" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-sage-600 mb-1">Google Sheets Link</label>
                              <input type="url" value={googleSheets} onChange={(e) => setGoogleSheets(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-cream-300 text-sm" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveLinks} disabled={saving} className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50">
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={() => setEditingWedding(null)} className="px-4 py-2 text-sage-600 text-sm hover:text-sage-800">Cancel</button>
                            <button onClick={() => toggleArchive(wedding.id, wedding.archived)} className="ml-auto text-xs px-3 py-1 rounded bg-cream-100 text-sage-500 hover:bg-cream-200">
                              {wedding.archived ? 'Unarchive' : 'Archive'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Link Status (when not editing) */}
                      {editingWedding !== wedding.id && (
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-cream-100 text-xs">
                          {wedding.honeybook_link ? (
                            <span className="text-green-600">✓ HoneyBook</span>
                          ) : (
                            <span className="text-amber-600">⚠ No HoneyBook</span>
                          )}
                          {wedding.google_sheets_link ? (
                            <span className="text-green-600">✓ Sheets</span>
                          ) : (
                            <span className="text-amber-600">⚠ No Sheets</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Integrations & Tools */}
        <div className="lg:col-span-1 space-y-4">
          {/* Email Sync */}
          <div className="bg-white rounded-xl border border-cream-200 p-4">
            <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Sync
            </h3>
            {gmailConnected ? (
              <div className="space-y-2">
                <p className="text-green-600 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Connected
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={syncEmails}
                    disabled={gmailSyncing}
                    className="flex-1 px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
                  >
                    {gmailSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button
                    onClick={disconnectGmail}
                    className="px-4 py-2 text-sage-500 hover:text-sage-700 text-sm"
                  >
                    Disconnect
                  </button>
                </div>
                {gmailStatus && (
                  <p className="text-sage-600 text-sm bg-cream-50 p-2 rounded">{gmailStatus}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sage-500 text-sm">
                  Connect your Gmail to search past and incoming emails from registered clients. Planning notes are automatically extracted.
                </p>
                <button
                  onClick={connectGmail}
                  className="w-full px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Connect Gmail
                </button>
              </div>
            )}
          </div>

          {/* SMS/Phone Sync */}
          <div className="bg-white rounded-xl border border-cream-200 p-4">
            <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Phone & SMS
            </h3>
            {quoConnected ? (
              <div className="space-y-2">
                <p className="text-green-600 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Connected
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => syncQuo(false)}
                    disabled={quoSyncing}
                    className="flex-1 px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
                  >
                    {quoSyncing ? 'Syncing...' : 'Sync New'}
                  </button>
                  <button
                    onClick={() => syncQuo(true)}
                    disabled={quoSyncing}
                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50"
                    title="Clears processed message cache and re-syncs all messages with planning note extraction"
                  >
                    {quoSyncing ? 'Syncing...' : 'Force Resync'}
                  </button>
                </div>
                {quoStatus && (
                  <pre className="text-sage-600 text-xs bg-cream-50 p-2 rounded whitespace-pre-wrap font-sans">{quoStatus}</pre>
                )}
              </div>
            ) : (
              <p className="text-sage-500 text-sm">
                Add QUO_API_KEY to .env to enable SMS sync
              </p>
            )}
          </div>

          {/* Zoom Integration */}
          <div className="bg-white rounded-xl border border-cream-200 p-4">
            <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Zoom Meetings
            </h3>
            {zoomConnected ? (
              <div className="space-y-2">
                <p className="text-green-600 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Connected
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={syncZoom}
                    disabled={zoomSyncing}
                    className="flex-1 px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
                  >
                    {zoomSyncing ? 'Working...' : 'Sync'}
                  </button>
                  <button
                    onClick={reextractZoom}
                    disabled={zoomSyncing}
                    className="flex-1 px-4 py-2 bg-cream-100 text-sage-700 rounded-lg text-sm hover:bg-cream-200 disabled:opacity-50"
                    title="Re-run AI extraction on already-synced transcripts"
                  >
                    Re-extract
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={connectZoom}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                    title="Re-authorize Zoom (use if sync is failing)"
                  >
                    Re-auth
                  </button>
                  <span className="text-cream-300 text-xs">·</span>
                  <button
                    onClick={clearZoom}
                    disabled={zoomSyncing}
                    className="text-amber-600 hover:text-amber-800 text-xs disabled:opacity-50"
                    title="Clear stored transcripts so next Sync re-downloads everything fresh"
                  >
                    Force Resync
                  </button>
                  <span className="text-cream-300 text-xs">·</span>
                  <button
                    onClick={disconnectZoom}
                    className="text-sage-400 hover:text-sage-600 text-xs"
                  >
                    Disconnect
                  </button>
                </div>
                {zoomStatus && (
                  <p className={`text-sm p-2 rounded ${zoomStatus.includes('fail') || zoomStatus.includes('error') || zoomStatus.includes('Error') ? 'text-red-700 bg-red-50' : 'text-sage-600 bg-cream-50'}`}>{zoomStatus}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sage-500 text-sm">
                  Sync meeting transcripts for planning notes
                </p>
                <button
                  onClick={connectZoom}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.5 4.5h15a2 2 0 012 2v11a2 2 0 01-2 2h-15a2 2 0 01-2-2v-11a2 2 0 012-2zm13.5 7.5l4-3v6l-4-3z"/>
                  </svg>
                  Connect Zoom
                </button>
                {zoomStatus && (
                  <p className="text-sage-600 text-sm bg-cream-50 p-2 rounded">{zoomStatus}</p>
                )}
              </div>
            )}
          </div>

          {/* Sage Needs Help */}
          <div
            onClick={() => setShowUncertainModal(true)}
            className={`rounded-xl border p-4 cursor-pointer transition ${
              uncertainQuestions.length > 0
                ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                : 'bg-white border-cream-200 hover:border-sage-300'
            }`}
          >
            <h3 className="font-medium text-sage-700 mb-1 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sage Needs Help
              {uncertainQuestions.length > 0 && (
                <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full ml-auto">
                  {uncertainQuestions.length}
                </span>
              )}
            </h3>
            <p className="text-sage-500 text-xs">
              {uncertainQuestions.length > 0
                ? `${uncertainQuestions.length} question${uncertainQuestions.length > 1 ? 's' : ''} to review`
                : 'No questions right now'
              }
            </p>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl border border-cream-200 p-4">
            <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Quick Links
            </h3>
            <div className="space-y-2 text-sm">
              <a
                href="https://calendly.com/rixeymanor"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sage-600 hover:text-sage-800"
              >
                <span>📅</span> Calendly
                <span className="ml-auto text-sage-400">↗</span>
              </a>
              <a
                href="https://www.honeybook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sage-600 hover:text-sage-800"
              >
                <span>📒</span> HoneyBook
                <span className="ml-auto text-sage-400">↗</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
