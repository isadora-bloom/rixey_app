import { supabase, getSessionOnce } from '../lib/supabase'

/**
 * The current access token, cached.
 *
 * This used to call supabase.auth.getSession() on every single API request.
 * gotrue serialises those behind one lock, and a screen like the admin
 * dashboard fires dozens of requests at once, so they queue up and start
 * timing out:
 *
 *   Lock "lock:sb-...-auth-token" acquisition timed out after 10000ms
 *
 * The old catch then returned null, which is the damaging part: the request
 * went out with **no Authorization header at all** and came back 404 or 401.
 * So a busy page intermittently looked like missing data or a broken feature,
 * when the token was there the whole time.
 *
 * Now the token is held in memory and only re-read when it is missing or close
 * to expiry, which turns dozens of lock acquisitions per page into roughly
 * one. onAuthStateChange keeps it current across sign-in, sign-out and refresh.
 */
let cachedToken = null
let cachedExpiry = 0        // seconds since epoch, as Supabase reports it
let inFlight = null         // de-duplicates concurrent refreshes

supabase.auth.onAuthStateChange((_event, session) => {
  cachedToken = session?.access_token || null
  cachedExpiry = session?.expires_at || 0
})

async function getAuthToken() {
  // 60s of headroom so a token never expires between here and the server.
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedExpiry - 60 > now) return cachedToken

  // Several callers arriving at once share one lookup rather than one each,
  // which is what caused the pile-up in the first place.
  if (!inFlight) {
    // Shared with AuthContext, so the two of them are one lock acquisition at
    // page load rather than two fighting over it.
    inFlight = getSessionOnce()
      .then(({ data: { session } }) => {
        cachedToken = session?.access_token || null
        cachedExpiry = session?.expires_at || 0
        return cachedToken
      })
      .catch(() => cachedToken)   // keep the last good token rather than dropping auth
      .finally(() => { inFlight = null })
  }
  return inFlight
}

/**
 * Build headers with auth token included.
 * Merges with any existing headers passed in.
 */
export async function authHeaders(extra = {}) {
  const token = await getAuthToken()
  const headers = { 'Content-Type': 'application/json', ...extra }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/**
 * Thrown by apiFetch on non-2xx responses.
 * The global unhandledrejection handler in main.jsx surfaces these as toasts,
 * so a forgotten try/catch never causes silent data loss.
 */
export class ApiError extends Error {
  constructor(message, { status, url, signedOut = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.url = url
    // True when the request failed because there was no usable session, rather
    // than because the save itself was wrong. Different problem, different fix.
    this.signedOut = signedOut
  }
}

/**
 * Paths that legitimately have no signed-in user. Mirrors PUBLIC_PREFIXES in
 * server/middleware/weddingAccess.js — guests RSVPing have no account and never
 * will, so these must not be blocked for want of a token.
 */
const PUBLIC_PATHS = [
  '/api/w/', '/api/rsvp/', '/api/vendor-portal/',
  '/api/wedding-website/check-slug/', '/api/health',
]

const SIGNED_OUT_MESSAGE =
  'You have been signed out, so that did not save. Sign in again and re-enter it.'

/**
 * Wrapper around fetch that:
 * 1. Automatically includes the Supabase auth token
 * 2. Throws ApiError on non-2xx responses (no need to check res.ok)
 * 3. Returns parsed JSON (or null for 204)
 *
 * Usage: const data = await apiFetch(`${API_URL}/api/foo`, { method: 'POST', body: JSON.stringify(...) })
 */
export async function apiFetch(url, options = {}) {
  const headers = await authHeaders(options.headers)
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (isFormData) {
    delete headers['Content-Type']
  }
  // Never send a write with no credentials.
  //
  // Until 14 August the server accepted requests with no Authorization header
  // at all, so a browser that had lost its token carried on saving and nobody
  // could tell. Now those are refused, and the couple sees "Save failed —
  // please try again", which is the one thing that will never work: retrying a
  // dead session produces the same failure for ever.
  //
  // So catch it here, before the request leaves, and say the true thing.
  const method = String(options.method || 'GET').toUpperCase()
  const isPublicPath = PUBLIC_PATHS.some(p => url.includes(p))
  if (method !== 'GET' && method !== 'HEAD' && !isPublicPath && !headers['Authorization']) {
    throw new ApiError(SIGNED_OUT_MESSAGE, { status: 401, url, signedOut: true })
  }

  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    let msg
    try { msg = (await res.json()).error } catch { msg = res.statusText }
    // A refusal on a path that needed a session is a sign-in problem, whatever
    // wording the server chose. Say so rather than passing along "you do not
    // have access to this wedding", which reads like a permissions fault to
    // someone looking at their own wedding.
    if ((res.status === 401 || res.status === 403) && !isPublicPath) {
      throw new ApiError(SIGNED_OUT_MESSAGE, { status: res.status, url, signedOut: true })
    }
    throw new ApiError(msg || `HTTP ${res.status}`, { status: res.status, url })
  }
  if (res.status === 204) return null
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  return res.json()
}
