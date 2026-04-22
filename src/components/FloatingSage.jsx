import { useState } from 'react'

export default function FloatingSage({ activeSection, onNavigateToChat }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [quickMsg, setQuickMsg] = useState('')
  const [showInput, setShowInput] = useState(false)

  // Hide on the chat section itself
  if (activeSection === 'chat') return null

  const handleSend = () => {
    if (quickMsg.trim()) {
      onNavigateToChat(quickMsg.trim())
      setQuickMsg('')
      setShowInput(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* Quick message input */}
      {showInput && (
        <div className="bg-white rounded-2xl shadow-xl border border-cream-200 p-3 w-72 animate-in slide-in-from-bottom-2">
          <p className="text-xs text-sage-500 mb-2">Ask Sage anything about your wedding</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={quickMsg}
              onChange={e => setQuickMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a question..."
              className="flex-1 px-3 py-2 border border-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={!quickMsg.trim()}
              className="px-3 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50 transition"
            >
              Go
            </button>
          </div>
          <button
            onClick={() => { onNavigateToChat(); setShowInput(false) }}
            className="text-xs text-sage-500 hover:text-sage-700 mt-2 block"
          >
            Open full chat
          </button>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowInput(v => !v)}
        onMouseEnter={() => !showInput && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="w-14 h-14 bg-sage-600 hover:bg-sage-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        {showInput ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !showInput && (
        <div className="absolute bottom-16 right-0 bg-sage-800 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
          Ask Sage
        </div>
      )}
    </div>
  )
}
