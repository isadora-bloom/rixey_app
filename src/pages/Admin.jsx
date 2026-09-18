import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// Components still used directly in the main Admin view (not in profile)
import KnowledgeBaseAdmin from '../components/KnowledgeBaseAdmin'
import VenueSettings from '../components/VenueSettings'
import AccommodationsAdmin from '../components/admin/AccommodationsAdmin'
import VendorsAdmin from '../components/VendorsAdmin'
import UsageStats from '../components/UsageStats'
import UpcomingMeetings from '../components/UpcomingMeetings'
import ToursPanel from './admin/ToursPanel'
import AdminInbox from '../components/AdminInbox'
import BorrowCatalog from '../components/BorrowCatalog'
import StorefrontAdmin from '../components/StorefrontAdmin'
import ManorDownloads from '../components/ManorDownloads'
import { API_URL } from '../config/api'
import { apiFetch, loadJson } from '../utils/api'
import LoadError from '../components/ui/LoadError'
import { awaitAnswerJob, timeAgo } from '../utils/answerJobs'
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui'
import { parseDateOnly } from '../utils/dates'
import { resolveSectionKey } from '../../shared/sections.js'

// Extracted sub-components
import AdminHeader from './admin/AdminHeader'
import CrashReports from '../components/CrashReports'
import AdminWeddingList from './admin/AdminWeddingList'
import AdminWeddingProfile from './admin/AdminWeddingProfile'
import { detectEscalation, getLastActivityAt } from './admin/adminUtils'
import { weddingName } from '../../shared/wedding-name.js'

// What the box says while Sonnet is still reading. A big wedding is a minute
// or two, so say that rather than leave a spinner that looks stuck.
const WAITING = 'Reading the file (large weddings take a minute or two)…'

// section_finalisations rows keyed by whatever the section was called when
// they were written, folded onto today's keys. Later writes win, so
// un-ticking a section that also has an old row still reads as un-ticked.
//
// Copied rather than imported: this is the same function as
// canonicaliseFinalisations in src/pages/Dashboard.jsx (~line 75). It is pure
// (no Dashboard state, just resolveSectionKey), so it would rather live once
// in shared/sections.js, but this agent's edits are scoped to Admin.jsx and
// AdminWeddingProfile.jsx only, so it is copied here instead of moved.
function canonicaliseFinalisations(rows) {
  const map = {}
  Object.entries(rows || {})
    .map(([storedKey, row]) => [resolveSectionKey(storedKey), row])
    .filter(([key]) => key)
    .sort((a, b) => String(a[1]?.updated_at || '').localeCompare(String(b[1]?.updated_at || '')))
    .forEach(([key, row]) => { map[key] = { ...(map[key] || {}), ...row } })
  return map
}

export default function Admin() {
  const navigate = useNavigate()
  const { error: toastError, success: toastSuccess } = useToast()
  const [notifications, setNotifications] = useState([])
  const [weddings, setWeddings] = useState([])
  // A failed load of the weddings list used to render as "no weddings yet",
  // console.error'd where nobody was looking. Distinct so the list can say so.
  const [weddingsLoadError, setWeddingsLoadError] = useState(false)
  const [allMessages, setAllMessages] = useState({}) // Messages by wedding ID
  const [loading, setLoading] = useState(true)
  const [editingWedding, setEditingWedding] = useState(null)
  const [viewingWedding, setViewingWedding] = useState(null)
  const [weddingMessages, setWeddingMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [selectedChatUser, setSelectedChatUser] = useState(null)
  const [honeybook, setHoneybook] = useState('')
  const [googleSheets, setGoogleSheets] = useState('')
  const [projectName, setProjectName] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [listSearch, setListSearch] = useState('') // searches the admin wedding list by couple/vendor
  const [showArchived, setShowArchived] = useState(false)
  const [escalations, setEscalations] = useState({})
  // Direct-message conversations keyed by wedding id — the "unread > 4h"
  // escalation signal and the last-activity fallback both read this rather
  // than re-fetching it themselves.
  const [directConversations, setDirectConversations] = useState({})
  const [planningNotes, setPlanningNotes] = useState([])
  // Section sign-offs for whichever wedding is open, canonicalised the same
  // way the couple's own menu reads them (see canonicaliseFinalisations
  // above). Keyed by canonical section key so the two marks in the venue
  // sidebar mean the same thing they do on the couple's side.
  const [sectionFinalisations, setSectionFinalisations] = useState({})
  const [activeTab, setActiveTabRaw] = useState('overview')
  const [tabHistory, setTabHistory] = useState([])

  // Wrapper around the tab setter: records the tab we're leaving so the
  // header Back button can step back through visited tabs, and scrolls the
  // new tab to the top instead of inheriting the previous tab's scroll position.
  //
  // Also the one place a tab key is resolved. Old keys still arrive here from
  // notification bodies, from the wedding list's focusTab, and from ?section=
  // in a link someone saved months ago, so 'messages' opens Sage Conversations
  // and 'direct-messages' opens the Inbox rather than nothing at all.
  const setActiveTab = (tab) => {
    const key = resolveSectionKey(tab) || 'overview'
    setActiveTabRaw((prev) => {
      if (key !== prev) setTabHistory((h) => [...h, prev])
      return key
    })
    window.scrollTo(0, 0)
  }

  // Header Back button: pop to the last visited tab; once the tab history is
  // exhausted, fall back to closing the profile (returning to the wedding list).
  const goBack = () => {
    if (tabHistory.length === 0) {
      closeProfile()
      return
    }
    setActiveTabRaw(tabHistory[tabHistory.length - 1])
    setTabHistory((h) => h.slice(0, -1))
    window.scrollTo(0, 0)
  }
  const [showUsageStats, setShowUsageStats] = useState(false) // Collapsed by default on mobile
  const [uploadingContract, setUploadingContract] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [contractQuestion, setContractQuestion] = useState('')
  const [contractAnswer, setContractAnswer] = useState('')
  const [askingQuestion, setAskingQuestion] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailCanSend, setGmailCanSend] = useState(true)
  const [gmailSyncing, setGmailSyncing] = useState(false)
  // Set once a dry run has found bodies worth recovering, so the button can
  // change from "count them" to "file them".
  const [bodyBackfillPlanned, setBodyBackfillPlanned] = useState(false)
  const [gmailStatus, setGmailStatus] = useState('')
  const [quoConnected, setQuoConnected] = useState(false)
  const [quoSyncing, setQuoSyncing] = useState(false)
  const [quoStatus, setQuoStatus] = useState('')
  const [zoomConnected, setZoomConnected] = useState(false)
  const [zoomSyncing, setZoomSyncing] = useState(false)
  const [zoomStatus, setZoomStatus] = useState('')
  // How many people are coming who have not booked. Counted on the way in
  // rather than when the tab is opened, for the same reason the worksheets tab
  // is badged: a number you only see after going looking is not a signal.
  const [tourCount, setTourCount] = useState(0)
  // Meetings the matcher would not guess at, and the wedding you picked for each.
  const [reviewItems, setReviewItems] = useState([])
  // Name and relationship typed against a queued caller, so filing them also
  // saves the number and the queue stops asking.
  const [reviewContact, setReviewContact] = useState({})
  const [crashCount, setCrashCount] = useState(0)
  const [reviewChoice, setReviewChoice] = useState({})
  const [reviewBusy, setReviewBusy] = useState(null)
  // "Someone else" was picked for this review item, so its select shows the
  // full wedding list instead of the (usually one) name the matcher suggested.
  const [reviewShowAll, setReviewShowAll] = useState({})
  const [notesHighlights, setNotesHighlights] = useState('')
  const [loadingHighlights, setLoadingHighlights] = useState(false)
  // Which wedding is on screen right now, readable from inside a poll that
  // started a minute ago. A briefing takes long enough that she can open
  // another couple while it is being written, and an answer must never land in
  // the wrong wedding's box.
  const openWeddingRef = useRef(null)
  // Checked on every pass of a background poll (followSyncJob) and every tick
  // of a job-await (awaitAnswerJob) so navigating away from Admin entirely —
  // not just closing one wedding's profile — actually stops the polling
  // rather than leaving it running against a page that no longer exists.
  const cancelledRef = useRef(false)
  // One controller for the life of this page. awaitAnswerJob polls (highlights,
  // contract Q&A) pass its signal so they stop between polls on unmount rather
  // than running to their five-minute timeout regardless.
  const abortRef = useRef(null)
  if (!abortRef.current) abortRef.current = new AbortController()
  const [notesSearchQuery, setNotesSearchQuery] = useState('')
  const [collapsedNoteCategories, setCollapsedNoteCategories] = useState({})
  const [sortBy, setSortBy] = useState('lastActivity') // 'lastActivity' or 'weddingDate'
  const [uncertainQuestions, setUncertainQuestions] = useState([])
  // Logins with no wedding attached — see /api/admin/unlinked-profiles.
  const [unlinkedProfiles, setUnlinkedProfiles] = useState([])
  const [answeringQuestion, setAnsweringQuestion] = useState(null)
  const [adminAnswer, setAdminAnswer] = useState('')
  const [addToKb, setAddToKb] = useState(false)
  const [kbCategory, setKbCategory] = useState('')
  const [kbSubcategory, setKbSubcategory] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)
  // Alerting the couple after we've corrected Sage. Sage tells them the team
  // will follow up, so something has to actually follow up.
  const [alertingQuestion, setAlertingQuestion] = useState(null)
  // Sage questions arrive collapsed. There are routinely dozens and each one
  // carries Sage's full reply, so an expanded list buries everything else on
  // the page. The question itself stays readable; tap to open the rest.
  const [expandedQuestions, setExpandedQuestions] = useState(() => new Set())
  const toggleQuestion = (id) => setExpandedQuestions(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const [clientMessage, setClientMessage] = useState('')
  const [draftingMessage, setDraftingMessage] = useState(false)
  const [sendingAlert, setSendingAlert] = useState(false)
  const [couplePhotos, setCouplePhotos] = useState({}) // weddingId -> photo URL
  const [enlargedPhoto, setEnlargedPhoto] = useState(null) // URL for enlarged photo modal
  const [mainView, setMainView] = useState('weddings') // 'weddings', 'knowledge-base', 'usage', 'meetings', 'messages', 'vendors'
  const [showUncertainModal, setShowUncertainModal] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [timelineSummary, setTimelineSummary] = useState(null) // Quick view of timeline data
  const [tableSummary, setTableSummary] = useState(null) // Quick view of table data
  const [staffingSummary, setStaffingSummary] = useState(null) // Quick view of staffing estimate
  const [sharedBudget, setSharedBudget] = useState(null) // Shared budget (only if is_shared=true)
  const [internalNotes, setInternalNotes] = useState([])
  // Which of viewWeddingProfile's ten parallel loads failed, keyed the same
  // way as PANEL_LABELS there — read by AdminWeddingProfile to swap an empty
  // state for a "could not load, retry" line instead of a false "no data yet".
  const [sectionLoadErrors, setSectionLoadErrors] = useState({})
  const [newNoteText, setNewNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showGuestCare, setShowGuestCare] = useState(false)
  const [activities, setActivities] = useState([]) // Recent client activities
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [borrowSelections, setBorrowSelections] = useState([]) // Borrow items couple selected
  // Admin add catalog item form
  const [showAddItemForm, setShowAddItemForm] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemImage, setNewItemImage] = useState(null)
  const [savingNewItem, setSavingNewItem] = useState(false)
  const [addItemResult, setAddItemResult] = useState(null)
  const [borrowCatalogRefreshKey, setBorrowCatalogRefreshKey] = useState(0)
  const [unansweredCount, setUnansweredCount] = useState(0)
  // Admin interject into Sage chat
  const [injectText, setInjectText] = useState('')
  const [injectKb, setInjectKb] = useState(false)
  const [injectKbCat, setInjectKbCat] = useState('')
  const [injecting, setInjecting] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkedIn, setCheckedIn] = useState(false)
  const [confirmDeleteQuestionId, setConfirmDeleteQuestionId] = useState(null)
  const [confirmIgnoreItem, setConfirmIgnoreItem] = useState(null)
  const [confirmClearZoom, setConfirmClearZoom] = useState(false)
  const [last24h, setLast24h] = useState({ signups: [], activity: [] })
  const [last24hLoading, setLast24hLoading] = useState(true)
  // The last 20 sync runs, whatever kind. Lifted out of the old sidebar panel
  // because two things read it now: the Integrations card, for what each
  // integration's last run actually did, and "Needs you", for a run that
  // failed today. Fetching it twice would be two answers to one question.
  const [syncJobs, setSyncJobs] = useState([])
  const [syncJobsLoading, setSyncJobsLoading] = useState(true)
  const [syncJobsError, setSyncJobsError] = useState(false)
  // Sync history is behind a link on the Integrations card. A failed-sync row
  // in "Needs you" opens it, which is why the flag lives up here.
  const [historyOpen, setHistoryOpen] = useState(false)
  // Whole /status payloads. Quo and Zoom already report last_status,
  // last_finished_at and last_error; Gmail does not, and falls back to the
  // sync-jobs list. See the note on checkGmailStatus.
  const [gmailInfo, setGmailInfo] = useState(null)
  const [quoInfo, setQuoInfo] = useState(null)
  const [zoomInfo, setZoomInfo] = useState(null)

  // Keep unanswered count in sync with loaded uncertain questions
  useEffect(() => {
    setUnansweredCount(uncertainQuestions.filter(q => !q.admin_answer).length)
  }, [uncertainQuestions])

  const fetchUnreadMessages = async () => {
    try {
      const data = await loadJson(`${API_URL}/api/messages/admin/unread`)
      setUnreadMessages(data.total || 0)
    } catch (err) {
      console.error('Failed to fetch unread count:', err)
    }
  }

  const loadTourCount = async () => {
    try {
      const d = await apiFetch(`${API_URL}/api/admin/enquiries`)
      setTourCount((d.enquiries || []).filter(e => !e.wedding_id && e.status !== 'lost').length)
    } catch {
      // The tab still works; only the badge is missing. Not worth a toast.
    }
  }

  /**
   * The last twenty sync runs. Read once here rather than by the panel that
   * happens to be open, so the Integrations rows and the failed-sync group in
   * "Needs you" cannot disagree about what happened.
   */
  const loadSyncJobs = async () => {
    try {
      const data = await apiFetch(`${API_URL}/api/admin/sync-jobs?limit=20`)
      setSyncJobs(data.jobs || [])
      setSyncJobsError(false)
    } catch {
      setSyncJobsError(true)
    }
    setSyncJobsLoading(false)
  }

  const reloadSyncJobs = () => { setSyncJobsLoading(true); loadSyncJobs() }

  useEffect(() => {
    loadData()
    loadReviewItems()
    loadCrashCount()
    loadTourCount()
    loadSyncJobs()
    checkGmailStatus()
    checkQuoStatus()
    checkZoomStatus()
    loadUncertainQuestions()
    loadUnlinkedProfiles()
    loadAllCouplePhotos()
    fetchUnreadMessages()
    const interval = setInterval(fetchUnreadMessages, 60000)
    return () => { clearInterval(interval); cancelledRef.current = true; abortRef.current?.abort() }
  }, [])

  const checkGmailStatus = async () => {
    try {
      const data = await loadJson(`${API_URL}/api/gmail/status`)
      setGmailConnected(data.connected)
      // Defaults to true so an older server that does not report it does not
      // put a warning on the screen that nobody can act on.
      setGmailCanSend(data.canSend !== false)
      // Unlike /api/quo/status and /api/zoom/status, this route does not
      // spread lastSyncJob() into its answer, so there is no last_status or
      // last_finished_at here to read. The Integrations row falls back to the
      // sync_jobs list for Gmail. Adding `...(await lastSyncJob(['gmail',
      // 'gmail-backfill']))` at server/index.js:3969 would close that gap.
      setGmailInfo(data)
    } catch (err) {
      console.error('Gmail status check error:', err)
    }
  }

  const connectGmail = async () => {
    try {
      const data = await apiFetch(`${API_URL}/api/gmail/auth`)
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (err) {
      toastError(`Could not connect Gmail: ${err.message}`)
    }
  }

  const syncEmails = async () => {
    setGmailSyncing(true)
    setGmailStatus('')
    try {
      const data = await apiFetch(`${API_URL}/api/gmail/sync`, { method: 'POST' })
      setGmailStatus(data.message || data.error)
      // Only the review queue and the open wedding's notes can have changed —
      // not every wedding's whole Sage history, which loadData would redo.
      await refreshAfterSync()
    } catch (err) {
      setGmailStatus('Failed to sync emails')
      toastError(`Could not sync Gmail: ${err.message}`)
    }
    setGmailSyncing(false)
  }

  /**
   * The emails that came in with no body, read again properly.
   *
   * Always counts before it writes. The first press reports what it found and
   * changes nothing; the second does the work. That is deliberate — this
   * rewrites the body of mail already on file and extracts planning notes onto
   * couples, and neither should happen because a button was near the mouse.
   */
  const recoverEmailBodies = async (apply = false) => {
    setGmailSyncing(true)
    setGmailStatus(apply ? 'Reading them again and filing the notes…' : 'Counting what can be recovered…')
    try {
      const data = await apiFetch(`${API_URL}/api/gmail/backfill-bodies`, {
        method: 'POST',
        body: JSON.stringify({ apply }),
      })
      if (!data.jobId) {
        setGmailStatus(data.message || data.error || 'It did not start')
      } else {
        const job = await followSyncJob(data.jobId, {
          kind: 'gmail-backfill',
          setStatus: setGmailStatus,
          noun: 'emails',
          describeDone: (j) => {
            const d = j.detail || {}
            const bits = [`${d.recovered || 0} of ${d.looked || 0} emails have a body after all`]
            if (d.notesExtracted) bits.push(`${d.notesExtracted} planning notes filed`)
            if (d.documentsFiled) bits.push(`${d.documentsFiled} attached document${d.documentsFiled === 1 ? '' : 's'} filed as contracts`)
            if (d.stillEmpty) bits.push(`${d.stillEmpty} genuinely have no words in them`)
            if (d.gone) bits.push(`${d.gone} no longer in the mailbox`)
            if (d.failed) bits.push(`${d.failed} failed, see the server log`)
            return (apply ? 'Done. ' : 'Nothing written yet. ') + bits.join(', ')
              + (apply ? '' : ' Press Recover again to file them.')
          },
        })
        setBodyBackfillPlanned(!apply && (job?.detail?.recovered || 0) > 0)
        if (apply) loadData()
      }
    } catch (err) {
      setGmailStatus('Could not recover the missing bodies')
      toastError(`Could not recover the missing bodies: ${err.message}`)
    }
    setGmailSyncing(false)
  }

  const disconnectGmail = async () => {
    try {
      await apiFetch(`${API_URL}/api/gmail/disconnect`, { method: 'POST' })
      setGmailConnected(false)
      setGmailStatus('Gmail disconnected')
    } catch (err) {
      toastError(`Could not disconnect Gmail: ${err.message}`)
    }
  }

  const checkQuoStatus = async () => {
    try {
      const data = await loadJson(`${API_URL}/api/quo/status`)
      setQuoConnected(data.connected)
      setQuoInfo(data)
    } catch (err) {
      console.error('Quo status check error:', err)
    }
  }

  const syncQuo = async (forceReprocess = false) => {
    setQuoSyncing(true)
    setQuoStatus(forceReprocess ? 'Force resyncing all messages...' : 'Syncing new messages...')
    try {
      console.log('Calling Quo sync with forceReprocess:', forceReprocess)
      const data = await apiFetch(`${API_URL}/api/quo/sync`, {
        method: 'POST',
        body: JSON.stringify({ forceReprocess, confirm: forceReprocess })
      })
      console.log('Quo sync response:', data)

      let statusMsg = data.message || data.error || 'Sync completed'
      // Show debug info if available
      if (data.debug) {
        const d = data.debug
        statusMsg += `\n📊 ${d.profileCount} profiles, ${d.profilesWithWeddingId} with wedding`
        statusMsg += `\n📱 Registered: ${d.registeredPhones?.join(', ') || 'none'}`
        statusMsg += `\n📞 Quo phones: ${d.quoPhoneCount} (${d.quoPhoneNumbers?.join(', ') || 'none'})`
        statusMsg += `\n📨 Found ${d.totalMessagesFound || 0} msgs, ${d.totalCallsFound || 0} calls`
        statusMsg += `\n📝 Planning notes saved: ${data.planningNotesSaved || 0}`
        if (d.planningNotesErrors?.length > 0) {
          statusMsg += `\n⚠️ Errors: ${d.planningNotesErrors.map(e => e.error).join(', ')}`
        }
        if (d.sampleMessages?.length > 0) {
          const sample = d.sampleMessages[0]
          statusMsg += `\n🔍 Sample: ${sample.body || 'no body'}`
        }
      } else {
        statusMsg += '\n(No debug info returned)'
      }
      setQuoStatus(statusMsg)
      await refreshAfterSync()
    } catch (err) {
      console.error('Quo sync error:', err)
      setQuoStatus('Failed to sync: ' + err.message + '\nCheck console for details')
      toastError(`Could not sync Quo: ${err.message}`)
    }
    setQuoSyncing(false)
  }

  /**
   * Everyone who has rung the Rixey line and is not a client or a saved
   * contact. Fills the review queue rather than filing anything.
   */
  const sweepCallers = async () => {
    setQuoSyncing(true)
    setQuoStatus('Looking for numbers nobody has accounted for...')
    try {
      const data = await apiFetch(`${API_URL}/api/quo/sweep-callers`, {
        method: 'POST',
        body: JSON.stringify({ sinceDays: 90 }),
      })
      setQuoStatus(data.message || 'Sweep started. It runs in the background.')
      loadReviewItems()
    } catch (err) {
      setQuoStatus('Could not sweep for callers: ' + err.message)
      toastError(`Could not sweep for callers: ${err.message}`)
    }
    setQuoSyncing(false)
  }

  const checkZoomStatus = async () => {
    try {
      const data = await loadJson(`${API_URL}/api/zoom/status`)
      setZoomConnected(data.connected)
      setZoomInfo(data)
    } catch (err) {
      console.error('Zoom status check error:', err)
    }
  }

  const connectZoom = async () => {
    try {
      const data = await apiFetch(`${API_URL}/api/zoom/auth`)
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (err) {
      toastError(`Could not connect Zoom: ${err.message}`)
    }
  }

  // Meetings the matcher would not file on a guess. Loaded on the way in so
  // they are sitting there waiting, rather than needing to be gone looking for.
  // How many crashes are waiting. Loaded on the way in, like the review items,
  // so a broken page announces itself rather than waiting to be found.
  const loadCrashCount = async () => {
    try {
      const data = await apiFetch(`${API_URL}/api/admin/client-errors`)
      setCrashCount((data || []).filter(r => r.status !== 'done').length)
    } catch {
      // Usually migration 026 has not been run. The Errors screen says so
      // properly; the badge just stays quiet rather than crying wolf.
    }
  }

  const loadReviewItems = async () => {
    try {
      const data = await apiFetch(`${API_URL}/api/admin/ingest-review`)
      setReviewItems(data.items || [])
    } catch (err) {
      console.error('Could not load meetings needing review:', err)
    }
  }

  const assignReviewItem = async (item) => {
    const weddingId = reviewChoice[item.id] || item.suggested_wedding_id
    if (!weddingId) return
    setReviewBusy(item.id)
    try {
      // Naming the caller does two things: it files these calls, and it stops
      // the queue asking about that number ever again.
      const contact = reviewContact[item.id]
      const data = await apiFetch(`${API_URL}/api/admin/ingest-review/${item.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          weddingId,
          contact: contact?.name?.trim() ? contact : undefined,
        }),
      })
      setReviewItems(prev => prev.filter(i => i.id !== item.id))
      toastSuccess(
        data.callsFiled
          ? `${data.callsFiled} call${data.callsFiled === 1 ? '' : 's'} filed${data.remembered ? ', and that number is saved to the wedding' : ''}`
          : `Filed, and pulled ${data.notesExtracted} planning notes out of it`
      )
      if (viewingWedding) await loadPlanningNotesForWedding(viewingWedding.id)
    } catch (err) {
      toastError(`Could not file that: ${err.message}`)
    }
    setReviewBusy(null)
  }

  const ignoreReviewItem = async (item) => {
    setReviewBusy(item.id)
    try {
      await apiFetch(`${API_URL}/api/admin/ingest-review/${item.id}/ignore`, { method: 'POST' })
      setReviewItems(prev => prev.filter(i => i.id !== item.id))
    } catch (err) {
      toastError(`Could not dismiss that: ${err.message}`)
    }
    setReviewBusy(null)
  }

  /**
   * The sync now answers straight away and works in the background, so this
   * follows the job instead of holding a request open for minutes. The old way
   * died partway through on 14 August and reported itself as a CORS error,
   * having quietly skipped the two newest meetings.
   *
   * Zoom is the default because Zoom is what it was written for. Any other
   * background job passes its own kind, its own status setter and its own word
   * for what it is counting.
   */
  const followSyncJob = async (jobId, opts = {}) => {
    const { kind = 'zoom', setStatus = setZoomStatus, noun = 'meetings', describeDone } = opts
    const started = Date.now()
    while (Date.now() - started < 20 * 60 * 1000) {
      if (cancelledRef.current) return null
      await new Promise(r => setTimeout(r, 4000))
      if (cancelledRef.current) return null
      let job
      try {
        const data = await apiFetch(`${API_URL}/api/admin/sync-jobs?kind=${kind}&limit=10`)
        job = (data.jobs || []).find(j => j.id === jobId)
      } catch {
        continue                       // a blip in polling is not a failed sync
      }
      if (!job) continue

      const seen = job.total ? ` of ${job.total}` : ''
      if (job.status === 'running' && !job.stalled) {
        setStatus(`Working: ${job.processed}${seen} ${noun}${job.last_item ? ` — ${job.last_item}` : ''}`)
        continue
      }
      if (job.stalled) {
        setStatus(`Stopped after ${job.processed}${seen} ${noun}. Press Sync again to carry on from there.`)
        return job
      }
      if (job.status === 'failed') {
        setStatus(`Failed after ${job.processed}${seen}: ${job.last_error || 'unknown error'}`)
        return job
      }
      if (describeDone) {
        setStatus(describeDone(job))
        return job
      }
      // "0 of 10 meetings, 0 filed to couples" is what a run reports when
      // every recording is already on file — which is a healthy sync, and
      // reads exactly like a broken one. The server now says which kind of
      // nothing it was, so lead with that.
      setStatus(
        `Done. ${job.detail?.message || `${job.processed}${seen} ${noun}, ${job.matched} filed to couples`}`
        + (job.needs_review ? ` ${job.needs_review} need you to say whose they are.` : '')
        + (job.failed ? ` ${job.failed} skipped.` : '')
      )
      return job
    }
    setStatus('Still running after 20 minutes — check the sync history.')
    return null
  }

  const syncZoom = async () => {
    setZoomSyncing(true)
    setZoomStatus('')
    try {
      const data = await apiFetch(`${API_URL}/api/zoom/sync`, { method: 'POST' })
      if (!data.jobId) {
        setZoomStatus(data.message || data.error || 'Sync did not start')
      } else {
        setZoomStatus('Started. Looking at Zoom…')
        await followSyncJob(data.jobId)
        await refreshAfterSync()
      }
    } catch (err) {
      setZoomStatus('Failed to sync Zoom meetings')
      toastError(`Could not sync Zoom: ${err.message}`)
    }
    setZoomSyncing(false)
  }

  const reextractZoom = async () => {
    setZoomSyncing(true)
    setZoomStatus('')
    try {
      // Answers with a job id now rather than the finished result — this runs
      // as a sync job like the others, so follow it instead of assuming it is
      // already done by the time the request returns.
      const data = await apiFetch(`${API_URL}/api/zoom/reextract`, { method: 'POST' })
      if (!data.jobId) {
        setZoomStatus(data.message || data.error || 'Did not start')
      } else {
        setZoomStatus(data.message || 'Started. Re-reading Zoom transcripts…')
        await followSyncJob(data.jobId, { kind: 'zoom-reextract' })
        await refreshAfterSync()
      }
      loadData()
    } catch (err) {
      setZoomStatus('Failed to re-extract notes')
      toastError(`Could not re-extract Zoom notes: ${err.message}`)
    }
    setZoomSyncing(false)
  }

  // The button still just calls clearZoom() — the confirm step is a dialog
  // now rather than a blocking window.confirm, so the actual clear waits for
  // performClearZoom below.
  const clearZoom = () => setConfirmClearZoom(true)

  const performClearZoom = async () => {
    setConfirmClearZoom(false)
    setZoomSyncing(true)
    setZoomStatus('')
    try {
      const data = await apiFetch(`${API_URL}/api/zoom/clear`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      })
      const count = data.count ?? data.cleared ?? data.removed ?? data.deleted
      setZoomStatus(
        count != null ? `${data.message || 'Cleared'} (${count} removed)` : (data.message || data.error)
      )
    } catch (err) {
      setZoomStatus('Failed to clear Zoom data')
      toastError(`Could not clear Zoom data: ${err.message}`)
    }
    setZoomSyncing(false)
  }

  const disconnectZoom = async () => {
    try {
      await apiFetch(`${API_URL}/api/zoom/disconnect`, { method: 'POST' })
      setZoomConnected(false)
      setZoomStatus('Zoom disconnected')
    } catch (err) {
      toastError(`Could not disconnect Zoom: ${err.message}`)
    }
  }

  /**
   * The briefing on file, shown on opening a profile.
   *
   * An empty box used to mean "nobody has generated this", which is the same
   * thing it looked like after a 502. Now the last one written is on screen
   * with its age, and the existing Generate Highlights button is the
   * regenerate button.
   */
  const loadLatestHighlights = async (weddingId) => {
    try {
      const job = await apiFetch(
        `${API_URL}/api/answer-jobs/latest?kind=highlights&weddingId=${weddingId}`
      )
      if (!job?.answer) return
      if (openWeddingRef.current !== weddingId) return
      setNotesHighlights(`Generated ${timeAgo(job.finished_at)}\n\n${job.answer}`)
    } catch {
      // Nothing on file, or it could not be read. The button still works.
    }
  }

  /**
   * Ask for a briefing and wait for it.
   *
   * The POST comes back in milliseconds with a job id; Sonnet is still reading
   * for the next minute or two. Nothing is held open, so nothing hits Railway's
   * fifty-second proxy timeout, and pressing the button a second time inside
   * three minutes joins the job already running rather than paying for another
   * full call.
   */
  const getNotesHighlights = async () => {
    if (!viewingWedding) return
    const weddingId = viewingWedding.id
    setLoadingHighlights(true)
    setNotesHighlights(WAITING)

    try {
      const started = await apiFetch(`${API_URL}/api/notes-highlights`, {
        method: 'POST',
        body: JSON.stringify({ weddingId })
      })
      const job = await awaitAnswerJob(started?.jobId, {
        signal: abortRef.current?.signal,
        onTick: (secs) => {
          if (openWeddingRef.current !== weddingId) return
          setNotesHighlights(`${WAITING} ${secs}s`)
        }
      })
      if (openWeddingRef.current !== weddingId) return
      setNotesHighlights(job.answer || 'Nothing came back. Try again.')
    } catch (err) {
      if (cancelledRef.current) return   // navigated away — not a real failure
      if (openWeddingRef.current === weddingId) setNotesHighlights('Failed to generate highlights')
      toastError(`Could not generate highlights: ${err.message}`)
    }
    setLoadingHighlights(false)
  }

  const loadUncertainQuestions = async () => {
    try {
      const data = await loadJson(`${API_URL}/api/uncertain-questions`)
      setUncertainQuestions(data.questions || [])
    } catch (err) {
      console.error('Failed to load uncertain questions:', err)
    }
  }

  const loadUnlinkedProfiles = async () => {
    try {
      setUnlinkedProfiles((await loadJson(`${API_URL}/api/admin/unlinked-profiles`)) || [])
    } catch (err) {
      console.error('Failed to load unlinked profiles:', err)
    }
  }

  const injectNote = async (userId) => {
    if (!injectText.trim() || injecting) return
    setInjecting(true)
    try {
      const data = await apiFetch(`${API_URL}/api/sage-messages/inject`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          content: injectText.trim(),
          addToKb: injectKb,
          kbCategory: injectKbCat || 'General'
        })
      })
      if (data.message) {
        setWeddingMessages(prev => [...prev, data.message])
        setInjectText('')
        setInjectKb(false)
        setInjectKbCat('')
      }
    } catch (err) {
      toastError(`Could not inject note: ${err.message}`)
    }
    setInjecting(false)
  }

  const loadAllCouplePhotos = async () => {
    try {
      // Load couple photos via server endpoint (bypasses RLS)
      const data = await loadJson(`${API_URL}/api/couple-photos/all`)

      if (data.photos) {
        const photoMap = {}
        data.photos.forEach(p => {
          photoMap[p.wedding_id] = p.image_url
        })
        setCouplePhotos(photoMap)
      }
    } catch (err) {
      console.error('Failed to load couple photos:', err)
    }
  }

  const submitAnswer = async (questionId) => {
    if (!adminAnswer.trim()) return

    setSubmittingAnswer(true)
    try {
      const data = await apiFetch(`${API_URL}/api/uncertain-questions/${questionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({
          answer: adminAnswer,
          addToKnowledgeBase: addToKb,
          kbCategory: addToKb ? kbCategory : null,
          kbSubcategory: addToKb ? kbSubcategory : null
        })
      })
      if (data.success) {
        // Don't drop the question off the list yet. Sage told this couple the
        // team would come back to them, so the answer isn't finished until
        // they've been told. Move straight to the send step, pre-filled.
        setUncertainQuestions(prev => prev.map(q =>
          q.id === questionId ? { ...q, ...(data.question || {}), admin_answer: adminAnswer } : q
        ))
        setAnsweringQuestion(null)
        setAlertingQuestion(questionId)
        setClientMessage(adminAnswer)
        setAdminAnswer('')
        setAddToKb(false)
        setKbCategory('')
        setKbSubcategory('')
      }
    } catch (err) {
      toastError(`Could not submit answer: ${err.message}`)
    }
    setSubmittingAnswer(false)
  }

  const draftClientMessage = async (questionId, answer) => {
    setDraftingMessage(true)
    try {
      const data = await apiFetch(`${API_URL}/api/uncertain-questions/${questionId}/draft-client-message`, {
        method: 'POST',
        body: JSON.stringify({ answer })
      })
      if (data.draft) setClientMessage(data.draft)
    } catch (err) {
      toastError(`Could not draft the message: ${err.message}`)
    }
    setDraftingMessage(false)
  }

  const sendClientAlert = async (questionId) => {
    if (!clientMessage.trim()) return
    setSendingAlert(true)
    try {
      const data = await apiFetch(`${API_URL}/api/uncertain-questions/${questionId}/alert-client`, {
        method: 'POST',
        body: JSON.stringify({ message: clientMessage })
      })
      if (data.success) {
        setUncertainQuestions(prev => prev.filter(q => q.id !== questionId))
        setAlertingQuestion(null)
        setClientMessage('')
        toastSuccess(data.couple
          ? `Sent to ${data.couple} — it's in their Inbox`
          : "Sent — it's in their Inbox")
        if (data.recorded === false) {
          toastError('Sent, but it could not be recorded against the question. Migration 009 may not be applied yet.')
        }
      }
    } catch (err) {
      toastError(`Could not send to the client: ${err.message}`)
    }
    setSendingAlert(false)
  }

  const skipClientAlert = (questionId) => {
    setUncertainQuestions(prev => prev.filter(q => q.id !== questionId))
    setAlertingQuestion(null)
    setClientMessage('')
  }

  const deleteUncertainQuestion = async (questionId) => {
    const snapshot = uncertainQuestions
    setUncertainQuestions(prev => prev.filter(q => q.id !== questionId))
    try {
      await apiFetch(`${API_URL}/api/uncertain-questions/${questionId}`, {
        method: 'DELETE'
      })
    } catch (err) {
      setUncertainQuestions(snapshot)
      toastError(`Could not delete question: ${err.message}`)
    }
  }

  const loadData = async () => {
    // Load notifications via server endpoint (bypasses RLS)
    try {
      const notifsData = await loadJson(`${API_URL}/api/admin/notifications`)
      setNotifications(notifsData.notifications || [])
    } catch (err) {
      console.error('Failed to load notifications:', err)
      setNotifications([])
    }

    // Auto-archive weddings whose date has passed before loading, so the active
    // list stays current. Best-effort: if it fails we still load what's there —
    // apiFetch so a real failure at least reaches the console with a reason.
    try {
      await apiFetch(`${API_URL}/api/admin/weddings/archive-past`, { method: 'POST' })
    } catch (err) {
      console.error('Auto-archive past weddings failed:', err)
    }

    // Load weddings with profiles via server endpoint (bypasses RLS). The main
    // read for this whole page — a failure here used to render as "no
    // weddings yet" with nothing but a console.error, indistinguishable from a
    // brand new, empty install.
    let weddingsData = []
    try {
      const weddingsJson = await loadJson(`${API_URL}/api/admin/weddings`)
      weddingsData = weddingsJson.weddings || []
      setWeddings(weddingsData)
      setWeddingsLoadError(false)
    } catch (err) {
      console.error('Failed to load weddings:', err)
      setWeddings([])
      setWeddingsLoadError(true)
    }

    // Load last 24h activity summary
    try {
      const d = await loadJson(`${API_URL}/api/admin/last-24h`)
      setLast24h({ signups: d.signups || [], activity: d.activity || [] })
    } catch {
      // A missing "last 24h" panel is not worth its own error state.
    }
    setLast24hLoading(false)

    // Direct-message conversations — the "unread > 4h" escalation signal and
    // the last-activity fallback for couples who only ever message directly.
    let directConvByWedding = {}
    try {
      const convData = await apiFetch(`${API_URL}/api/messages/admin/conversations`)
      ;(convData.conversations || []).forEach(c => { directConvByWedding[c.wedding_id] = c })
    } catch (err) {
      console.error('Failed to load direct-message conversations:', err)
    }
    setDirectConversations(directConvByWedding)

    // Load Sage messages for escalation detection via server (bypasses RLS).
    // Scoped to the last 30 days — escalation only ever looks at the last
    // week anyway, and this is what stops one admin tab re-downloading the
    // whole history of every wedding's chat after every sync and upload.
    if (weddingsData && weddingsData.length > 0) {
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const messagesData = await loadJson(`${API_URL}/api/sage-messages/all?since=${encodeURIComponent(since)}`)
        const messages = messagesData.messages || []

        // Group messages by wedding
        const msgByWedding = {}
        const escalationByWedding = {}

        weddingsData.forEach(wedding => {
          const userIds = wedding.profiles?.map(p => p.id) || []
          const weddingMsgs = messages.filter(m => userIds.includes(m.user_id))
          msgByWedding[wedding.id] = weddingMsgs
          escalationByWedding[wedding.id] = detectEscalation(weddingMsgs, wedding.escalation_handled_at, directConvByWedding[wedding.id])
        })

        setAllMessages(msgByWedding)
        setEscalations(escalationByWedding)
      } catch (err) {
        console.error('Failed to load messages for escalation detection:', err)
      }
    }

    setLoading(false)
  }

  // Re-runs just the review queue and (if a profile is open) that wedding's
  // planning notes, instead of loadData's full reload. A sync or upload can
  // only ever touch those two things, so refetching everyone's Sage history
  // and every wedding row again was wasted bandwidth on every button press.
  const refreshAfterSync = async () => {
    await loadReviewItems()
    // The Integrations rows and the failed-sync group both read this, so a run
    // that has just finished should be on the screen without a reload.
    await loadSyncJobs()
    if (viewingWedding) await loadPlanningNotesForWedding(viewingWedding.id)
  }

  const loadPlanningNotesForWedding = async (weddingId) => {
    try {
      const data = await apiFetch(`${API_URL}/api/planning-notes/${weddingId}`)
      setPlanningNotes(data.notes || [])
    } catch (err) {
      toastError(`Could not refresh planning notes: ${err.message}`)
    }
  }

  const markAsRead = async (id) => {
    const snapshot = notifications
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ))
    try {
      await apiFetch(`${API_URL}/api/admin/notifications/${id}/read`, {
        method: 'PUT'
      })
    } catch (err) {
      setNotifications(snapshot)
      toastError(`Could not mark notification as read: ${err.message}`)
    }
  }

  const startEditing = (wedding) => {
    setEditingWedding(wedding.id)
    setHoneybook(wedding.honeybook_link || '')
    setGoogleSheets(wedding.google_sheets_link || '')
    setProjectName(wedding.project_name || '')
  }

  const saveLinks = async () => {
    setSaving(true)
    try {
      await apiFetch(`${API_URL}/api/weddings/${editingWedding}/links`, {
        method: 'PUT',
        body: JSON.stringify({
          honeybook_link: honeybook || null,
          google_sheets_link: googleSheets || null,
          project_name: projectName.trim() || null
        })
      })
      setWeddings(weddings.map(w =>
        w.id === editingWedding
          ? { ...w, honeybook_link: honeybook || null, google_sheets_link: googleSheets || null, project_name: projectName.trim() || null }
          : w
      ))
      setEditingWedding(null)
    } catch (err) {
      toastError(`Could not save links: ${err.message}`)
    }
    setSaving(false)
  }

  // Rename a wedding's workspace from the profile header. Reuses the links
  // endpoint, which only touches project_name when it's sent.
  const updateProjectName = async (weddingId, name) => {
    const trimmed = (name || '').trim() || null
    await apiFetch(`${API_URL}/api/weddings/${weddingId}/links`, {
      method: 'PUT',
      body: JSON.stringify({ project_name: trimmed })
    })
    setWeddings(prev => prev.map(w => w.id === weddingId ? { ...w, project_name: trimmed } : w))
    setViewingWedding(prev => (prev && prev.id === weddingId ? { ...prev, project_name: trimmed } : prev))
  }

  const toggleArchive = async (weddingId, currentArchived) => {
    const snapshot = weddings
    setWeddings(weddings.map(w =>
      w.id === weddingId ? { ...w, archived: !currentArchived } : w
    ))
    setViewingWedding(prev => (prev && prev.id === weddingId ? { ...prev, archived: !currentArchived } : prev))
    try {
      await apiFetch(`${API_URL}/api/weddings/${weddingId}/archive`, {
        method: 'PUT',
        body: JSON.stringify({ archived: !currentArchived })
      })
    } catch (err) {
      setWeddings(snapshot)
      setViewingWedding(prev => (prev && prev.id === weddingId ? { ...prev, archived: currentArchived } : prev))
      toastError(`Could not ${currentArchived ? 'unarchive' : 'archive'} wedding: ${err.message}`)
    }
  }

  const markEscalationHandled = async (weddingId) => {
    const now = new Date().toISOString()
    const weddingsSnapshot = weddings
    const escalationsSnapshot = escalations
    setWeddings(weddings.map(w =>
      w.id === weddingId ? { ...w, escalation_handled_at: now } : w
    ))
    setEscalations(prev => ({
      ...prev,
      [weddingId]: { hasEscalation: false, count: 0, messages: [] }
    }))
    try {
      await apiFetch(`${API_URL}/api/weddings/${weddingId}/escalation`, {
        method: 'PUT',
        body: JSON.stringify({ escalation_handled_at: now })
      })
    } catch (err) {
      setWeddings(weddingsSnapshot)
      setEscalations(escalationsSnapshot)
      toastError(`Could not mark escalation handled: ${err.message}`)
    }
  }


  const viewWeddingProfile = async (wedding, opts = {}) => {
    const { focusUserId, focusTab } = opts
    setViewingWedding(wedding)
    openWeddingRef.current = wedding.id
    setLoadingMessages(true)
    setSearchQuery('')
    setNotesSearchQuery('')
    setNotesHighlights('')
    // Show the briefing she already has, with its age, rather than an empty
    // box that costs a minute and a Sonnet call to fill.
    loadLatestHighlights(wedding.id)
    // Wiped on entry as well as on close: without this, opening a second
    // wedding straight after the first could show its stale contract Q&A,
    // its upload result, its collapsed note categories or a half-typed Sage
    // injection, all belonging to whichever wedding was open before.
    setContractQuestion('')
    setContractAnswer('')
    setUploadResult(null)
    setCollapsedNoteCategories({})
    setInjectText('')
    setSectionFinalisations({})
    // When opened from a "needs attention" flag, land directly on that person's
    // conversation (or the right tab for a non-Sage escalation); otherwise
    // start on the overview tab.
    setSelectedChatUser(focusUserId || null)
    setActiveTabRaw(
      resolveSectionKey(focusTab) || (focusUserId ? 'conversations' : 'overview')
    )
    setTabHistory([])

    // PARALLELIZED: load all wedding data concurrently. apiFetch throws on a
    // non-2xx response instead of quietly handing back {}, so a 401 or 500
    // here no longer reads as "this couple simply has no notes yet" — it
    // shows up below as "Could not load" with a Retry, and once as one toast
    // naming every panel that failed.
    const [
      couplePhotoResult,
      messagesResult,
      notesResult,
      timelineResult,
      tablesResult,
      staffingResult,
      budgetResult,
      borrowResult,
      activitiesResult,
      internalNotesResult,
      finalisationsResult,
    ] = await Promise.allSettled([
      apiFetch(`${API_URL}/api/couple-photo/${wedding.id}`),
      apiFetch(`${API_URL}/api/sage-messages/${wedding.id}`),
      apiFetch(`${API_URL}/api/planning-notes/${wedding.id}`),
      apiFetch(`${API_URL}/api/timeline/${wedding.id}`),
      apiFetch(`${API_URL}/api/tables/${wedding.id}`),
      apiFetch(`${API_URL}/api/staffing/${wedding.id}`),
      // A 404 here means "no budget yet", not a failure — the endpoint
      // returns it deliberately when wedding_budget has no row.
      apiFetch(`${API_URL}/api/budget/${wedding.id}`).catch(err => {
        if (err.status === 404) return null
        throw err
      }),
      apiFetch(`${API_URL}/api/borrow-selections/${wedding.id}`),
      apiFetch(`${API_URL}/api/activities/${wedding.id}?limit=20`),
      apiFetch(`${API_URL}/api/internal-notes/${wedding.id}`),
      apiFetch(`${API_URL}/api/finalisations/${wedding.id}`),
    ])

    const PANEL_LABELS = {
      photo: 'couple photo', messages: 'Sage conversation', notes: 'planning notes',
      timeline: 'timeline', tables: 'tables', staffing: 'staffing', budget: 'budget',
      borrow: 'borrow selections', activities: 'recent activity', internalNotes: 'internal notes',
      finalisations: 'section sign-offs',
    }
    const failedPanels = {}
    const failed = (key) => { failedPanels[key] = true }

    // Process results
    if (couplePhotoResult.status === 'fulfilled') {
      if (couplePhotoResult.value?.photo) {
        setCouplePhotos(prev => ({ ...prev, [wedding.id]: couplePhotoResult.value.photo.image_url }))
      }
    } else failed('photo')

    if (messagesResult.status === 'fulfilled') {
      setWeddingMessages(messagesResult.value.messages || [])
    } else {
      setWeddingMessages([])
      failed('messages')
    }

    if (notesResult.status === 'fulfilled') {
      setPlanningNotes(notesResult.value.notes || [])
    } else {
      setPlanningNotes([])
      failed('notes')
    }

    if (timelineResult.status === 'fulfilled') {
      const tl = timelineResult.value?.timeline
      if (tl) {
        const events = tl.timeline_data?.events || {}
        const includedCount = Object.values(events).filter(e => e.included).length
        setTimelineSummary({
          ceremonyTime: tl.ceremony_start,
          receptionEnd: tl.reception_end,
          doingFirstLook: tl.timeline_data?.doingFirstLook,
          dinnerType: tl.timeline_data?.dinnerType,
          includedEvents: includedCount,
          updatedAt: tl.updated_at
        })
      } else {
        setTimelineSummary(null)
      }
    } else {
      setTimelineSummary(null)
      failed('timeline')
    }

    if (tablesResult.status === 'fulfilled') {
      const tb = tablesResult.value?.tables
      if (tb) {
        const guestsPerTable = tb.guests_per_table || 8
        const baseGuests = tb.guest_count - (tb.head_table ? tb.head_table_size : 0) - (tb.sweetheart_table ? 2 : 0) - (tb.kids_count || 0)
        const tablesNeeded = Math.ceil(baseGuests / guestsPerTable)
        setTableSummary({
          guestCount: tb.guest_count,
          tableShape: tb.table_shape,
          tablesNeeded,
          headTable: tb.head_table,
          sweetheartTable: tb.sweetheart_table,
          linenColor: tb.linen_color,
          napkinColor: tb.napkin_color,
          updatedAt: tb.updated_at
        })
      } else {
        setTableSummary(null)
      }
    } else {
      setTableSummary(null)
      failed('tables')
    }

    if (staffingResult.status === 'fulfilled') {
      setStaffingSummary(staffingResult.value?.staffing || null)
    } else {
      setStaffingSummary(null)
      failed('staffing')
    }

    if (budgetResult.status === 'fulfilled') {
      setSharedBudget(budgetResult.value?.budget?.is_shared ? budgetResult.value.budget : null)
    } else {
      setSharedBudget(null)
      failed('budget')
    }

    if (borrowResult.status === 'fulfilled') {
      setBorrowSelections(borrowResult.value.selections || [])
    } else {
      setBorrowSelections([])
      failed('borrow')
    }

    if (activitiesResult.status === 'fulfilled') {
      setActivities(activitiesResult.value.activities || [])
    } else {
      setActivities([])
      failed('activities')
    }

    if (internalNotesResult.status === 'fulfilled') {
      setInternalNotes(internalNotesResult.value.notes || [])
    } else {
      setInternalNotes([])
      failed('internalNotes')
    }

    if (finalisationsResult.status === 'fulfilled') {
      setSectionFinalisations(canonicaliseFinalisations(finalisationsResult.value))
    } else {
      setSectionFinalisations({})
      failed('finalisations')
    }

    setSectionLoadErrors(failedPanels)
    const failedNames = Object.keys(failedPanels).map(k => PANEL_LABELS[k] || k)
    if (failedNames.length > 0) {
      toastError(`Could not load: ${failedNames.join(', ')}. See the panels below for Retry.`)
    }

    setLoadingMessages(false)
  }

  // Re-runs viewWeddingProfile for whichever wedding is open. Simpler than
  // threading a per-section retry through ten independent requests, and the
  // whole load already runs in parallel, so pressing it again costs one
  // round trip, not ten.
  const retryWeddingProfile = () => { if (viewingWedding) viewWeddingProfile(viewingWedding) }

  // ?wedding=<id>&section=<key> opens straight into that wedding, on that tab.
  //
  // There is no route for a single wedding — the profile is state on this page
  // — so anything that leaves and comes back used to land on the list. The
  // print pack opens in its own tab, and its way back was "← Admin", which is
  // a different place from where you were.
  //
  // The section half is what makes "open Bar Planner" work down a phone line:
  // the couple's link and Grace's link now carry the same key, so either of
  // them can read theirs out and the other lands on the same panel.
  //
  // Read once, on the first render, before any effect gets the chance to strip
  // it. Kept as a pending job until the wedding list has loaded, since matching
  // the id needs the row.
  const [initialUrlTarget] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return { weddingId: params.get('wedding'), section: params.get('section') }
  })
  const urlOpenPending = useRef(!!initialUrlTarget.weddingId)

  useEffect(() => {
    if (!urlOpenPending.current || !weddings.length || viewingWedding) return
    urlOpenPending.current = false
    const found = weddings.find(w => w.id === initialUrlTarget.weddingId)
    if (found) viewWeddingProfile(found, { focusTab: initialUrlTarget.section })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddings])

  // Keep the address bar on the wedding and tab actually open, so the link can
  // be copied out of it. replaceState, not navigation: the profile is state on
  // this page, and pushing would make Back walk every tab anyone opened.
  useEffect(() => {
    if (urlOpenPending.current) return
    const url = new URL(window.location.href)
    if (viewingWedding) {
      url.searchParams.set('wedding', viewingWedding.id)
      url.searchParams.set('section', activeTab)
    } else {
      url.searchParams.delete('wedding')
      url.searchParams.delete('section')
    }
    const next = `${url.pathname}${url.search}${url.hash}`
    const now = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (next !== now) window.history.replaceState(window.history.state, '', next)
  }, [viewingWedding, activeTab])

  const updateNoteStatus = async (noteId, newStatus) => {
    const snapshot = planningNotes
    setPlanningNotes(planningNotes.map(n =>
      n.id === noteId ? { ...n, status: newStatus } : n
    ))
    try {
      await apiFetch(`${API_URL}/api/planning-notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      })
    } catch (err) {
      setPlanningNotes(snapshot)
      toastError(`Could not update note status: ${err.message}`)
    }
  }

  const addInternalNote = async () => {
    if (!newNoteText.trim() || !viewingWedding) return
    setSavingNote(true)
    try {
      const data = await apiFetch(`${API_URL}/api/internal-notes`, {
        method: 'POST',
        body: JSON.stringify({ weddingId: viewingWedding.id, content: newNoteText.trim() })
      })
      if (data.note) {
        setInternalNotes(prev => [data.note, ...prev])
        setNewNoteText('')
      }
    } catch (err) {
      toastError(`Could not save internal note: ${err.message}`)
    }
    setSavingNote(false)
  }

  const deleteInternalNote = async (noteId) => {
    const snapshot = internalNotes
    setInternalNotes(prev => prev.filter(n => n.id !== noteId))
    try {
      await apiFetch(`${API_URL}/api/internal-notes/${noteId}`, { method: 'DELETE' })
    } catch (err) {
      setInternalNotes(snapshot)
      toastError(`Could not delete internal note: ${err.message}`)
    }
  }

  const handleContractUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !viewingWedding) return

    const weddingId = viewingWedding.id
    setUploadingContract(true)
    setUploadResult(null)

    const formData = new FormData()
    formData.append('contract', file)
    formData.append('weddingId', weddingId)

    try {
      // Answers straight away with a job id now — reading a contract is
      // Sonnet's job, not the request's, and holding it open used to run into
      // Railway's proxy timeout on a long one.
      const started = await apiFetch(`${API_URL}/api/extract-contract`, {
        method: 'POST',
        body: formData
      })
      const job = await awaitAnswerJob(started?.jobId, { signal: abortRef.current?.signal })
      if (openWeddingRef.current === weddingId) {
        setUploadResult({
          success: true,
          message: job?.answer || `Extracted ${job?.counts?.notesExtracted ?? 0} notes from contract`,
        })
      }
      await loadPlanningNotesForWedding(weddingId)
    } catch (err) {
      if (cancelledRef.current) return   // navigated away — not a real failure
      console.error('Upload error:', err)
      if (openWeddingRef.current === weddingId) {
        setUploadResult({ success: false, message: err.message || 'Failed to upload contract' })
      }
      toastError(`Could not upload contract: ${err.message}`)
    }

    setUploadingContract(false)
    // Clear file input
    e.target.value = ''
  }

  const askContractQuestion = async () => {
    if (!contractQuestion.trim() || !viewingWedding) return

    const weddingId = viewingWedding.id
    setAskingQuestion(true)
    setContractAnswer(WAITING)

    try {
      const started = await apiFetch(`${API_URL}/api/ask-contracts`, {
        method: 'POST',
        body: JSON.stringify({
          weddingId,
          question: contractQuestion
        })
      })
      const job = await awaitAnswerJob(started?.jobId, {
        signal: abortRef.current?.signal,
        onTick: (secs) => {
          if (openWeddingRef.current !== weddingId) return
          setContractAnswer(`${WAITING} ${secs}s`)
        }
      })
      if (openWeddingRef.current !== weddingId) return
      setContractAnswer(job.answer || 'Nothing came back. Try again.')
    } catch (err) {
      if (cancelledRef.current) return   // navigated away — not a real failure
      console.error('Question error:', err)
      if (openWeddingRef.current === weddingId) setContractAnswer(`Could not get an answer: ${err.message}`)
      toastError(`Could not get answer: ${err.message}`)
    }

    setAskingQuestion(false)
  }

  const sendCheckin = async () => {
    if (!viewingWedding || checkingIn) return
    setCheckingIn(true)
    try {
      await apiFetch(`${API_URL}/api/checkin/${viewingWedding.id}`, { method: 'POST' })
      setCheckedIn(true)
      setTimeout(() => setCheckedIn(false), 3000)
    } catch (err) {
      toastError(`Could not send check-in: ${err.message}`)
    }
    setCheckingIn(false)
  }

  const closeProfile = () => {
    setViewingWedding(null)
    openWeddingRef.current = null
    setTabHistory([])
    setWeddingMessages([])
    setSearchQuery('')
    setSelectedChatUser(null)
    setTimelineSummary(null)
    setTableSummary(null)
    setStaffingSummary(null)
    setSharedBudget(null)
    setInternalNotes([])
    setNewNoteText('')
    setShowGuestCare(false)
    setBorrowSelections([])
    setShowAddItemForm(false)
    setAddItemResult(null)
    setNewItemName('')
    setNewItemCategory('')
    setNewItemDescription('')
    setNewItemImage(null)
    setSectionLoadErrors({})
  }

  // Quick stats
  const getQuickStats = () => {
    const activeWeddings = weddings.filter(w => !w.archived)
    const archivedWeddings = weddings.filter(w => w.archived)

    // Active this week
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const activeThisWeek = activeWeddings.filter(w => {
      const lastActive = getLastActivityAt(w, allMessages[w.id], directConversations[w.id])
      return lastActive && lastActive > weekAgo
    })

    // Weddings needing attention (escalations)
    const needsAttention = activeWeddings.filter(w =>
      escalations[w.id]?.hasEscalation
    )

    // Upcoming weddings (next 30 days)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const upcoming = activeWeddings.filter(w => {
      if (!w.wedding_date) return false
      const weddingDate = parseDateOnly(w.wedding_date)
      return weddingDate > new Date() && weddingDate < thirtyDaysFromNow
    })

    return {
      total: weddings.length,
      active: activeWeddings.length,
      archived: archivedWeddings.length,
      activeThisWeek: activeThisWeek.length,
      needsAttention: needsAttention.length,
      // The couples behind the number. A bare count tells you something is
      // wrong without telling you who, which means opening every profile to
      // find out.
      needsAttentionList: needsAttention,
      upcoming: upcoming.length
    }
  }

  // The unread count that used to live here fed a blue Notifications panel on
  // the home screen. The rows themselves, and the tick that marks one read,
  // are now a group in "Needs you", which counts them itself.
  const stats = getQuickStats()

  // Filter and sort weddings for display. Past-date weddings are auto-archived
  // on load, so the active view simply hides archived weddings. A non-empty
  // search spans every wedding (archived included) so anything is still findable
  // by couple name, project name, event code, member name, or vendor.
  const listQuery = listSearch.trim().toLowerCase()

  const matchesListSearch = (w) => {
    if (!listQuery) return true
    const haystack = [
      w.project_name,
      w.couple_names,
      w.event_code,
      ...(w.profiles || []).map(p => p?.name),
      ...(w.vendor_checklist || []).map(v => v?.vendor_name),
      ...(w.vendor_checklist || []).map(v => v?.vendor_type),
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(listQuery)
  }

  const displayedWeddings = weddings
    .filter(w => {
      if (listQuery) return matchesListSearch(w)
      if (showArchived) return w.archived
      return !w.archived
    })
    .sort((a, b) => {
      if (sortBy === 'lastActivity') {
        // Sage messages or direct messages, whichever is newer — a couple
        // who only ever uses direct messages used to sort as if they had
        // never said anything at all.
        const aLast = getLastActivityAt(a, allMessages[a.id], directConversations[a.id])
        const bLast = getLastActivityAt(b, allMessages[b.id], directConversations[b.id])

        // No activity goes to the bottom
        if (!aLast && !bLast) return 0
        if (!aLast) return 1
        if (!bLast) return -1

        return bLast - aLast
      } else if (sortBy === 'weddingDate') {
        // Sort by wedding date (soonest first)
        if (!a.wedding_date && !b.wedding_date) return 0
        if (!a.wedding_date) return 1
        if (!b.wedding_date) return -1
        return parseDateOnly(a.wedding_date) - parseDateOnly(b.wedding_date)
      }
      return 0
    })

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <p className="text-sage-500">Loading...</p>
      </div>
    )
  }

  // Wedding Profile View
  if (viewingWedding) {
    return (
      <AdminWeddingProfile
        viewingWedding={viewingWedding}
        updateProjectName={updateProjectName}
        toggleArchive={toggleArchive}
        closeProfile={closeProfile}
        goBack={goBack}
        tabHistory={tabHistory}
        weddingMessages={weddingMessages}
        setWeddingMessages={setWeddingMessages}
        loadingMessages={loadingMessages}
        selectedChatUser={selectedChatUser}
        setSelectedChatUser={setSelectedChatUser}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        escalations={escalations}
        markEscalationHandled={markEscalationHandled}
        directConversation={directConversations[viewingWedding.id]}
        sectionLoadErrors={sectionLoadErrors}
        retryWeddingProfile={retryWeddingProfile}
        editingWedding={editingWedding}
        setEditingWedding={setEditingWedding}
        honeybook={honeybook}
        setHoneybook={setHoneybook}
        googleSheets={googleSheets}
        setGoogleSheets={setGoogleSheets}
        saving={saving}
        saveLinks={saveLinks}
        startEditing={startEditing}
        couplePhotos={couplePhotos}
        setEnlargedPhoto={setEnlargedPhoto}
        setCouplePhotos={setCouplePhotos}
        planningNotes={planningNotes}
        setPlanningNotes={setPlanningNotes}
        sectionFinalisations={sectionFinalisations}
        onSectionFinalised={(sectionKey, party, value) => {
          setSectionFinalisations(prev => ({
            ...prev,
            [sectionKey]: {
              ...(prev[sectionKey] || {}),
              [party === 'couple' ? 'couple_finalised' : 'staff_finalised']: value,
            },
          }))
        }}
        updateNoteStatus={updateNoteStatus}
        notesSearchQuery={notesSearchQuery}
        setNotesSearchQuery={setNotesSearchQuery}
        notesHighlights={notesHighlights}
        setNotesHighlights={setNotesHighlights}
        loadingHighlights={loadingHighlights}
        getNotesHighlights={getNotesHighlights}
        collapsedNoteCategories={collapsedNoteCategories}
        setCollapsedNoteCategories={setCollapsedNoteCategories}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        timelineSummary={timelineSummary}
        tableSummary={tableSummary}
        staffingSummary={staffingSummary}
        sharedBudget={sharedBudget}
        borrowSelections={borrowSelections}
        borrowCatalogRefreshKey={borrowCatalogRefreshKey}
        internalNotes={internalNotes}
        newNoteText={newNoteText}
        setNewNoteText={setNewNoteText}
        savingNote={savingNote}
        addInternalNote={addInternalNote}
        deleteInternalNote={deleteInternalNote}
        uploadingContract={uploadingContract}
        uploadResult={uploadResult}
        handleContractUpload={handleContractUpload}
        contractQuestion={contractQuestion}
        setContractQuestion={setContractQuestion}
        contractAnswer={contractAnswer}
        askContractQuestion={askContractQuestion}
        askingQuestion={askingQuestion}
        uncertainQuestions={uncertainQuestions}
        answeringQuestion={answeringQuestion}
        setAnsweringQuestion={setAnsweringQuestion}
        adminAnswer={adminAnswer}
        setAdminAnswer={setAdminAnswer}
        addToKb={addToKb}
        setAddToKb={setAddToKb}
        kbCategory={kbCategory}
        setKbCategory={setKbCategory}
        kbSubcategory={kbSubcategory}
        setKbSubcategory={setKbSubcategory}
        submittingAnswer={submittingAnswer}
        submitAnswer={submitAnswer}
        deleteUncertainQuestion={deleteUncertainQuestion}
        injectText={injectText}
        setInjectText={setInjectText}
        injectKb={injectKb}
        setInjectKb={setInjectKb}
        injectKbCat={injectKbCat}
        setInjectKbCat={setInjectKbCat}
        injecting={injecting}
        injectNote={injectNote}
        checkingIn={checkingIn}
        checkedIn={checkedIn}
        sendCheckin={sendCheckin}
        activities={activities}
        loadingActivities={loadingActivities}
        setMainView={setMainView}
      />
    )
  }

  // Shared renderer for the "Sage needs help" question list — used both by the
  // popup modal and the full-page Sage Help tab.
  const renderUncertainList = () => (
    uncertainQuestions.length === 0 ? (
      <p className="text-sage-400 text-center py-8">No uncertain questions right now</p>
    ) : (
      <div className="space-y-4">
        {uncertainQuestions.map(q => {
          const wedding = weddings.find(w => w.id === q.wedding_id)
          const isAnswering = answeringQuestion === q.id
          const isAlerting = alertingQuestion === q.id
          // Answering or alerting forces it open; otherwise it stays as it was
          // left. A fresh login starts with an empty set, so everything closed.
          const isOpen = expandedQuestions.has(q.id) || isAnswering || isAlerting

          return (
            <div key={q.id} className={`rounded-xl p-4 border ${isAnswering || isAlerting ? 'border-amber-300 bg-amber-50' : 'border-cream-200 bg-cream-50'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => toggleQuestion(q.id)}
                  aria-expanded={isOpen}
                  className="flex-1 text-left flex items-start gap-2 group"
                >
                  <svg
                    className={`w-4 h-4 mt-1 flex-shrink-0 text-sage-400 group-hover:text-sage-600 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="flex-1">
                    <span className="block text-sage-800 font-medium">{q.question}</span>
                    <span className="block text-sage-400 text-sm mt-1">
                      {weddingName(wedding)} · {new Date(q.created_at).toLocaleDateString()}
                      {q.confidence_level && (
                        <span className="ml-2 text-amber-600">{q.confidence_level}% confident</span>
                      )}
                      {q.admin_answer && <span className="ml-2 text-sage-500">· answered</span>}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => setConfirmDeleteQuestionId(q.id)}
                  className="text-sage-400 hover:text-red-500 p-1"
                  title="Delete question"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {isOpen && q.sage_response && (
                <div className="bg-white rounded-lg p-3 mb-3 text-sm text-sage-600 border border-cream-200">
                  {/* The whole reply. It was cut at 200 characters with an
                      ellipsis bolted on whether or not anything had been cut,
                      so the one thing this panel exists to show was the one
                      thing you could not read. */}
                  <p className="font-medium mb-1">Sage said:</p>
                  <p className="whitespace-pre-line max-h-64 overflow-y-auto">{q.sage_response}</p>
                </div>
              )}

              {!isOpen ? null : isAnswering ? (
                <div className="space-y-3 mt-3 pt-3 border-t border-cream-200">
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
                      id={`kb-${q.id}`}
                      checked={addToKb}
                      onChange={(e) => setAddToKb(e.target.checked)}
                      className="rounded border-cream-300"
                    />
                    <label htmlFor={`kb-${q.id}`} className="text-sm text-sage-600">
                      Add to Knowledge Base
                    </label>
                  </div>

                  {addToKb && (
                    <div className="grid grid-cols-2 gap-2">
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
                      {submittingAnswer ? 'Saving...' : 'Save answer, then alert client'}
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
              ) : isAlerting ? (
                <div className="space-y-3 mt-3 pt-3 border-t border-cream-200">
                  <div>
                    <p className="text-sm font-medium text-sage-700">
                      Send the answer to {weddingName(wedding, 'the couple')}
                    </p>
                    <p className="text-xs text-sage-400 mt-0.5">
                      Sage told them the team would follow up. This goes to their Inbox as a message from Rixey Manor.
                    </p>
                  </div>

                  <textarea
                    value={clientMessage}
                    onChange={(e) => setClientMessage(e.target.value)}
                    placeholder="What the couple will read..."
                    rows={5}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => sendClientAlert(q.id)}
                      disabled={sendingAlert || draftingMessage || !clientMessage.trim()}
                      className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
                    >
                      {sendingAlert ? 'Sending...' : 'Send to their Inbox'}
                    </button>
                    <button
                      onClick={() => draftClientMessage(q.id, clientMessage || q.admin_answer)}
                      disabled={draftingMessage || sendingAlert}
                      className="px-4 py-2 border border-cream-300 text-sage-600 rounded-lg text-sm hover:bg-cream-100 disabled:opacity-50"
                      title="Rewrite the answer as a message to the couple"
                    >
                      {draftingMessage ? 'Drafting...' : 'Reword for the couple'}
                    </button>
                    <button
                      onClick={() => skipClientAlert(q.id)}
                      disabled={sendingAlert}
                      className="px-4 py-2 text-sage-500 text-sm hover:text-sage-700"
                      title="Answer is filed, but don't message the couple"
                    >
                      Don't send
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => setAnsweringQuestion(q.id)}
                    className="text-sm text-sage-600 hover:text-sage-800 font-medium"
                  >
                    {q.admin_answer ? 'Edit answer →' : 'Answer this question →'}
                  </button>
                  {q.admin_answer && !q.client_notified_at && (
                    <button
                      onClick={() => {
                        setAlertingQuestion(q.id)
                        setClientMessage(q.admin_answer)
                      }}
                      className="text-sm text-amber-700 hover:text-amber-900 font-medium"
                    >
                      Alert client →
                    </button>
                  )}
                  {q.client_notified_at && (
                    <span className="text-xs text-sage-400">
                      Answer sent {new Date(q.client_notified_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  )

  // Main Admin View
  return (
    <div className="min-h-screen min-h-[100dvh] bg-cream-50">
      {/* Header with integrated navigation */}
      <AdminHeader
        navigate={navigate}
        mainView={mainView}
        setMainView={setMainView}
        stats={stats}
        unreadMessages={unreadMessages}
        setUnreadMessages={setUnreadMessages}
        unansweredCount={unansweredCount}
        setShowUncertainModal={setShowUncertainModal}
        fetchUnreadMessages={fetchUnreadMessages}
        setViewingWedding={setViewingWedding}
        setActiveTab={setActiveTab}
        tourCount={tourCount}
        crashCount={crashCount}
        reviewCount={reviewItems.length}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* Meetings the matcher would not guess at.
            Sits above every view, not just eleven of thirteen: a queue nobody
            passes is a queue nobody answers, and the whole point is that it
            asks rather than files a meeting on a shared first name.

            Every view except the home screen, that is. Home now lists the same
            items as one collapsed group in "Needs you", which links here; the
            Meetings tab is where the queue is worked through and is the tab
            its badge points at. Rendering both would put the same amber panel
            on the one screen that was asked to stop shouting. */}
        {mainView !== 'weddings' && reviewItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-6 mb-6">
            <h3 className="font-serif text-lg text-amber-900">
              {reviewItems.length === 1 ? 'One thing I can’t place' : `${reviewItems.length} things I can’t place`}
            </h3>
            <p className="text-amber-800 text-sm mt-1 mb-4">
              I only file something when I’m sure: a first and last name, both partners, or a name with the
              wedding date. An email has to actually be from the couple, or have their address in it. These
              didn’t reach that, so I’ve left them for you rather than guessing.
            </p>
            <div className="space-y-3">
              {reviewItems.map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-amber-200 p-3 sm:p-4">
                  <div className="font-medium text-sage-700">
                    {/* Emails and meetings share this list, so say which. It
                        used to read "Untitled meeting" whatever it was. */}
                    {item.source === 'gmail' && (
                      <span className="mr-2 text-xs uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">Email</span>
                    )}
                    {item.source === 'quo_call' && (
                      <span className="mr-2 text-xs uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">Call</span>
                    )}
                    {item.title || (item.source === 'gmail' ? 'No subject' : item.source === 'quo_call' ? 'Calls from an unknown number' : 'Untitled meeting')}
                  </div>
                  <div className="text-xs text-sage-500 mt-0.5">
                    {item.occurred_at ? new Date(item.occurred_at).toLocaleString() : 'no date'}
                    {item.reason ? ` · ${item.reason}` : ''}
                  </div>
                  {item.excerpt && (
                    <p className="text-sm text-sage-600 mt-2 line-clamp-3 italic">“{item.excerpt.slice(0, 240)}…”</p>
                  )}
                  {/* A number filed once should file itself next time, so the
                      answer to "whose is this?" can also save them to the
                      wedding. Left blank, the calls are still filed. */}
                  {item.source === 'quo_call' && (
                    <div className="grid gap-2 sm:grid-cols-2 mt-3">
                      <input
                        value={reviewContact[item.id]?.name || item.payload?.callerName || ''}
                        onChange={e => setReviewContact(prev => ({ ...prev, [item.id]: { ...prev[item.id], name: e.target.value } }))}
                        placeholder="Who is this? e.g. Susan Miller"
                        className="border border-cream-300 rounded-lg px-3 py-2 text-sm"
                      />
                      <input
                        value={reviewContact[item.id]?.relationship || ''}
                        onChange={e => setReviewContact(prev => ({ ...prev, [item.id]: { ...prev[item.id], relationship: e.target.value } }))}
                        placeholder="Bride's mother"
                        className="border border-cream-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-3">
                    {(item.candidates?.length > 0) && !reviewShowAll[item.id] ? (
                      <select
                        value={reviewChoice[item.id] || item.suggested_wedding_id || ''}
                        onChange={e => {
                          if (e.target.value === '__other__') {
                            setReviewShowAll(prev => ({ ...prev, [item.id]: true }))
                            setReviewChoice(prev => ({ ...prev, [item.id]: '' }))
                            return
                          }
                          setReviewChoice(prev => ({ ...prev, [item.id]: e.target.value }))
                        }}
                        className="flex-1 min-w-[200px] border border-cream-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Whose is this?</option>
                        {item.candidates.map(c => {
                          const confidence = c.score ?? c.confidence
                          const label = c.name || c.coupleNames || weddingName(weddings.find(w => w.id === c.weddingId) || {}, 'Unknown couple')
                          return (
                            <option key={c.weddingId} value={c.weddingId}>
                              {label}{typeof confidence === 'number' ? ` (${Math.max(0, Math.min(100, Math.round(confidence)))}% sure)` : ''}
                            </option>
                          )
                        })}
                        <option value="__other__">Someone else…</option>
                      </select>
                    ) : (
                      <select
                        value={reviewChoice[item.id] || item.suggested_wedding_id || ''}
                        onChange={e => setReviewChoice(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="flex-1 min-w-[200px] border border-cream-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Whose is this?</option>
                        {weddings.map(w => (
                          <option key={w.id} value={w.id}>
                            {weddingName(w)}{w.wedding_date ? ` — ${w.wedding_date}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => assignReviewItem(item)}
                      disabled={reviewBusy === item.id || !(reviewChoice[item.id] || item.suggested_wedding_id)}
                      className="px-4 py-2 rounded-lg text-sm bg-sage-600 text-white disabled:opacity-40"
                    >
                      {reviewBusy === item.id ? 'Filing…' : 'File it'}
                    </button>
                    <button
                      onClick={() => setConfirmIgnoreItem(item)}
                      disabled={reviewBusy === item.id}
                      className="px-4 py-2 rounded-lg text-sm border border-cream-300 text-sage-600"
                    >
                      {item.source === 'quo_call' ? 'Not a client — stop asking' : 'Not a client meeting'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rixey Picks Admin */}
        {mainView === 'picks' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <StorefrontAdmin />
          </div>
        )}

        {/* Manor Downloads admin */}
        {mainView === 'manor-downloads' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <ManorDownloads isAdmin={true} />
          </div>
        )}

        {mainView === 'borrow-catalog' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl text-sage-700">Borrow Catalog</h2>
                <p className="text-sage-400 text-sm mt-1">Add items here to make them available to all couples in their Borrow Brochure.</p>
              </div>
              <button
                onClick={() => { setShowAddItemForm(v => !v); setAddItemResult(null) }}
                className="px-4 py-2 bg-sage-600 text-white rounded-xl text-sm font-medium hover:bg-sage-700 transition"
              >
                {showAddItemForm ? '× Cancel' : '+ Add Item'}
              </button>
            </div>

            {showAddItemForm && (
              <div className="bg-cream-50 rounded-xl border border-cream-200 p-5 mb-6 space-y-4">
                <h3 className="font-medium text-sage-700">New Catalog Item</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-sage-600 mb-1">Item Name *</label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      placeholder="e.g. Lantern Trio"
                      className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-sage-600 mb-1">Category *</label>
                    <select
                      value={newItemCategory}
                      onChange={e => setNewItemCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
                    >
                      <option value="">Select category...</option>
                      {['Arbors','Candles & Lighting','Card Boxes','Ceremony','Dessert & Cake','Extras','Signs','Silk Florals','Stands & Displays','Table Numbers','Vases'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-sage-600 mb-1">Description</label>
                  <textarea
                    value={newItemDescription}
                    onChange={e => setNewItemDescription(e.target.value)}
                    placeholder="Short description of the item..."
                    rows={2}
                    className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-sage-600 mb-1">Image (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setNewItemImage(e.target.files?.[0] || null)}
                    className="text-sm text-sage-600"
                  />
                </div>
                {addItemResult && (
                  <div className={`text-sm px-3 py-2 rounded-lg ${addItemResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {addItemResult.message}
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (!newItemName.trim() || !newItemCategory) return
                    setSavingNewItem(true)
                    setAddItemResult(null)
                    try {
                      const fd = new FormData()
                      fd.append('item_name', newItemName.trim())
                      fd.append('category', newItemCategory)
                      fd.append('description', newItemDescription.trim())
                      if (newItemImage) fd.append('image', newItemImage)
                      const data = await apiFetch(`${API_URL}/api/admin/borrow-catalog`, { method: 'POST', body: fd })
                      if (data.item) {
                        setAddItemResult({ success: true, message: `"${data.item.item_name}" added to catalog.` })
                        setNewItemName(''); setNewItemCategory(''); setNewItemDescription(''); setNewItemImage(null)
                        setBorrowCatalogRefreshKey(k => k + 1)
                      } else {
                        setAddItemResult({ success: false, message: data.error || 'Failed to add item' })
                      }
                    } catch (err) {
                      setAddItemResult({ success: false, message: err.message || 'Failed to add item' })
                      toastError(`Could not add catalog item: ${err.message}`)
                    }
                    setSavingNewItem(false)
                  }}
                  disabled={savingNewItem || !newItemName.trim() || !newItemCategory}
                  className="px-6 py-2 bg-sage-600 text-white rounded-xl text-sm font-medium hover:bg-sage-700 transition disabled:opacity-50"
                >
                  {savingNewItem ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            )}

            <BorrowCatalog refreshKey={borrowCatalogRefreshKey} />
          </div>
        )}

        {/* Knowledge Base View */}
        {mainView === 'knowledge-base' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <KnowledgeBaseAdmin />
          </div>
        )}

        {/* Venue Settings View */}
        {mainView === 'venue-settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
              <VenueSettings />
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
              <AccommodationsAdmin />
            </div>
          </div>
        )}

        {/* Usage Stats View */}
        {mainView === 'errors' && (
          <CrashReports />
        )}

        {mainView === 'usage' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <UsageStats weddings={weddings} />
          </div>
        )}

        {/* Meetings View */}
        {mainView === 'meetings' && (
          <UpcomingMeetings weddings={weddings} />
        )}

        {/* Tours and first meetings: the people with no wedding yet, who had
            nowhere in this portal to exist at all. */}
        {mainView === 'tours' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <ToursPanel onCountChange={setTourCount} />
          </div>
        )}

        {/* Messages View */}
        {mainView === 'messages' && (
          <AdminInbox weddings={weddings} onUnreadChange={setUnreadMessages} />
        )}

        {/* Sage Help View -- every question Sage needs answering, in one place */}
        {mainView === 'sage-help' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <div className="mb-5">
              <h2 className="font-serif text-xl text-sage-700">Sage Needs Help</h2>
              <p className="text-sage-400 text-sm mt-1">
                Questions Sage was uncertain about or deferred to the team. Answer them here and optionally add the answer to Sage's Knowledge Base so it can respond next time.
              </p>
            </div>
            {renderUncertainList()}
          </div>
        )}

        {/* Vendors View */}
        {mainView === 'vendors' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <VendorsAdmin />
          </div>
        )}

        {/* Weddings View */}
        {mainView === 'weddings' && weddingsLoadError && weddings.length === 0 ? (
          <LoadError what="the weddings list" onRetry={loadData} />
        ) : mainView === 'weddings' && (
          <AdminWeddingList
            weddings={weddings}
            unlinkedProfiles={unlinkedProfiles}
            setUnlinkedProfiles={setUnlinkedProfiles}
            displayedWeddings={displayedWeddings}
            allMessages={allMessages}
            directConversations={directConversations}
            escalations={escalations}
            couplePhotos={couplePhotos}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
            listSearch={listSearch}
            setListSearch={setListSearch}
            sortBy={sortBy}
            setSortBy={setSortBy}
            stats={stats}
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
            startEditing={startEditing}
            toggleArchive={toggleArchive}
            markEscalationHandled={markEscalationHandled}
            viewWeddingProfile={viewWeddingProfile}
            setEnlargedPhoto={setEnlargedPhoto}
            last24h={last24h}
            last24hLoading={last24hLoading}
            uncertainQuestions={uncertainQuestions}
            setAnsweringQuestion={setAnsweringQuestion}
            setShowUncertainModal={setShowUncertainModal}
            notifications={notifications}
            markAsRead={markAsRead}
            reviewItems={reviewItems}
            setMainView={setMainView}
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
        )}

        {/* Uncertain Questions Modal */}
        {showUncertainModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-cream-200">
                <div>
                  <h3 className="font-serif text-xl text-sage-700">Sage Needs Help</h3>
                  <p className="text-sage-500 text-sm">Questions Sage was uncertain about or deferred to the team</p>
                </div>
                <button
                  onClick={() => { setShowUncertainModal(false); setAnsweringQuestion(null); setAdminAnswer(''); setAddToKb(false) }}
                  className="text-sage-400 hover:text-sage-600 p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {renderUncertainList()}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Enlarged Photo Modal */}
      {enlargedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setEnlargedPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[80vh]">
            <img
              src={enlargedPhoto}
              alt="Couple"
              className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
            />
            <button
              onClick={() => setEnlargedPhoto(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-sage-600 hover:text-sage-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteQuestionId !== null}
        onClose={() => setConfirmDeleteQuestionId(null)}
        onConfirm={() => deleteUncertainQuestion(confirmDeleteQuestionId)}
        title="Delete this question?"
        message="This removes it from Sage Needs Help for everyone."
        confirmLabel="Delete"
        danger
      />

      <ConfirmDialog
        open={confirmIgnoreItem !== null}
        onClose={() => setConfirmIgnoreItem(null)}
        onConfirm={() => { const item = confirmIgnoreItem; setConfirmIgnoreItem(null); if (item) ignoreReviewItem(item) }}
        title="Not a client meeting?"
        message="This drops it from the review queue for good — it will not come back suggesting a wedding again."
        confirmLabel="Ignore it"
        danger
      />

      <ConfirmDialog
        open={confirmClearZoom}
        onClose={() => setConfirmClearZoom(false)}
        onConfirm={performClearZoom}
        title="Clear all Zoom data?"
        message="This removes every stored Zoom transcript and processing history. You'll need to click Sync after to re-download everything fresh."
        confirmLabel="Clear Zoom data"
        danger
      />
    </div>
  )
}
