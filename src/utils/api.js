import { supabase } from '../lib/supabase'

/**
 * Get the current user's auth token for API calls.
 * Returns the Bearer token string or null if not authenticated.
 */
async function getAuthToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch {
    return null
  }
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
 * Wrapper around fetch that:
 * 1. Automatically includes the Supabase auth token
 * 2. Throws on non-2xx responses so callers don't need to check res.ok
 * 3. Returns parsed JSON (or null for 204)
 *
 * Usage: const data = await apiFetch(`${API_URL}/api/foo`)
 */
export async function apiFetch(url, options = {}) {
  const headers = await authHeaders(options.headers)
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    let msg
    try { msg = (await res.json()).error } catch { msg = res.statusText }
    throw new Error(msg || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}
