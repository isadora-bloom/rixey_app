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
import BudgetTracker from '../components/BudgetTracker'
import BorrowCatalog from '../components/BorrowCatalog'
import ManorDownloads from '../components/ManorDownloads'
import NotificationBell from '../components/NotificationBell'
import GuestCareNotes from '../components/GuestCareNotes'
import StorefrontBrowser from '../components/StorefrontBrowser'
import WeddingDetails from '../components/WeddingDetails'
import AllergyRegistry from '../components/AllergyRegistry'
import BedroomAssignments from '../components/BedroomAssignments'
import CeremonyOrder from '../components/CeremonyOrder'
import DecorInventory from '../components/DecorInventory'
import MakeupSchedule from '../components/MakeupSchedule'
import ShuttleSchedule from '../components/ShuttleSchedule'
import RehearsalDinner from '../components/RehearsalDinner'
import GuestList from '../components/GuestList'
import TableCanvas from '../components/TableCanvas'
import PreferredVendors from '../components/PreferredVendors'
import WeddingWorksheets from '../components/WeddingWorksheets'
import PhotoBucket from '../components/PhotoBucket'
import WeddingParty from '../components/WeddingParty'
import WebsiteBuilder from '../components/WebsiteBuilder'
import BarPlanner from '../components/BarPlanner'
import SectionFinaliser from '../components/SectionFinaliser'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'


// Sections that can be finalised in the pre-wedding period
const FINALISABLE = new Set([
  'timeline', 'ceremony-order', 'guests', 'table-map', 'vendor',
  'makeup', 'shuttle', 'rehearsal', 'bedrooms', 'decor',
  'allergies', 'staffing', 'bar', 'tables', 'guestcare',
])

// Countdown component
function WeddingCountdown({ weddingDate }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const wedding = new Date(weddingDate + 'T00:00:00')
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

  const weddingPassed = new Date(weddingDate + 'T00:00:00') < new Date()
  if (weddingPassed) {
    return (
      <div className="bg-gradient-to-r from-sage-500 to-sage-600 rounded-2xl p-6 text-white text-center">
        <p className="font-serif text-lg">Congratulations on your wedding!</p>
      </div>
    )
  }

  const days = timeLeft.days
  const countdownLabel = days >= 400
    ? "You've got time — enjoy every moment of the journey"
    : days >= 200
    ? "The adventure is just beginning!"
    : days >= 100
    ? "Getting closer — the fun details are coming!"
    : days >= 30
    ? "The big day is on the horizon"
    : days >= 8
    ? "Almost there — you're in the home stretch!"
    : days >= 2
    ? "This is your week. Soak it all in."
    : days === 1
    ? "Tomorrow is your day!"
    : "Today is YOUR day! 🎉"

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
      <p className="text-sage-100 text-xs text-center mt-3 italic">{countdownLabel}</p>
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
  const [activeSection, setActiveSection] = useState('chat')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const [budgetSummary, setBudgetSummary] = useState(null)
  const [timelineSummary, setTimelineSummary] = useState(null)
  const [tableSummary, setTableSummary] = useState(null)
  const [retryState, setRetryState] = useState(null) // { userMessage, baseMessages, secondsLeft }
  const [finalisations, setFinalisations] = useState({}) // { [sectionKey]: { couple_finalised, staff_finalised } }
  const [profileLoading, setProfileLoading] = useState(true)
  const [needsPhoto, setNeedsPhoto] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [couplePhotoKey, setCouplePhotoKey] = useState(0)
  const photoInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const contentRef = useRef(null)
  const prevSectionRef = useRef('chat')

  // Pre-wedding period: within 6 weeks of the wedding date
  const isPreWedding = (() => {
    if (!wedding?.wedding_date) return false
    const days = (new Date(wedding.wedding_date + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24)
    return days >= 0 && days <= 42
  })()

  const handlePhotoUpload = async (file) => {
    if (!file || !profile?.wedding_id) return
    setPhotoUploading(true)
    setPhotoError('')
    const formData = new FormData()
    formData.append('photo', file)
    formData.append('weddingId', profile.wedding_id)
    formData.append('uploadedBy', user?.id || '')
    try {
      const token = (await authHeaders())['Authorization']
      const res = await fetch(`${API_URL}/api/couple-photo`, { method: 'POST', headers: token ? { 'Authorization': token } : {}, body: formData })
      const data = await res.json()
      if (data.photo) {
        setNeedsPhoto(false)
        setCouplePhotoKey(k => k + 1) // force sidebar CouplePhoto to reload
      } else {
        setPhotoError(data.error || 'Upload failed — please try again.')
      }
    } catch {
      setPhotoError('Could not connect to the server — please try again.')
    }
    setPhotoUploading(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  function handleFinalised(sectionKey, party, value) {
    setFinalisations(prev => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [party === 'couple' ? 'couple_finalised' : 'staff_finalised']: value,
      },
    }))
  }

  useEffect(() => {
    if (['timeline', 'tables', 'budget'].includes(prevSectionRef.current) && activeSection !== prevSectionRef.current) {
      refreshSummaries()
    }
    prevSectionRef.current = activeSection
    // Scroll to top of page on every section change
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeSection]) // eslint-disable-line react-hooks/exhaustive-deps

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

    setProfileLoading(false)
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

        // Check if couple photo has been uploaded — require it if not
        if (data.role?.startsWith('couple')) {
          try {
            const photoRes = await fetch(`${API_URL}/api/couple-photo/${data.wedding_id}`, {
              headers: await authHeaders()
            })
            const photoData = await photoRes.json()
            if (!photoData.photo) setNeedsPhoto(true)
          } catch {}
        }

        // Load finalisations
        try {
          const finRes = await fetch(`${API_URL}/api/finalisations/${data.wedding_id}`, {
            headers: await authHeaders()
          })
          if (finRes.ok) setFinalisations(await finRes.json())
        } catch {}

        // Load budget summary
        try {
          const budgetRes = await fetch(`${API_URL}/api/budget/${data.wedding_id}`, {
            headers: await authHeaders()
          })
          if (budgetRes.ok) {
            const budgetData = await budgetRes.json()
            if (budgetData.budget) {
              const cats = budgetData.budget.categories || {}
              const totalCommitted = Object.values(cats).reduce((s, c) => s + (c.committed || 0), 0)
              setBudgetSummary({
                totalBudget: budgetData.budget.total_budget,
                totalCommitted
              })
            }
          }
        } catch (err) {
          console.error('Failed to load budget summary:', err)
        }

        // Load timeline summary
        try {
          const timelineRes = await fetch(`${API_URL}/api/timeline/${data.wedding_id}`, {
            headers: await authHeaders()
          })
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
          const tablesRes = await fetch(`${API_URL}/api/tables/${data.wedding_id}`, {
            headers: await authHeaders()
          })
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
      const timelineRes = await fetch(`${API_URL}/api/timeline/${profile.wedding_id}`, {
        headers: await authHeaders()
      })
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
      const tablesRes = await fetch(`${API_URL}/api/tables/${profile.wedding_id}`, {
        headers: await authHeaders()
      })
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
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }

  // Countdown tick — when it hits 0 auto-retry
  useEffect(() => {
    if (!retryState) return
    if (retryState.secondsLeft <= 0) {
      doSageRequest(retryState.userMessage, retryState.baseMessages)
      return
    }
    const t = setTimeout(() => {
      setRetryState(prev => prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null)
    }, 1000)
    return () => clearTimeout(t)
  }, [retryState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Extracted Sage API call — used by sendMessage and the retry loop
  const doSageRequest = async (userMessage, baseMessages) => {
    setSending(true)
    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          message: userMessage,
          userId: user.id,
          profile: profile,
          conversationHistory: baseMessages.slice(-10)
        })
      })
      const data = await response.json()
      if (data.message) {
        const saveRes = await fetch(`${API_URL}/api/sage-messages`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ user_id: user.id, content: data.message, sender: 'sage' })
        })
        const saveData = await saveRes.json()
        if (saveData.message) {
          setMessages([...baseMessages, saveData.message])
          setRetryState(null)
        }
      } else {
        throw new Error(data.error || 'No response from Sage')
      }
    } catch (error) {
      console.error('Error getting Sage response:', error)
      // Show countdown bubble and auto-retry in 60 s
      setRetryState({ userMessage, baseMessages, secondsLeft: 60 })
    }
    setSending(false)
  }

  const loadMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/sage-messages/user/${user.id}`, {
        headers: await authHeaders()
      })
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
        headers: await authHeaders(),
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
          headers: await authHeaders(),
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

    setRetryState(null) // cancel any pending retry when user sends a new message

    const userMessageContent = newMessage.trim()
    setSending(true)
    setNewMessage('')

    // Save user message via server endpoint
    let userData
    try {
      const saveRes = await fetch(`${API_URL}/api/sage-messages`, {
        method: 'POST',
        headers: await authHeaders(),
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

    await doSageRequest(userMessageContent, updatedMessages)
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
        headers: await authHeaders(),
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

      const fileToken = (await authHeaders())['Authorization']
      const response = await fetch(`${API_URL}/api/chat-with-file`, {
        method: 'POST',
        headers: fileToken ? { 'Authorization': fileToken } : {},
        body: formData
      })

      const data = await response.json()

      if (data.message) {
        // Save Sage's response via server endpoint
        const saveRes = await fetch(`${API_URL}/api/sage-messages`, {
          method: 'POST',
          headers: await authHeaders(),
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
        headers: await authHeaders(),
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
            <button onClick={() => setActiveSection('chat')} className="inline-block">
              <img src="/icons/icon-192x192.png" alt="Rixey Manor" className="h-9 w-auto" />
            </button>
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

            {/* Notification Bell */}
            {wedding?.id && (
              <NotificationBell
                recipientType="client"
                weddingId={wedding.id}
              />
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
            weddingDate={wedding.wedding_date}
            onAction={(action) => {
              if (action === 'couple_photo_uploaded') {
                document.getElementById('couple-photo-section')?.scrollIntoView({ behavior: 'smooth' })
              } else if (action === 'first_message_sent') {
                document.getElementById('sage-input')?.focus()
              } else if (action === 'vendor_added') {
                setActiveSection('vendor')
              } else if (action === 'inspo_uploaded') {
                setActiveSection('inspo')
              } else if (action === 'checklist_item_completed') {
                setActiveSection('checklist')
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
                <CouplePhoto key={couplePhotoKey} weddingId={profile.wedding_id} userId={user?.id} compact />
              </div>
            )}

            {/* Wedding Info */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="font-serif text-xl sm:text-2xl text-sage-700">
                {wedding?.couple_names || 'Welcome!'}
              </h2>
              {wedding?.wedding_date && (
                <p className="text-sage-500 text-sm mt-1">
                  {new Date(wedding.wedding_date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              )}
              {wedding?.event_code && (
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-sage-400 text-xs">
                    Event Code: <span className="font-mono bg-cream-100 px-2 py-0.5 rounded">{wedding.event_code}</span>
                  </p>
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="text-xs text-sage-600 hover:text-sage-800 flex items-center gap-1 bg-sage-100 hover:bg-sage-200 px-2 py-1 rounded transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Invite
                  </button>
                </div>
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

        {/* Main Layout */}
        <div className="grid lg:grid-cols-[220px_1fr] gap-4 sm:gap-6">

          {/* Compact Nav Sidebar — desktop only */}
          <div className="hidden lg:block lg:order-1">
            <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden lg:sticky lg:top-24">
              <div className="px-4 pt-5 pb-3 flex justify-center border-b border-cream-200">
                <img src="/rixey-manor-logo-optimized.png" alt="Rixey Manor" className="h-16 w-auto" />
              </div>
              <nav className="p-2">
                {[
                  { key: 'chat', label: 'Chat with Sage', icon: '/icons/sage-chat.svg' },
                  { section: 'Get Started' },
                  { key: 'worksheets', label: 'Worksheets', icon: '/icons/checklist.svg' },
                  { key: 'wedding-details', label: 'Wedding Details', icon: '/icons/overview.svg' },
                  { key: 'checklist', label: 'Checklist', icon: '/icons/checklist.svg' },
                  { section: 'Plan' },
                  { key: 'budget', label: 'Budget', icon: '/icons/budget.svg', dot: !!budgetSummary },
                  { key: 'guests', label: 'Guest List', icon: '/icons/guest-care.svg' },
                  { key: 'vendor', label: 'Vendors', icon: '/icons/vendors.svg' },
                  { key: 'timeline', label: 'Timeline', icon: '/icons/timeline.svg', dot: !!timelineSummary },
                  { key: 'tables', label: 'Tables', icon: '/icons/tables.svg', dot: !!tableSummary },
                  { section: 'Day Of' },
                  { key: 'ceremony-order', label: 'Ceremony Order', icon: '/icons/timeline.svg' },
                  { key: 'table-map', label: 'Table Map', icon: '/icons/tables.svg' },
                  { key: 'staffing', label: 'Staffing Guide', icon: '/icons/staffing-guide.svg' },
                  { key: 'bar', label: 'Bar Planner', icon: '/icons/staffing-guide.svg' },
                  { key: 'makeup', label: 'Hair & Makeup', icon: '/icons/upload-photo-of-you-two.svg' },
                  { key: 'shuttle', label: 'Shuttle Schedule', icon: '/icons/book-a-meeting.svg' },
                  { key: 'rehearsal', label: 'Rehearsal Dinner', icon: '/icons/meetings.svg' },
                  { key: 'bedrooms', label: 'Bedroom Assignments', icon: '/icons/direct-messages.svg' },
                  { key: 'decor', label: 'Decor Inventory', icon: '/icons/inspiration.svg' },
                  { section: 'Your Guests' },
                  { key: 'allergies', label: 'Allergy Registry', icon: '/icons/guest-care.svg' },
                  { key: 'guestcare', label: 'Guest Care Notes', icon: '/icons/guest-care.svg' },
                  { section: 'Your Website' },
                  { key: 'website-builder', label: 'Build Your Website', icon: '/icons/resources.svg' },
                  { key: 'photos', label: 'Photo Library', icon: '/icons/inspiration.svg' },
                  { key: 'wedding-party', label: 'Wedding Party', icon: '/icons/vendors.svg' },
                  { section: 'Rixey' },
                  { key: 'preferred-vendors', label: 'Preferred Vendors', icon: '/icons/vendors.svg' },
                  { key: 'inspo', label: 'Inspiration', icon: '/icons/inspiration.svg' },
                  { key: 'borrow', label: 'Borrow Brochure', icon: '/icons/borrow-brochure.svg' },
                  { key: 'picks', label: 'Rixey Picks', icon: '/icons/rixey-picks.svg' },
                  { key: 'downloads', label: 'Manor Downloads', icon: '/icons/resources.svg' },
                  { section: 'Connect' },
                  { key: 'inbox', label: 'Inbox', icon: '/icons/inbox.svg' },
                  { key: 'booking', label: 'Book a Meeting', icon: '/icons/book-a-meeting.svg' },
                  { key: 'resources', label: 'Resources', icon: '/icons/resources.svg' },
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
                      key={item.key}
                      onClick={() => setActiveSection(item.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                        activeSection === item.key
                          ? 'bg-sage-100 text-sage-700 font-medium'
                          : 'text-sage-500 hover:bg-cream-50 hover:text-sage-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <img src={item.icon} className="w-5 h-5 flex-shrink-0" alt="" />
                        <span>{item.label}</span>
                      </span>
                      {/* Finalisation ticks — last 6 weeks only */}
                      {isPreWedding && FINALISABLE.has(item.key) ? (
                        <span className="flex items-center gap-0.5 shrink-0">
                          {[
                            finalisations[item.key]?.couple_finalised,
                            finalisations[item.key]?.staff_finalised,
                          ].map((done, i) => (
                            <span
                              key={i}
                              className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                                done ? 'bg-sage-500 border-sage-500' : 'border-cream-400 bg-white'
                              }`}
                            >
                              {done && <span className="text-white text-[7px] leading-none">✓</span>}
                            </span>
                          ))}
                        </span>
                      ) : (
                        item.dot && <span className="w-1.5 h-1.5 rounded-full bg-sage-400 flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div ref={contentRef} className={`order-1 lg:order-2 ${isPreWedding && FINALISABLE.has(activeSection) ? 'pb-24' : ''}`}>
            {/* Mobile: section dropdown */}
            <div className="lg:hidden mb-3">
              <select
                value={activeSection}
                onChange={e => setActiveSection(e.target.value)}
                className="w-full p-3 border border-cream-200 rounded-xl bg-white text-sage-700 font-medium focus:outline-none focus:ring-2 focus:ring-sage-300"
              >
                <option value="chat">💬 Chat with Sage</option>
                <optgroup label="Get Started">
                  <option value="worksheets">📋 Worksheets</option>
                  <option value="wedding-details">💍 Wedding Details</option>
                  <option value="checklist">✅ Checklist</option>
                </optgroup>
                <optgroup label="Plan">
                  <option value="budget">💰 Budget</option>
                  <option value="guests">👥 Guest List</option>
                  <option value="vendor">📎 Vendors</option>
                  <option value="timeline">📅 Timeline</option>
                  <option value="tables">🪑 Tables</option>
                </optgroup>
                <optgroup label="Day Of">
                  <option value="ceremony-order">🎶 Ceremony Order</option>
                  <option value="table-map">🗺 Table Map</option>
                  <option value="staffing">🙋 Staffing Guide</option>
                  <option value="bar">🍹 Bar Planner</option>
                  <option value="makeup">💄 Hair &amp; Makeup</option>
                  <option value="shuttle">🚌 Shuttle Schedule</option>
                  <option value="rehearsal">🍽 Rehearsal Dinner</option>
                  <option value="bedrooms">🛏 Bedroom Assignments</option>
                  <option value="decor">🌿 Decor Inventory</option>
                </optgroup>
                <optgroup label="Your Guests">
                  <option value="allergies">⚕️ Allergy Registry</option>
                  <option value="guestcare">💝 Guest Care Notes</option>
                </optgroup>
                <optgroup label="Your Website">
                  <option value="website-builder">🌐 Build Your Website</option>
                  <option value="photos">📷 Photo Library</option>
                  <option value="wedding-party">💐 Wedding Party</option>
                </optgroup>
                <optgroup label="Rixey">
                  <option value="preferred-vendors">⭐ Preferred Vendors</option>
                  <option value="inspo">💡 Inspiration</option>
                  <option value="borrow">📦 Borrow Brochure</option>
                  <option value="picks">🛍 Rixey Picks</option>
                </optgroup>
                <optgroup label="Connect">
                  <option value="inbox">📬 Inbox</option>
                  <option value="booking">📞 Book a Meeting</option>
                  <option value="resources">🔗 Resources</option>
                </optgroup>
              </select>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">

              {/* Chat section */}
              {activeSection === 'chat' && (
                <div className="flex flex-col h-[450px] sm:h-[550px] lg:h-[650px]">
                  {/* Chat Header */}
                  <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-cream-200 shrink-0">
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
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {loadingMessages ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                        {i % 2 !== 0 && <div className="w-8 h-8 bg-cream-200 rounded-full mr-2 flex-shrink-0 animate-pulse" />}
                        <div className={`h-12 rounded-2xl animate-pulse bg-cream-200 ${i % 2 === 0 ? 'w-2/3' : 'w-3/4'}`} />
                      </div>
                    ))}
                  </div>
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
                            : message.is_team_note
                              ? 'bg-amber-50 border border-amber-200 text-sage-800 rounded-bl-md'
                              : 'bg-cream-100 text-sage-800 rounded-bl-md'
                        }`}
                      >
                        {message.is_team_note && (
                          <p className="text-xs text-amber-600 font-medium mb-1">★ Team note</p>
                        )}
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
                {retryState && !sending && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-sage-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <span className="text-sage-600 font-serif text-xs sm:text-sm">S</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 text-sage-700 px-4 py-3 rounded-2xl rounded-bl-md max-w-[85%] sm:max-w-[80%]">
                      <p className="text-sm">Having trouble connecting. Retrying in {retryState.secondsLeft}s…</p>
                      <button
                        onClick={() => setRetryState(prev => prev ? { ...prev, secondsLeft: 0 } : null)}
                        className="text-xs text-sage-500 underline mt-1 hover:text-sage-700"
                      >
                        Try now
                      </button>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={selectedFile ? sendWithFile : sendMessage} className="p-3 sm:p-4 border-t border-cream-200 shrink-0">
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
              )}


              {/* Fallback: staff/admin account on the couple dashboard */}
              {!['chat', 'photos', 'website-builder', 'wedding-party', 'preferred-vendors', 'downloads', 'picks', 'booking', 'resources'].includes(activeSection) && !profile?.wedding_id && !profileLoading && (
                <div className="p-8 text-center">
                  <p className="text-sage-400 text-sm">This account isn't linked to a wedding — please sign in with your couple account.</p>
                </div>
              )}

              {/* Timeline section */}
              {activeSection === 'timeline' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <TimelineBuilder weddingId={profile.wedding_id} weddingDate={wedding?.wedding_date} userId={user?.id} />
                </div>
              )}

              {/* Tables section */}
              {activeSection === 'tables' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <TableLayoutPlanner weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}

              {/* Budget section */}
              {activeSection === 'budget' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <BudgetTracker weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}

              {/* Worksheets section */}
              {activeSection === 'worksheets' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <WeddingWorksheets weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}

              {/* Vendors section */}
              {activeSection === 'vendor' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <VendorChecklist weddingId={profile.wedding_id} />
                </div>
              )}

              {/* Photo Library */}
              {activeSection === 'photos' && (
                <div className="p-4 sm:p-6">
                  <PhotoBucket weddingId={wedding?.id} />
                </div>
              )}

              {/* Website Builder */}
              {activeSection === 'website-builder' && (
                <div className="p-4 sm:p-6">
                  <WebsiteBuilder weddingId={wedding?.id} coupleNames={wedding?.couple_names} />
                </div>
              )}

              {/* Wedding Party */}
              {activeSection === 'wedding-party' && (
                <div className="p-4 sm:p-6">
                  <WeddingParty weddingId={wedding?.id} />
                </div>
              )}

              {/* Preferred Vendors section */}
              {activeSection === 'preferred-vendors' && (
                <div className="p-4 sm:p-6">
                  <PreferredVendors />
                </div>
              )}

              {/* Checklist section */}
              {activeSection === 'checklist' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <PlanningChecklist weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}

              {/* Bar Planner section */}
              {activeSection === 'bar' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <BarPlanner weddingId={profile.wedding_id} guestCount={profile.guest_count} weddingDate={profile.wedding_date} coupleNames={profile.couple_names} />
                </div>
              )}

              {/* Staffing section */}
              {activeSection === 'staffing' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <StaffingCalculator weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}

              {/* Inspiration section */}
              {activeSection === 'inspo' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <InspoGallery weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}

              {/* Borrow section */}
              {activeSection === 'borrow' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <BorrowCatalog weddingId={profile.wedding_id} />
                </div>
              )}

              {/* Manor Downloads section */}
              {activeSection === 'downloads' && (
                <div className="p-4 sm:p-6">
                  <ManorDownloads isAdmin={false} />
                </div>
              )}

              {/* Picks section */}
              {activeSection === 'picks' && (
                <div className="p-4 sm:p-6">
                  <StorefrontBrowser />
                </div>
              )}

              {/* Guest Care section */}
              {activeSection === 'guestcare' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <GuestCareNotes weddingId={profile.wedding_id} />
                </div>
              )}

              {/* Inbox section */}
              {activeSection === 'inbox' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <ClientInbox weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}

              {/* Booking section */}
              {activeSection === 'booking' && (
                <div className="p-4 sm:p-6">
                  <BookingCalendly />
                </div>
              )}

              {activeSection === 'wedding-details' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <WeddingDetails weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}
              {activeSection === 'guests' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <GuestList weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}
              {activeSection === 'table-map' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <TableCanvas weddingId={profile.wedding_id} />
                </div>
              )}
              {activeSection === 'allergies' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <AllergyRegistry weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}
              {activeSection === 'ceremony-order' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <CeremonyOrder weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}
              {activeSection === 'decor' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <DecorInventory weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}
              {activeSection === 'makeup' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <MakeupSchedule weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}
              {activeSection === 'shuttle' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <ShuttleSchedule weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}
              {activeSection === 'rehearsal' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <RehearsalDinner weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}
              {activeSection === 'bedrooms' && profile?.wedding_id && (
                <div className="p-4 sm:p-6">
                  <BedroomAssignments weddingId={profile.wedding_id} userId={user?.id} />
                </div>
              )}

              {/* Resources section */}
              {activeSection === 'resources' && (
                <div className="p-4 sm:p-6 space-y-3">
                  {wedding?.honeybook_link && (
                    <a href={wedding.honeybook_link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-cream-200 hover:border-sage-300 hover:shadow-sm transition">
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
                  <a href="https://members.isadoraandco.com/offers/hWX4WHcQ" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 hover:border-amber-300 hover:shadow-sm transition">
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
                  {[
                    { name: 'Vendor Directory', href: '/vendors' },
                    { name: 'Accommodations', href: '/accommodations' },
                    { name: 'Venue Gallery', href: 'https://www.rixeymanor.com/weddingsbyseason' },
                    { name: 'Planning Resources', href: 'https://www.rixeymanor.com/planning' },
                  ].map((link) => (
                    link.href.startsWith('/') ? (
                      <button key={link.name} onClick={() => navigate(link.href)}
                        className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-cream-200 hover:border-sage-300 hover:shadow-sm transition text-left">
                        <div className="w-10 h-10 bg-cream-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </div>
                        <p className="font-medium text-sage-800 text-sm">{link.name}</p>
                      </button>
                    ) : (
                      <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 bg-white rounded-xl border border-cream-200 hover:border-sage-300 hover:shadow-sm transition">
                        <div className="w-10 h-10 bg-cream-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                        <p className="font-medium text-sage-800 text-sm">{link.name}</p>
                      </a>
                    )
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Section Finaliser — fixed bottom bar, pre-wedding period only */}
      {FINALISABLE.has(activeSection) && profile?.wedding_id && (
        <SectionFinaliser
          sectionKey={activeSection}
          weddingId={profile.wedding_id}
          finalisations={finalisations}
          onFinalised={handleFinalised}
          role="couple"
          isPreWedding={isPreWedding}
        />
      )}

      {/* Mandatory couple photo overlay — blocks portal until uploaded */}
      {needsPhoto && (
        <div className="fixed inset-0 bg-sage-900/80 flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <h2 className="font-serif text-2xl text-sage-700 mb-2">One last thing</h2>
            <p className="text-sage-500 text-sm mb-6">
              Add a photo of you two so your coordinator knows who they're planning with.
              It'll show up in your portal and on your planning file.
            </p>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]) }}
              disabled={photoUploading}
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="w-full py-3 px-6 bg-sage-600 text-white rounded-xl font-medium hover:bg-sage-700 transition disabled:opacity-50"
            >
              {photoUploading ? 'Uploading…' : 'Upload a photo'}
            </button>
            {photoError && (
              <p className="text-red-500 text-xs mt-3">{photoError}</p>
            )}
            <p className="text-sage-400 text-xs mt-4">JPG, PNG or HEIC · any size</p>
          </div>
        </div>
      )}

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



      {/* Share / Invite Modal */}
      {showShareModal && wedding?.event_code && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl text-sage-700">Invite Family & Friends</h3>
              <button
                onClick={() => { setShowShareModal(false); setShareLinkCopied(false); }}
                className="text-sage-400 hover:text-sage-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sage-600 text-sm mb-4">
              Share this link with family members and wedding party so they can access your planning portal and chat with Sage.
            </p>

            {/* Event Code */}
            <div className="bg-cream-50 rounded-lg p-4 mb-4">
              <p className="text-sage-500 text-xs mb-1">Event Code</p>
              <p className="font-mono text-2xl text-sage-700 font-bold tracking-wider">{wedding.event_code}</p>
            </div>

            {/* Signup Link */}
            <div className="bg-sage-50 rounded-lg p-4 mb-4">
              <p className="text-sage-500 text-xs mb-2">Invite Link</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/?code=${wedding.event_code}`}
                  className="flex-1 px-3 py-2 bg-white border border-sage-200 rounded-lg text-sm text-sage-700 font-mono"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?code=${wedding.event_code}`)
                    setShareLinkCopied(true)
                    setTimeout(() => setShareLinkCopied(false), 2000)
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    shareLinkCopied
                      ? 'bg-green-500 text-white'
                      : 'bg-sage-600 text-white hover:bg-sage-700'
                  }`}
                >
                  {shareLinkCopied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="text-sage-500 text-xs space-y-1">
              <p>📱 They'll use this code when signing up to join your wedding portal.</p>
              <p>👨‍👩‍👧 They can choose their role (Mother of Bride, Best Man, etc.)</p>
              <p>💬 They'll be able to chat with Sage and view your planning info.</p>
            </div>

            {/* Share buttons */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-cream-200">
              <button
                onClick={() => {
                  const text = `Join our wedding planning portal! Sign up at ${window.location.origin}/?code=${wedding.event_code} and use code: ${wedding.event_code}`
                  if (navigator.share) {
                    navigator.share({ title: 'Wedding Portal Invite', text })
                  } else {
                    navigator.clipboard.writeText(text)
                    setShareLinkCopied(true)
                    setTimeout(() => setShareLinkCopied(false), 2000)
                  }
                }}
                className="flex-1 px-4 py-2 bg-cream-100 text-sage-700 rounded-lg text-sm font-medium hover:bg-cream-200 transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <a
                href={`sms:?body=Join our wedding planning portal! Sign up at ${encodeURIComponent(window.location.origin)}/?code=${wedding.event_code} and use code: ${wedding.event_code}`}
                className="flex-1 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Text
              </a>
              <a
                href={`mailto:?subject=Join Our Wedding Portal&body=Join our wedding planning portal! Sign up at ${encodeURIComponent(window.location.origin)}/?code=${wedding.event_code} and use code: ${wedding.event_code}`}
                className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
