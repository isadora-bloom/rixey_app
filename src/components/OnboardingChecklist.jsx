import { useState, useEffect } from 'react'

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

export default function OnboardingChecklist({ weddingId, onAction, onDismiss }) {
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
      const response = await fetch(`http://localhost:3001/api/onboarding/${weddingId}`)
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
      await fetch(`http://localhost:3001/api/onboarding/${weddingId}`, {
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

  return (
    <div className="bg-gradient-to-br from-sage-50 to-cream-50 rounded-2xl border border-sage-200 p-6 mb-6">
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
