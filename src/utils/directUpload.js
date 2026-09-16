import { API_URL } from '../config/api'
import { apiFetch } from './api'
import { supabase } from '../lib/supabase'

/**
 * Direct-to-storage media upload for walkthrough recordings and photos.
 *
 * The old route posted the whole file as one multipart body to the server,
 * which then wrote it on to Supabase Storage itself. A ninety-minute
 * recording routinely beat both the storage bucket's size cap and Railway's
 * ~50s proxy timeout on the way through, so a real meeting could be recorded
 * in full and still fail to save. This asks the server for a signed URL,
 * uploads straight to storage — never touching the Railway proxy — then
 * tells the server the object is there so it can write the media row.
 *
 * Falls back to the old multipart POST when /begin 404s, which covers the
 * short window where the client has deployed ahead of the server.
 *
 * @param {object} opts
 * @param {string} opts.walkthroughId
 * @param {Blob} opts.blob
 * @param {'audio'|'photo'} opts.kind
 * @param {string} opts.mimetype
 * @param {string} opts.filename
 * @param {object} [opts.extra] extra fields for the /complete body and the multipart fallback (e.g. duration_secs)
 * @returns {Promise<object>} the saved media row
 */
export async function uploadMediaDirect({ walkthroughId, blob, kind, mimetype, filename, extra = {} }) {
  let begin = null
  try {
    begin = await apiFetch(`${API_URL}/api/admin/walkthroughs/${walkthroughId}/media/begin`, {
      method: 'POST',
      body: JSON.stringify({ kind, mimetype, filename, size: blob.size }),
    })
  } catch (err) {
    // Only a missing route falls back — a real failure (bad session, refused
    // wedding) should surface exactly as it would for any other write.
    if (err.status !== 404) throw err
  }

  if (begin?.key && begin?.token && begin?.signedUrl) {
    const { error: uploadError } = await supabase.storage
      .from('day-of-media')
      .uploadToSignedUrl(begin.key, begin.token, blob, { contentType: mimetype })
    if (uploadError) throw new Error(uploadError.message || 'The upload to storage failed.')

    const saved = await apiFetch(`${API_URL}/api/admin/walkthroughs/${walkthroughId}/media/complete`, {
      method: 'POST',
      body: JSON.stringify({ key: begin.key, kind, mimetype, size: blob.size, ...extra }),
    })
    if (!saved?.id) throw new Error('The server did not confirm it saved.')
    return saved
  }

  // Fallback: the old single-request multipart route, for a client ahead of
  // its server.
  const form = new FormData()
  form.append('file', new File([blob], filename, { type: mimetype }))
  for (const [k, v] of Object.entries(extra)) form.append(k, String(v))
  const saved = await apiFetch(`${API_URL}/api/admin/walkthroughs/${walkthroughId}/media`, { method: 'POST', body: form })
  if (!saved?.id) throw new Error('The server did not confirm it saved.')
  return saved
}
