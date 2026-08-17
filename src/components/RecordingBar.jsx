import { useEffect, useRef } from 'react'
import { useRecorder } from '../context/RecorderContext'

/**
 * The bar that says a meeting is being recorded, wherever you are in the portal.
 *
 * It sits above everything and stays put while you move around, which is the
 * point: the recorder used to be a button on one screen, so navigating away
 * both hid it and killed it. Now leaving the screen is a normal thing to do
 * during a meeting and the bar is the evidence it is still running.
 *
 * It also carries anything recorded but not yet filed, because a recording that
 * exists on the laptop and nowhere else should follow you around until you have
 * dealt with it. Being quietly tidy about that is how you end up with none.
 */
export default function RecordingBar() {
  const { active, elapsed, pending, busyId, stop, uploadStored, download, discard } = useRecorder()
  const barRef = useRef(null)
  const showing = !!active || pending.length > 0

  /**
   * Publish the bar's height so everything else can get out of its way.
   *
   * The bar is fixed, and the admin header is `sticky top-0`, which sticks to
   * the top of the viewport no matter what is in front of it. Padding the body
   * does not help, so the header reads --recording-bar-h and sticks below
   * instead. Measured rather than hard-coded: the pending list grows, and a
   * guessed height covers the tabs the moment it wraps to two lines.
   */
  useEffect(() => {
    const root = document.documentElement
    if (!showing) {
      root.style.setProperty('--recording-bar-h', '0px')
      return
    }
    const measure = () => {
      const h = barRef.current?.offsetHeight || 0
      root.style.setProperty('--recording-bar-h', `${h}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (barRef.current) ro.observe(barRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      root.style.setProperty('--recording-bar-h', '0px')
    }
  }, [showing, pending.length])

  if (!showing) return null

  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <>
    <div ref={barRef} className="fixed top-0 left-0 right-0 z-[60]">
      {active && (
        <div className="bg-red-600 text-white">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-2 font-medium text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              Recording
            </span>
            <span className="text-sm tabular-nums">{mmss(elapsed)}</span>
            {active.label && (
              <span className="text-sm text-red-100 truncate max-w-[16rem]">{active.label}</span>
            )}
            <span className="text-xs text-red-100 hidden sm:inline">
              Saved to this laptop every few seconds. Move around the portal freely.
            </span>
            <span className="grow" />
            <button
              type="button"
              onClick={stop}
              className="text-sm font-medium px-3 py-1 rounded-lg bg-white text-red-700 hover:bg-red-50 transition"
            >
              ■ Stop and save
            </button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="bg-amber-100 border-b border-amber-300">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 space-y-1.5">
            <p className="text-xs font-medium text-amber-900">
              {pending.length === 1
                ? 'A recording on this laptop has not been saved to the portal yet'
                : `${pending.length} recordings on this laptop have not been saved to the portal yet`}
            </p>
            {pending.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
                <span className="font-medium">
                  {new Date(r.startedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                <span className="text-amber-700">
                  {r.durationSecs ? mmss(r.durationSecs) : `${Math.round(r.bytes / 1024 / 1024 * 10) / 10} MB`}
                  {r.status === 'recording' && ' · interrupted mid-recording'}
                </span>
                {r.label && <span className="text-amber-700 truncate max-w-[14rem]">{r.label}</span>}
                {r.lastError && <span className="text-red-700 basis-full">Last attempt: {r.lastError}</span>}
                <span className="grow" />
                <button
                  type="button" disabled={busyId === r.id}
                  onClick={() => uploadStored(r)}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition disabled:opacity-50"
                >
                  {busyId === r.id ? 'Uploading…' : 'Upload it now'}
                </button>
                <button
                  type="button"
                  onClick={() => download(r)}
                  className="px-2.5 py-1 rounded-lg border border-amber-400 hover:bg-amber-200 transition"
                >
                  Download a copy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Worded as a deletion on purpose, and never offered as the
                    // easy way out of a failed upload.
                    if (!window.confirm('Delete this recording from this laptop? The audio cannot be got back.')) return
                    discard(r)
                  }}
                  className="px-2.5 py-1 rounded-lg text-amber-700 hover:text-red-700 transition"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    {/* Holds the space the fixed bar occupies, so nothing starts underneath it. */}
    <div style={{ height: 'var(--recording-bar-h, 0px)' }} aria-hidden="true" />
    </>
  )
}
