import { useState } from 'react'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'


/**
 * Sticky bottom bar for section save + finalisation.
 *
 * Props:
 *   sectionKey      string  — matches the sidebar key (e.g. 'timeline')
 *   weddingId       string
 *   finalisations   object  — map of sectionKey → { couple_finalised, staff_finalised }
 *   onFinalised     fn(sectionKey, party, value) — optimistic update callback
 *   role            'couple' | 'staff'  — who is viewing
 *   isPreWedding    bool  — only show when within 6 weeks
 *   onSave          fn (optional) — if provided, shows a Save button too
 *   saveLabel       string (optional) — defaults to 'Save'
 *   saving          bool (optional) — external saving state
 *   saved           bool (optional) — external saved state
 */
export default function SectionFinaliser({
  sectionKey,
  weddingId,
  finalisations = {},
  onFinalised,
  role = 'couple',
  isPreWedding = false,
  onSave,
  saveLabel = 'Save',
  saving = false,
  saved = false,
}) {
  const [toggling, setToggling] = useState(false)

  if (!isPreWedding) return null

  const data            = finalisations[sectionKey] || {}
  const coupleDone      = !!data.couple_finalised
  const staffDone       = !!data.staff_finalised
  const myDone          = role === 'couple' ? coupleDone : staffDone
  const bothDone        = coupleDone && staffDone

  async function toggle() {
    if (toggling) return
    setToggling(true)
    try {
      await fetch(`${API_URL}/api/finalisations/${weddingId}`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ section: sectionKey, party: role, value: !myDone }),
      })
      onFinalised?.(sectionKey, role, !myDone)
    } finally {
      setToggling(false)
    }
  }

  const myLabel   = role === 'couple' ? 'You' : 'Rixey'
  const theirLabel = role === 'couple' ? 'Rixey' : 'Couple'
  const theirDone  = role === 'couple' ? staffDone : coupleDone

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      {/* fade gradient so content doesn't hard-cut */}
      <div className="h-8 bg-gradient-to-t from-white/80 to-transparent" />

      <div className="bg-white/95 backdrop-blur border-t border-cream-200 pointer-events-auto">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">

          {/* Save button — only if onSave is provided */}
          {onSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className={`shrink-0 px-5 py-2 rounded-lg text-sm font-medium transition ${
                saved
                  ? 'bg-green-100 text-green-700'
                  : 'bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50'
              }`}
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : saveLabel}
            </button>
          )}

          {onSave && <div className="hidden sm:block w-px h-6 bg-cream-200 shrink-0" />}

          {/* Finalisation status */}
          <div className="flex items-center gap-4 flex-1 min-w-0">

            {/* My confirmation */}
            <button
              onClick={toggle}
              disabled={toggling}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition shrink-0 ${
                myDone
                  ? 'bg-sage-50 border-sage-300 text-sage-700'
                  : 'bg-white border-cream-300 text-sage-500 hover:border-sage-400 hover:text-sage-700'
              } disabled:opacity-50`}
            >
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                myDone ? 'bg-sage-500 border-sage-500' : 'border-cream-400'
              }`}>
                {myDone && <span className="text-white text-[9px] leading-none">✓</span>}
              </span>
              <span>{myDone ? `${myLabel}: signed off` : `${myLabel}: sign off`}</span>
            </button>

            {/* Their status — read only */}
            <div className={`flex items-center gap-2 text-sm shrink-0 ${theirDone ? 'text-sage-600' : 'text-sage-400'}`}>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                theirDone ? 'bg-sage-500 border-sage-500' : 'border-cream-300'
              }`}>
                {theirDone && <span className="text-white text-[9px] leading-none">✓</span>}
              </span>
              <span>{theirDone ? `${theirLabel}: signed off` : `${theirLabel}: pending`}</span>
            </div>

          </div>

          {/* Both done banner */}
          {bothDone && (
            <span className="shrink-0 text-xs font-semibold text-sage-600 bg-sage-50 border border-sage-200 rounded-full px-3 py-1">
              ✓ Section finalised
            </span>
          )}

        </div>
      </div>
    </div>
  )
}
