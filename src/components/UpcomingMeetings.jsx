import { useState, useEffect } from 'react'

export default function UpcomingMeetings({ weddings = [], filterWedding = null, compact = false }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // 'all', 'today', 'week'

  useEffect(() => {
    loadEvents()
  }, [filterWedding])

  const loadEvents = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/calendly/events')
      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setEvents(data.events || [])
      }
    } catch (err) {
      console.error('Failed to load Calendly events:', err)
      setError('Failed to connect to Calendly')
    }
    setLoading(false)
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getEventTypeName = (event) => {
    // Extract event type from the name
    return event.name || 'Meeting'
  }

  const getEventIcon = (eventName) => {
    const name = eventName.toLowerCase()
    if (name.includes('phone') || name.includes('call')) return '📞'
    if (name.includes('zoom') || name.includes('virtual')) return '💻'
    if (name.includes('walkthrough') || name.includes('walk-through')) return '📋'
    if (name.includes('drop off') || name.includes('drop-off')) return '📦'
    if (name.includes('vendor')) return '👥'
    if (name.includes('onboarding') || name.includes('initial')) return '🎉'
    if (name.includes('planning')) return '🏛️'
    return '📅'
  }

  const isToday = (dateStr) => {
    const eventDate = new Date(dateStr).toDateString()
    const today = new Date().toDateString()
    return eventDate === today
  }

  const isThisWeek = (dateStr) => {
    const eventDate = new Date(dateStr)
    const today = new Date()
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    return eventDate >= today && eventDate <= weekFromNow
  }

  // Match event invitee to a wedding
  const matchWedding = (invitees) => {
    if (!invitees || invitees.length === 0) return null

    const inviteeEmail = invitees[0]?.email?.toLowerCase()
    const inviteeName = invitees[0]?.name?.toLowerCase()

    // Try to match by email or name
    for (const wedding of weddings) {
      const coupleName = wedding.couple_names?.toLowerCase() || ''
      const email = wedding.email?.toLowerCase() || ''

      if (inviteeEmail && email && inviteeEmail === email) {
        return wedding
      }
      if (inviteeName && coupleName && (
        inviteeName.includes(coupleName.split(' ')[0]) ||
        coupleName.includes(inviteeName.split(' ')[0])
      )) {
        return wedding
      }
    }
    return null
  }

  // Check if event matches a specific wedding
  const eventMatchesWedding = (event, wedding) => {
    if (!event.invitees || event.invitees.length === 0) return false

    const inviteeEmail = event.invitees[0]?.email?.toLowerCase()
    const inviteeName = event.invitees[0]?.name?.toLowerCase()
    const coupleName = wedding.couple_names?.toLowerCase() || ''
    const weddingEmail = wedding.email?.toLowerCase() || ''

    // Match by email
    if (inviteeEmail && weddingEmail && inviteeEmail === weddingEmail) {
      return true
    }
    // Match by name (partial)
    if (inviteeName && coupleName) {
      const coupleFirstName = coupleName.split(' ')[0]
      const inviteeFirstName = inviteeName.split(' ')[0]
      if (inviteeName.includes(coupleFirstName) || coupleName.includes(inviteeFirstName)) {
        return true
      }
    }
    return false
  }

  // Filter events
  const filteredEvents = events.filter(event => {
    // Filter by specific wedding if provided
    if (filterWedding && !eventMatchesWedding(event, filterWedding)) {
      return false
    }
    if (filter === 'today') return isToday(event.start_time)
    if (filter === 'week') return isThisWeek(event.start_time)
    return true
  })

  // Group by date
  const groupedEvents = filteredEvents.reduce((groups, event) => {
    const date = new Date(event.start_time).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(event)
    return groups
  }, {})

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-cream-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-sage-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sage-500">Loading meetings...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-cream-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl text-sage-700">Upcoming Meetings</h2>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 text-center">
          <p className="text-amber-700 text-sm mb-2">{error}</p>
          {error.includes('not configured') && (
            <p className="text-sage-500 text-xs">
              Add your Calendly Personal Access Token to .env as CALENDLY_API_TOKEN
            </p>
          )}
          <button
            onClick={() => loadEvents()}
            className="mt-3 px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 text-sm cursor-pointer"
            type="button"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={compact ? "" : "bg-white rounded-xl border border-cream-200 p-6"}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className={`font-serif ${compact ? 'text-lg' : 'text-xl'} text-sage-700`}>
            {filterWedding ? 'Scheduled Meetings' : 'Upcoming Meetings'}
          </h2>
          <p className="text-sage-500 text-sm">{filteredEvents.length} scheduled</p>
        </div>
        <div className="flex items-center gap-2">
          {!compact && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border border-cream-300 rounded-lg px-2 py-1 text-sage-700"
            >
              <option value="all">All upcoming</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
            </select>
          )}
          <button
            onClick={loadEvents}
            className="p-2 text-sage-400 hover:text-sage-600 rounded-lg hover:bg-cream-100"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sage-400">
            {filterWedding ? 'No scheduled meetings with this couple' : 'No upcoming meetings'}
          </p>
          {filterWedding && (
            <a
              href="https://calendly.com/rixeymanor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sage-600 hover:text-sage-800 text-sm"
            >
              Schedule a meeting →
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedEvents)
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .map(([date, dayEvents]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-medium ${
                    isToday(date) ? 'text-sage-700 bg-sage-100 px-2 py-0.5 rounded' : 'text-sage-500'
                  }`}>
                    {isToday(date) ? 'Today' : formatDate(date)}
                  </span>
                  <div className="flex-1 h-px bg-cream-200" />
                </div>
                <div className="space-y-2">
                  {dayEvents
                    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                    .map(event => {
                      const matchedWedding = matchWedding(event.invitees)
                      const invitee = event.invitees?.[0]

                      return (
                        <div
                          key={event.uri}
                          className="flex items-start gap-3 p-3 bg-cream-50 rounded-lg border border-cream-200 hover:border-sage-300 transition"
                        >
                          <span className="text-2xl">{getEventIcon(event.name)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sage-800 text-sm">
                                  {getEventTypeName(event)}
                                </p>
                                {invitee && (
                                  <p className="text-sage-600 text-sm">
                                    {invitee.name}
                                    {matchedWedding && (
                                      <span className="ml-2 text-xs bg-sage-100 text-sage-600 px-1.5 py-0.5 rounded">
                                        {matchedWedding.couple_names}
                                      </span>
                                    )}
                                  </p>
                                )}
                                {invitee?.email && (
                                  <p className="text-sage-400 text-xs">{invitee.email}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sage-700 font-medium text-sm">
                                  {formatTime(event.start_time)}
                                </p>
                                {event.location?.type === 'physical' && (
                                  <p className="text-sage-400 text-xs">In-person</p>
                                )}
                                {event.location?.type === 'custom' && event.location?.location && (
                                  <p className="text-sage-400 text-xs truncate max-w-[100px]">
                                    {event.location.location.includes('zoom') ? 'Zoom' : 'Virtual'}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-cream-200">
        <a
          href="https://calendly.com/app/scheduled_events/user/me"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sage-600 hover:text-sage-800 text-sm flex items-center gap-1"
        >
          Manage in Calendly
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  )
}
