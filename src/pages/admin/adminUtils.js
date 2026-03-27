// Stress/escalation keywords to detect
export const ESCALATION_KEYWORDS = [
  'stressed', 'stress', 'anxious', 'worried', 'frustrated', 'frustrating',
  'overwhelmed', 'help', 'urgent', 'problem', 'issue', 'wrong', 'mistake',
  'angry', 'upset', 'confused', 'lost', 'panic', 'emergency', 'asap',
  'deadline', 'behind', 'late', 'cancel', 'disaster', 'terrible', 'awful'
]

// Calculate time since last activity
export function getLastActivity(messages) {
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

export function detectEscalation(messages, handledAt = null) {
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
    default: return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}
