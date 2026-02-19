import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function ClientInbox({ weddingId, userId, onUnreadChange }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (weddingId) {
      loadMessages()
      loadUnreadCount()
      // Poll for new messages every 30 seconds
      const interval = setInterval(() => {
        loadMessages()
        loadUnreadCount()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [weddingId])

  useEffect(() => {
    if (expanded && messages.length > 0) {
      scrollToBottom()
      markAsRead()
    }
  }, [expanded, messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/messages/${weddingId}`)
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
    setLoading(false)
  }

  const loadUnreadCount = async () => {
    try {
      const response = await fetch(`${API_URL}/api/messages/unread/${weddingId}`)
      const data = await response.json()
      setUnreadCount(data.unread || 0)
      onUnreadChange?.(data.unread || 0)
    } catch (err) {
      console.error('Failed to load unread count:', err)
    }
  }

  const markAsRead = async () => {
    if (unreadCount === 0) return
    try {
      await fetch(`${API_URL}/api/messages/read/${weddingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderType: 'admin' })
      })
      setUnreadCount(0)
      onUnreadChange?.(0)
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const response = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weddingId,
          senderId: userId,
          senderType: 'client',
          content: newMessage.trim()
        })
      })

      if (response.ok) {
        setNewMessage('')
        loadMessages()
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    }
    setSending(false)
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  // Collapsed view - just show button with unread badge
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-cream-200 hover:border-sage-300 transition text-left"
      >
        <div className="w-10 h-10 bg-sage-100 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-medium text-sage-800">Message the Team</p>
          <p className="text-sage-500 text-sm">
            {messages.length === 0 ? 'Start a conversation' : `${messages.length} messages`}
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {unreadCount}
          </span>
        )}
        <svg className="w-5 h-5 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    )
  }

  // Expanded view - full inbox
  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cream-200 bg-sage-50">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <h3 className="font-serif text-lg text-sage-700">Messages</h3>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="text-sage-400 hover:text-sage-600 p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="h-80 overflow-y-auto p-4 space-y-3 bg-cream-50">
        {loading ? (
          <p className="text-sage-400 text-center py-8">Loading messages...</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sage-500 mb-2">No messages yet</p>
            <p className="text-sage-400 text-sm">Send a message to the Rixey Manor team</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_type === 'client' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.sender_type === 'client'
                    ? 'bg-sage-600 text-white rounded-br-md'
                    : 'bg-white border border-cream-200 text-sage-800 rounded-bl-md'
                }`}
              >
                {msg.sender_type === 'admin' && (
                  <p className="text-xs font-medium text-sage-500 mb-1">Rixey Manor</p>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${
                  msg.sender_type === 'client' ? 'text-sage-200' : 'text-sage-400'
                }`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
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
            className="px-4 py-2 bg-sage-600 text-white rounded-full hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
