import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import CouplePhoto from '../components/CouplePhoto'
import VendorChecklist from '../components/VendorChecklist'
import InspoGallery from '../components/InspoGallery'
import PlanningChecklist from '../components/PlanningChecklist'
import OnboardingChecklist from '../components/OnboardingChecklist'
import BookingCalendly from '../components/BookingCalendly'
import ClientInbox from '../components/ClientInbox'
import TimelineBuilder from '../components/TimelineBuilder'
import TableLayoutPlanner from '../components/TableLayoutPlanner'
import StaffingCalculator from '../components/StaffingCalculator'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Countdown component
function WeddingCountdown({ weddingDate }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const wedding = new Date(weddingDate)
      const now = new Date()
      const difference = wedding - now

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60)
        })
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 60000) // Update every minute
    return () => clearInterval(timer)
  }, [weddingDate])

  if (!weddingDate) return null

  const weddingPassed = new Date(weddingDate) < new Date()
  if (weddingPassed) {
    return (
      <div className="bg-gradient-to-r from-sage-500 to-sage-600 rounded-2xl p-6 text-white text-center">
        <p className="font-serif text-lg">Congratulations on your wedding!</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-sage-500 to-sage-600 rounded-2xl p-4 sm:p-6 text-white">
      <p className="text-sage-100 text-xs uppercase tracking-wide mb-2 text-center">Countdown to Your Day</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="text-center">
          <p className="text-2xl sm:text-4xl font-bold">{timeLeft.days}</p>
          <p className="text-sage-200 text-xs sm:text-sm">Days</p>
        </div>
        <div className="text-center">
          <p className="text-2xl sm:text-4xl font-bold">{timeLeft.hours}</p>
          <p className="text-sage-200 text-xs sm:text-sm">Hours</p>
        </div>
        <div className="text-center">
          <p className="text-2xl sm:text-4xl font-bold">{timeLeft.minutes}</p>
          <p className="text-sage-200 text-xs sm:text-sm">Minutes</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [sending, setSending] = useState(false)
  const [welcomeSent, setWelcomeSent] = useState(false)
  const [profile, setProfile] = useState(null)
  const [wedding, setWedding] = useState(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [showInspoModal, setShowInspoModal] = useState(false)
  const [showChecklistModal, setShowChecklistModal] = useState(false)
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [showTablesModal, setShowTablesModal] = useState(false)
  const [showStaffingModal, setShowStaffingModal] = useState(false)
  const [timelineSummary, setTimelineSummary] = useState(null)
  const [tableSummary, setTableSummary] = useState(null)
  // Collapsible sections (collapsed by default)
  const [expandedSections, setExpandedSections] = useState({
    externalTools: false,
    meetings: false,
    planningTools: false,
    inspiration: false,
    resourceLinks: false
  })
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (user) {
      loadMessages()
      loadProfile()
    }
  }, [user])

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      setProfile(data)
      setEditName(data.name || '')
      setEditPhone(data.phone || '')

      // Load wedding separately if profile has wedding_id
      if (data.wedding_id) {
        const { data: weddingData } = await supabase
          .from('weddings')
          .select('*')
          .eq('id', data.wedding_id)
          .single()

        if (weddingData) {
          setWedding(weddingData)
        }

        // Load timeline summary
        try {
          const timelineRes = await fetch(`${API_URL}/api/timeline/${data.wedding_id}`)
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
          }
        } catch (err) {
          console.error('Failed to load timeline:', err)
        }

        // Load table summary
        try {
          const tablesRes = await fetch(`${API_URL}/api/tables/${data.wedding_id}`)
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
          }
        } catch (err) {
          console.error('Failed to load tables:', err)
        }
      }
    }
  }

  // Refresh timeline and table summaries (called after modal saves)
  const refreshSummaries = async () => {
    if (!profile?.wedding_id) return

    // Refresh timeline summary
    try {
      const timelineRes = await fetch(`${API_URL}/api/timeline/${profile.wedding_id}`)
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
      }
    } catch (err) {
      console.error('Failed to refresh timeline:', err)
    }

    // Refresh table summary
    try {
      const tablesRes = await fetch(`${API_URL}/api/tables/${profile.wedding_id}`)
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
      }
    } catch (err) {
      console.error('Failed to refresh tables:', err)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Trigger welcome message only if user has no messages in this session
  useEffect(() => {
    if (!loadingMessages && !welcomeSent && user && messages.length === 0) {
      sendWelcomeMessage()
      setWelcomeSent(true)
    }
  }, [loadingMessages, welcomeSent, user, messages.length])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/sage-messages/user/${user.id}`)
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Error loading messages:', error)
      setMessages([])
    }
    setLoadingMessages(false)
  }

  const sendWelcomeMessage = async () => {
    setSending(true)

    try {
      const response = await fetch(`${API_URL}/api/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          profile: profile,
          conversationHistory: messages
        })
      })

      const data = await response.json()

      if (data.message) {
        // Save welcome message via server endpoint
        const saveRes = await fetch(`${API_URL}/api/sage-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            content: data.message,
            sender: 'sage'
          })
        })
        const saveData = await saveRes.json()

        if (saveData.message) {
          setMessages(prev => [...prev, saveData.message])
        }
      }
    } catch (error) {
      console.error('Error getting welcome message:', error)
    }

    setSending(false)
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    const userMessageContent = newMessage.trim()
    setSending(true)
    setNewMessage('')

    // Save user message via server endpoint
    let userData
    try {
      const saveRes = await fetch(`${API_URL}/api/sage-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          content: userMessageContent,
          sender: 'user'
        })
      })
      const saveData = await saveRes.json()
      if (!saveData.message) {
        console.error('Error sending message:', saveData.error)
        setSending(false)
        return
      }
      userData = saveData.message
    } catch (err) {
      console.error('Error sending message:', err)
      setSending(false)
      return
    }

    const updatedMessages = [...messages, userData]
    setMessages(updatedMessages)

    // Get Sage's response
    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessageContent,
          userId: user.id,
          profile: profile,
          conversationHistory: updatedMessages.slice(-10) // Last 10 messages for context
        })
      })

      const data = await response.json()

      if (data.message) {
        // Save Sage's response via server endpoint
        const saveRes = await fetch(`${API_URL}/api/sage-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            content: data.message,
            sender: 'sage'
          })
        })
        const saveData = await saveRes.json()

        if (saveData.message) {
          setMessages([...updatedMessages, saveData.message])
        }
      }
    } catch (error) {
      console.error('Error getting Sage response:', error)
      // Add error message via server endpoint
      const saveRes = await fetch(`${API_URL}/api/sage-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          sender: 'sage'
        })
      })
      const saveData = await saveRes.json()

      if (saveData.message) {
        setMessages([...updatedMessages, saveData.message])
      }
    }

    setSending(false)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      if (!allowed.includes(file.type)) {
        alert('Please upload a PDF or image file')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Maximum 10MB.')
        return
      }
      setSelectedFile(file)
    }
  }

  const clearSelectedFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const sendWithFile = async (e) => {
    e.preventDefault()
    if (!selectedFile || sending) return

    setUploadingFile(true)
    setSending(true)

    const userMessageContent = newMessage.trim() || `[Uploaded: ${selectedFile.name}]`
    setNewMessage('')

    // Save user message via server endpoint
    let userData
    try {
      const saveRes = await fetch(`${API_URL}/api/sage-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          content: userMessageContent,
          sender: 'user'
        })
      })
      const saveData = await saveRes.json()
      if (!saveData.message) {
        setSending(false)
        setUploadingFile(false)
        return
      }
      userData = saveData.message
    } catch (err) {
      setSending(false)
      setUploadingFile(false)
      return
    }

    const updatedMessages = [...messages, userData]
    setMessages(updatedMessages)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('message', newMessage.trim() || 'What can you tell me about this document?')
      formData.append('userId', user.id)
      formData.append('weddingId', profile?.wedding_id || '')

      const response = await fetch(`${API_URL}/api/chat-with-file`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.message) {
        // Save Sage's response via server endpoint
        const saveRes = await fetch(`${API_URL}/api/sage-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            content: data.message,
            sender: 'sage'
          })
        })
        const saveData = await saveRes.json()

        if (saveData.message) {
          setMessages([...updatedMessages, saveData.message])
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      // Save error message via server endpoint
      const saveRes = await fetch(`${API_URL}/api/sage-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          content: "I had trouble processing that file. Please try again.",
          sender: 'sage'
        })
      })
      const saveData = await saveRes.json()

      if (saveData.message) {
        setMessages([...updatedMessages, saveData.message])
      }
    }

    clearSelectedFile()
    setSending(false)
    setUploadingFile(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const saveProfile = async () => {
    if (!editName.trim()) return
    setSavingProfile(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        name: editName.trim(),
        phone: editPhone.trim() || null
      })
      .eq('id', user.id)

    if (!error) {
      setProfile({ ...profile, name: editName.trim(), phone: editPhone.trim() || null })
      setShowEditProfile(false)
    }
    setSavingProfile(false)
  }

  const resourceLinks = [
    { name: 'Vendor Directory', href: '/vendors' },
    { name: 'Accommodations', href: '/accommodations' },
    { name: 'Venue Gallery', href: 'https://www.rixeymanor.com/weddingsbyseason' },
    { name: 'Planning Resources', href: 'https://www.rixeymanor.com/planning' },
  ]

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="bg-white border-b border-cream-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl sm:text-2xl text-sage-700 truncate">Rixey Manor</h1>
            <button
              onClick={() => setShowEditProfile(true)}
              className="text-sage-400 text-sm hover:text-sage-600 transition flex items-center gap-1"
            >
              {profile?.name || user?.email}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Google Sheets Link */}
            {wedding?.google_sheets_link && (
              <a
                href={wedding.google_sheets_link}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
                Spreadsheet
              </a>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-sage-500 hover:text-sage-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <button
              onClick={handleSignOut}
              className="hidden sm:block text-sage-500 hover:text-sage-700 text-sm font-medium transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-cream-200 bg-white px-4 py-3 space-y-2">
            {wedding?.google_sheets_link && (
              <a
                href={wedding.google_sheets_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-green-700 bg-green-50 hover:bg-green-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
                Planning Spreadsheet <span className="text-green-500 text-xs">↗</span>
              </a>
            )}
            <a
              href="https://members.isadoraandco.com/offers/hWX4WHcQ"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Planning Course <span className="text-amber-500 text-xs">(FREE: RIXEYFAMILY)</span>
            </a>
            {resourceLinks.map((link) => (
              link.href.startsWith('/') ? (
                <button
                  key={link.name}
                  onClick={() => { navigate(link.href); setMobileMenuOpen(false) }}
                  className="block w-full text-left px-3 py-2 rounded-lg text-sage-600 hover:bg-sage-50"
                >
                  {link.name}
                </button>
              ) : (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 rounded-lg text-sage-600 hover:bg-sage-50"
                >
                  {link.name} <span className="text-sage-400 text-xs">↗</span>
                </a>
              )
            ))}
            <button
              onClick={handleSignOut}
              className="block w-full text-left px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        {/* Onboarding Checklist for new users */}
        {wedding?.id && (
          <OnboardingChecklist
            weddingId={wedding.id}
            onAction={(action) => {
              if (action === 'couple_photo_uploaded') {
                document.getElementById('couple-photo-section')?.scrollIntoView({ behavior: 'smooth' })
              } else if (action === 'first_message_sent') {
                document.getElementById('sage-input')?.focus()
              } else if (action === 'vendor_added') {
                setShowVendorModal(true)
              } else if (action === 'inspo_uploaded') {
                setShowInspoModal(true)
              } else if (action === 'checklist_item_completed') {
                setShowChecklistModal(true)
              }
            }}
          />
        )}

        {/* Hero Section: Countdown + Couple Photo + Wedding Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            {/* Couple Photo */}
            {profile?.wedding_id && (
              <div id="couple-photo-section" className="flex-shrink-0">
                <CouplePhoto weddingId={profile.wedding_id} userId={user?.id} compact />
              </div>
            )}

            {/* Wedding Info */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="font-serif text-xl sm:text-2xl text-sage-700">
                {wedding?.couple_names || 'Welcome!'}
              </h2>
              {wedding?.wedding_date && (
                <p className="text-sage-500 text-sm mt-1">
                  {new Date(wedding.wedding_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              )}
              {wedding?.event_code && (
                <p className="text-sage-400 text-xs mt-2">
                  Event Code: <span className="font-mono bg-cream-100 px-2 py-0.5 rounded">{wedding.event_code}</span>
                </p>
              )}
            </div>

            {/* Countdown */}
            {wedding?.wedding_date && (
              <div className="flex-shrink-0 w-full sm:w-auto">
                <WeddingCountdown weddingDate={wedding.wedding_date} />
              </div>
            )}
          </div>
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column: Sage Chat */}
          <div className="order-2 lg:order-1">
            <div className="bg-white rounded-2xl shadow-sm border border-cream-200 flex flex-col h-[500px] lg:h-[650px]">
              {/* Chat Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-cream-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-sage-100 rounded-full flex items-center justify-center">
                    <span className="text-sage-600 font-serif text-base sm:text-lg">S</span>
                  </div>
                  <div>
                    <h2 className="font-serif text-lg sm:text-xl text-sage-700">Chat with Sage</h2>
                    <p className="text-sage-400 text-xs sm:text-sm">Your personal wedding planning assistant</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {loadingMessages ? (
                  <div className="text-center text-sage-400 py-8">Loading messages...</div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.sender !== 'user' && (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-sage-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                          <span className="text-sage-600 font-serif text-xs sm:text-sm">S</span>
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] sm:max-w-[80%] px-3 sm:px-4 py-2 sm:py-3 rounded-2xl ${
                          message.sender === 'user'
                            ? 'bg-sage-600 text-white rounded-br-md'
                            : 'bg-cream-100 text-sage-800 rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>
                        <p className={`text-xs mt-1 ${message.sender === 'user' ? 'text-sage-200' : 'text-sage-400'}`}>
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {sending && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-sage-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <span className="text-sage-600 font-serif text-xs sm:text-sm">S</span>
                    </div>
                    <div className="bg-cream-100 text-sage-500 px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex gap-1">
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={selectedFile ? sendWithFile : sendMessage} className="p-3 sm:p-4 border-t border-cream-200">
                {selectedFile && (
                  <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-sage-50 rounded-lg text-sm">
                    <svg className="w-4 h-4 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="flex-1 truncate text-sage-700">{selectedFile.name}</span>
                    <button type="button" onClick={clearSelectedFile} className="text-sage-500 hover:text-sage-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="flex gap-2 sm:gap-3">
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".pdf,image/*" className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    className="px-3 py-2 sm:py-3 rounded-xl border border-cream-300 hover:bg-cream-100 transition disabled:opacity-50 text-sage-600"
                    title="Upload contract or image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <input
                    id="sage-input"
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={selectedFile ? "Add a message about this file..." : "Ask Sage anything..."}
                    disabled={sending}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 transition bg-cream-50 disabled:opacity-50 text-sm sm:text-base"
                  />
                  <button
                    type="submit"
                    disabled={sending || (!newMessage.trim() && !selectedFile)}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-sage-600 text-white rounded-xl font-medium hover:bg-sage-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    {uploadingFile ? '...' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Planning Tools & Quick Actions */}
          <div className="order-1 lg:order-2 space-y-4">
            {/* Planning at a Glance - 2x2 Grid */}
            {profile?.wedding_id && (
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-4 sm:p-5">
                <h3 className="font-serif text-lg text-sage-700">Planning at a Glance</h3>
                <p className="text-sage-400 text-xs mb-4">
                  These tools give you a rough idea to help with planning. Final details are always finalized personally with your coordinator.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Timeline Card */}
                  <button
                    onClick={() => setShowTimelineModal(true)}
                    className="bg-gradient-to-br from-amber-50 to-cream-50 rounded-xl p-4 border border-amber-200 hover:border-amber-300 hover:shadow-md transition text-left"
                  >
                    <span className="text-2xl">📅</span>
                    <p className="font-medium text-sage-800 text-sm mt-2">Timeline</p>
                    {timelineSummary ? (
                      <p className="text-sage-500 text-xs mt-1">
                        {timelineSummary.ceremonyTime ?
                          new Date(`2000-01-01T${timelineSummary.ceremonyTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                          : 'Not set'}
                      </p>
                    ) : (
                      <p className="text-sage-400 text-xs mt-1">Set up →</p>
                    )}
                  </button>

                  {/* Tables Card */}
                  <button
                    onClick={() => setShowTablesModal(true)}
                    className="bg-gradient-to-br from-sage-50 to-cream-50 rounded-xl p-4 border border-sage-200 hover:border-sage-300 hover:shadow-md transition text-left"
                  >
                    <span className="text-2xl">🪑</span>
                    <p className="font-medium text-sage-800 text-sm mt-2">Tables</p>
                    {tableSummary ? (
                      <p className="text-sage-500 text-xs mt-1">{tableSummary.guestCount} guests</p>
                    ) : (
                      <p className="text-sage-400 text-xs mt-1">Set up →</p>
                    )}
                  </button>

                  {/* Vendors Card */}
                  <button
                    onClick={() => setShowVendorModal(true)}
                    className="bg-gradient-to-br from-rose-50 to-cream-50 rounded-xl p-4 border border-rose-200 hover:border-rose-300 hover:shadow-md transition text-left"
                  >
                    <span className="text-2xl">👥</span>
                    <p className="font-medium text-sage-800 text-sm mt-2">Vendors</p>
                    <p className="text-sage-400 text-xs mt-1">Manage →</p>
                  </button>

                  {/* Checklist Card */}
                  <button
                    onClick={() => setShowChecklistModal(true)}
                    className="bg-gradient-to-br from-blue-50 to-cream-50 rounded-xl p-4 border border-blue-200 hover:border-blue-300 hover:shadow-md transition text-left"
                  >
                    <span className="text-2xl">✅</span>
                    <p className="font-medium text-sage-800 text-sm mt-2">Checklist</p>
                    <p className="text-sage-400 text-xs mt-1">View tasks →</p>
                  </button>

                  {/* Staffing Card */}
                  <button
                    onClick={() => setShowStaffingModal(true)}
                    className="bg-gradient-to-br from-purple-50 to-cream-50 rounded-xl p-4 border border-purple-200 hover:border-purple-300 hover:shadow-md transition text-left"
                  >
                    <span className="text-2xl">🙋</span>
                    <p className="font-medium text-sage-800 text-sm mt-2">Staffing</p>
                    <p className="text-sage-400 text-xs mt-1">Estimate →</p>
                  </button>

                  {/* Inspo Gallery Card */}
                  <button
                    onClick={() => setShowInspoModal(true)}
                    className="bg-gradient-to-br from-pink-50 to-cream-50 rounded-xl p-4 border border-pink-200 hover:border-pink-300 hover:shadow-md transition text-left"
                  >
                    <span className="text-2xl">💡</span>
                    <p className="font-medium text-sage-800 text-sm mt-2">Inspiration</p>
                    <p className="text-sage-400 text-xs mt-1">Gallery →</p>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Message the Team */}
              {profile?.wedding_id && (
                <div className="col-span-2">
                  <ClientInbox weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}
            </div>

            {/* Book a Meeting */}
            <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, meetings: !prev.meetings }))}
                className="w-full flex items-center justify-between p-4 hover:bg-cream-50 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📞</span>
                  <span className="font-medium text-sage-700">Book a Meeting</span>
                </div>
                <svg
                  className={`w-5 h-5 text-sage-400 transition-transform ${expandedSections.meetings ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedSections.meetings && (
                <div className="px-4 pb-4">
                  <BookingCalendly hideTitle />
                </div>
              )}
            </div>

            {/* Inspiration Gallery */}
            {profile?.wedding_id && (
              <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, inspiration: !prev.inspiration }))}
                  className="w-full flex items-center justify-between p-4 hover:bg-cream-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💐</span>
                    <span className="font-medium text-sage-700">Inspiration Gallery</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      onClick={(e) => { e.stopPropagation(); setShowInspoModal(true); }}
                      className="text-sage-500 hover:text-sage-700 text-sm"
                    >
                      View All
                    </span>
                    <svg
                      className={`w-5 h-5 text-sage-400 transition-transform ${expandedSections.inspiration ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {expandedSections.inspiration && (
                  <div className="px-4 pb-4">
                    <InspoGallery weddingId={profile.wedding_id} userId={user?.id} compact />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: External Tools & Resources */}
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* HoneyBook */}
          {wedding?.honeybook_link && (
            <a
              href={wedding.honeybook_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-cream-200 hover:border-sage-300 hover:shadow-sm transition"
            >
              <div className="w-10 h-10 bg-sage-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-sage-800 text-sm">HoneyBook</p>
                <p className="text-sage-400 text-xs">Contracts & Payments</p>
              </div>
            </a>
          )}

          {/* Planning Course */}
          <a
            href="https://members.isadoraandco.com/offers/hWX4WHcQ"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 hover:border-amber-300 hover:shadow-sm transition"
          >
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-sage-800 text-sm">Planning Course</p>
              <p className="text-amber-600 text-xs font-medium">FREE with code: RIXEYFAMILY</p>
            </div>
          </a>

          {/* Resource Links */}
          {resourceLinks.map((link) => (
            link.href.startsWith('/') ? (
              <button
                key={link.name}
                onClick={() => navigate(link.href)}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-cream-200 hover:border-sage-300 hover:shadow-sm transition text-left"
              >
                <div className="w-10 h-10 bg-cream-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-sage-800 text-sm">{link.name}</p>
                </div>
              </button>
            ) : (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-cream-200 hover:border-sage-300 hover:shadow-sm transition"
              >
                <div className="w-10 h-10 bg-cream-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-sage-800 text-sm">{link.name}</p>
                </div>
              </a>
            )
          ))}
        </div>
      </main>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full">
            <h3 className="font-serif text-xl text-sage-700 mb-4">Edit Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sage-600 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 transition bg-cream-50"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 rounded-lg border border-cream-200 bg-cream-100 text-sage-500"
                />
                <p className="text-sage-400 text-xs mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-600 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 transition bg-cream-50"
                  placeholder="(555) 123-4567"
                />
                <p className="text-sage-400 text-xs mt-1">Used to sync planning notes from your texts</p>
              </div>
              {profile?.role && (
                <div>
                  <label className="block text-sm font-medium text-sage-600 mb-1">
                    Role
                  </label>
                  <p className="px-4 py-3 rounded-lg bg-cream-50 text-sage-700 capitalize">
                    {profile.role.replace('couple-', '').replace('-', ' ')}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditProfile(false)}
                className="flex-1 px-4 py-3 text-sage-600 rounded-lg font-medium hover:bg-cream-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={savingProfile || !editName.trim()}
                className="flex-1 bg-sage-600 text-white py-3 rounded-lg font-medium hover:bg-sage-700 transition disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Checklist Modal */}
      {showVendorModal && profile?.wedding_id && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl text-sage-700">Vendor Checklist</h3>
              <button
                onClick={() => setShowVendorModal(false)}
                className="text-sage-400 hover:text-sage-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <VendorChecklist weddingId={profile.wedding_id} />
          </div>
        </div>
      )}

      {/* Inspo Gallery Modal */}
      {showInspoModal && profile?.wedding_id && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl text-sage-700">Inspiration Gallery</h3>
              <button
                onClick={() => setShowInspoModal(false)}
                className="text-sage-400 hover:text-sage-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <InspoGallery weddingId={profile.wedding_id} userId={user?.id} />
          </div>
        </div>
      )}

      {/* Planning Checklist Modal */}
      {showChecklistModal && profile?.wedding_id && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl text-sage-700">Planning Checklist</h3>
              <button
                onClick={() => setShowChecklistModal(false)}
                className="text-sage-400 hover:text-sage-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <PlanningChecklist weddingId={profile.wedding_id} userId={user?.id} />
          </div>
        </div>
      )}

      {/* Timeline Builder Modal */}
      {showTimelineModal && profile?.wedding_id && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-2 sm:px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 w-full max-w-3xl my-4 sm:my-0 overflow-x-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📅</span>
                <h3 className="font-serif text-xl text-sage-700">Timeline Builder</h3>
              </div>
              <button
                onClick={() => { setShowTimelineModal(false); refreshSummaries(); }}
                className="text-sage-400 hover:text-sage-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <TimelineBuilder weddingId={profile.wedding_id} weddingDate={wedding?.wedding_date} />
          </div>
        </div>
      )}

      {/* Table Planner Modal */}
      {showTablesModal && profile?.wedding_id && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🪑</span>
                <h3 className="font-serif text-xl text-sage-700">Table & Seating Planner</h3>
              </div>
              <button
                onClick={() => { setShowTablesModal(false); refreshSummaries(); }}
                className="text-sage-400 hover:text-sage-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <TableLayoutPlanner weddingId={profile.wedding_id} />
          </div>
        </div>
      )}

      {/* Staffing Calculator Modal */}
      {showStaffingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🙋</span>
                <h3 className="font-serif text-xl text-sage-700">Staffing Guide</h3>
              </div>
              <button
                onClick={() => setShowStaffingModal(false)}
                className="text-sage-400 hover:text-sage-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <StaffingCalculator guestCount={tableSummary?.guestCount} weddingId={profile?.wedding_id} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
