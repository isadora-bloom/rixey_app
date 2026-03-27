// Chat interface: message list, input, file upload, welcome message, retry state

export default function DashboardChat({
  messages,
  loadingMessages,
  sending,
  newMessage,
  setNewMessage,
  sendMessage,
  selectedFile,
  setSelectedFile,
  sendWithFile,
  handleFileSelect,
  clearSelectedFile,
  uploadingFile,
  retryState,
  setRetryState,
  chatContainerRef,
  messagesEndRef,
  fileInputRef,
  user,
}) {
  return (
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
  )
}
