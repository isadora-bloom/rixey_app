// Wrapper around fetch that throws on non-2xx responses so callers don't have
// to remember to check res.ok. Usage is identical to fetch() but errors bubble.

export async function apiFetch(url, options = {}) {
  const res = await fetch(url, options)
  if (!res.ok) {
    let msg
    try { msg = (await res.json()).error } catch { msg = res.statusText }
    throw new Error(msg || `HTTP ${res.status}`)
  }
  // Return parsed JSON, or null for 204 No Content
  if (res.status === 204) return null
  return res.json()
}
