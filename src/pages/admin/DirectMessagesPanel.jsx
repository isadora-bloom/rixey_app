import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../../config/api'
import { authHeaders } from '../../utils/api'

export default function DirectMessagesPanel({ weddingId, weddingName }) {
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
      const response = await fetch(`${API_URL}/api/messages/${weddingId}`, { headers: await authHeaders() })
      const data = await response.json()
      setMessages(data.messages || [])

      // Mark client messages as read
      await fetch(`${API_URL}/api/messages/read/${weddingId}`, {
        method: 'PUT',
        headers: await authHeaders(),
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
        headers: await authHeaders(),
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
        <div className="h-64 sm:h-80 overflow-y-auto p-3 sm:p-4 space-y-3">
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
