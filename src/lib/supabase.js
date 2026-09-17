import { createClient } from '@supabase/supabase-js'
import { processLock } from '@supabase/auth-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// Every request the auth library makes goes through this. A token refresh
// that started while the connection was down never resolved, and the
// library holds its in-memory lock until it does, so every getSession after
// that waited ten seconds and gave up ("Lock acquisition timed out after
// 10000ms") until the tab was reloaded. A request that gets no answer in
// twenty seconds now fails, which releases the lock and lets the next
// attempt go.
const REQUEST_TIMEOUT_MS = 20_000
function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('request timed out')), REQUEST_TIMEOUT_MS)
  // Respect a caller's own signal as well as ours.
  if (init.signal) init.signal.addEventListener('abort', () => controller.abort(init.signal.reason), { once: true })
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

// Android Chrome PWAs (standalone home-screen apps) sometimes hang on
// `navigator.locks.request` due to storage partitioning, then abort with
// "signal is aborted without reason". Force the in-memory lock instead.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: processLock },
  global: { fetch: fetchWithTimeout },
})

/**
 * One getSession at a time, shared by everybody who wants one.
 *
 * gotrue serialises auth work behind a single lock. Two callers were asking
 * independently at page load — AuthContext bootstrapping the user, and
 * api.js wanting a token for the first request — and if either triggered a
 * token refresh it held the lock for a network round trip while the other sat
 * out its ten second timeout:
 *
 *   Lock "lock:sb-...-auth-token" acquisition timed out after 10000ms
 *
 * Nothing broke, because api.js keeps the last good token when the lookup
 * fails. But a console full of red is how a real fault hides in plain sight,
 * and the guest list crash sat unnoticed for twenty hours in exactly that kind
 * of noise.
 *
 * The promise is released once it settles, so this collapses a burst into one
 * call without ever handing back a stale session later.
 */
let sessionInFlight = null

export function getSessionOnce() {
  if (!sessionInFlight) {
    sessionInFlight = supabase.auth.getSession()
      .finally(() => { sessionInFlight = null })
  }
  return sessionInFlight
}
