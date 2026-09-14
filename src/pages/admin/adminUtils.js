// How long an unread direct message sits before it counts as needing
// attention. Four hours is long enough that it is not "we haven't got to
// this yet", short enough that a couple who message in the evening are not
// waiting until morning to hear that back.
const UNREAD_STALE_MS = 4 * 60 * 60 * 1000

/**
 * The wedding's own last-activity timestamp, wherever it lives.
 *
 * `wedding.last_activity_at` (once the server computes it) is the ground
 * truth. Until then this falls back to the newest of the couple's Sage
 * questions and their newest direct message, so a couple who only ever use
 * direct messages stop reading as "No activity" just because nobody asked
 * Sage anything.
 */
export function getLastActivityAt(wedding, messages, directConversation) {
  if (wedding?.last_activity_at) {
    const d = new Date(wedding.last_activity_at)
    if (!isNaN(d)) return d
  }

  const userMessages = (messages || []).filter(m => m.sender === 'user')
  const sageLatest = userMessages.length
    ? new Date(Math.max(...userMessages.map(m => new Date(m.created_at).getTime())))
    : null

  const directLatest = directConversation?.latest_message?.created_at
    ? new Date(directConversation.latest_message.created_at)
    : null

  if (sageLatest && directLatest) return sageLatest > directLatest ? sageLatest : directLatest
  return sageLatest || directLatest || null
}

// Calculate time since last activity. Takes the wedding row and the couple's
// direct-message conversation alongside their Sage messages — see
// getLastActivityAt for why all three matter.
export function getLastActivity(wedding, messages, directConversation) {
  const lastDate = getLastActivityAt(wedding, messages, directConversation)
  if (!lastDate) return null

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

/**
 * Two real signals instead of matching a couple's own words against a list
 * of feelings ("no regex on user text" is a project rule, and keyword
 * matching on "help", "late", "lost" flagged ordinary planning talk as
 * distress just as often as it caught anything real).
 *
 * (a) a message the server itself judged worth flagging, at write time —
 *     `messages[].flagged`. Absent wherever that hasn't shipped yet, which
 *     reads as false rather than as an escalation.
 * (b) a direct message from the couple that has sat unread for more than
 *     four hours. The conversations endpoint only reports the newest message
 *     per wedding, so this is judged from that one row: if it is unread,
 *     from the couple, and already older than the threshold, there is for
 *     certain been no reply in that time.
 */
export function detectEscalation(messages, handledAt = null, directConversation = null) {
  const isAfterHandled = (dateStr) => !handledAt || new Date(dateStr) > new Date(handledAt)

  const flagged = (messages || []).filter(m =>
    m.sender === 'user' && m.flagged === true && isAfterHandled(m.created_at)
  )

  const latestDirect = directConversation?.latest_message
  const directIsStale = !!(
    latestDirect &&
    latestDirect.sender_type === 'client' &&
    !latestDirect.is_read &&
    isAfterHandled(latestDirect.created_at) &&
    Date.now() - new Date(latestDirect.created_at).getTime() > UNREAD_STALE_MS
  )

  const escalationMessages = [...flagged]
  if (directIsStale) {
    // No Sage message backs this one, so there's no user_id to focus a chat
    // thread on — `source` tells callers to open Direct Messages instead.
    escalationMessages.push({
      content: latestDirect.content,
      created_at: latestDirect.created_at,
      user_id: null,
      source: 'direct',
    })
  }

  return {
    hasEscalation: escalationMessages.length > 0,
    count: escalationMessages.length,
    messages: escalationMessages,
  }
}

export function getCategoryIcon(category) {
  switch (category) {
    case 'vendor': return '👥'
    case 'vendor_contact': return '📞'
    case 'guest_count': return '🎫'
    case 'decor': return '🌸'
    case 'ceremony': return '💒'
    case 'allergy': return '⚠️'
    case 'timeline': return '⏰'
    case 'colors': return '🎨'
    case 'reception': return '🥂'
    case 'bar': return '🍷'
    case 'catering': return '🍽️'
    case 'accommodations': return '🛏️'
    case 'shuttle': return '🚌'
    case 'family': return '👨‍👩‍👧'
    case 'budget': return '💰'
    case 'stress': return '💛'
    case 'grief': return '🕊️'
    case 'relationship': return '💑'
    case 'health': return '💙'
    case 'note': return '📝'
    case 'follow_up': return '🔔'
    case 'sms_message': return '💬'
    case 'call_transcript': return '📱'
    case 'zoom_transcript': return '🎥'
    case 'email': return '📧'
    case 'borrow_selection': return '📋'
    default: return '📌'
  }
}

export function getCategoryLabel(category) {
  switch (category) {
    case 'vendor': return 'Vendor'
    case 'vendor_contact': return 'Contact Info'
    case 'guest_count': return 'Guest Count'
    case 'decor': return 'Decor'
    case 'ceremony': return 'Ceremony'
    case 'allergy': return 'Allergy / Dietary'
    case 'timeline': return 'Timeline'
    case 'colors': return 'Colors & Style'
    case 'reception': return 'Reception'
    case 'bar': return 'Bar Setup'
    case 'catering': return 'Catering'
    case 'accommodations': return 'Accommodations'
    case 'shuttle': return 'Transportation'
    case 'family': return 'Family'
    case 'budget': return 'Budget'
    case 'stress': return 'Stress / Worry'
    case 'grief': return 'Grief / Loss'
    case 'relationship': return 'Couple Dynamics'
    case 'health': return 'Health / Access'
    case 'note': return 'Note'
    case 'follow_up': return 'Follow Up'
    case 'sms_message': return 'SMS'
    case 'call_transcript': return 'Call'
    case 'zoom_transcript': return 'Zoom'
    case 'email': return 'Email'
    case 'borrow_selection': return 'Borrow Selection'
    // Emitted by the document importer's heading categoriser. They were
    // reaching the default below and title-casing acceptably, which is how
    // nobody noticed they were missing; a curated label reads better and
    // "Wedding Party" beats "Wedding_party" if the default ever changes.
    case 'contact': return 'Contact Info'
    case 'contract': return 'Contract'
    case 'wedding_party': return 'Wedding Party'
    case 'music': return 'Music'
    case 'rentals': return 'Rentals'
    case 'photography': return 'Photography'
    case 'seating': return 'Seating & Tables'
    default: return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}
