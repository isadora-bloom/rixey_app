import { API_URL } from '../config/api'

/**
 * Tell the venue that something broke in somebody's browser.
 *
 * The guest list threw on every render for twenty hours in August and the way
 * Rixey found out was a client ringing up. ErrorBoundary had caught it the
 * whole time and called console.error, into a console nobody at Rixey is
 * looking at. Everything needed to know sooner existed; none of it left the
 * page.
 *
 * Three rules, all of them because the thing calling this is already broken:
 *
 *   it never throws. A reporter that can fail turns one error into two, and the
 *   second one lands in the handler for the first.
 *
 *   it never blocks. keepalive so the report survives the reload the user is
 *   about to do out of frustration, and nothing awaits it.
 *
 *   it never loops. Reporting is deliberately not done through apiFetch: that
 *   raises ApiError on failure, main.jsx turns unhandled rejections into
 *   reports, and a failing report would report its own failure for ever.
 */

// Same fault, same session, reported once. A render loop can fire thousands of
// times a second and the venue needs to know it happened, not how many times.
const reported = new Set()

export function reportError(error, context = {}) {
  try {
    const message = String(error?.message || error || 'Unknown error').slice(0, 500)
    const stack = error?.stack ? String(error.stack) : null
    const key = `${message}|${(stack || '').split('\n')[1] || ''}`
    if (reported.has(key)) return
    reported.add(key)

    const body = JSON.stringify({
      message,
      stack,
      component: context.component || null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      weddingId: context.weddingId || null,
      userEmail: context.userEmail || null,
      release: import.meta.env.VITE_COMMIT_SHA || null,
    })

    fetch(`${API_URL}/api/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      // Survives the page being reloaded or closed a moment later, which is
      // exactly what somebody does when a screen breaks.
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Deliberately silent. There is nowhere left to complain to.
  }
}
