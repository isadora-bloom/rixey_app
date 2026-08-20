import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Components still used directly in the main Admin view (not in profile)
import KnowledgeBaseAdmin from '../components/KnowledgeBaseAdmin'
import VenueSettings from '../components/VenueSettings'
import RecommendedVendorsAdmin from '../components/RecommendedVendorsAdmin'
import UsageStats from '../components/UsageStats'
import UpcomingMeetings from '../components/UpcomingMeetings'
import ToursPanel from './admin/ToursPanel'
import AdminInbox from '../components/AdminInbox'
import BorrowCatalog from '../components/BorrowCatalog'
import StorefrontAdmin from '../components/StorefrontAdmin'
import ManorDownloads from '../components/ManorDownloads'
import { API_URL } from '../config/api'
import { apiFetch, authHeaders } from '../utils/api'
import { useToast } from '../components/ui/Toast'
import { parseDateOnly } from '../utils/dates'

// Extracted sub-components
import AdminHeader from './admin/AdminHeader'
import CrashReports from '../components/CrashReports'
import AdminWeddingList from './admin/AdminWeddingList'
import AdminWeddingProfile from './admin/AdminWeddingProfile'
import { detectEscalation } from './admin/adminUtils'

export default function Admin() {
  const navigate = useNavigate()
  const { error: toastError, success: toastSuccess } = useToast()
  const [notifications, setNotifications] = useState([])
  const [weddings, setWeddings] = useState([])
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
  const [planningNotes, setPlanningNotes] = useState([])
  const [activeTab, setActiveTabRaw] = useState('overview')
  const [tabHistory, setTabHistory] = useState([])

  // Wrapper around the tab setter: records the tab we're leaving so the
  // header Back button can step back through visited tabs, and scrolls the
  // new tab to the top instead of inheriting the previous tab's scroll position.
  const setActiveTab = (tab) => {
    setActiveTabRaw((prev) => {
      if (tab !== prev) setTabHistory((h) => [...h, prev])
      return tab
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
  const [gmailSyncing, setGmailSyncing] = useState(false)
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
  const [notesHighlights, setNotesHighlights] = useState('')
  const [loadingHighlights, setLoadingHighlights] = useState(false)
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
  const [last24h, setLast24h] = useState({ signups: [], activity: [] })
  const [last24hLoading, setLast24hLoading] = useState(true)

  // Keep unanswered count in sync with loaded uncertain questions
  useEffect(() => {
    setUnansweredCount(uncertainQuestions.filter(q => !q.admin_answer).length)
  }, [uncertainQuestions])

  const fetchUnreadMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/messages/admin/unread`, {
        headers: await authHeaders()
      })
      const data = await res.json()
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

  useEffect(() => {
    loadData()
    loadReviewItems()
    loadCrashCount()
    loadTourCount()
    checkGmailStatus()
    checkQuoStatus()
    checkZoomStatus()
    loadUncertainQuestions()
    loadUnlinkedProfiles()
    loadAllCouplePhotos()
    fetchUnreadMessages()
    const interval = setInterval(fetchUnreadMessages, 60000)
    return () => clearInterval(interval)
  }, [])

  const checkGmailStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/gmail/status`, {
        headers: await authHeaders()
      })
      const data = await response.json()
      setGmailConnected(data.connected)
    } catch (err) {
      console.error('Gmail status check error:', err)
    }
  }

  const connectGmail = async () => {
    try {
      const response = await fetch(`${API_URL}/api/gmail/auth`, {
        headers: await authHeaders()
      })
      const data = await response.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (err) {
      console.error('Gmail connect error:', err)
    }
  }

  const syncEmails = async () => {
    setGmailSyncing(true)
    setGmailStatus('')
    try {
      const data = await apiFetch(`${API_URL}/api/gmail/sync`, { method: 'POST' })
      setGmailStatus(data.message || data.error)
      // Reload data to get any new planning notes
      loadData()
    } catch (err) {
      setGmailStatus('Failed to sync emails')
      toastError(`Could not sync Gmail: ${err.message}`)
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
      const response = await fetch(`${API_URL}/api/quo/status`, {
        headers: await authHeaders()
      })
      const data = await response.json()
      setQuoConnected(data.connected)
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
        body: JSON.stringify({ forceReprocess })
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
      loadData()
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
      const response = await fetch(`${API_URL}/api/zoom/status`, {
        headers: await authHeaders()
      })
      const data = await response.json()
      setZoomConnected(data.connected)
    } catch (err) {
      console.error('Zoom status check error:', err)
    }
  }

  const connectZoom = async () => {
    try {
      const response = await fetch(`${API_URL}/api/zoom/auth`, {
        headers: await authHeaders()
      })
      const data = await response.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (err) {
      console.error('Zoom connect error:', err)
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
      loadData()
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
   */
  const followSyncJob = async (jobId) => {
    const started = Date.now()
    while (Date.now() - started < 20 * 60 * 1000) {
      await new Promise(r => setTimeout(r, 4000))
      let job
      try {
        const data = await apiFetch(`${API_URL}/api/admin/sync-jobs?kind=zoom&limit=10`)
        job = (data.jobs || []).find(j => j.id === jobId)
      } catch {
        continue                       // a blip in polling is not a failed sync
      }
      if (!job) continue

      const seen = job.total ? ` of ${job.total}` : ''
      if (job.status === 'running' && !job.stalled) {
        setZoomStatus(`Working: ${job.processed}${seen} meetings${job.last_item ? ` — ${job.last_item}` : ''}`)
        continue
      }
      if (job.stalled) {
        setZoomStatus(`Stopped after ${job.processed}${seen} meetings. Press Sync again to carry on from there.`)
        return
      }
      if (job.status === 'failed') {
        setZoomStatus(`Failed after ${job.processed}${seen}: ${job.last_error || 'unknown error'}`)
        return
      }
      setZoomStatus(
        `Done. ${job.processed}${seen} meetings, ${job.matched} filed to couples`
        + (job.needs_review ? `, ${job.needs_review} need you to say whose they are` : '')
        + (job.failed ? `, ${job.failed} skipped` : '')
      )
      return
    }
    setZoomStatus('Still running after 20 minutes — check the sync history.')
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
        await loadReviewItems()
        loadData()
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
      const data = await apiFetch(`${API_URL}/api/zoom/reextract`, { method: 'POST' })
      setZoomStatus(data.message || data.error)
      loadData()
    } catch (err) {
      setZoomStatus('Failed to re-extract notes')
      toastError(`Could not re-extract Zoom notes: ${err.message}`)
    }
    setZoomSyncing(false)
  }

  const clearZoom = async () => {
    if (!window.confirm('Clear all stored Zoom transcripts and processing history? You\'ll need to click Sync after to re-download everything fresh.')) return
    setZoomSyncing(true)
    setZoomStatus('')
    try {
      const data = await apiFetch(`${API_URL}/api/zoom/clear`, { method: 'POST' })
      setZoomStatus(data.message || data.error)
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

  const getNotesHighlights = async () => {
    if (!viewingWedding) return
    setLoadingHighlights(true)
    setNotesHighlights('')

    try {
      const data = await apiFetch(`${API_URL}/api/notes-highlights`, {
        method: 'POST',
        body: JSON.stringify({ weddingId: viewingWedding.id })
      })
      setNotesHighlights(data.highlights || data.error)
    } catch (err) {
      setNotesHighlights('Failed to generate highlights')
      toastError(`Could not generate highlights: ${err.message}`)
    }
    setLoadingHighlights(false)
  }

  const loadUncertainQuestions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/uncertain-questions`, {
        headers: await authHeaders()
      })
      const data = await response.json()
      setUncertainQuestions(data.questions || [])
    } catch (err) {
      console.error('Failed to load uncertain questions:', err)
    }
  }

  const loadUnlinkedProfiles = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/unlinked-profiles`, {
        headers: await authHeaders()
      })
      setUnlinkedProfiles(response.ok ? (await response.json()) || [] : [])
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
      const response = await fetch(`${API_URL}/api/couple-photos/all`, {
        headers: await authHeaders()
      })
      const data = await response.json()

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
      const notifsRes = await fetch(`${API_URL}/api/admin/notifications`, {
        headers: await authHeaders()
      })
      const notifsData = await notifsRes.json()
      setNotifications(notifsData.notifications || [])
    } catch (err) {
      console.error('Failed to load notifications:', err)
      setNotifications([])
    }

    // Auto-archive weddings whose date has passed before loading, so the active
    // list stays current. Best-effort: if it fails we still load what's there.
    try {
      await fetch(`${API_URL}/api/admin/weddings/archive-past`, {
        method: 'POST',
        headers: await authHeaders()
      })
    } catch (err) {
      console.error('Auto-archive past weddings failed:', err)
    }

    // Load weddings with profiles via server endpoint (bypasses RLS)
    let weddingsData = []
    try {
      const weddingsRes = await fetch(`${API_URL}/api/admin/weddings`, {
        headers: await authHeaders()
      })
      const weddingsJson = await weddingsRes.json()
      weddingsData = weddingsJson.weddings || []
      setWeddings(weddingsData)
    } catch (err) {
      console.error('Failed to load weddings:', err)
      setWeddings([])
    }

    // Load last 24h activity summary
    authHeaders().then(hdrs =>
      fetch(`${API_URL}/api/admin/last-24h`, { headers: hdrs })
        .then(r => r.json())
        .then(d => { setLast24h({ signups: d.signups || [], activity: d.activity || [] }) })
        .catch(() => {})
        .finally(() => setLast24hLoading(false))
    )

    // Load all Sage messages for escalation detection via server (bypasses RLS)
    if (weddingsData && weddingsData.length > 0) {
      try {
        const messagesRes = await fetch(`${API_URL}/api/sage-messages/all`, {
          headers: await authHeaders()
        })
        const messagesData = await messagesRes.json()
        const messages = messagesData.messages || []

        // Group messages by wedding
        const msgByWedding = {}
        const escalationByWedding = {}

        weddingsData.forEach(wedding => {
          const userIds = wedding.profiles?.map(p => p.id) || []
          const weddingMsgs = messages.filter(m => userIds.includes(m.user_id))
          msgByWedding[wedding.id] = weddingMsgs
          escalationByWedding[wedding.id] = detectEscalation(weddingMsgs, wedding.escalation_handled_at)
        })

        setAllMessages(msgByWedding)
        setEscalations(escalationByWedding)
      } catch (err) {
        console.error('Failed to load messages for escalation detection:', err)
      }
    }

    setLoading(false)
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
    const { focusUserId } = opts
    setViewingWedding(wedding)
    setLoadingMessages(true)
    setSearchQuery('')
    setNotesSearchQuery('')
    setNotesHighlights('')
    // When opened from a "needs attention" flag, land directly on that person's
    // conversation; otherwise start on the overview tab.
    setSelectedChatUser(focusUserId || null)
    setActiveTabRaw(focusUserId ? 'messages' : 'overview')
    setTabHistory([])

    // PARALLELIZED: Load all wedding data concurrently with Promise.allSettled
    const hdrs = await authHeaders()
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
    ] = await Promise.allSettled([
      // 0: Couple photo
      fetch(`${API_URL}/api/couple-photo/${wedding.id}`, { headers: hdrs }).then(r => r.json()),
      // 1: Sage chat messages
      fetch(`${API_URL}/api/sage-messages/${wedding.id}`, { headers: hdrs }).then(r => r.json()),
      // 2: Planning notes
      fetch(`${API_URL}/api/planning-notes/${wedding.id}`, { headers: hdrs }).then(r => r.json()),
      // 3: Timeline
      fetch(`${API_URL}/api/timeline/${wedding.id}`, { headers: hdrs }).then(r => r.json()),
      // 4: Tables
      fetch(`${API_URL}/api/tables/${wedding.id}`, { headers: hdrs }).then(r => r.json()),
      // 5: Staffing
      fetch(`${API_URL}/api/staffing/${wedding.id}`, { headers: hdrs }).then(r => r.json()),
      // 6: Budget
      fetch(`${API_URL}/api/budget/${wedding.id}`, { headers: hdrs }).then(r => r.ok ? r.json() : null),
      // 7: Borrow selections
      fetch(`${API_URL}/api/borrow-selections/${wedding.id}`, { headers: hdrs }).then(r => r.json()),
      // 8: Activities
      fetch(`${API_URL}/api/activities/${wedding.id}?limit=20`, { headers: hdrs }).then(r => r.json()),
      // 9: Internal notes
      fetch(`${API_URL}/api/internal-notes/${wedding.id}`, { headers: hdrs }).then(r => r.json()),
    ])

    // Process results
    if (couplePhotoResult.status === 'fulfilled' && couplePhotoResult.value?.photo) {
      setCouplePhotos(prev => ({ ...prev, [wedding.id]: couplePhotoResult.value.photo.image_url }))
    }

    if (messagesResult.status === 'fulfilled') {
      setWeddingMessages(messagesResult.value.messages || [])
    } else {
      setWeddingMessages([])
    }

    if (notesResult.status === 'fulfilled') {
      setPlanningNotes(notesResult.value.notes || [])
    } else {
      setPlanningNotes([])
    }

    if (timelineResult.status === 'fulfilled' && timelineResult.value?.timeline) {
      const tl = timelineResult.value.timeline
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

    if (tablesResult.status === 'fulfilled' && tablesResult.value?.tables) {
      const tb = tablesResult.value.tables
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

    if (staffingResult.status === 'fulfilled' && staffingResult.value?.staffing) {
      setStaffingSummary(staffingResult.value.staffing)
    } else {
      setStaffingSummary(null)
    }

    if (budgetResult.status === 'fulfilled' && budgetResult.value?.budget?.is_shared) {
      setSharedBudget(budgetResult.value.budget)
    } else {
      setSharedBudget(null)
    }

    if (borrowResult.status === 'fulfilled') {
      setBorrowSelections(borrowResult.value.selections || [])
    } else {
      setBorrowSelections([])
    }

    if (activitiesResult.status === 'fulfilled') {
      setActivities(activitiesResult.value.activities || [])
    } else {
      setActivities([])
    }

    if (internalNotesResult.status === 'fulfilled') {
      setInternalNotes(internalNotesResult.value.notes || [])
    } else {
      setInternalNotes([])
    }

    setLoadingMessages(false)
  }

  // ?wedding=<id> opens straight into that profile.
  //
  // There is no route for a single wedding — the profile is state on this page
  // — so anything that leaves and comes back used to land on the list. The
  // print pack opens in its own tab, and its way back was "← Admin", which is
  // a different place from where you were.
  //
  // Runs once weddings have loaded, since it needs the row, and clears the
  // parameter afterwards so a refresh does not keep reopening it.
  useEffect(() => {
    if (!weddings.length || viewingWedding) return
    const wanted = new URLSearchParams(window.location.search).get('wedding')
    if (!wanted) return
    const found = weddings.find(w => w.id === wanted)
    if (found) viewWeddingProfile(found)
    window.history.replaceState({}, '', '/admin')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddings])

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

    setUploadingContract(true)
    setUploadResult(null)

    const formData = new FormData()
    formData.append('contract', file)
    formData.append('weddingId', viewingWedding.id)

    try {
      const data = await apiFetch(`${API_URL}/api/extract-contract`, {
        method: 'POST',
        body: formData
      })

      setUploadResult({
        success: true,
        message: `Extracted ${data.notesExtracted} notes from contract`
      })
      // Reload planning notes via server endpoint
      const notesRes = await fetch(`${API_URL}/api/planning-notes/${viewingWedding.id}`, {
        headers: await authHeaders()
      })
      const notesData = await notesRes.json()
      setPlanningNotes(notesData.notes || [])
    } catch (err) {
      console.error('Upload error:', err)
      setUploadResult({ success: false, message: err.message || 'Failed to upload contract' })
      toastError(`Could not upload contract: ${err.message}`)
    }

    setUploadingContract(false)
    // Clear file input
    e.target.value = ''
  }

  const askContractQuestion = async () => {
    if (!contractQuestion.trim() || !viewingWedding) return

    setAskingQuestion(true)
    setContractAnswer('')

    try {
      const data = await apiFetch(`${API_URL}/api/ask-contracts`, {
        method: 'POST',
        body: JSON.stringify({
          weddingId: viewingWedding.id,
          question: contractQuestion
        })
      })
      setContractAnswer(data.answer || data.error)
    } catch (err) {
      console.error('Question error:', err)
      setContractAnswer('Failed to get answer. Make sure the server is running.')
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
  }

  // Quick stats
  const getQuickStats = () => {
    const activeWeddings = weddings.filter(w => !w.archived)
    const archivedWeddings = weddings.filter(w => w.archived)

    // Active this week
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const activeThisWeek = activeWeddings.filter(w => {
      const msgs = allMessages[w.id] || []
      return msgs.some(m => new Date(m.created_at) > weekAgo)
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

  const unreadCount = notifications.filter(n => !n.read).length
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
        // Get last activity for each wedding
        const aMessages = allMessages[a.id] || []
        const bMessages = allMessages[b.id] || []
        const aUserMsgs = aMessages.filter(m => m.sender === 'user')
        const bUserMsgs = bMessages.filter(m => m.sender === 'user')

        // No activity goes to the bottom
        if (aUserMsgs.length === 0 && bUserMsgs.length === 0) return 0
        if (aUserMsgs.length === 0) return 1
        if (bUserMsgs.length === 0) return -1

        // Most recent first
        const aLatest = Math.max(...aUserMsgs.map(m => new Date(m.created_at).getTime()))
        const bLatest = Math.max(...bUserMsgs.map(m => new Date(m.created_at).getTime()))
        return bLatest - aLatest
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
        couplePhotos={couplePhotos}
        setEnlargedPhoto={setEnlargedPhoto}
        setCouplePhotos={setCouplePhotos}
        planningNotes={planningNotes}
        setPlanningNotes={setPlanningNotes}
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

          return (
            <div key={q.id} className={`rounded-xl p-4 border ${isAnswering || isAlerting ? 'border-amber-300 bg-amber-50' : 'border-cream-200 bg-cream-50'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <p className="text-sage-800 font-medium">{q.question}</p>
                  <p className="text-sage-400 text-sm mt-1">
                    {wedding?.project_name || wedding?.couple_names || 'Unknown'} · {new Date(q.created_at).toLocaleDateString()}
                    {q.confidence_level && (
                      <span className="ml-2 text-amber-600">{q.confidence_level}% confident</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => deleteUncertainQuestion(q.id)}
                  className="text-sage-400 hover:text-red-500 p-1"
                  title="Delete question"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {q.sage_response && (
                <div className="bg-white rounded-lg p-3 mb-3 text-sm text-sage-600 border border-cream-200">
                  <span className="font-medium">Sage said:</span> {q.sage_response.substring(0, 200)}...
                </div>
              )}

              {isAnswering ? (
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
                      Send the answer to {wedding?.couple_names || 'the couple'}
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
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Quick Stats - Compact Row */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 border border-cream-200">
            <span className="text-xl font-bold text-sage-700">{stats.active}</span>
            <span className="text-sage-500 text-sm">Active</span>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 border border-cream-200">
            <span className="text-xl font-bold text-blue-600">{stats.activeThisWeek}</span>
            <span className="text-sage-500 text-sm">This Week</span>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 border border-cream-200">
            <span className="text-xl font-bold text-amber-600">{stats.upcoming}</span>
            <span className="text-sage-500 text-sm">Next 30 Days</span>
          </div>
          {uncertainQuestions.length > 0 && (
            <button
              onClick={() => setShowUncertainModal(true)}
              className="flex items-center gap-2 bg-amber-50 rounded-lg px-4 py-2 border border-amber-200 hover:bg-amber-100 transition-colors"
              title="Open the questions Sage could not answer confidently"
            >
              <span className="text-xl font-bold text-amber-600">{uncertainQuestions.length}</span>
              <span className="text-amber-600 text-sm">Sage Needs Help</span>
            </button>
          )}
        </div>

        {/* Who needs attention, by name. A count on its own means opening every
            profile to find out which couple it refers to. */}
        {stats.needsAttention > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
            <p className="text-red-700 text-sm font-medium mb-2">
              {stats.needsAttention === 1 ? '1 client needs attention' : `${stats.needsAttention} clients need attention`}
            </p>
            <div className="flex flex-wrap gap-2">
              {(stats.needsAttentionList || []).map(w => {
                const escalation = escalations[w.id]
                const firstMessage = escalation?.messages?.[0]
                return (
                  <button
                    key={w.id}
                    onClick={() => viewWeddingProfile(w, { focusUserId: firstMessage?.user_id })}
                    className="text-left bg-white border border-red-200 rounded-lg px-3 py-2 hover:border-red-400 hover:shadow-sm transition-all"
                    title={firstMessage?.content
                      ? `Open the conversation: "${String(firstMessage.content).slice(0, 120)}"`
                      : 'Open this profile'}
                  >
                    <span className="block text-sm font-medium text-red-700">
                      {w.project_name || w.couple_names || 'Unnamed wedding'}
                    </span>
                    <span className="block text-xs text-red-400">
                      {w.wedding_date
                        ? new Date(w.wedding_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'No date set'}
                      {escalation?.count ? ` · ${escalation.count} flagged message${escalation.count === 1 ? '' : 's'}` : ''}
                    </span>
                  </button>
                )
              })}
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
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <VenueSettings />
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

        {/* Meetings the matcher would not guess at.
            Sits above every view on purpose: a queue nobody passes is a queue
            nobody answers, and the whole point is that it asks rather than
            files a meeting on a shared first name. */}
        {reviewItems.length > 0 && (
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
                    <select
                      value={reviewChoice[item.id] || item.suggested_wedding_id || ''}
                      onChange={e => setReviewChoice(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="flex-1 min-w-[200px] border border-cream-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Whose is this?</option>
                      {weddings.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.couple_names}{w.wedding_date ? ` — ${w.wedding_date}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => assignReviewItem(item)}
                      disabled={reviewBusy === item.id || !(reviewChoice[item.id] || item.suggested_wedding_id)}
                      className="px-4 py-2 rounded-lg text-sm bg-sage-600 text-white disabled:opacity-40"
                    >
                      {reviewBusy === item.id ? 'Filing…' : 'File it'}
                    </button>
                    <button
                      onClick={() => ignoreReviewItem(item)}
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

        {/* Recommended Vendors View */}
        {mainView === 'vendors' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <RecommendedVendorsAdmin />
          </div>
        )}

        {/* Weddings View */}
        {mainView === 'weddings' && (
          <AdminWeddingList
            weddings={weddings}
            unlinkedProfiles={unlinkedProfiles}
            displayedWeddings={displayedWeddings}
            allMessages={allMessages}
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
            unreadCount={unreadCount}
            markAsRead={markAsRead}
            gmailConnected={gmailConnected}
            gmailSyncing={gmailSyncing}
            gmailStatus={gmailStatus}
            connectGmail={connectGmail}
            syncEmails={syncEmails}
            disconnectGmail={disconnectGmail}
            quoConnected={quoConnected}
            quoSyncing={quoSyncing}
            quoStatus={quoStatus}
            syncQuo={syncQuo}
            sweepCallers={sweepCallers}
            zoomConnected={zoomConnected}
            zoomSyncing={zoomSyncing}
            zoomStatus={zoomStatus}
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
    </div>
  )
}
