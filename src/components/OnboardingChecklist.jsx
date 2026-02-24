import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const ONBOARDING_STEPS = [
  {
    key: 'couple_photo_uploaded',
    title: 'Upload a photo of you two',
    description: 'Help us put a face to your names!',
    icon: '📸',
    action: 'Upload Photo'
  },
  {
    key: 'first_message_sent',
    title: 'Say hi to Sage',
    description: 'Your AI planning assistant is ready to help',
    icon: '💬',
    action: 'Chat with Sage'
  },
  {
    key: 'vendor_added',
    title: 'Add your first vendor',
    description: 'Start tracking your photographer, caterer, etc.',
    icon: '👥',
    action: 'Add Vendor'
  },
  {
    key: 'inspo_uploaded',
    title: 'Share some inspiration',
    description: 'Upload photos that capture your vision',
    icon: '✨',
    action: 'Add Inspo'
  },
  {
    key: 'checklist_item_completed',
    title: 'Check off a task',
    description: 'Get started on your planning checklist',
    icon: '✅',
    action: 'View Checklist'
  }
]

const TIME_BUCKETS = [
  {
    minWeeks: 52,
    label: 'Dream & Book Essentials',
    emoji: '✨',
    nudges: [
      { text: 'Book your photographer and caterer first — they book up a year or more in advance.', action: 'vendor_added' },
      { text: 'Lock in your music (DJ or band) — great ones fill their calendars fast.', action: 'vendor_added' },
      { text: 'Not sure where to start? Ask Sage — she can walk you through the first 90 days.', action: 'first_message_sent' },
    ]
  },
  {
    minWeeks: 26,
    label: 'Lock In Your Vendors',
    emoji: '📋',
    nudges: [
      { text: 'Book remaining vendors (florist, hair & makeup, officiant) before your date fills up.', action: 'vendor_added' },
      { text: 'Start uploading vendor contracts so Sage can answer questions about them.', action: 'first_message_sent' },
      { text: 'Check off your planning checklist to see where you stand.', action: 'checklist_item_completed' },
    ]
  },
  {
    minWeeks: 13,
    label: 'Get Into the Details',
    emoji: '🗓',
    nudges: [
      { text: 'Build your day-of timeline — now is the right time to nail down the schedule.', action: 'checklist_item_completed' },
      { text: 'Start thinking about table layout and guest count for your seating plan.', action: 'checklist_item_completed' },
      { text: 'Confirm all vendors have your date locked in their calendars.', action: 'vendor_added' },
    ]
  },
  {
    minWeeks: 4,
    label: 'Final Prep',
    emoji: '🏁',
    nudges: [
      { text: 'Schedule your final venue walkthrough with the Rixey Manor team.', action: 'first_message_sent' },
      { text: 'Send final guest count and dietary needs to your caterer this week.', action: 'vendor_added' },
      { text: 'Confirm every vendor: arrival times, contacts, and day-of logistics.', action: 'checklist_item_completed' },
    ]
  },
  {
    minWeeks: 0,
    label: 'Home Stretch',
    emoji: '🎉',
    nudges: [
      { text: "You're almost there! Confirm every vendor one final time this week.", action: 'vendor_added' },
      { text: 'Pack your personal items and vendor tips the night before.', action: 'checklist_item_completed' },
      { text: 'Ask Sage if you have any last-minute questions — she\'s here for you!', action: 'first_message_sent' },
    ]
  },
]

function getTimeBucket(weddingDate) {
  if (!weddingDate) return null
  const msPerWeek = 1000 * 60 * 60 * 24 * 7
  const weeksOut = Math.floor((new Date(weddingDate) - new Date()) / msPerWeek)
  if (weeksOut < 0) return null
  return TIME_BUCKETS.find(b => weeksOut >= b.minWeeks) || TIME_BUCKETS[TIME_BUCKETS.length - 1]
}

export default function OnboardingChecklist({ weddingId, weddingDate, onAction, onDismiss }) {
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (weddingId) {
      loadProgress()
    }
  }, [weddingId])

  const loadProgress = async () => {
    try {
      const response = await fetch(`${API_URL}/api/onboarding/${weddingId}`)
      const data = await response.json()
      setProgress(data.progress)
      setDismissed(data.progress?.onboarding_dismissed || false)
    } catch (err) {
      console.error('Failed to load onboarding:', err)
    }
    setLoading(false)
  }

  const handleDismiss = async () => {
    try {
      await fetch(`${API_URL}/api/onboarding/${weddingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_dismissed: true })
      })
      setDismissed(true)
      if (onDismiss) onDismiss()
    } catch (err) {
      console.error('Failed to dismiss:', err)
    }
  }

  if (loading || dismissed || !progress) return null

  // Count completed steps
  const completedSteps = ONBOARDING_STEPS.filter(step => progress[step.key]).length
  const totalSteps = ONBOARDING_STEPS.length
  const progressPercent = Math.round((completedSteps / totalSteps) * 100)

  // If all complete, don't show
  if (completedSteps === totalSteps) return null

  const timeBucket = getTimeBucket(weddingDate)

  return (
    <div className="bg-gradient-to-br from-sage-50 to-cream-50 rounded-2xl border border-sage-200 p-4 sm:p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-serif text-lg text-sage-700 flex items-center gap-2">
            <span>🎉</span>
            Welcome! Let's get started
          </h2>
          <p className="text-sage-500 text-sm mt-1">
            Complete these steps to make the most of your planning portal
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-sage-400 hover:text-sage-600 text-sm"
        >
          Dismiss
        </button>
      </div>

      {/* Time-bucket nudges */}
      {timeBucket && (
        <div className="mb-5 p-4 bg-white rounded-xl border border-sage-200">
          <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">
            {timeBucket.emoji} {timeBucket.label} — Focus on this now
          </p>
          <ul className="space-y-2">
            {timeBucket.nudges.map((nudge, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-sage-400 mt-0.5">→</span>
                <button
                  onClick={() => onAction && onAction(nudge.action)}
                  className="text-sm text-sage-700 hover:text-sage-900 text-left hover:underline"
                >
                  {nudge.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-sage-600 font-medium">{completedSteps} of {totalSteps} complete</span>
          <span className="text-sage-500">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-sage-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {ONBOARDING_STEPS.map(step => {
          const isComplete = progress[step.key]

          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 p-3 rounded-lg transition ${
                isComplete
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-white border border-cream-200 hover:border-sage-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                isComplete ? 'bg-green-100' : 'bg-cream-100'
              }`}>
                {isComplete ? '✓' : step.icon}
              </div>
              <div className="flex-1">
                <p className={`font-medium text-sm ${
                  isComplete ? 'text-green-700 line-through' : 'text-sage-800'
                }`}>
                  {step.title}
                </p>
                {!isComplete && (
                  <p className="text-sage-500 text-xs">{step.description}</p>
                )}
              </div>
              {!isComplete && onAction && (
                <button
                  onClick={() => onAction(step.key)}
                  className="px-3 py-1 bg-sage-100 text-sage-700 rounded-lg text-xs font-medium hover:bg-sage-200"
                >
                  {step.action}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
