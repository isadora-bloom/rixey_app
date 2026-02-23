import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
import VendorChecklist from '../components/VendorChecklist'
import InspoGallery from '../components/InspoGallery'
import PlanningChecklist from '../components/PlanningChecklist'
import CouplePhoto from '../components/CouplePhoto'
import KnowledgeBaseAdmin from '../components/KnowledgeBaseAdmin'
import RecommendedVendorsAdmin from '../components/RecommendedVendorsAdmin'
import UsageStats from '../components/UsageStats'
import UpcomingMeetings from '../components/UpcomingMeetings'
import AdminInbox from '../components/AdminInbox'
import TimelineBuilder from '../components/TimelineBuilder'
import TableLayoutPlanner from '../components/TableLayoutPlanner'
import BorrowCatalog from '../components/BorrowCatalog'

// Stress/escalation keywords to detect
const ESCALATION_KEYWORDS = [
  'stressed', 'stress', 'anxious', 'worried', 'frustrated', 'frustrating',
  'overwhelmed', 'help', 'urgent', 'problem', 'issue', 'wrong', 'mistake',
  'angry', 'upset', 'confused', 'lost', 'panic', 'emergency', 'asap',
  'deadline', 'behind', 'late', 'cancel', 'disaster', 'terrible', 'awful'
]

// Calculate time since last activity
function getLastActivity(messages) {
  if (!messages || messages.length === 0) return null

  // Find the most recent user message
  const userMessages = messages.filter(m => m.sender === 'user')
  if (userMessages.length === 0) return null

  const lastMessage = userMessages.reduce((latest, msg) => {
    return new Date(msg.created_at) > new Date(latest.created_at) ? msg : latest
  })

  const lastDate = new Date(lastMessage.created_at)
  const now = new Date()
  const diffMs = now - lastDate
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  let display, status
  if (diffMinutes < 60) {
    display = `${diffMinutes}m ago`
    status = 'recent'
  } else if (diffHours < 24) {
    display = `${diffHours}h ago`
    status = 'recent'
  } else if (diffDays < 7) {
    display = `${diffDays}d ago`
    status = 'active'
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    display = `${weeks}w ago`
    status = 'moderate'
  } else {
    const months = Math.floor(diffDays / 30)
    display = `${months}mo ago`
    status = 'inactive'
  }

  return { display, status, diffDays, lastDate }
}

function detectEscalation(messages, handledAt = null) {
  const recentMessages = messages.filter(m => {
    const msgDate = new Date(m.created_at)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    // Only count messages after the last "handled" timestamp
    const afterHandled = !handledAt || msgDate > new Date(handledAt)
    return msgDate > weekAgo && m.sender === 'user' && afterHandled
  })

  const escalationMessages = recentMessages.filter(msg => {
    const content = msg.content.toLowerCase()
    return ESCALATION_KEYWORDS.some(keyword => content.includes(keyword))
  })

  return {
    hasEscalation: escalationMessages.length > 0,
    count: escalationMessages.length,
    messages: escalationMessages
  }
}

// Direct messages panel for individual wedding profile
function DirectMessagesPanel({ weddingId, weddingName }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadMessages()
  }, [weddingId])

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const loadMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/messages/${weddingId}`)
      const data = await response.json()
      setMessages(data.messages || [])

      // Mark client messages as read
      await fetch(`${API_URL}/api/messages/read/${weddingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderType: 'client' })
      })
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
    setLoading(false)
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weddingId,
          senderType: 'admin',
          content: newMessage.trim()
        })
      })
      setNewMessage('')
      loadMessages()
    } catch (err) {
      console.error('Failed to send message:', err)
    }
    setSending(false)
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    })
  }

  return (
    <div>
      <p className="text-sage-500 text-sm mb-4">Direct messages with {weddingName}</p>

      <div className="bg-cream-50 rounded-xl border border-cream-200 overflow-hidden">
        <div className="h-80 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-sage-400 text-center py-8">Loading messages...</p>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sage-500">No messages yet</p>
              <p className="text-sage-400 text-sm">Send a message to start the conversation</p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.sender_type === 'admin'
                      ? 'bg-sage-600 text-white rounded-br-md'
                      : 'bg-white border border-cream-200 text-sage-800 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    msg.sender_type === 'admin' ? 'text-sage-200' : 'text-sage-400'
                  }`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="p-3 border-t border-cream-200 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-cream-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-4 py-2 bg-sage-600 text-white rounded-full hover:bg-sage-700 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
  const [activeTab, setActiveTab] = useState('notes') // 'notes' or 'messages'
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

  useEffect(() => {
    loadData()
    checkGmailStatus()
    checkQuoStatus()
    checkZoomStatus()
    loadUncertainQuestions()
    loadAllCouplePhotos()
  }, [])

  const checkGmailStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/gmail/status`)
      const data = await response.json()
      setGmailConnected(data.connected)
    } catch (err) {
      console.error('Gmail status check error:', err)
    }
  }

  const connectGmail = async () => {
    try {
      const response = await fetch(`${API_URL}/api/gmail/auth`)
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
        method: 'POST'
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
      await fetch(`${API_URL}/api/gmail/disconnect`, { method: 'POST' })
      setGmailConnected(false)
      setGmailStatus('Gmail disconnected')
    } catch (err) {
      console.error('Disconnect error:', err)
    }
  }

  const checkQuoStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/quo/status`)
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
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`${API_URL}/api/zoom/status`)
      const data = await response.json()
      setZoomConnected(data.connected)
    } catch (err) {
      console.error('Zoom status check error:', err)
    }
  }

  const connectZoom = async () => {
    try {
      const response = await fetch(`${API_URL}/api/zoom/auth`)
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
        method: 'POST'
      })
      const data = await response.json()
      setZoomStatus(data.message || data.error)
      loadData()
    } catch (err) {
      setZoomStatus('Failed to sync Zoom meetings')
    }
    setZoomSyncing(false)
  }

  const disconnectZoom = async () => {
    try {
      await fetch(`${API_URL}/api/zoom/disconnect`, { method: 'POST' })
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
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`${API_URL}/api/uncertain-questions`)
      const data = await response.json()
      setUncertainQuestions(data.questions || [])
    } catch (err) {
      console.error('Failed to load uncertain questions:', err)
    }
  }

  const loadAllCouplePhotos = async () => {
    try {
      // Load couple photos via server endpoint (bypasses RLS)
      const response = await fetch(`${API_URL}/api/couple-photos/all`)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: adminAnswer,
          addToKb,
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
        method: 'DELETE'
      })
      setUncertainQuestions(prev => prev.filter(q => q.id !== questionId))
    } catch (err) {
      console.error('Failed to delete question:', err)
    }
  }

  const loadData = async () => {
    // Load notifications via server endpoint (bypasses RLS)
    try {
      const notifsRes = await fetch(`${API_URL}/api/admin/notifications`)
      const notifsData = await notifsRes.json()
      setNotifications(notifsData.notifications || [])
    } catch (err) {
      console.error('Failed to load notifications:', err)
      setNotifications([])
    }

    // Load weddings with profiles via server endpoint (bypasses RLS)
    let weddingsData = []
    try {
      const weddingsRes = await fetch(`${API_URL}/api/admin/weddings`)
      const weddingsJson = await weddingsRes.json()
      weddingsData = weddingsJson.weddings || []
      setWeddings(weddingsData)
    } catch (err) {
      console.error('Failed to load weddings:', err)
      setWeddings([])
    }

    // Load all Sage messages for escalation detection via server (bypasses RLS)
    if (weddingsData && weddingsData.length > 0) {
      try {
        const messagesRes = await fetch(`${API_URL}/api/sage-messages/all`)
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
        method: 'PUT'
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    setLoadingMessages(true)
    setSearchQuery('')
    setNotesSearchQuery('')
    setNotesHighlights('')
    setActiveTab('notes')

    // Refresh couple photo for this wedding
    try {
      const response = await fetch(`${API_URL}/api/couple-photo/${wedding.id}`)
      const data = await response.json()
      if (data.photo) {
        setCouplePhotos(prev => ({ ...prev, [wedding.id]: data.photo.image_url }))
      }
    } catch (err) {
      console.error('Failed to load couple photo:', err)
    }

    // Load Sage chat messages via server endpoint (bypasses RLS)
    try {
      const messagesRes = await fetch(`${API_URL}/api/sage-messages/${wedding.id}`)
      const messagesData = await messagesRes.json()
      setWeddingMessages(messagesData.messages || [])
    } catch (err) {
      console.error('Failed to load Sage messages:', err)
      setWeddingMessages([])
    }

    // Load planning notes via server endpoint (bypasses RLS)
    try {
      const notesRes = await fetch(`${API_URL}/api/planning-notes/${wedding.id}`)
      const notesData = await notesRes.json()
      setPlanningNotes(notesData.notes || [])
    } catch (err) {
      console.error('Failed to load planning notes:', err)
      setPlanningNotes([])
    }

    // Load timeline summary
    try {
      const timelineRes = await fetch(`${API_URL}/api/timeline/${wedding.id}`)
      const timelineData = await timelineRes.json()
      if (timelineData.timeline) {
        const tl = timelineData.timeline
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
    } catch (err) {
      console.error('Failed to load timeline:', err)
      setTimelineSummary(null)
    }

    // Load table summary
    try {
      const tablesRes = await fetch(`${API_URL}/api/tables/${wedding.id}`)
      const tablesData = await tablesRes.json()
      if (tablesData.tables) {
        const tb = tablesData.tables
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
    } catch (err) {
      console.error('Failed to load tables:', err)
      setTableSummary(null)
    }

    // Load staffing summary
    try {
      const staffingRes = await fetch(`${API_URL}/api/staffing/${wedding.id}`)
      const staffingData = await staffingRes.json()
      if (staffingData.staffing) {
        setStaffingSummary(staffingData.staffing)
      } else {
        setStaffingSummary(null)
      }
    } catch (err) {
      console.error('Failed to load staffing:', err)
      setStaffingSummary(null)
    }

    // Load budget (only show if couple shared it)
    try {
      const budgetRes = await fetch(`${API_URL}/api/budget/${wedding.id}`)
      if (budgetRes.ok) {
        const budgetData = await budgetRes.json()
        if (budgetData.budget?.is_shared) {
          setSharedBudget(budgetData.budget)
        } else {
          setSharedBudget(null)
        }
      } else {
        setSharedBudget(null)
      }
    } catch (err) {
      console.error('Failed to load budget:', err)
      setSharedBudget(null)
    }

    // Load borrow selections
    try {
      const borrowRes = await fetch(`${API_URL}/api/borrow-selections/${wedding.id}`)
      const borrowData = await borrowRes.json()
      setBorrowSelections(borrowData.selections || [])
    } catch (err) {
      console.error('Failed to load borrow selections:', err)
      setBorrowSelections([])
    }

    // Load recent activities
    try {
      setLoadingActivities(true)
      const activitiesRes = await fetch(`${API_URL}/api/activities/${wedding.id}?limit=20`)
      const activitiesData = await activitiesRes.json()
      setActivities(activitiesData.activities || [])
    } catch (err) {
      console.error('Failed to load activities:', err)
      setActivities([])
    }
    setLoadingActivities(false)

    setLoadingMessages(false)
  }

  const updateNoteStatus = async (noteId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/planning-notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

  const handleContractUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !viewingWedding) return

    setUploadingContract(true)
    setUploadResult(null)

    const formData = new FormData()
    formData.append('contract', file)
    formData.append('weddingId', viewingWedding.id)

    try {
      const response = await fetch(`${API_URL}/api/extract-contract`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setUploadResult({
          success: true,
          message: `Extracted ${data.notesExtracted} notes from contract`
        })
        // Reload planning notes via server endpoint
        const notesRes = await fetch(`${API_URL}/api/planning-notes/${viewingWedding.id}`)
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
        headers: { 'Content-Type': 'application/json' },
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

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'vendor': return '👥'
      case 'vendor_contact': return '📞'
      case 'guest_count': return '🎫'
      case 'decor': return '🎨'
      case 'ceremony': return '💒'
      case 'allergy': return '⚠️'
      case 'timeline': return '⏰'
      case 'colors': return '🎨'
      case 'note': return '📝'
      case 'sms_message': return '💬'
      case 'call_transcript': return '📱'
      case 'zoom_transcript': return '🎥'
      case 'email': return '📧'
      case 'borrow_selection': return '📋'
      default: return '📌'
    }
  }

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'vendor': return 'Vendor'
      case 'vendor_contact': return 'Contact Info'
      case 'guest_count': return 'Guest Count'
      case 'decor': return 'Decor'
      case 'ceremony': return 'Ceremony'
      case 'allergy': return 'Allergy'
      case 'timeline': return 'Timeline'
      case 'colors': return 'Colors'
      case 'note': return 'Note'
      case 'sms_message': return 'SMS'
      case 'call_transcript': return 'Call'
      case 'zoom_transcript': return 'Zoom'
      case 'email': return 'Email'
      case 'borrow_selection': return 'Borrow Selection'
      default: return 'Info'
    }
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
    setBorrowSelections([])
    setShowAddItemForm(false)
    setAddItemResult(null)
    setNewItemName('')
    setNewItemCategory('')
    setNewItemDescription('')
    setNewItemImage(null)
  }

  // Filter messages by search query
  const filteredMessages = searchQuery.trim()
    ? weddingMessages.filter(m =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : weddingMessages

  // Get only user messages (questions)
  const userQuestions = filteredMessages.filter(m => m.sender === 'user')

  // Get message stats
  const getMessageStats = () => {
    const total = weddingMessages.length
    const userMsgs = weddingMessages.filter(m => m.sender === 'user').length
    const sageMsgs = weddingMessages.filter(m => m.sender === 'sage').length

    // Get unique days with activity
    const uniqueDays = new Set(
      weddingMessages.map(m => new Date(m.created_at).toDateString())
    ).size

    return { total, userMsgs, sageMsgs, uniqueDays }
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
    const msgStats = getMessageStats()
    const profileMap = {}
    viewingWedding.profiles?.forEach(p => { profileMap[p.id] = p })
    const escalation = escalations[viewingWedding.id]

    return (
      <div className="min-h-screen min-h-[100dvh] bg-cream-50">
        <header className="bg-white border-b border-cream-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              {/* Couple Photo in Header */}
              {couplePhotos[viewingWedding.id] ? (
                <img
                  src={couplePhotos[viewingWedding.id]}
                  alt={viewingWedding.couple_names}
                  className="w-14 h-14 rounded-full object-cover border-2 border-sage-300 shadow-sm cursor-pointer hover:opacity-80 transition"
                  onClick={() => setEnlargedPhoto(couplePhotos[viewingWedding.id])}
                  title="Click to enlarge"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-cream-100 flex items-center justify-center border-2 border-cream-200">
                  <span className="text-sage-400 text-xl">
                    {viewingWedding.couple_names?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-xl sm:text-2xl text-sage-700">
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
            <button
              onClick={closeProfile}
              className="text-sage-500 hover:text-sage-700 text-sm font-medium"
            >
              Back to Admin
            </button>
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
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Stats & Info */}
            <div className="lg:col-span-1 space-y-4 sm:space-y-6">
              {/* Quick Stats */}
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-3 sm:p-6">
                <h2 className="font-serif text-lg text-sage-700 mb-3 sm:mb-4">Activity Overview</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                  <div className="bg-sage-50 rounded-lg p-2 sm:p-3 flex sm:block items-center justify-between sm:text-center">
                    <p className="text-sage-500 text-xs sm:hidden">Questions Asked</p>
                    <p className="text-xl sm:text-2xl font-semibold text-sage-700">{msgStats.userMsgs}</p>
                    <p className="text-sage-500 text-xs hidden sm:block">Questions Asked</p>
                  </div>
                  <div className="bg-cream-100 rounded-lg p-2 sm:p-3 flex sm:block items-center justify-between sm:text-center">
                    <p className="text-sage-500 text-xs sm:hidden">Total Messages</p>
                    <p className="text-xl sm:text-2xl font-semibold text-sage-700">{msgStats.total}</p>
                    <p className="text-sage-500 text-xs hidden sm:block">Total Messages</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2 sm:p-3 flex sm:block items-center justify-between sm:text-center">
                    <p className="text-sage-500 text-xs sm:hidden">Active Days</p>
                    <p className="text-xl sm:text-2xl font-semibold text-sage-700">{msgStats.uniqueDays}</p>
                    <p className="text-sage-500 text-xs hidden sm:block">Active Days</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 sm:p-3 flex sm:block items-center justify-between sm:text-center">
                    <p className="text-sage-500 text-xs sm:hidden">Members</p>
                    <p className="text-xl sm:text-2xl font-semibold text-sage-700">{viewingWedding.profiles?.length || 0}</p>
                    <p className="text-sage-500 text-xs hidden sm:block">Members</p>
                  </div>
                </div>
              </div>

              {/* API Usage & Costs - Collapsible */}
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
                <button
                  onClick={() => setShowUsageStats(!showUsageStats)}
                  className="w-full p-3 sm:p-4 flex items-center justify-between text-left hover:bg-cream-50 transition"
                >
                  <h2 className="font-serif text-lg text-sage-700">API Usage</h2>
                  <svg
                    className={`w-5 h-5 text-sage-400 transition-transform ${showUsageStats ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUsageStats && (
                  <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                    <UsageStats weddingId={viewingWedding.id} />
                  </div>
                )}
              </div>

              {/* Members */}
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
                <h2 className="font-serif text-lg text-sage-700 mb-4">Wedding Party</h2>
                <div className="space-y-3">
                  {viewingWedding.profiles?.length > 0 ? (
                    viewingWedding.profiles.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-cream-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sage-800">{p.name}</p>
                          <p className="text-sage-500 text-xs">{p.email}</p>
                        </div>
                        <span className="bg-sage-100 text-sage-600 text-xs px-2 py-1 rounded">
                          {p.role.replace('couple-', '').replace('-', ' ')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sage-400 text-sm">No members yet</p>
                  )}
                </div>
              </div>

              {/* Links Status */}
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
                <h2 className="font-serif text-lg text-sage-700 mb-4">Planning Tools</h2>
                <div className="space-y-2 text-sm">
                  {viewingWedding.honeybook_link ? (
                    <a
                      href={viewingWedding.honeybook_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-green-600 hover:text-green-700"
                    >
                      <span>✓</span> HoneyBook Portal
                      <span className="text-sage-400">↗</span>
                    </a>
                  ) : (
                    <p className="text-amber-600">⚠ No HoneyBook link</p>
                  )}
                  {viewingWedding.google_sheets_link ? (
                    <a
                      href={viewingWedding.google_sheets_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-green-600 hover:text-green-700"
                    >
                      <span>✓</span> Planning Spreadsheet
                      <span className="text-sage-400">↗</span>
                    </a>
                  ) : (
                    <p className="text-amber-600">⚠ No Google Sheets link</p>
                  )}
                </div>
              </div>

              {/* Shared Budget Card — only shows if couple opted to share */}
              {sharedBudget && (() => {
                const cats = sharedBudget.categories || {}
                const totalBudgeted = Object.values(cats).reduce((s, c) => s + (c.budgeted || 0), 0)
                const totalCommitted = Object.values(cats).reduce((s, c) => s + (c.committed || 0), 0)
                const effectiveBudget = sharedBudget.total_budget || totalBudgeted
                const pct = effectiveBudget > 0 ? Math.min(100, Math.round((totalCommitted / effectiveBudget) * 100)) : 0
                const isOver = totalCommitted > effectiveBudget && effectiveBudget > 0
                return (
                  <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6">
                    <h2 className="font-serif text-lg text-sage-700 flex items-center gap-2 mb-3">
                      <span>💰</span> Budget <span className="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Shared by couple</span>
                    </h2>
                    <div className="space-y-2 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-sage-500">Total Budget</span>
                        <span className="font-medium text-sage-700">${effectiveBudget.toLocaleString('en-US')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage-500">Committed</span>
                        <span className={`font-medium ${isOver ? 'text-red-600' : 'text-sage-700'}`}>
                          ${totalCommitted.toLocaleString('en-US')} ({pct}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-cream-100 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full ${isOver ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="space-y-1">
                      {Object.entries(cats).filter(([, c]) => c.budgeted > 0 || c.committed > 0).map(([key, cat]) => (
                        <div key={key} className="flex justify-between text-xs text-sage-600">
                          <span>{cat.label}</span>
                          <span>${(cat.committed || 0).toLocaleString()} / ${(cat.budgeted || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Timeline Summary Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-serif text-lg text-sage-700 flex items-center gap-2">
                    <span>📅</span> Timeline
                  </h2>
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className="text-sage-500 hover:text-sage-700 text-sm"
                  >
                    View Full →
                  </button>
                </div>
                {timelineSummary ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-sage-500">Ceremony</span>
                      <span className="font-medium text-sage-700">
                        {timelineSummary.ceremonyTime ?
                          new Date(`2000-01-01T${timelineSummary.ceremonyTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sage-500">Reception Ends</span>
                      <span className="font-medium text-sage-700">
                        {timelineSummary.receptionEnd ?
                          new Date(`2000-01-01T${timelineSummary.receptionEnd}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sage-500">First Look</span>
                      <span className={`font-medium ${timelineSummary.doingFirstLook ? 'text-green-600' : 'text-sage-500'}`}>
                        {timelineSummary.doingFirstLook ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sage-500">Dinner Style</span>
                      <span className="font-medium text-sage-700 capitalize">{timelineSummary.dinnerType || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sage-500">Events Planned</span>
                      <span className="font-medium text-sage-700">{timelineSummary.includedEvents || 0}</span>
                    </div>
                    {timelineSummary.updatedAt && (
                      <p className="text-xs text-sage-400 pt-2 border-t border-cream-100">
                        Last updated: {new Date(timelineSummary.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sage-400 text-sm">No timeline created yet</p>
                )}
              </div>

              {/* Table Layout Summary Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-serif text-lg text-sage-700 flex items-center gap-2">
                    <span>🪑</span> Table Layout
                  </h2>
                  <button
                    onClick={() => setActiveTab('tables')}
                    className="text-sage-500 hover:text-sage-700 text-sm"
                  >
                    View Full →
                  </button>
                </div>
                {tableSummary ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-sage-500">Guest Count</span>
                      <span className="font-medium text-sage-700">{tableSummary.guestCount || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sage-500">Tables Needed</span>
                      <span className="font-medium text-sage-700">{tableSummary.tablesNeeded || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sage-500">Table Shape</span>
                      <span className="font-medium text-sage-700 capitalize">{tableSummary.tableShape || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sage-500">Head Table</span>
                      <span className={`font-medium ${tableSummary.headTable ? 'text-green-600' : 'text-sage-500'}`}>
                        {tableSummary.headTable ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sage-500">Sweetheart Table</span>
                      <span className={`font-medium ${tableSummary.sweetheartTable ? 'text-green-600' : 'text-sage-500'}`}>
                        {tableSummary.sweetheartTable ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {(tableSummary.linenColor || tableSummary.napkinColor) && (
                      <div className="flex justify-between items-center">
                        <span className="text-sage-500">Colors</span>
                        <div className="flex items-center gap-2">
                          {tableSummary.linenColor && (
                            <span className="capitalize text-sage-700">{tableSummary.linenColor}</span>
                          )}
                          {tableSummary.linenColor && tableSummary.napkinColor && <span className="text-sage-300">/</span>}
                          {tableSummary.napkinColor && (
                            <span className="capitalize text-sage-700">{tableSummary.napkinColor}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {tableSummary.updatedAt && (
                      <p className="text-xs text-sage-400 pt-2 border-t border-cream-100">
                        Last updated: {new Date(tableSummary.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sage-400 text-sm">No table layout created yet</p>
                )}
              </div>

              {/* Staffing Summary Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
                <h2 className="font-serif text-lg text-sage-700 flex items-center gap-2 mb-3">
                  <span>🙋</span> Staffing Estimate
                </h2>
                {staffingSummary ? (
                  <div className="space-y-3 text-sm">
                    {staffingSummary.friday_total > 0 && (
                      <div className="bg-amber-50 rounded-lg p-3">
                        <p className="font-medium text-amber-800 mb-1">Friday Night</p>
                        <div className="flex justify-between text-amber-700">
                          <span>Bartenders: {staffingSummary.friday_bartenders}</span>
                          <span>Extra Hands: {staffingSummary.friday_extra_hands}</span>
                        </div>
                      </div>
                    )}
                    <div className="bg-sage-50 rounded-lg p-3">
                      <p className="font-medium text-sage-800 mb-1">Saturday</p>
                      <div className="flex justify-between text-sage-700">
                        <span>Bartenders: {staffingSummary.saturday_bartenders}</span>
                        <span>Extra Hands: {staffingSummary.saturday_extra_hands}</span>
                      </div>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-cream-100">
                      <span className="font-medium text-sage-700">Weekend Total</span>
                      <span className="font-bold text-sage-800">
                        {staffingSummary.total_staff} staff · ${Number(staffingSummary.total_cost).toLocaleString()}
                      </span>
                    </div>
                    {staffingSummary.updated_at && (
                      <p className="text-xs text-sage-400">
                        Last updated: {new Date(staffingSummary.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sage-400 text-sm">No staffing estimate yet</p>
                )}
              </div>

              {/* Allergy / Dietary Notes Card */}
              {(() => {
                const allergyNotes = planningNotes.filter(n => n.category === 'allergy')
                if (allergyNotes.length === 0) return null
                return (
                  <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-300 p-5">
                    <h2 className="font-serif text-lg text-amber-800 flex items-center gap-2 mb-3">
                      <span>⚠</span> Dietary &amp; Allergy Notes
                    </h2>
                    <ul className="space-y-2">
                      {allergyNotes.map(n => (
                        <li key={n.id} className="text-amber-900 text-sm bg-amber-100 rounded-lg px-3 py-2">
                          {n.content}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}

              {/* Borrow Selections Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-serif text-lg text-sage-700 flex items-center gap-2">
                    <span>📋</span> Borrow Selections
                  </h2>
                  <button
                    onClick={() => setActiveTab('borrow')}
                    className="text-sage-500 hover:text-sage-700 text-sm"
                  >
                    View All →
                  </button>
                </div>
                {borrowSelections.length > 0 ? (
                  <ul className="space-y-1">
                    {borrowSelections.map(s => (
                      <li key={s.item_id} className="text-sm text-sage-700 flex items-center gap-2">
                        <span className="text-sage-400">•</span> {s.item_name}
                        {s.category && <span className="text-sage-400 text-xs">({s.category})</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sage-400 text-sm">No items selected yet</p>
                )}
              </div>

              {/* Contract Upload */}
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
                <h2 className="font-serif text-lg text-sage-700 mb-4">Upload Contract</h2>
                <p className="text-sage-500 text-sm mb-4">
                  Upload vendor contracts (PDF or image) and Claude will extract key details as planning notes.
                </p>
                <label className={`block w-full p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition ${
                  uploadingContract
                    ? 'border-sage-300 bg-sage-50'
                    : 'border-cream-300 hover:border-sage-400 hover:bg-cream-50'
                }`}>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleContractUpload}
                    disabled={uploadingContract}
                    className="hidden"
                  />
                  {uploadingContract ? (
                    <span className="text-sage-600">
                      <svg className="w-5 h-5 animate-spin inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Extracting details...
                    </span>
                  ) : (
                    <span className="text-sage-500">
                      <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Click to upload PDF or image
                    </span>
                  )}
                </label>
                {uploadResult && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${
                    uploadResult.success
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {uploadResult.message}
                  </div>
                )}
              </div>

              {/* Ask About Wedding */}
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
                <h2 className="font-serif text-lg text-sage-700 mb-4">Ask About This Wedding</h2>
                <p className="text-sage-500 text-sm mb-3">
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
            </div>

            {/* Planning Notes & Messages */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-3 sm:p-6">
                {/* Mobile: Dropdown selector */}
                <div className="sm:hidden mb-4">
                  <select
                    value={activeTab}
                    onChange={(e) => setActiveTab(e.target.value)}
                    className="w-full p-3 border border-cream-200 rounded-lg bg-cream-50 text-sage-700 font-medium focus:outline-none focus:ring-2 focus:ring-sage-300"
                  >
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
                    <option value="timeline">Timeline</option>
                    <option value="tables">Tables</option>
                    <option value="borrow">Borrow Brochure</option>
                    <option value="activity">
                      Recent Activity {activities.length > 0 ? `(${activities.length})` : ''}
                    </option>
                  </select>
                </div>

                {/* Desktop: Tab buttons */}
                <div className="hidden sm:flex gap-4 mb-4 border-b border-cream-200 overflow-x-auto scrollbar-hide -mx-6 px-6">
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'notes'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Planning Notes
                    {planningNotes.filter(n => n.status === 'pending').length > 0 && (
                      <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                        {planningNotes.filter(n => n.status === 'pending').length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('vendors')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'vendors'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Vendors & Contracts
                  </button>
                  <button
                    onClick={() => setActiveTab('inspo')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'inspo'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Inspiration
                  </button>
                  <button
                    onClick={() => setActiveTab('checklist')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'checklist'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Checklist
                  </button>
                  <button
                    onClick={() => { setActiveTab('messages'); setSelectedChatUser(null); setSearchQuery('') }}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'messages'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    All Conversations
                  </button>
                  <button
                    onClick={() => setActiveTab('uncertain')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'uncertain'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Uncertain Q's
                    {uncertainQuestions.filter(q => q.wedding_id === viewingWedding.id).length > 0 && (
                      <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                        {uncertainQuestions.filter(q => q.wedding_id === viewingWedding.id).length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('meetings')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'meetings'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Meetings
                  </button>
                  <button
                    onClick={() => setActiveTab('direct-messages')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'direct-messages'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Direct Messages
                  </button>
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'timeline'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    onClick={() => setActiveTab('tables')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'tables'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Tables
                  </button>
                  <button
                    onClick={() => setActiveTab('borrow')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'borrow'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Borrow Brochure
                    {borrowSelections.length > 0 && (
                      <span className="ml-2 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                        {borrowSelections.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'activity'
                        ? 'border-sage-600 text-sage-700'
                        : 'border-transparent text-sage-400 hover:text-sage-600'
                    }`}
                  >
                    Recent Activity
                    {activities.length > 0 && (
                      <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                        {activities.length}
                      </span>
                    )}
                  </button>
                </div>

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
                      /* ── Chat Thread View ── */
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
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
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
                                          : 'bg-cream-100 text-sage-800 rounded-bl-sm border border-cream-200'
                                      }`}>
                                        {isEscalation && (
                                          <span className="block text-xs text-red-500 font-medium mb-1">Needs attention</span>
                                        )}
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()
                    ) : (
                      /* ── User List View ── */
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

                {/* Borrow Brochure Tab */}
                {activeTab === 'borrow' && (
                  <div>
                    {/* Add Item Form Toggle */}
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sage-500 text-sm">
                        Catalog with couple's selections checked. Add new items below.
                      </p>
                      <button
                        onClick={() => { setShowAddItemForm(v => !v); setAddItemResult(null) }}
                        className="px-4 py-2 bg-sage-600 text-white rounded-xl text-sm font-medium hover:bg-sage-700 transition"
                      >
                        {showAddItemForm ? '× Cancel' : '+ Add Item'}
                      </button>
                    </div>

                    {/* Inline Add Item Form */}
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
                              <option value="">Select category…</option>
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
                            placeholder="Short description of the item…"
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
                              const res = await fetch(`${API_URL}/api/admin/borrow-catalog`, { method: 'POST', body: fd })
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
                          {savingNewItem ? 'Saving…' : 'Save Item'}
                        </button>
                      </div>
                    )}

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
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Main Admin View
  return (
    <div className="min-h-screen min-h-[100dvh] bg-cream-50">
      {/* Header with integrated navigation */}
      <header className="bg-white border-b border-cream-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between py-3">
            <h1 className="font-serif text-xl text-sage-700">Admin Dashboard</h1>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/staff'); }}
              className="text-sage-500 hover:text-sage-700 text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
          {/* Navigation Tabs in Header */}
          <div className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
            {[
              { id: 'weddings', label: 'Weddings', count: stats.active },
              { id: 'messages', label: 'Messages', count: unreadMessages, alert: unreadMessages > 0 },
              { id: 'meetings', label: 'Meetings' },
              { id: 'vendors', label: 'Vendors' },
              { id: 'knowledge-base', label: 'KB' },
              { id: 'usage', label: 'Usage' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMainView(tab.id)}
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

        {/* Knowledge Base View */}
        {mainView === 'knowledge-base' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
            <KnowledgeBaseAdmin />
          </div>
        )}

        {/* Usage Stats View */}
        {mainView === 'usage' && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
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
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
            <RecommendedVendorsAdmin />
          </div>
        )}

        {/* Weddings View */}
        {mainView === 'weddings' && (
        <>
        {/* Needs Attention Section - Only show if there are items */}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h2 className="font-serif text-xl text-sage-700">
                  {showArchived ? 'Archived Weddings' : 'Active Weddings'}
                </h2>
                <div className="flex items-center gap-4">
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
                  <div className="flex gap-2">
                    <button
                      onClick={syncZoom}
                      disabled={zoomSyncing}
                      className="flex-1 px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
                    >
                      {zoomSyncing ? 'Syncing...' : 'Sync'}
                    </button>
                    <button
                      onClick={disconnectZoom}
                      className="px-4 py-2 text-sage-500 hover:text-sage-700 text-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                  {zoomStatus && (
                    <p className="text-sage-600 text-sm bg-cream-50 p-2 rounded">{zoomStatus}</p>
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
        )}

        {/* Uncertain Questions Modal */}
        {showUncertainModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-cream-200">
                <div>
                  <h3 className="font-serif text-xl text-sage-700">Sage Needs Help</h3>
                  <p className="text-sage-500 text-sm">Questions Sage was uncertain about (less than 75% confident)</p>
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
