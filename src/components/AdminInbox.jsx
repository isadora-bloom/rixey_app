import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function AdminInbox({ weddings = [], onUnreadChange }) {
  const [conversations, setConversations] = useState([])
  const [selectedWedding, setSelectedWedding] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadConversations()
    loadUnreadCounts()
    // Poll every 30 seconds
    const interval = setInterval(() => {
      loadConversations()
      loadUnreadCounts()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedWedding) {
      loadMessages(selectedWedding.id)
    }
  }, [selectedWedding])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadConversations = async () => {
    try {
      const response = await fetch('${API_URL}/api/messages/admin/conversations')
      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
    setLoading(false)
  }

  const loadUnreadCounts = async () => {
    try {
      const response = await fetch('${API_URL}/api/messages/admin/unread')
      const data = await response.json()
      setTotalUnread(data.total || 0)
      onUnreadChange?.(data.total || 0)
    } catch (err) {
      console.error('Failed to load unread counts:', err)
    }
  }

  const loadMessages = async (weddingId) => {
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

      // Refresh unread counts
      loadUnreadCounts()
      loadConversations()
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedWedding || sending) return

    setSending(true)
    try {
      const response = await fetch('${API_URL}/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weddingId: selectedWedding.id,
          senderType: 'admin',
          content: newMessage.trim()
        })
      })

      if (response.ok) {
        setNewMessage('')
        loadMessages(selectedWedding.id)
        loadConversations()
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    }
    setSending(false)
  }

  const getWeddingName = (weddingId) => {
    const wedding = weddings.find(w => w.id === weddingId)
    return wedding?.couple_names || 'Unknown Couple'
  }

  const getWedding = (weddingId) => {
    return weddings.find(w => w.id === weddingId)
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

  // Start new conversation with a wedding
  const startConversation = (wedding) => {
    setSelectedWedding(wedding)
    // Check if conversation exists, if not messages will be empty
    loadMessages(wedding.id)
  }

  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-cream-200">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Messages</h2>
          <p className="text-sage-500 text-sm">
            {totalUnread > 0 ? `${totalUnread} unread` : 'Direct messages with couples'}
          </p>
        </div>
        {selectedWedding && (
          <button
            onClick={() => setSelectedWedding(null)}
            className="text-sage-500 hover:text-sage-700 text-sm"
          >
            ← All conversations
          </button>
        )}
      </div>

      {!selectedWedding ? (
        // Conversation list
        <div className="divide-y divide-cream-100">
          {loading ? (
            <p className="text-sage-400 text-center py-8">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sage-500 mb-4">No conversations yet</p>
              <p className="text-sage-400 text-sm mb-4">Start a conversation with a couple:</p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {weddings.filter(w => !w.archived).map(wedding => (
                  <button
                    key={wedding.id}
                    onClick={() => startConversation(wedding)}
                    className="w-full text-left p-3 rounded-lg hover:bg-cream-50 border border-cream-200 transition"
                  >
                    <p className="font-medium text-sage-700">{wedding.couple_names}</p>
                    <p className="text-sage-400 text-xs">
                      {wedding.wedding_date
                        ? new Date(wedding.wedding_date).toLocaleDateString()
                        : 'No date set'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {conversations
                .sort((a, b) => new Date(b.latest_message.created_at) - new Date(a.latest_message.created_at))
                .map(conv => (
                  <button
                    key={conv.wedding_id}
                    onClick={() => startConversation(getWedding(conv.wedding_id))}
                    className="w-full text-left p-4 hover:bg-cream-50 transition flex items-start gap-3"
                  >
                    <div className="w-10 h-10 bg-sage-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sage-600 font-medium">
                        {getWeddingName(conv.wedding_id).charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sage-800 truncate">
                          {getWeddingName(conv.wedding_id)}
                        </p>
                        <span className="text-sage-400 text-xs shrink-0">
                          {formatTime(conv.latest_message.created_at)}
                        </span>
                      </div>
                      <p className="text-sage-500 text-sm truncate">
                        {conv.latest_message.sender_type === 'admin' && (
                          <span className="text-sage-400">You: </span>
                        )}
                        {conv.latest_message.content}
                      </p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                ))}

              {/* Option to start new conversation */}
              <div className="p-4 bg-cream-50">
                <p className="text-sage-500 text-sm mb-2">Message another couple:</p>
                <select
                  onChange={(e) => {
                    const wedding = weddings.find(w => w.id === e.target.value)
                    if (wedding) startConversation(wedding)
                  }}
                  className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Select a couple...</option>
                  {weddings
                    .filter(w => !w.archived && !conversations.find(c => c.wedding_id === w.id))
                    .map(w => (
                      <option key={w.id} value={w.id}>{w.couple_names}</option>
                    ))}
                </select>
              </div>
            </>
          )}
        </div>
      ) : (
        // Message thread
        <div className="flex flex-col h-[500px]">
          {/* Thread header */}
          <div className="p-3 bg-sage-50 border-b border-cream-200">
            <p className="font-medium text-sage-700">{selectedWedding.couple_names}</p>
            <p className="text-sage-400 text-xs">
              {selectedWedding.wedding_date
                ? new Date(selectedWedding.wedding_date).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })
                : 'Wedding date not set'}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-cream-50">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sage-500">No messages yet</p>
                <p className="text-sage-400 text-sm">Send the first message below</p>
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
      )}
    </div>
  )
}
