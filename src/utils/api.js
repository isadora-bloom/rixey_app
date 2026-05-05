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
 * Thrown by apiFetch on non-2xx responses.
 * The global unhandledrejection handler in main.jsx surfaces these as toasts,
 * so a forgotten try/catch never causes silent data loss.
 */
export class ApiError extends Error {
  constructor(message, { status, url } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.url = url
  }
}

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
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    let msg
    try { msg = (await res.json()).error } catch { msg = res.statusText }
    throw new ApiError(msg || `HTTP ${res.status}`, { status: res.status, url })
  }
  if (res.status === 204) return null
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  return res.json()
}
