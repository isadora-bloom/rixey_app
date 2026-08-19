import { createClient } from '@supabase/supabase-js'
import { processLock } from '@supabase/auth-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// Android Chrome PWAs (standalone home-screen apps) sometimes hang on
// `navigator.locks.request` due to storage partitioning, then abort with
// "signal is aborted without reason". Force the in-memory lock instead.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: processLock },
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
