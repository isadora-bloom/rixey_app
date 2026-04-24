import VendorChecklist from '../../components/VendorChecklist'
import InspoGallery from '../../components/InspoGallery'
import PlanningChecklist from '../../components/PlanningChecklist'
import CouplePhoto from '../../components/CouplePhoto'
import WebsiteBuilder from '../../components/WebsiteBuilder'
import PhotoBucket from '../../components/PhotoBucket'
import WeddingParty from '../../components/WeddingParty'
import BarPlanner from '../../components/BarPlanner'
// CommunicationPulse removed from overview — import kept for reference only
import UpcomingMeetings from '../../components/UpcomingMeetings'
import TimelineBuilder from '../../components/TimelineBuilder'
import TableLayoutPlanner from '../../components/TableLayoutPlanner'
import BorrowCatalog from '../../components/BorrowCatalog'
import GuestCareNotes from '../../components/GuestCareNotes'
import WeddingDetails from '../../components/WeddingDetails'
import AllergyRegistry from '../../components/AllergyRegistry'
import BedroomAssignments from '../../components/BedroomAssignments'
import DayOfMemories from '../../components/DayOfMemories'
import CeremonyOrder from '../../components/CeremonyOrder'
import CeremonyChairPlan from '../../components/CeremonyChairPlan'
import DecorInventory from '../../components/DecorInventory'
import MakeupSchedule from '../../components/MakeupSchedule'
import ShuttleSchedule from '../../components/ShuttleSchedule'
import RehearsalDinner from '../../components/RehearsalDinner'
import StaffingCalculator from '../../components/StaffingCalculator'
import BudgetTracker from '../../components/BudgetTracker'
import GuestList from '../../components/GuestList'
import TableCanvas from '../../components/TableCanvas'
import UsageStats from '../../components/UsageStats'
import DirectMessagesPanel from './DirectMessagesPanel'
import ContractPanel from './ContractPanel'
import WeddingCompleteness from './WeddingCompleteness'
import { ESCALATION_KEYWORDS, getLastActivity, getCategoryIcon, getCategoryLabel } from './adminUtils'

export default function AdminWeddingProfile({
  viewingWedding,
  closeProfile,
  // Messages / chat
  weddingMessages,
  setWeddingMessages,
  loadingMessages,
  selectedChatUser,
  setSelectedChatUser,
  searchQuery,
  setSearchQuery,
  // Escalation
  escalations,
  markEscalationHandled,
  // Pulse
  weddingPulse,
  // Photo
  couplePhotos,
  setEnlargedPhoto,
  setCouplePhotos,
  // Planning notes
  planningNotes,
  setPlanningNotes,
  updateNoteStatus,
  notesSearchQuery,
  setNotesSearchQuery,
  notesHighlights,
  setNotesHighlights,
  loadingHighlights,
  getNotesHighlights,
  collapsedNoteCategories,
  setCollapsedNoteCategories,
  // Tabs
  activeTab,
  setActiveTab,
  // Data summaries
  timelineSummary,
  tableSummary,
  staffingSummary,
  sharedBudget,
  borrowSelections,
  borrowCatalogRefreshKey,
  // Internal notes
  internalNotes,
  newNoteText,
  setNewNoteText,
  savingNote,
  addInternalNote,
  deleteInternalNote,
  // Contract
  uploadingContract,
  uploadResult,
  handleContractUpload,
  contractQuestion,
  setContractQuestion,
  contractAnswer,
  askContractQuestion,
  askingQuestion,
  // Uncertain questions
  uncertainQuestions,
  answeringQuestion,
  setAnsweringQuestion,
  adminAnswer,
  setAdminAnswer,
  addToKb,
  setAddToKb,
  kbCategory,
  setKbCategory,
  kbSubcategory,
  setKbSubcategory,
  submittingAnswer,
  submitAnswer,
  deleteUncertainQuestion,
  // Inject
  injectText,
  setInjectText,
  injectKb,
  setInjectKb,
  injectKbCat,
  setInjectKbCat,
  injecting,
  injectNote,
  // Check-in
  checkingIn,
  checkedIn,
  sendCheckin,
  // Activities
  activities,
  loadingActivities,
  // Borrow
  setMainView,
  // Guest care (not used as prop, component is self-contained)
}) {
  const msgStats = getMessageStats()
  const profileMap = {}
  viewingWedding.profiles?.forEach(p => { profileMap[p.id] = p })
  const escalation = escalations[viewingWedding.id]

  // Filter messages by search query
  const filteredMessages = searchQuery.trim()
    ? weddingMessages.filter(m =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : weddingMessages

  // Get only user messages (questions)
  const userQuestions = filteredMessages.filter(m => m.sender === 'user')

  function getMessageStats() {
    const total = weddingMessages.length
    const userMsgs = weddingMessages.filter(m => m.sender === 'user').length
    const sageMsgs = weddingMessages.filter(m => m.sender === 'sage').length
    const uniqueDays = new Set(
      weddingMessages.map(m => new Date(m.created_at).toDateString())
    ).size
    return { total, userMsgs, sageMsgs, uniqueDays }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-cream-50">
      <header className="bg-white border-b border-cream-200 sticky top-0 z-40">
        {/* Breadcrumb */}
        <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-2 pb-0">
          <nav className="flex items-center gap-1.5 text-xs text-sage-400">
            <button onClick={closeProfile} className="hover:text-sage-600 transition">Admin</button>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sage-600 font-medium truncate">{viewingWedding.couple_names || 'Wedding'}</span>
          </nav>
        </div>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Couple Photo in Header */}
            {couplePhotos[viewingWedding.id] ? (
              <img
                src={couplePhotos[viewingWedding.id]}
                alt={viewingWedding.couple_names}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-sage-300 shadow-sm cursor-pointer hover:opacity-80 transition flex-shrink-0"
                onClick={() => setEnlargedPhoto(couplePhotos[viewingWedding.id])}
                title="Click to enlarge"
              />
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-cream-100 flex items-center justify-center border-2 border-cream-200 flex-shrink-0">
                <span className="text-sage-400 text-lg sm:text-xl">
                  {viewingWedding.couple_names?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-lg sm:text-2xl text-sage-700 leading-tight">
                {viewingWedding.couple_names || 'Wedding'} Profile
              </h1>
              {/* Last Activity in header */}
              {(() => {
                const lastActivity = getLastActivity(weddingMessages)
                if (!lastActivity) {
                  return (
                    <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                      No activity
                    </span>
                  )
                }
                return (
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                    lastActivity.status === 'recent'
                      ? 'bg-green-100 text-green-700'
                      : lastActivity.status === 'active'
                      ? 'bg-sage-100 text-sage-700'
                      : lastActivity.status === 'moderate'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    Last active {lastActivity.display}
                  </span>
                )
              })()}
            </div>
            <p className="text-sage-400 text-sm">
              {viewingWedding.wedding_date
                ? new Date(viewingWedding.wedding_date).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })
                : 'No date set'
              } · Code: {viewingWedding.event_code}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={sendCheckin}
              disabled={checkingIn}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                checkedIn
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
              }`}
              title="Send a friendly check-in message to this couple"
            >
              {checkedIn ? '\u2713 Sent!' : checkingIn ? '\u2026' : '\uD83D\uDC9B Check in'}
            </button>
            <button
              onClick={() => window.open(`/admin/print/${viewingWedding.id}`, '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sage-100 hover:bg-sage-200 text-sage-700 text-sm font-medium transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              onClick={closeProfile}
              className="flex items-center gap-1.5 text-sage-500 hover:text-sage-700 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Escalation Alert */}
        {escalation?.hasEscalation && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-red-700 font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Needs Attention - {escalation.count} concerning message(s) this week
              </div>
              <button
                onClick={() => markEscalationHandled(viewingWedding.id)}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                Mark Handled
              </button>
            </div>
            <p className="text-red-600 text-sm">
              This client may be stressed or need extra support. Review their recent messages below.
            </p>
            {escalation.messages?.[0] && (
              <p className="mt-2 text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2 italic line-clamp-2">
                "{escalation.messages[0].content.length > 140
                  ? escalation.messages[0].content.slice(0, 140) + '\u2026'
                  : escalation.messages[0].content}"
              </p>
            )}
          </div>
        )}

        {/* Ask About This Wedding -- always visible at top */}
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 mb-4 sm:mb-6">
          <div className="flex gap-2">
            <img src="/icons/ask-about-wedding.svg" className="w-5 h-5 flex-shrink-0 mt-2" alt="" />
            <div className="flex-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contractQuestion}
                  onChange={(e) => setContractQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && askContractQuestion()}
                  placeholder="Ask anything about this wedding\u2026"
                  className="flex-1 px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  disabled={askingQuestion}
                />
                <button
                  onClick={askContractQuestion}
                  disabled={askingQuestion || !contractQuestion.trim()}
                  className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
                >
                  {askingQuestion ? '\u2026' : 'Ask'}
                </button>
              </div>
              {contractAnswer && (
                <div className="mt-3 p-3 bg-cream-50 rounded-lg text-sm text-sage-700 whitespace-pre-wrap">
                  {contractAnswer}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[220px_1fr] gap-4 sm:gap-8">
          {/* Compact Nav Sidebar */}
          <div className="order-2 lg:order-1">
            <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden lg:sticky lg:top-24">
              <div className="px-4 pt-5 pb-3 flex justify-center border-b border-cream-200">
                <img src="/rixey-manor-logo-optimized.png" alt="Rixey Manor" className="h-16 w-auto" />
              </div>
              <nav className="p-2">
                {[
                  { tab: 'overview', label: 'Overview', icon: '/icons/overview.svg' },
                  { section: 'Planning' },
                  { tab: 'completeness', label: 'File Completeness', icon: '/icons/checklist.svg' },
                  { tab: 'notes', label: 'Planning Notes', icon: '/icons/planning-notes.svg', badge: planningNotes.filter(n => n.status === 'pending').length },
                  { tab: 'wedding-details', label: 'Wedding Details', icon: '/icons/overview.svg' },
                  { tab: 'allergies', label: 'Allergy Registry', icon: '/icons/guest-care.svg' },
                  { tab: 'ceremony-order', label: 'Ceremony Order', icon: '/icons/timeline.svg' },
                  { tab: 'ceremony-chairs', label: 'Ceremony Chairs', icon: '/icons/tables.svg' },
                  { tab: 'decor', label: 'Decor Inventory', icon: '/icons/inspiration.svg' },
                  { tab: 'makeup', label: 'Hair & Makeup', icon: '/icons/upload-photo-of-you-two.svg' },
                  { tab: 'shuttle', label: 'Shuttle Schedule', icon: '/icons/book-a-meeting.svg' },
                  { tab: 'rehearsal', label: 'Rehearsal Dinner', icon: '/icons/meetings.svg' },
                  { tab: 'bedrooms', label: 'Bedroom Assignments', icon: '/icons/direct-messages.svg' },
                  { tab: 'vendors', label: 'Vendors', icon: '/icons/vendors.svg' },
                  { tab: 'inspo', label: 'Inspiration', icon: '/icons/inspiration.svg' },
                  { tab: 'checklist', label: 'Checklist', icon: '/icons/checklist.svg' },
                  { section: 'Conversations' },
                  { tab: 'messages', label: 'Conversations', icon: '/icons/conversations.svg' },
                  { tab: 'uncertain', label: "Uncertain Q's", icon: '/icons/uncertain-questions.svg', badge: uncertainQuestions.filter(q => q.wedding_id === viewingWedding.id).length },
                  { tab: 'meetings', label: 'Meetings', icon: '/icons/meetings.svg' },
                  { tab: 'direct-messages', label: 'Direct Messages', icon: '/icons/direct-messages.svg' },
                  { section: 'Tools' },
                  { tab: 'table-map', label: 'Table Map', icon: '/icons/tables.svg' },
                  { tab: 'timeline', label: 'Timeline', icon: '/icons/timeline.svg' },
                  { tab: 'tables', label: 'Tables', icon: '/icons/tables.svg' },
                  { tab: 'staffing', label: 'Staffing Guide', icon: '/icons/staffing-guide.svg' },
                  { tab: 'bar', label: 'Bar Planner', icon: '/icons/staffing-guide.svg' },
                  { tab: 'budget', label: 'Budget', icon: '/icons/budget.svg' },
                  { tab: 'guests', label: 'Guest List', icon: '/icons/guest-care.svg' },
                  { tab: 'borrow', label: 'Borrow Brochure', icon: '/icons/borrow-brochure.svg', badge: borrowSelections.length },
                  { tab: 'guest-care', label: 'Guest Care', icon: '/icons/guest-care.svg' },
                  { section: 'Website' },
                  { tab: 'website-builder', label: 'Website Builder', icon: '/icons/overview.svg' },
                  { tab: 'photo-library', label: 'Photo Library', icon: '/icons/inspiration.svg' },
                  { tab: 'wedding-party', label: 'Wedding Party', icon: '/icons/guest-care.svg' },
                  { section: 'After the Day' },
                  { tab: 'day-of-memories', label: 'Day-of Memories', icon: '/icons/inspiration.svg' },
                  { tab: 'activity', label: 'Recent Activity', icon: '/icons/recent-activity.svg', badge: activities.length },
                  { section: 'Admin' },
                  { tab: 'contract-upload', label: 'Upload Contract', icon: '/icons/upload-contract.svg' },
                  { tab: 'ask', label: 'Ask About Wedding', icon: '/icons/ask-about-wedding.svg' },
                  { tab: 'api-usage', label: 'API Usage', icon: '/icons/api-usage.svg' },
                ].map((item, idx) => {
                  if (item.section) {
                    return (
                      <p key={idx} className="text-xs font-semibold text-sage-400 uppercase tracking-wide px-3 pt-3 pb-1">
                        {item.section}
                      </p>
                    )
                  }
                  return (
                    <button
                      key={item.tab}
                      onClick={() => {
                        setActiveTab(item.tab)
                        if (item.tab === 'messages') { setSelectedChatUser(null); setSearchQuery('') }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                        activeTab === item.tab
                          ? 'bg-sage-100 text-sage-700 font-medium'
                          : 'text-sage-500 hover:bg-cream-50 hover:text-sage-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <img src={item.icon} className="w-5 h-5 flex-shrink-0" alt="" />
                        <span>{item.label}</span>
                      </span>
                      {item.badge > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Main Content Panel */}
          <div className="order-1 lg:order-2">
            <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-3 sm:p-4 lg:p-6">
              {/* Mobile: Dropdown selector */}
              <div className="lg:hidden mb-4">
                <select
                  value={activeTab}
                  onChange={(e) => {
                    setActiveTab(e.target.value)
                    if (e.target.value === 'messages') { setSelectedChatUser(null); setSearchQuery('') }
                  }}
                  className="w-full p-3 border border-cream-200 rounded-lg bg-cream-50 text-sage-700 font-medium focus:outline-none focus:ring-2 focus:ring-sage-300"
                >
                  <option value="overview">Overview</option>
                  <option value="completeness">File Completeness</option>
                  <option value="notes">
                    Planning Notes {planningNotes.filter(n => n.status === 'pending').length > 0 ? `(${planningNotes.filter(n => n.status === 'pending').length})` : ''}
                  </option>
                  <option value="vendors">Vendors & Contracts</option>
                  <option value="inspo">Inspiration</option>
                  <option value="checklist">Checklist</option>
                  <option value="messages">All Conversations</option>
                  <option value="uncertain">
                    Uncertain Q's {uncertainQuestions.filter(q => q.wedding_id === viewingWedding.id).length > 0 ? `(${uncertainQuestions.filter(q => q.wedding_id === viewingWedding.id).length})` : ''}
                  </option>
                  <option value="meetings">Meetings</option>
                  <option value="direct-messages">Direct Messages</option>
                  <option value="table-map">Table Map</option>
                  <option value="ceremony-chairs">Ceremony Chairs</option>
                  <option value="timeline">Timeline</option>
                  <option value="tables">Tables</option>
                  <option value="staffing">Staffing Guide</option>
                  <option value="bar">Bar Planner</option>
                  <option value="budget">Budget</option>
                  <option value="guests">Guest List</option>
                  <option value="borrow">Borrow Brochure</option>
                  <option value="guest-care">Guest Care</option>
                  <option value="website-builder">Website Builder</option>
                  <option value="photo-library">Photo Library</option>
                  <option value="wedding-party">Wedding Party</option>
                  <option value="day-of-memories">Day-of Memories</option>
                  <option value="activity">
                    Recent Activity {activities.length > 0 ? `(${activities.length})` : ''}
                  </option>
                  <option value="contract-upload">Upload Contract</option>
                  <option value="ask">Ask About Wedding</option>
                  <option value="api-usage">API Usage</option>
                </select>
              </div>

              {/* File Completeness Tab */}
              {activeTab === 'completeness' && (
                <WeddingCompleteness
                  weddingId={viewingWedding.id}
                  wedding={viewingWedding}
                  onSwitchTab={setActiveTab}
                />
              )}

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-sage-50 rounded-xl p-2 sm:p-3 text-center">
                      <p className="text-xl sm:text-2xl font-semibold text-sage-700">{msgStats.userMsgs}</p>
                      <p className="text-sage-500 text-xs mt-0.5">Questions</p>
                    </div>
                    <div className="bg-cream-100 rounded-xl p-2 sm:p-3 text-center">
                      <p className="text-xl sm:text-2xl font-semibold text-sage-700">{msgStats.total}</p>
                      <p className="text-sage-500 text-xs mt-0.5">Messages</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-2 sm:p-3 text-center">
                      <p className="text-xl sm:text-2xl font-semibold text-sage-700">{msgStats.uniqueDays}</p>
                      <p className="text-sage-500 text-xs mt-0.5">Active Days</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-2 sm:p-3 text-center">
                      <p className="text-xl sm:text-2xl font-semibold text-sage-700">{viewingWedding.profiles?.length || 0}</p>
                      <p className="text-sage-500 text-xs mt-0.5">Members</p>
                    </div>
                  </div>

                  {/* Planning Links */}
                  <div className="flex flex-wrap gap-2">
                    {viewingWedding.honeybook_link ? (
                      <a href={viewingWedding.honeybook_link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition text-xs">
                        ✓ HoneyBook ↗
                      </a>
                    ) : (
                      <span className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-xs">⚠ No HoneyBook link</span>
                    )}
                    {viewingWedding.google_sheets_link ? (
                      <a href={viewingWedding.google_sheets_link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition text-xs">
                        ✓ Spreadsheet ↗
                      </a>
                    ) : (
                      <span className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-xs">⚠ No Spreadsheet</span>
                    )}
                  </div>

                  {/* AI Summary */}
                  <div className="bg-gradient-to-r from-sage-50 to-cream-50 rounded-xl p-4 border border-sage-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sage-700 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Summary
                      </h3>
                      <button
                        onClick={getNotesHighlights}
                        disabled={loadingHighlights || planningNotes.length === 0}
                        className="px-3 py-1 bg-sage-600 text-white text-xs rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingHighlights ? 'Generating...' : 'Generate Highlights'}
                      </button>
                    </div>
                    {notesHighlights ? (
                      <div className="bg-white rounded-lg p-3 text-sm text-sage-700 whitespace-pre-wrap">{notesHighlights}</div>
                    ) : (
                      <p className="text-sage-400 text-sm">Generate a quick AI summary of all planning notes.</p>
                    )}
                  </div>

                  {/* Data Tiles */}
                  {(timelineSummary || tableSummary || staffingSummary || sharedBudget || borrowSelections.length > 0 || viewingWedding.profiles?.length > 0) && (
                    <div>
                      <h3 className="text-xs font-semibold text-sage-400 uppercase tracking-wide mb-3">Wedding Details</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {timelineSummary && (
                          <button onClick={() => setActiveTab('timeline')} className="text-left bg-amber-50 border border-amber-200 rounded-xl p-3 hover:shadow-sm transition group">
                            <p className="text-sm font-medium text-sage-700 mb-1">📅 Timeline</p>
                            <p className="text-xs text-sage-500">{timelineSummary.ceremonyTime ? new Date(`2000-01-01T${timelineSummary.ceremonyTime}`).toLocaleTimeString('en-US', {hour:'numeric',minute:'2-digit'}) : '\u2014'} ceremony</p>
                            <p className="text-xs text-sage-400 mt-1 group-hover:text-sage-600">View →</p>
                          </button>
                        )}
                        {tableSummary && (
                          <button onClick={() => setActiveTab('tables')} className="text-left bg-sage-50 border border-sage-200 rounded-xl p-3 hover:shadow-sm transition group">
                            <p className="text-sm font-medium text-sage-700 mb-1">🪑 Tables</p>
                            <p className="text-xs text-sage-500">{tableSummary.guestCount} guests · {tableSummary.tablesNeeded} tables</p>
                            <p className="text-xs text-sage-400 mt-1 group-hover:text-sage-600">View →</p>
                          </button>
                        )}
                        {staffingSummary && (
                          <div className="text-left bg-purple-50 border border-purple-200 rounded-xl p-3">
                            <p className="text-sm font-medium text-sage-700 mb-1">🙋 Staffing</p>
                            <p className="text-xs text-sage-500">{staffingSummary.total_staff} staff · ${Number(staffingSummary.total_cost).toLocaleString()}</p>
                          </div>
                        )}
                        {sharedBudget && (() => {
                          const cats = sharedBudget.categories || {}
                          const totalCommitted = Object.values(cats).reduce((s, c) => s + (c.committed || 0), 0)
                          const effectiveBudget = sharedBudget.total_budget || Object.values(cats).reduce((s, c) => s + (c.budgeted || 0), 0)
                          return (
                            <div className="text-left bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                              <p className="text-sm font-medium text-sage-700 mb-1">💰 Budget</p>
                              <p className="text-xs text-sage-500">${totalCommitted.toLocaleString()} / ${effectiveBudget.toLocaleString()}</p>
                            </div>
                          )
                        })()}
                        {borrowSelections.length > 0 && (
                          <button onClick={() => setActiveTab('borrow')} className="text-left bg-orange-50 border border-orange-200 rounded-xl p-3 hover:shadow-sm transition group">
                            <p className="text-sm font-medium text-sage-700 mb-1">📋 Borrow</p>
                            <p className="text-xs text-sage-500">{borrowSelections.length} items selected</p>
                            <p className="text-xs text-sage-400 mt-1 group-hover:text-sage-600">View →</p>
                          </button>
                        )}
                        {viewingWedding.profiles?.length > 0 && (
                          <div className="text-left bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <p className="text-sm font-medium text-sage-700 mb-1">👥 Party</p>
                            <p className="text-xs text-sage-500">{viewingWedding.profiles.length} member{viewingWedding.profiles.length !== 1 ? 's' : ''} joined</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Planning Notes by Category */}
                  {planningNotes.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-sage-400 uppercase tracking-wide">Planning Notes</h3>
                        <button onClick={() => setActiveTab('notes')} className="text-xs text-sage-500 hover:text-sage-700">View all →</button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(() => {
                          const notesByCategory = planningNotes.reduce((acc, note) => {
                            const cat = note.category || 'note'
                            if (!acc[cat]) acc[cat] = { total: 0, pending: 0 }
                            acc[cat].total++
                            if (note.status === 'pending') acc[cat].pending++
                            return acc
                          }, {})
                          const PRIORITY_CATS = ['allergy', 'stress', 'grief', 'health', 'family', 'follow_up', 'relationship']
                          const sortedCats = Object.entries(notesByCategory).sort((a, b) => {
                            const aP = PRIORITY_CATS.indexOf(a[0])
                            const bP = PRIORITY_CATS.indexOf(b[0])
                            if (aP !== -1 && bP !== -1) return aP - bP
                            if (aP !== -1) return -1
                            if (bP !== -1) return 1
                            return b[1].pending - a[1].pending || b[1].total - a[1].total
                          })
                          return sortedCats.map(([cat, counts]) => {
                            const isHighAlert = cat === 'allergy'
                            const isEmotional = ['stress', 'grief', 'relationship', 'family', 'health'].includes(cat)
                            const isFollowUp = cat === 'follow_up'
                            const tileClass = isHighAlert
                              ? 'bg-amber-50 border-amber-300'
                              : isEmotional
                              ? 'bg-rose-50 border-rose-200'
                              : isFollowUp
                              ? 'bg-blue-50 border-blue-200'
                              : 'bg-cream-50 border-cream-200'
                            const labelClass = isHighAlert ? 'text-amber-800' : isEmotional ? 'text-rose-700' : isFollowUp ? 'text-blue-700' : 'text-sage-700'
                            const subClass = isHighAlert ? 'text-amber-700' : isEmotional ? 'text-rose-500' : isFollowUp ? 'text-blue-500' : 'text-sage-400'
                            return (
                            <button key={cat} onClick={() => setActiveTab('notes')} className={`text-left rounded-lg p-2.5 hover:border-sage-300 transition border ${tileClass}`}>
                              <p className={`text-xs font-medium flex items-center gap-1.5 ${labelClass}`}>
                                <span>{getCategoryIcon(cat)}</span>
                                <span className="capitalize">{getCategoryLabel(cat)}</span>
                              </p>
                              <p className={`text-xs mt-0.5 ${subClass}`}>
                                {counts.total} note{counts.total !== 1 ? 's' : ''}
                                {counts.pending > 0 && <span className="ml-1 text-amber-600">· {counts.pending} new</span>}
                              </p>
                            </button>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Internal Notes */}
                  <div className="border border-amber-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-medium text-sage-700">Internal Notes</h3>
                      <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">Admin only</span>
                    </div>
                    <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                      {internalNotes.length === 0 ? (
                        <p className="text-sage-400 text-sm italic">No notes yet</p>
                      ) : (
                        internalNotes.map(note => (
                          <div key={note.id} className="group bg-amber-50 rounded-lg px-3 py-2 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sage-700 whitespace-pre-wrap leading-snug flex-1">{note.content}</p>
                              <button
                                onClick={() => deleteInternalNote(note.id)}
                                className="opacity-0 group-hover:opacity-100 text-sage-300 hover:text-red-400 transition flex-shrink-0 mt-0.5"
                                title="Delete note"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <p className="text-sage-400 text-xs mt-1">
                              {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <textarea
                      value={newNoteText}
                      onChange={e => setNewNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addInternalNote() }}
                      placeholder="Add a note\u2026 (Cmd+Enter to save)"
                      rows={2}
                      className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2 text-sage-700 placeholder-sage-300 focus:outline-none focus:border-sage-400 resize-none"
                    />
                    <button
                      onClick={addInternalNote}
                      disabled={!newNoteText.trim() || savingNote}
                      className="mt-2 w-full py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition"
                    >
                      {savingNote ? 'Saving\u2026' : 'Add Note'}
                    </button>
                  </div>
                </div>
              )}

              {/* Planning Notes Tab */}
              {activeTab === 'notes' && (
                <div>
                  {/* AI Highlights Section */}
                  <div className="bg-gradient-to-r from-sage-50 to-cream-50 rounded-xl p-4 mb-4 border border-sage-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sage-700 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Summary
                      </h3>
                      <button
                        onClick={getNotesHighlights}
                        disabled={loadingHighlights || planningNotes.length === 0}
                        className="px-3 py-1 bg-sage-600 text-white text-sm rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingHighlights ? 'Generating...' : 'Generate Highlights'}
                      </button>
                    </div>
                    {notesHighlights ? (
                      <div className="bg-white rounded-lg p-3 text-sm text-sage-700 whitespace-pre-wrap">
                        {notesHighlights}
                      </div>
                    ) : (
                      <p className="text-sage-500 text-sm">
                        Click "Generate Highlights" to get an AI summary of all planning notes for quick review.
                      </p>
                    )}
                  </div>

                  {/* Notes Search */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <p className="text-sage-500 text-sm">
                      Auto-detected planning updates. Mark as "Added" once updated.
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        value={notesSearchQuery}
                        onChange={(e) => setNotesSearchQuery(e.target.value)}
                        placeholder="Search notes..."
                        className="pl-9 pr-4 py-2 border border-cream-300 rounded-lg text-sm w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-sage-300"
                      />
                      <svg className="w-4 h-4 text-sage-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  {notesSearchQuery && (
                    <p className="text-sage-500 text-sm mb-3">
                      Found {planningNotes.filter(n =>
                        n.content.toLowerCase().includes(notesSearchQuery.toLowerCase()) ||
                        n.category.toLowerCase().includes(notesSearchQuery.toLowerCase()) ||
                        (n.source_message && n.source_message.toLowerCase().includes(notesSearchQuery.toLowerCase()))
                      ).length} note(s) matching "{notesSearchQuery}"
                    </p>
                  )}

                  {loadingMessages ? (
                    <p className="text-sage-400 text-center py-8">Loading...</p>
                  ) : planningNotes.length === 0 ? (
                    <p className="text-sage-400 text-center py-8">
                      No planning notes detected yet. They'll appear here as clients share decisions with Sage.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {/* Group notes by category */}
                      {(() => {
                        const filteredNotes = planningNotes.filter(note => {
                          if (!notesSearchQuery.trim()) return true
                          const query = notesSearchQuery.toLowerCase()
                          return (
                            note.content.toLowerCase().includes(query) ||
                            note.category.toLowerCase().includes(query) ||
                            (note.source_message && note.source_message.toLowerCase().includes(query))
                          )
                        })

                        // Group by category
                        const grouped = filteredNotes.reduce((acc, note) => {
                          const cat = note.category || 'other'
                          if (!acc[cat]) acc[cat] = []
                          acc[cat].push(note)
                          return acc
                        }, {})

                        // Sort categories - pending first, then by note count
                        const sortedCategories = Object.keys(grouped).sort((a, b) => {
                          const aPending = grouped[a].filter(n => n.status === 'pending').length
                          const bPending = grouped[b].filter(n => n.status === 'pending').length
                          if (aPending !== bPending) return bPending - aPending
                          return grouped[b].length - grouped[a].length
                        })

                        return sortedCategories.map(category => {
                          const notes = grouped[category]
                          const pendingCount = notes.filter(n => n.status === 'pending').length
                          const isCollapsed = collapsedNoteCategories[category]

                          return (
                            <div key={category} className="border border-cream-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => setCollapsedNoteCategories(prev => ({
                                  ...prev,
                                  [category]: !prev[category]
                                }))}
                                className="w-full flex items-center justify-between p-3 bg-cream-50 hover:bg-cream-100 transition"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{getCategoryIcon(category)}</span>
                                  <span className="font-medium text-sage-700">{getCategoryLabel(category)}</span>
                                  <span className="text-sage-400 text-sm">({notes.length})</span>
                                  {pendingCount > 0 && (
                                    <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                                      {pendingCount} new
                                    </span>
                                  )}
                                </div>
                                <svg
                                  className={`w-5 h-5 text-sage-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              {!isCollapsed && (
                                <div className="p-2 space-y-2">
                                  {notes.map(note => (
                                    <div
                                      key={note.id}
                                      className={`border rounded-lg p-3 ${
                                        note.status === 'pending'
                                          ? 'border-amber-200 bg-amber-50/50'
                                          : note.status === 'added'
                                          ? 'border-green-200 bg-green-50/50'
                                          : note.status === 'confirmed'
                                          ? 'border-blue-200 bg-blue-50/50'
                                          : 'border-cream-200 bg-white'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                              note.status === 'pending'
                                                ? 'bg-amber-100 text-amber-700'
                                                : note.status === 'added'
                                                ? 'bg-green-100 text-green-700'
                                                : note.status === 'confirmed'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                              {note.status === 'pending' ? 'New' : note.status === 'confirmed' ? 'Synced' : note.status}
                                            </span>
                                            <span className="text-sage-400 text-xs">
                                              {new Date(note.created_at).toLocaleDateString('en-US', {
                                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                              })}
                                            </span>
                                          </div>
                                          <p className="text-sage-800 text-sm">{note.content}</p>
                                          {note.source_message && (
                                            <p className="text-sage-500 text-xs mt-1 italic line-clamp-1">
                                              "{note.source_message}"
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex flex-col gap-1 shrink-0">
                                          {note.status === 'pending' && (
                                            <>
                                              <button
                                                onClick={() => updateNoteStatus(note.id, 'added')}
                                                className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                              >
                                                ✓
                                              </button>
                                              <button
                                                onClick={() => updateNoteStatus(note.id, 'dismissed')}
                                                className="text-xs px-2 py-1 text-sage-400 hover:text-sage-600"
                                              >
                                                ✕
                                              </button>
                                            </>
                                          )}
                                          {note.status === 'added' && (
                                            <span className="text-xs text-green-600">✓</span>
                                          )}
                                          {note.status === 'dismissed' && (
                                            <button
                                              onClick={() => updateNoteStatus(note.id, 'pending')}
                                              className="text-xs text-sage-400 hover:text-sage-600"
                                            >
                                              ↩
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Messages Tab */}
              {activeTab === 'messages' && (
                <div>
                  {selectedChatUser ? (
                    /* Chat Thread View */
                    (() => {
                      const chronological = [...weddingMessages]
                        .filter(m => m.user_id === selectedChatUser)
                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                      const chatProfile = profileMap[selectedChatUser]
                      return (
                        <div>
                          {/* Header */}
                          <div className="flex items-center gap-3 mb-4">
                            <button
                              onClick={() => { setSelectedChatUser(null); setSearchQuery('') }}
                              className="flex items-center gap-1 text-sage-500 hover:text-sage-700 text-sm"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              All conversations
                            </button>
                            <span className="text-sage-300">|</span>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center">
                                <span className="text-xs font-medium text-sage-600">
                                  {chatProfile?.name?.charAt(0) || '?'}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-sage-800 text-sm">{chatProfile?.name || 'Unknown'}</span>
                                <span className="text-sage-400 text-xs ml-2">{chatProfile?.role?.replace('couple-', '').replace('-', ' ') || 'Member'}</span>
                              </div>
                            </div>
                            <span className="ml-auto text-sage-400 text-xs">{chronological.length} messages</span>
                          </div>

                          {/* Chat bubbles */}
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                            {chronological.map((msg, idx) => {
                              const isUser = msg.sender === 'user'
                              const isEscalation = isUser && ESCALATION_KEYWORDS.some(kw =>
                                msg.content.toLowerCase().includes(kw)
                              )
                              const showTime = idx === 0 ||
                                new Date(msg.created_at) - new Date(chronological[idx - 1].created_at) > 5 * 60 * 1000
                              return (
                                <div key={msg.id}>
                                  {showTime && (
                                    <p className="text-center text-sage-400 text-xs my-2">
                                      {new Date(msg.created_at).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                      })}
                                    </p>
                                  )}
                                  <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    {!isUser && (
                                      <div className="w-6 h-6 rounded-full bg-sage-200 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                                        <span className="text-xs text-sage-600 font-medium">S</span>
                                      </div>
                                    )}
                                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                                      isUser
                                        ? isEscalation
                                          ? 'bg-red-100 text-red-800 rounded-br-sm'
                                          : 'bg-sage-600 text-white rounded-br-sm'
                                        : msg.is_team_note
                                          ? 'bg-amber-50 text-sage-800 rounded-bl-sm border border-amber-200'
                                          : 'bg-cream-100 text-sage-800 rounded-bl-sm border border-cream-200'
                                    }`}>
                                      {isEscalation && (
                                        <span className="block text-xs text-red-500 font-medium mb-1">Needs attention</span>
                                      )}
                                      {msg.is_team_note && (
                                        <span className="block text-xs text-amber-600 font-medium mb-1">★ Team note</span>
                                      )}
                                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Inject Team Note */}
                          <div className="mt-4 pt-4 border-t border-cream-200">
                            <p className="text-xs text-sage-500 mb-2 font-medium">Inject a note as Sage</p>
                            <textarea
                              value={injectText}
                              onChange={e => setInjectText(e.target.value)}
                              placeholder="Type a correction or clarification \u2014 it will appear in the client's chat thread marked as a team note\u2026"
                              rows={3}
                              className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage-300"
                            />
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              <label className="flex items-center gap-2 text-sm text-sage-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={injectKb}
                                  onChange={e => setInjectKb(e.target.checked)}
                                  className="rounded border-cream-300"
                                />
                                Also save to Knowledge Base
                              </label>
                              {injectKb && (
                                <input
                                  type="text"
                                  value={injectKbCat}
                                  onChange={e => setInjectKbCat(e.target.value)}
                                  placeholder="KB category (e.g. Catering)"
                                  className="flex-1 px-3 py-1.5 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                                />
                              )}
                              <button
                                onClick={() => injectNote(selectedChatUser)}
                                disabled={!injectText.trim() || injecting}
                                className="ml-auto px-4 py-1.5 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {injecting ? 'Sending\u2026' : 'Send as Team Note'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    /* User List View */
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <h3 className="font-medium text-sage-700">Questions & Conversations</h3>
                        <div className="relative">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search messages..."
                            className="pl-9 pr-4 py-2 border border-cream-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-sage-300"
                          />
                          <svg className="w-4 h-4 text-sage-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>

                      {loadingMessages ? (
                        <p className="text-sage-400 text-center py-8">Loading messages...</p>
                      ) : weddingMessages.length === 0 ? (
                        <p className="text-sage-400 text-center py-8">No conversations yet</p>
                      ) : (() => {
                        // Group messages by user, filter by search
                        const byUser = {}
                        weddingMessages.forEach(m => {
                          if (!byUser[m.user_id]) byUser[m.user_id] = []
                          byUser[m.user_id].push(m)
                        })
                        const userIds = Object.keys(byUser).filter(uid => {
                          if (!searchQuery.trim()) return true
                          return byUser[uid].some(m =>
                            m.content.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                        })
                        if (userIds.length === 0) {
                          return <p className="text-sage-400 text-center py-8">No messages match your search</p>
                        }
                        return (
                          <div className="space-y-3">
                            {userIds.map(uid => {
                              const msgs = byUser[uid]
                              const profile = profileMap[uid]
                              const userMsgs = msgs.filter(m => m.sender === 'user')
                              const hasEscalation = userMsgs.some(m =>
                                ESCALATION_KEYWORDS.some(kw => m.content.toLowerCase().includes(kw))
                              )
                              // Latest message chronologically
                              const latest = [...msgs].sort((a, b) =>
                                new Date(b.created_at) - new Date(a.created_at)
                              )[0]
                              return (
                                <button
                                  key={uid}
                                  onClick={() => setSelectedChatUser(uid)}
                                  className={`w-full text-left border rounded-xl p-4 hover:shadow-sm transition-shadow ${
                                    hasEscalation ? 'border-red-200 bg-red-50/40' : 'border-cream-200 hover:border-sage-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        hasEscalation ? 'bg-red-100' : 'bg-sage-100'
                                      }`}>
                                        <span className={`text-sm font-medium ${
                                          hasEscalation ? 'text-red-600' : 'text-sage-600'
                                        }`}>
                                          {profile?.name?.charAt(0) || '?'}
                                        </span>
                                      </div>
                                      <div>
                                        <p className="font-medium text-sage-800 text-sm">
                                          {profile?.name || 'Unknown User'}
                                          {hasEscalation && (
                                            <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                                              Needs attention
                                            </span>
                                          )}
                                        </p>
                                        <p className="text-sage-400 text-xs">
                                          {profile?.role?.replace('couple-', '').replace('-', ' ') || 'Member'} · {userMsgs.length} question{userMsgs.length !== 1 ? 's' : ''}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sage-400 text-xs">
                                        {new Date(latest.created_at).toLocaleDateString('en-US', {
                                          month: 'short', day: 'numeric'
                                        })}
                                      </span>
                                      <svg className="w-4 h-4 text-sage-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </div>
                                  <p className="text-sage-500 text-sm truncate pl-10">
                                    {latest.sender === 'user' ? latest.content : `Sage: ${latest.content}`}
                                  </p>
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'wedding-details' && (
                <WeddingDetails weddingId={viewingWedding.id} userId={null} />
              )}

              {activeTab === 'allergies' && (
                <AllergyRegistry weddingId={viewingWedding.id} userId={null} />
              )}

              {activeTab === 'ceremony-order' && (
                <CeremonyOrder weddingId={viewingWedding.id} userId={null} />
              )}

              {activeTab === 'ceremony-chairs' && (
                <CeremonyChairPlan weddingId={viewingWedding.id} userId={null} isAdmin />
              )}

              {activeTab === 'decor' && (
                <DecorInventory weddingId={viewingWedding.id} userId={null} />
              )}

              {activeTab === 'makeup' && (
                <MakeupSchedule weddingId={viewingWedding.id} userId={null} />
              )}

              {activeTab === 'shuttle' && (
                <ShuttleSchedule weddingId={viewingWedding.id} userId={null} />
              )}

              {activeTab === 'rehearsal' && (
                <RehearsalDinner weddingId={viewingWedding.id} userId={null} />
              )}

              {activeTab === 'bedrooms' && (
                <BedroomAssignments weddingId={viewingWedding.id} userId={null} />
              )}

              {activeTab === 'day-of-memories' && (
                <DayOfMemories weddingId={viewingWedding.id} isAdmin />
              )}

              {/* Vendors Tab */}
              {activeTab === 'vendors' && (
                <div>
                  {/* Couple Photo Section */}
                  <div className="bg-gradient-to-r from-sage-50 to-cream-50 rounded-xl p-4 mb-6 border border-sage-100">
                    <h3 className="font-medium text-sage-700 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      The Couple
                    </h3>
                    <CouplePhoto weddingId={viewingWedding.id} />
                  </div>
                  <VendorChecklist weddingId={viewingWedding.id} isAdmin />
                </div>
              )}

              {/* Inspiration Tab */}
              {activeTab === 'inspo' && (
                <div>
                  <InspoGallery weddingId={viewingWedding.id} isAdmin />
                </div>
              )}

              {/* Checklist Tab */}
              {activeTab === 'checklist' && (
                <div>
                  <PlanningChecklist weddingId={viewingWedding.id} isAdmin />
                </div>
              )}

              {/* Uncertain Questions Tab */}
              {activeTab === 'uncertain' && (
                <div>
                  <p className="text-sage-500 text-sm mb-4">
                    Questions Sage was uncertain about for this wedding. Answer to help Sage improve.
                  </p>
                  {uncertainQuestions.filter(q => q.wedding_id === viewingWedding.id).length === 0 ? (
                    <p className="text-sage-400 text-center py-8">
                      No uncertain questions for this wedding
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {uncertainQuestions
                        .filter(q => q.wedding_id === viewingWedding.id)
                        .map(q => {
                          const isAnswering = answeringQuestion === q.id

                          return (
                            <div key={q.id} className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="text-sage-800 font-medium">{q.question}</p>
                                  <p className="text-sage-400 text-xs mt-1">
                                    {new Date(q.created_at).toLocaleDateString()}
                                    {q.confidence_level && (
                                      <span className="ml-2 text-amber-600">
                                        {q.confidence_level}% confident
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <button
                                  onClick={() => deleteUncertainQuestion(q.id)}
                                  className="text-sage-400 hover:text-red-500 text-sm"
                                  title="Delete question"
                                >
                                  ✕
                                </button>
                              </div>

                              {q.sage_response && (
                                <div className="bg-white rounded p-3 mb-3 text-sm text-sage-600 border border-cream-200">
                                  <span className="font-medium">Sage said:</span> {q.sage_response}
                                </div>
                              )}

                              {isAnswering ? (
                                <div className="space-y-3 mt-3 pt-3 border-t border-amber-300">
                                  <textarea
                                    value={adminAnswer}
                                    onChange={(e) => setAdminAnswer(e.target.value)}
                                    placeholder="Your answer..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                                  />

                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id={`kb-profile-${q.id}`}
                                      checked={addToKb}
                                      onChange={(e) => setAddToKb(e.target.checked)}
                                      className="rounded border-cream-300"
                                    />
                                    <label htmlFor={`kb-profile-${q.id}`} className="text-sm text-sage-600">
                                      Add to Knowledge Base
                                    </label>
                                  </div>

                                  {addToKb && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        value={kbCategory}
                                        onChange={(e) => setKbCategory(e.target.value)}
                                        placeholder="Category (e.g., venue)"
                                        className="px-3 py-2 border border-cream-300 rounded-lg text-sm"
                                      />
                                      <input
                                        type="text"
                                        value={kbSubcategory}
                                        onChange={(e) => setKbSubcategory(e.target.value)}
                                        placeholder="Subcategory (optional)"
                                        className="px-3 py-2 border border-cream-300 rounded-lg text-sm"
                                      />
                                    </div>
                                  )}

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => submitAnswer(q.id)}
                                      disabled={submittingAnswer || !adminAnswer.trim()}
                                      className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
                                    >
                                      {submittingAnswer ? 'Saving...' : 'Save Answer'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAnsweringQuestion(null)
                                        setAdminAnswer('')
                                        setAddToKb(false)
                                      }}
                                      className="px-4 py-2 text-sage-500 text-sm hover:text-sage-700"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setAnsweringQuestion(q.id)}
                                  className="mt-2 text-sm text-sage-600 hover:text-sage-800 font-medium"
                                >
                                  Answer this question →
                                </button>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Meetings Tab */}
              {activeTab === 'meetings' && (
                <div>
                  <UpcomingMeetings filterWedding={viewingWedding} compact />
                </div>
              )}

              {/* Direct Messages Tab */}
              {activeTab === 'direct-messages' && (
                <DirectMessagesPanel weddingId={viewingWedding.id} weddingName={viewingWedding.couple_names} />
              )}

              {/* Timeline Tab */}
              {activeTab === 'timeline' && (
                <TimelineBuilder weddingId={viewingWedding.id} weddingDate={viewingWedding.wedding_date} isAdmin />
              )}

              {/* Tables Tab */}
              {activeTab === 'tables' && (
                <TableLayoutPlanner weddingId={viewingWedding.id} isAdmin />
              )}

              {activeTab === 'table-map' && (
                <TableCanvas weddingId={viewingWedding.id} isAdmin />
              )}

              {activeTab === 'staffing' && (
                <StaffingCalculator weddingId={viewingWedding.id} userId={null} isAdmin />
              )}

              {activeTab === 'bar' && (
                <BarPlanner weddingId={viewingWedding.id} guestCount={viewingWedding.guest_count} weddingDate={viewingWedding.wedding_date} coupleNames={viewingWedding.couple_names} isAdmin />
              )}

              {activeTab === 'budget' && (
                <BudgetTracker weddingId={viewingWedding.id} />
              )}

              {activeTab === 'guests' && (
                <GuestList weddingId={viewingWedding.id} userId={null} />
              )}

              {/* Borrow Brochure Tab */}
              {activeTab === 'borrow' && (
                <div>
                  <p className="text-sage-500 text-sm mb-4">
                    Items this couple has selected. To add new catalog items, go to the <button onClick={() => { closeProfile(); setMainView('borrow-catalog') }} className="text-sage-600 underline hover:text-sage-800">Borrow Catalog</button> tab.
                  </p>
                  <BorrowCatalog
                    weddingId={viewingWedding.id}
                    isAdmin={true}
                    refreshKey={borrowCatalogRefreshKey}
                  />
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div>
                  <p className="text-sage-500 text-sm mb-4">
                    Recent client actions and updates. Shows when they interact with the portal.
                  </p>
                  {loadingActivities ? (
                    <p className="text-sage-400 text-center py-8">Loading activities...</p>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-8 bg-cream-50 rounded-xl">
                      <p className="text-sage-500">No recent activity</p>
                      <p className="text-sage-400 text-sm mt-1">Activity will appear when clients make updates</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activities.map(activity => {
                        const activityIcons = {
                          'timeline_updated': '📅',
                          'tables_updated': '🪑',
                          'staffing_updated': '🙋',
                          'vendor_added': '👥',
                          'vendor_updated': '✏️',
                          'contract_uploaded': '📄',
                          'message_sent': '💬',
                          'inspo_uploaded': '💡',
                          'checklist_completed': '✅',
                        }
                        const activityLabels = {
                          'timeline_updated': 'Updated timeline',
                          'tables_updated': 'Updated table setup',
                          'staffing_updated': 'Updated staffing guide',
                          'vendor_added': 'Added vendor',
                          'vendor_updated': 'Updated vendor',
                          'contract_uploaded': 'Uploaded contract',
                          'message_sent': 'Sent message',
                          'inspo_uploaded': 'Added inspiration',
                          'checklist_completed': 'Completed task',
                        }
                        const icon = activityIcons[activity.activity_type] || '📌'
                        const label = activityLabels[activity.activity_type] || activity.activity_type

                        return (
                          <div
                            key={activity.id}
                            className="flex items-start gap-3 p-3 bg-white rounded-lg border border-cream-200"
                          >
                            <span className="text-xl">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sage-800 text-sm font-medium">{label}</p>
                              {activity.details && (
                                <p className="text-sage-500 text-xs mt-0.5">{activity.details}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {activity.profiles?.name && (
                                  <span className="text-sage-400 text-xs">by {activity.profiles.name}</span>
                                )}
                                <span className="text-sage-300 text-xs">
                                  {new Date(activity.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Guest Care Tab */}
              {activeTab === 'guest-care' && (
                <GuestCareNotes weddingId={viewingWedding.id} />
              )}

              {/* Website Builder Tab */}
              {activeTab === 'website-builder' && (
                <WebsiteBuilder
                  weddingId={viewingWedding.id}
                  coupleNames={viewingWedding.couple_names}
                />
              )}

              {/* Photo Library Tab */}
              {activeTab === 'photo-library' && (
                <PhotoBucket weddingId={viewingWedding.id} />
              )}

              {/* Wedding Party Tab */}
              {activeTab === 'wedding-party' && (
                <WeddingParty
                  weddingId={viewingWedding.id}
                  partner1={viewingWedding.partner1_name}
                  partner2={viewingWedding.partner2_name}
                />
              )}

              {/* Contract Upload Tab */}
              {activeTab === 'contract-upload' && (
                <ContractPanel
                  weddingId={viewingWedding.id}
                  uploadingContract={uploadingContract}
                  handleContractUpload={handleContractUpload}
                  uploadResult={uploadResult}
                />
              )}

              {/* Ask About Wedding Tab */}
              {activeTab === 'ask' && (
                <div>
                  <h3 className="font-medium text-sage-700 mb-2">Ask About This Wedding</h3>
                  <p className="text-sage-500 text-sm mb-4">
                    Search contracts & planning notes (e.g., "Is the caterer doing a welcome drink?" or "How many guests?")
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={contractQuestion}
                      onChange={(e) => setContractQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && askContractQuestion()}
                      placeholder="Ask a question..."
                      className="flex-1 px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                      disabled={askingQuestion}
                    />
                    <button
                      onClick={askContractQuestion}
                      disabled={askingQuestion || !contractQuestion.trim()}
                      className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
                    >
                      {askingQuestion ? '...' : 'Ask'}
                    </button>
                  </div>
                  {contractAnswer && (
                    <div className="mt-3 p-3 bg-cream-50 rounded-lg text-sm text-sage-700 whitespace-pre-wrap">
                      {contractAnswer}
                    </div>
                  )}
                </div>
              )}

              {/* API Usage Tab */}
              {activeTab === 'api-usage' && (
                <div>
                  <h3 className="font-medium text-sage-700 mb-4">API Usage & Costs</h3>
                  <UsageStats weddingId={viewingWedding.id} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
