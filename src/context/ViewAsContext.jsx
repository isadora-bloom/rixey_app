import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { toast } from '../components/ui/Toast'

/**
 * "View as couple": the venue looking at the couple's own portal, read-only.
 *
 * Grace on the phone with a couple needs to see the screen they are describing,
 * not her version of it. So AdminWeddingProfile renders the real Dashboard with
 * this context set, rather than a second copy of the couple's screens that
 * would drift from the first one within a fortnight.
 *
 * The context carries the wedding to read and a stand-in profile, because
 * Dashboard otherwise loads both from the signed-in user, and the signed-in
 * user here is Grace.
 *
 *   { weddingId, profile, wedding }   when viewing, null otherwise
 *
 * Nothing in here grants access. Admin tokens already pass the server's
 * weddingAccess check for any wedding, so every loader works unchanged.
 */
const ViewAsContext = createContext(null)

// Same shape as useAuth next door, and the same fast-refresh complaint, which
// is about hot reload rather than about the code.
// eslint-disable-next-line react-refresh/only-export-components
export const useViewAs = () => useContext(ViewAsContext)

export const READ_ONLY_MESSAGE = 'Read-only while viewing as the couple'

// Module-level mirror of the context, for the guard below, which runs outside
// React and cannot read a context.
let readOnly = false

/**
 * True while a view-as session is open. Safe to call from anywhere, including
 * modules that have no React around them.
 *
 * This is the hook apiFetch would use if the guard ever moves in there, which
 * is the tidier home for it. See the handover note.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function isViewingAsCouple() {
  return readOnly
}

// A request that only reads is always fine. Everything else is a write.
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Supabase's own auth traffic is the one exception. A token refresh is a POST,
// and refusing it would sign the admin out in the middle of a phone call, which
// is a worse outcome than the thing this guard exists to prevent.
const ALWAYS_ALLOWED = [/\/auth\/v1\//]

/**
 * Should this request be refused while viewing as the couple?
 * Split out so the decision is one readable thing rather than a condition
 * buried inside the patched fetch.
 */
function shouldBlockRequest(method, url) {
  if (READ_METHODS.has(String(method || 'GET').toUpperCase())) return false
  return !ALWAYS_ALLOWED.some(re => re.test(String(url || '')))
}

/**
 * Catch every write in one place.
 *
 * The obvious version of this is a flag inside apiFetch, and that is the right
 * long-term shape (see the note in the handover). But roughly fifty components
 * import apiFetch directly and a handful still write through the Supabase
 * client, so nothing passed down from Dashboard as a prop can reach them all,
 * and a guard that catches most writes is worse than none: it reads as safe.
 *
 * Patching fetch for the life of the view-as session catches apiFetch,
 * useAutosave, the finalise buttons, the Supabase client and any raw fetch
 * still about, with no edits to files this change does not own. It is removed
 * again the moment the session ends.
 *
 * Blocked requests come back as a real 405 rather than a rejected promise, so
 * callers take their normal error path and show their normal message instead of
 * tipping into an unhandled rejection. 405 and not 403: apiFetch rewrites 401
 * and 403 into "you have been signed out", which would be a lie here.
 */
function installFetchGuard(onBlocked) {
  const original = window.fetch

  function guardedFetch(input, init) {
    const fromRequest = typeof input === 'object' && input !== null ? input : null
    const method = init?.method || fromRequest?.method || 'GET'
    const url = typeof input === 'string' ? input : (fromRequest?.url ?? String(input))

    if (shouldBlockRequest(method, url)) {
      onBlocked()
      return Promise.resolve(new Response(
        JSON.stringify({ error: READ_ONLY_MESSAGE }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      ))
    }
    return original.call(window, input, init)
  }

  window.fetch = guardedFetch
  return () => {
    // Only stand down if nobody has patched fetch on top of ours since.
    if (window.fetch === guardedFetch) window.fetch = original
  }
}

export function ViewAsProvider({ value, children }) {
  const active = !!value
  // An autosave can fire a dozen writes in a second. One toast is the message;
  // twelve is a fault of its own.
  const lastToastRef = useRef(0)

  useEffect(() => {
    if (!active) return
    readOnly = true
    const uninstall = installFetchGuard(() => {
      const now = Date.now()
      if (now - lastToastRef.current < 1500) return
      lastToastRef.current = now
      toast.error(READ_ONLY_MESSAGE)
    })
    return () => {
      readOnly = false
      uninstall()
    }
  }, [active])

  const ctx = useMemo(() => value || null, [value])

  return (
    <ViewAsContext.Provider value={ctx}>
      {children}
    </ViewAsContext.Provider>
  )
}
