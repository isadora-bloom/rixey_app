import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Components still used directly in the main Admin view (not in profile)
import KnowledgeBaseAdmin from '../components/KnowledgeBaseAdmin'
import VenueSettings from '../components/VenueSettings'
import RecommendedVendorsAdmin from '../components/RecommendedVendorsAdmin'
import UsageStats from '../components/UsageStats'
import UpcomingMeetings from '../components/UpcomingMeetings'
import AdminInbox from '../components/AdminInbox'
import BorrowCatalog from '../components/BorrowCatalog'
import StorefrontAdmin from '../components/StorefrontAdmin'
import ManorDownloads from '../components/ManorDownloads'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'

// Extracted sub-components
import AdminHeader from './admin/AdminHeader'
import AdminWeddingList from './admin/AdminWeddingList'
import AdminWeddingProfile from './admin/AdminWeddingProfile'
import { detectEscalation } from './admin/adminUtils'

export default function Admin() {
  const navigate = useNavigate()
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
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [escalations, setEscalations] = useState({})
  const [planningNotes, setPlanningNotes] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
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
  const [notesHighlights, setNotesHighlights] = useState('')
  const [loadingHighlights, setLoadingHighlights] = useState(false)
  const [notesSearchQuery, setNotesSearchQuery] = useState('')
  const [collapsedNoteCategories, setCollapsedNoteCategories] = useState({})
  const [sortBy, setSortBy] = useState('lastActivity') // 'lastActivity' or 'weddingDate'
  const [pulseFilter, setPulseFilter] = useState('all') // 'all' | 'less' | 'typical' | 'more'
  const [uncertainQuestions, setUncertainQuestions] = useState([])
  const [answeringQuestion, setAnsweringQuestion] = useState(null)
  const [adminAnswer, setAdminAnswer] = useState('')
  const [addToKb, setAddToKb] = useState(false)
  const [kbCategory, setKbCategory] = useState('')
  const [kbSubcategory, setKbSubcategory] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)
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
  const [pulses, setPulses] = useState({})
  const [weddingPulse, setWeddingPulse] = useState(null)
  const [last24h, setLast24h] = useState({ signups: [], activity: [] })
  const [last24hLoading, setLast24hLoading] = useState(true)

  // Debug pulse key matching
  useEffect(() => {
    if (Object.keys(pulses).length > 0 && weddings.length > 0) {
      console.log('[Pulse] pulse keys (first 3):', Object.keys(pulses).slice(0, 3))
      console.log('[Pulse] wedding IDs (first 3):', weddings.slice(0, 3).map(w => w.id))
      console.log('[Pulse] first match?', pulses[weddings[0]?.id])
    }
  }, [pulses, weddings])

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

  useEffect(() => {
    loadData()
    checkGmailStatus()
    checkQuoStatus()
    checkZoomStatus()
    loadUncertainQuestions()
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
      const response = await fetch(`${API_URL}/api/gmail/sync`, {
        method: 'POST',
        headers: await authHeaders()
      })
      const data = await response.json()
      setGmailStatus(data.message || data.error)
      // Reload data to get any new planning notes
      loadData()
    } catch (err) {
      setGmailStatus('Failed to sync emails')
    }
    setGmailSyncing(false)
  }

  const disconnectGmail = async () => {
    try {
      await fetch(`${API_URL}/api/gmail/disconnect`, { method: 'POST', headers: await authHeaders() })
      setGmailConnected(false)
      setGmailStatus('Gmail disconnected')
    } catch (err) {
      console.error('Disconnect error:', err)
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
      const response = await fetch(`${API_URL}/api/quo/sync`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ forceReprocess })
      })

      if (!response.ok) {
        const errorText = await response.text()
        setQuoStatus(`Server error ${response.status}: ${errorText}`)
        setQuoSyncing(false)
        return
      }

      const data = await response.json()
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

  const syncZoom = async () => {
    setZoomSyncing(true)
    setZoomStatus('')
    try {
      const response = await fetch(`${API_URL}/api/zoom/sync`, {
        method: 'POST',
        headers: await authHeaders()
      })
      const data = await response.json()
      setZoomStatus(data.message || data.error)
      loadData()
    } catch (err) {
      setZoomStatus('Failed to sync Zoom meetings')
    }
    setZoomSyncing(false)
  }

  const reextractZoom = async () => {
    setZoomSyncing(true)
    setZoomStatus('')
    try {
      const response = await fetch(`${API_URL}/api/zoom/reextract`, { method: 'POST', headers: await authHeaders() })
      const data = await response.json()
      setZoomStatus(data.message || data.error)
      loadData()
    } catch (err) {
      setZoomStatus('Failed to re-extract notes')
    }
    setZoomSyncing(false)
  }

  const clearZoom = async () => {
    if (!window.confirm('Clear all stored Zoom transcripts and processing history? You\'ll need to click Sync after to re-download everything fresh.')) return
    setZoomSyncing(true)
    setZoomStatus('')
    try {
      const response = await fetch(`${API_URL}/api/zoom/clear`, { method: 'POST', headers: await authHeaders() })
      const data = await response.json()
      setZoomStatus(data.message || data.error)
    } catch (err) {
      setZoomStatus('Failed to clear Zoom data')
    }
    setZoomSyncing(false)
  }

  const disconnectZoom = async () => {
    try {
      await fetch(`${API_URL}/api/zoom/disconnect`, { method: 'POST', headers: await authHeaders() })
      setZoomConnected(false)
      setZoomStatus('Zoom disconnected')
    } catch (err) {
      console.error('Disconnect error:', err)
    }
  }

  const getNotesHighlights = async () => {
    if (!viewingWedding) return
    setLoadingHighlights(true)
    setNotesHighlights('')

    try {
      const response = await fetch(`${API_URL}/api/notes-highlights`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ weddingId: viewingWedding.id })
      })
      const data = await response.json()
      setNotesHighlights(data.highlights || data.error)
    } catch (err) {
      setNotesHighlights('Failed to generate highlights')
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

  const injectNote = async (userId) => {
    if (!injectText.trim() || injecting) return
    setInjecting(true)
    try {
      const res = await fetch(`${API_URL}/api/sage-messages/inject`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          user_id: userId,
          content: injectText.trim(),
          addToKb: injectKb,
          kbCategory: injectKbCat || 'General'
        })
      })
      const data = await res.json()
      if (data.message) {
        setWeddingMessages(prev => [...prev, data.message])
        setInjectText('')
        setInjectKb(false)
        setInjectKbCat('')
      }
    } catch (err) {
      console.error('Inject note failed:', err)
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
      const response = await fetch(`${API_URL}/api/uncertain-questions/${questionId}/answer`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          answer: adminAnswer,
          addToKnowledgeBase: addToKb,
          kbCategory: addToKb ? kbCategory : null,
          kbSubcategory: addToKb ? kbSubcategory : null
        })
      })

      const data = await response.json()
      if (data.success) {
        // Remove from list or update
        setUncertainQuestions(prev => prev.filter(q => q.id !== questionId))
        setAnsweringQuestion(null)
        setAdminAnswer('')
        setAddToKb(false)
        setKbCategory('')
        setKbSubcategory('')
      }
    } catch (err) {
      console.error('Failed to submit answer:', err)
    }
    setSubmittingAnswer(false)
  }

  const deleteUncertainQuestion = async (questionId) => {
    try {
      await fetch(`${API_URL}/api/uncertain-questions/${questionId}`, {
        method: 'DELETE',
        headers: await authHeaders()
      })
      setUncertainQuestions(prev => prev.filter(q => q.id !== questionId))
    } catch (err) {
      console.error('Failed to delete question:', err)
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

    // Load communication pulses for all weddings (background, non-blocking)
    authHeaders().then(hdrs =>
      fetch(`${API_URL}/api/communication-pulse`, { headers: hdrs })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(d => { console.log('[Pulse] got response:', d); if (d.pulses) setPulses(d.pulses); else console.warn('[Pulse] no pulses key in response:', d) })
        .catch(err => console.error('[Pulse] Failed to load pulses:', err))
    )

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
    try {
      await fetch(`${API_URL}/api/admin/notifications/${id}/read`, {
        method: 'PUT',
        headers: await authHeaders()
      })
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ))
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  const startEditing = (wedding) => {
    setEditingWedding(wedding.id)
    setHoneybook(wedding.honeybook_link || '')
    setGoogleSheets(wedding.google_sheets_link || '')
  }

  const saveLinks = async () => {
    setSaving(true)
    try {
      const response = await fetch(`${API_URL}/api/weddings/${editingWedding}/links`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({
          honeybook_link: honeybook || null,
          google_sheets_link: googleSheets || null
        })
      })

      if (response.ok) {
        setWeddings(weddings.map(w =>
          w.id === editingWedding
            ? { ...w, honeybook_link: honeybook || null, google_sheets_link: googleSheets || null }
            : w
        ))
        setEditingWedding(null)
      }
    } catch (err) {
      console.error('Failed to save links:', err)
    }
    setSaving(false)
  }

  const toggleArchive = async (weddingId, currentArchived) => {
    try {
      const response = await fetch(`${API_URL}/api/weddings/${weddingId}/archive`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ archived: !currentArchived })
      })

      if (response.ok) {
        setWeddings(weddings.map(w =>
          w.id === weddingId ? { ...w, archived: !currentArchived } : w
        ))
      }
    } catch (err) {
      console.error('Failed to toggle archive:', err)
    }
  }

  const markEscalationHandled = async (weddingId) => {
    const now = new Date().toISOString()
    try {
      const response = await fetch(`${API_URL}/api/weddings/${weddingId}/escalation`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ escalation_handled_at: now })
      })

      if (response.ok) {
        setWeddings(weddings.map(w =>
          w.id === weddingId ? { ...w, escalation_handled_at: now } : w
        ))
        // Clear the escalation status
        setEscalations(prev => ({
          ...prev,
          [weddingId]: { hasEscalation: false, count: 0, messages: [] }
        }))
      }
    } catch (err) {
      console.error('Failed to mark escalation handled:', err)
    }
  }

  const viewWeddingProfile = async (wedding) => {
    setViewingWedding(wedding)
    setWeddingPulse(null)
    setLoadingMessages(true)
    setSearchQuery('')
    setNotesSearchQuery('')
    setNotesHighlights('')
    setActiveTab('overview')

    // Fire-and-forget pulse load
    authHeaders().then(hdrs =>
      fetch(`${API_URL}/api/communication-pulse/${wedding.id}`, { headers: hdrs })
        .then(r => r.json())
        .then(d => { if (d.level) setWeddingPulse(d) })
        .catch(() => {})
    )

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

  const updateNoteStatus = async (noteId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/planning-notes/${noteId}`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        setPlanningNotes(planningNotes.map(n =>
          n.id === noteId ? { ...n, status: newStatus } : n
        ))
      }
    } catch (err) {
      console.error('Failed to update note status:', err)
    }
  }

  const addInternalNote = async () => {
    if (!newNoteText.trim() || !viewingWedding) return
    setSavingNote(true)
    try {
      const res = await fetch(`${API_URL}/api/internal-notes`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ weddingId: viewingWedding.id, content: newNoteText.trim() })
      })
      const data = await res.json()
      if (data.note) {
        setInternalNotes(prev => [data.note, ...prev])
        setNewNoteText('')
      }
    } catch (err) {
      console.error('Failed to add internal note:', err)
    }
    setSavingNote(false)
  }

  const deleteInternalNote = async (noteId) => {
    try {
      await fetch(`${API_URL}/api/internal-notes/${noteId}`, { method: 'DELETE', headers: await authHeaders() })
      setInternalNotes(prev => prev.filter(n => n.id !== noteId))
    } catch (err) {
      console.error('Failed to delete internal note:', err)
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
      const contractToken = (await authHeaders())['Authorization']
      const response = await fetch(`${API_URL}/api/extract-contract`, {
        method: 'POST',
        headers: contractToken ? { 'Authorization': contractToken } : {},
        body: formData
      })

      const data = await response.json()

      if (data.success) {
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
      } else {
        setUploadResult({ success: false, message: data.error })
      }
    } catch (err) {
      console.error('Upload error:', err)
      setUploadResult({ success: false, message: 'Failed to upload contract' })
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
      const response = await fetch(`${API_URL}/api/ask-contracts`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          weddingId: viewingWedding.id,
          question: contractQuestion
        })
      })

      const data = await response.json()
      setContractAnswer(data.answer || data.error)
    } catch (err) {
      console.error('Question error:', err)
      setContractAnswer('Failed to get answer. Make sure the server is running.')
    }

    setAskingQuestion(false)
  }

  const sendCheckin = async () => {
    if (!viewingWedding || checkingIn) return
    setCheckingIn(true)
    try {
      await fetch(`${API_URL}/api/checkin/${viewingWedding.id}`, { method: 'POST', headers: await authHeaders() })
      setCheckedIn(true)
      setTimeout(() => setCheckedIn(false), 3000)
    } catch (err) {
      console.error('Check-in failed:', err)
    }
    setCheckingIn(false)
  }

  const closeProfile = () => {
    setViewingWedding(null)
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
      const weddingDate = new Date(w.wedding_date)
      return weddingDate > new Date() && weddingDate < thirtyDaysFromNow
    })

    return {
      total: weddings.length,
      active: activeWeddings.length,
      archived: archivedWeddings.length,
      activeThisWeek: activeThisWeek.length,
      needsAttention: needsAttention.length,
      upcoming: upcoming.length
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const stats = getQuickStats()

  // Filter and sort weddings for display
  const displayedWeddings = weddings
    .filter(w => {
      if (showArchived) return w.archived
      return !w.archived
    })
    .filter(w => {
      if (pulseFilter === 'all') return true
      return pulses[w.id]?.level === pulseFilter
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
        return new Date(a.wedding_date) - new Date(b.wedding_date)
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
        closeProfile={closeProfile}
        weddingMessages={weddingMessages}
        setWeddingMessages={setWeddingMessages}
        loadingMessages={loadingMessages}
        selectedChatUser={selectedChatUser}
        setSelectedChatUser={setSelectedChatUser}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        escalations={escalations}
        markEscalationHandled={markEscalationHandled}
        weddingPulse={weddingPulse}
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
          {stats.needsAttention > 0 && (
            <div className="flex items-center gap-2 bg-red-50 rounded-lg px-4 py-2 border border-red-200">
              <span className="text-xl font-bold text-red-600">{stats.needsAttention}</span>
              <span className="text-red-600 text-sm">Needs Attention</span>
            </div>
          )}
          {uncertainQuestions.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-4 py-2 border border-amber-200">
              <span className="text-xl font-bold text-amber-600">{uncertainQuestions.length}</span>
              <span className="text-amber-600 text-sm">Sage Needs Help</span>
            </div>
          )}
        </div>

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
                      const borrowToken = (await authHeaders())['Authorization']
                      const res = await fetch(`${API_URL}/api/admin/borrow-catalog`, { method: 'POST', headers: borrowToken ? { 'Authorization': borrowToken } : {}, body: fd })
                      const data = await res.json()
                      if (data.item) {
                        setAddItemResult({ success: true, message: `"${data.item.item_name}" added to catalog.` })
                        setNewItemName(''); setNewItemCategory(''); setNewItemDescription(''); setNewItemImage(null)
                        setBorrowCatalogRefreshKey(k => k + 1)
                      } else {
                        setAddItemResult({ success: false, message: data.error || 'Failed to add item' })
                      }
                    } catch (err) {
                      setAddItemResult({ success: false, message: 'Network error' })
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
        {mainView === 'usage' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6">
            <UsageStats weddings={weddings} />
          </div>
        )}

        {/* Meetings View */}
        {mainView === 'meetings' && (
          <UpcomingMeetings weddings={weddings} />
        )}

        {/* Messages View */}
        {mainView === 'messages' && (
          <AdminInbox weddings={weddings} onUnreadChange={setUnreadMessages} />
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
            displayedWeddings={displayedWeddings}
            allMessages={allMessages}
            escalations={escalations}
            pulses={pulses}
            couplePhotos={couplePhotos}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
            sortBy={sortBy}
            setSortBy={setSortBy}
            pulseFilter={pulseFilter}
            setPulseFilter={setPulseFilter}
            stats={stats}
            editingWedding={editingWedding}
            setEditingWedding={setEditingWedding}
            honeybook={honeybook}
            setHoneybook={setHoneybook}
            googleSheets={googleSheets}
            setGoogleSheets={setGoogleSheets}
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
                {uncertainQuestions.length === 0 ? (
                  <p className="text-sage-400 text-center py-8">No uncertain questions right now</p>
                ) : (
                  <div className="space-y-4">
                    {uncertainQuestions.map(q => {
                      const wedding = weddings.find(w => w.id === q.wedding_id)
                      const isAnswering = answeringQuestion === q.id

                      return (
                        <div key={q.id} className={`rounded-xl p-4 border ${isAnswering ? 'border-amber-300 bg-amber-50' : 'border-cream-200 bg-cream-50'}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <p className="text-sage-800 font-medium">{q.question}</p>
                              <p className="text-sage-400 text-sm mt-1">
                                {wedding?.couple_names || 'Unknown'} · {new Date(q.created_at).toLocaleDateString()}
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
                                  id={`modal-kb-${q.id}`}
                                  checked={addToKb}
                                  onChange={(e) => setAddToKb(e.target.checked)}
                                  className="rounded border-cream-300"
                                />
                                <label htmlFor={`modal-kb-${q.id}`} className="text-sm text-sage-600">
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
