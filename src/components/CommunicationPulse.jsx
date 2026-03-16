// CommunicationPulse — shows how active a couple is vs what's typical at their planning stage
// Three zones: less than typical / about right / more than typical
// Designed to be calm and informational, not alarming

const LEVELS = {
  less:    { label: 'Quieter than usual', color: 'bg-slate-400', textColor: 'text-slate-600', position: 0 },
  typical: { label: 'About right',        color: 'bg-sage-500',  textColor: 'text-sage-700',  position: 1 },
  more:    { label: 'More active',         color: 'bg-amber-400', textColor: 'text-amber-700', position: 2 },
}

// Compact pill for wedding list cards
export function PulsePill({ level }) {
  if (!level) return null
  const { label, textColor } = LEVELS[level] || LEVELS.typical
  const dot = level === 'less' ? 'bg-slate-300' : level === 'more' ? 'bg-amber-300' : 'bg-sage-400'
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

// Compact 3-bar meter for wedding list cards
export function PulseMeter({ level }) {
  if (!level) return null
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" title={LEVELS[level]?.label}>
      <span className={`inline-block h-2.5 w-2 rounded-sm ${level === 'less' ? 'bg-slate-400' : 'bg-cream-200'}`} />
      <span className={`inline-block h-3.5 w-2 rounded-sm ${level === 'typical' ? 'bg-sage-400' : 'bg-cream-200'}`} />
      <span className={`inline-block h-2.5 w-2 rounded-sm ${level === 'more' ? 'bg-amber-400' : 'bg-cream-200'}`} />
    </span>
  )
}

// Full scale for the overview tab
export default function CommunicationPulse({ pulse }) {
  if (!pulse) return null

  const { level, score, expected, stage, breakdown } = pulse
  const current = LEVELS[level] || LEVELS.typical

  return (
    <div className="bg-white rounded-xl border border-cream-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-sage-700">Communication Pulse</h3>
        <span className="text-xs text-sage-400">{stage} · last 30 days</span>
      </div>

      {/* Scale track */}
      <div className="relative">
        <div className="flex rounded-full overflow-hidden h-2 bg-cream-100">
          <div className={`flex-1 ${level === 'less' ? 'bg-slate-300' : 'bg-cream-100'}`} />
          <div className={`flex-1 ${level === 'typical' ? 'bg-sage-400' : 'bg-cream-100'} mx-px`} />
          <div className={`flex-1 ${level === 'more' ? 'bg-amber-300' : 'bg-cream-100'}`} />
        </div>
        {/* Labels */}
        <div className="flex justify-between mt-1.5">
          <span className={`text-xs ${level === 'less' ? 'text-slate-600 font-medium' : 'text-sage-300'}`}>
            Quieter than usual
          </span>
          <span className={`text-xs ${level === 'typical' ? 'text-sage-600 font-medium' : 'text-sage-300'}`}>
            About right
          </span>
          <span className={`text-xs ${level === 'more' ? 'text-amber-600 font-medium' : 'text-sage-300'}`}>
            More active
          </span>
        </div>
      </div>

      {/* Score context */}
      <p className="text-xs text-sage-400">
        {score} touchpoint{score !== 1 ? 's' : ''} this month · typical range for this stage is {expected.min}–{expected.max}
      </p>

      {/* Breakdown — only show if there's something to show */}
      {score > 0 && breakdown && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-cream-100">
          {breakdown.emails > 0 && <span className="text-xs text-sage-400">{breakdown.emails} email{breakdown.emails !== 1 ? 's' : ''}</span>}
          {breakdown.texts > 0 && <span className="text-xs text-sage-400">{breakdown.texts} text{breakdown.texts !== 1 ? 's' : ''}</span>}
          {breakdown.zooms > 0 && <span className="text-xs text-sage-400">{breakdown.zooms} zoom{breakdown.zooms !== 1 ? 's' : ''}</span>}
          {breakdown.sageChat > 0 && <span className="text-xs text-sage-400">{breakdown.sageChat} Sage message{breakdown.sageChat !== 1 ? 's' : ''}</span>}
          {breakdown.directMessages > 0 && <span className="text-xs text-sage-400">{breakdown.directMessages} direct message{breakdown.directMessages !== 1 ? 's' : ''}</span>}
          {breakdown.portalActivity > 0 && <span className="text-xs text-sage-400">{breakdown.portalActivity} portal update{breakdown.portalActivity !== 1 ? 's' : ''}</span>}
        </div>
      )}
    </div>
  )
}
