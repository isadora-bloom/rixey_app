/**
 * Recordings, held on the device until the server has definitely got them.
 *
 * Two meetings were lost on 16 August: Chris & Emily, and the Tatyana Rivera
 * tour. Both walkthroughs exist with no audio and no notes, and nothing ever
 * reached Supabase storage. The only recordings that have ever survived were
 * 13 seconds and 141 seconds long.
 *
 * The old recorder made that inevitable rather than unlucky. It called
 * `rec.start()` with no timeslice, so the entire meeting sat in one in-memory
 * blob until Stop was pressed, and it uploaded that blob exactly once. Any
 * interruption at all lost everything:
 *
 *   - the phone locking or the tab being evicted, so `onstop` never ran
 *   - an expired session, which apiFetch refuses before it sends
 *   - a dropped connection at the end of a ninety-minute meeting
 *
 * and on failure the catch showed a toast and let the blob fall out of scope.
 * A toast is not a copy. There was no retry and no way to get the audio back.
 *
 * So audio is written here, to IndexedDB, every few seconds while it is being
 * recorded, and is only deleted once the upload has returned a row id. If the
 * browser dies mid-meeting the chunks are still on disk and are offered back
 * on the next load. Nothing is ever held in one place.
 *
 * IndexedDB rather than localStorage because this is binary and can be tens of
 * megabytes; localStorage would neither hold it nor survive it.
 */

const DB_NAME = 'rixey-recordings'
const DB_VERSION = 1
const META = 'recordings'
const CHUNKS = 'chunks'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(CHUNKS)) {
        const s = db.createObjectStore(CHUNKS, { keyPath: ['recordingId', 'seq'] })
        s.createIndex('byRecording', 'recordingId')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(db, stores, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode)
    let result
    t.oncomplete = () => resolve(result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
    result = fn(t)
  })
}

/** Available at all? Private browsing and old WebViews can refuse. */
export function recordingStoreAvailable() {
  return typeof indexedDB !== 'undefined'
}

export async function beginRecording({ walkthroughId, mimeType, label }) {
  const db = await openDb()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const meta = {
    id,
    walkthroughId,
    mimeType: mimeType || 'audio/webm',
    label: label || null,
    startedAt: new Date().toISOString(),
    // 'recording' until Stop is pressed. A row still saying 'recording' on the
    // next page load means the browser went away mid-meeting, which is worth
    // saying out loud rather than presenting as a normal pending upload.
    status: 'recording',
    durationSecs: null,
    chunks: 0,
    bytes: 0,
    lastError: null,
  }
  await tx(db, [META], 'readwrite', t => t.objectStore(META).put(meta))
  return id
}

/**
 * One chunk, written as it arrives.
 *
 * Awaited by the caller so a failing disk surfaces while there is still time to
 * do something about it, rather than at the end when the audio is already gone.
 */
export async function appendChunk(id, blob) {
  const db = await openDb()
  return tx(db, [META, CHUNKS], 'readwrite', t => {
    const metaStore = t.objectStore(META)
    const get = metaStore.get(id)
    get.onsuccess = () => {
      const meta = get.result
      if (!meta) return
      const seq = meta.chunks
      t.objectStore(CHUNKS).put({ recordingId: id, seq, blob })
      metaStore.put({ ...meta, chunks: seq + 1, bytes: meta.bytes + (blob.size || 0) })
    }
  })
}

export async function finishRecording(id, { durationSecs } = {}) {
  const db = await openDb()
  return tx(db, [META], 'readwrite', t => {
    const store = t.objectStore(META)
    const get = store.get(id)
    get.onsuccess = () => {
      if (get.result) store.put({ ...get.result, status: 'pending', durationSecs: durationSecs ?? null })
    }
  })
}

export async function noteUploadError(id, message) {
  const db = await openDb()
  return tx(db, [META], 'readwrite', t => {
    const store = t.objectStore(META)
    const get = store.get(id)
    get.onsuccess = () => {
      if (get.result) store.put({ ...get.result, status: 'pending', lastError: String(message || '') })
    }
  })
}

/**
 * Everything not yet confirmed by the server, newest first.
 *
 * Deliberately not filtered by walkthrough: a recording made against a meeting
 * that was later deleted, or made while the page was on a different screen,
 * would otherwise be invisible for ever. Better to show it somewhere than
 * nowhere.
 */
export async function listPending(walkthroughId = null) {
  if (!recordingStoreAvailable()) return []
  const db = await openDb()
  const all = await tx(db, [META], 'readonly', t => {
    const req = t.objectStore(META).getAll()
    req.onsuccess = () => { req._out = req.result }
    return req
  }).then(req => req._out || [])
  return all
    .filter(r => r.status !== 'uploaded')
    .filter(r => !walkthroughId || r.walkthroughId === walkthroughId)
    .filter(r => r.chunks > 0)
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
}

export async function getRecordingBlob(id) {
  const db = await openDb()
  const [meta, chunks] = await Promise.all([
    tx(db, [META], 'readonly', t => {
      const req = t.objectStore(META).get(id)
      req.onsuccess = () => { req._out = req.result }
      return req
    }).then(r => r._out),
    tx(db, [CHUNKS], 'readonly', t => {
      const req = t.objectStore(CHUNKS).index('byRecording').getAll(id)
      req.onsuccess = () => { req._out = req.result }
      return req
    }).then(r => r._out || []),
  ])
  if (!meta || !chunks.length) return null
  chunks.sort((a, b) => a.seq - b.seq)
  return new Blob(chunks.map(c => c.blob), { type: meta.mimeType })
}

/** Called only once the server has returned a row. Nothing else deletes audio. */
export async function discardRecording(id) {
  const db = await openDb()
  return tx(db, [META, CHUNKS], 'readwrite', t => {
    t.objectStore(META).delete(id)
    const idx = t.objectStore(CHUNKS).index('byRecording')
    const req = idx.openKeyCursor(IDBKeyRange.only(id))
    req.onsuccess = () => {
      const cur = req.result
      if (!cur) return
      t.objectStore(CHUNKS).delete(cur.primaryKey)
      cur.continue()
    }
  })
}

export function extensionFor(mimeType) {
  const m = String(mimeType || '')
  if (m.includes('mp4')) return 'mp4'
  if (m.includes('mpeg')) return 'mp3'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('wav')) return 'wav'
  return 'webm'
}

/**
 * The last resort: put the file on the user's own disk.
 *
 * If the upload cannot be made to work, whoever recorded the meeting should
 * still end the day holding the audio. An email attachment beats a toast.
 */
export async function downloadRecording(id, filename) {
  const blob = await getRecordingBlob(id)
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return true
}
