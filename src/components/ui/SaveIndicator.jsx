import { useEffect, useState } from 'react'

export default function SaveIndicator({ state = 'idle' }) {
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (state === 'saving') {
      setVisible(true)
      setFading(false)
    } else if (state === 'saved') {
      setVisible(true)
      setFading(false)
      const fadeTimer = setTimeout(() => setFading(true), 1500)
      const hideTimer = setTimeout(() => setVisible(false), 2000)
      return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
    } else {
      setVisible(false)
      setFading(false)
    }
  }, [state])

  if (!visible) return null

  if (state === 'saving') {
    return (
      <span className="text-xs text-sage-400 inline-flex items-center gap-1 select-none">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
          <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Saving...
      </span>
    )
  }

  return (
    <span
      className={`text-xs text-sage-500 inline-flex items-center gap-1 select-none transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Saved
    </span>
  )
}
