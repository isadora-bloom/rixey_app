import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../config/api'
import { apiFetch } from '../utils/api'
import { useToast } from './ui/Toast'
import { useAutosave } from '../hooks/useAutosave'
import SaveIndicator from './ui/SaveIndicator'
import {
  recordingStoreAvailable, beginRecording, appendChunk, finishRecording,
  noteUploadError, listPending, getRecordingBlob, discardRecording,
  downloadRecording, extensionFor,
} from '../utils/recordingStore'

const KINDS = [
  { value: 'final_walkthrough', label: 'Final walkthrough' },
  { value: 'planning_meeting', label: 'Planning meeting' },
  { value: 'site_visit', label: 'Site visit' },
  { value: 'rehearsal', label: 'Rehearsal' },
  { value: 'call', label: 'Call / meeting' },
]

// Mirrors WALKTHROUGH_TARGETS on the server. Labels only — the server decides
// what is actually writable and re-checks every section it is handed.
const SECTION_LABELS = {
  checklist: 'To-do list',
  allergies: 'Allergy registry',
  decor: 'Decor inventory',
  bar: 'Bar shopping list',
  shuttle: 'Shuttle schedule',
  vendor: 'Vendor checklist',
}

const kindLabel = k => KINDS.find(x => x.value === k)?.label || 'Walkthrough'

/**
 * Photos and voice notes.
 *
 * Half of a walkthrough is pointing at something, and "that corner" does not
 * survive being typed. Audio is recorded and stored even though nothing can
 * read it yet: Rixey has no transcription provider, and a recording nobody
 * has transcribed still beats losing what was said.
 */
function MediaStrip({ walkthroughId, media, onChange, toastError, onUseTranscript }) {
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  // Recordings on this device that the server has not confirmed yet.
  const [pending, setPending] = useState([])
  const [busyId, setBusyId] = useState(null)
  const recorderRef = useRef(null)
  const recordingIdRef = useRef(null)
  const startedAt = useRef(0)
  const fileRef = useRef(null)
  const wakeLockRef = useRef(null)

  // Every unconfirmed recording on this device, not only this meeting's.
  //
  // Filtering to the open walkthrough is how a stranded recording stays
  // invisible: click from Chris & Emily to another couple and the audio you
  // just made is on disk and shown nowhere.
  const refreshPending = async () => {
    if (!recordingStoreAvailable()) return
    try { setPending(await listPending()) } catch { /* never block recording on this */ }
  }

  useEffect(() => { refreshPending() }, [walkthroughId])

  // A meeting in progress must survive the phone deciding the screen has been
  // idle. Without this the screen locks, Safari suspends the recorder, and the
  // first anyone knows is silence. Not supported everywhere, and a missing
  // wake lock is not a reason to refuse to record.
  const holdScreenAwake = async () => {
    try { wakeLockRef.current = await navigator.wakeLock?.request('screen') } catch { /* fine */ }
  }
  const releaseScreen = () => {
    try { wakeLockRef.current?.release() } catch { /* fine */ }
    wakeLockRef.current = null
  }

  /** Photos, which are already a file and have nothing to lose. */
  const uploadFile = async (file, extra = {}) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      for (const [k, v] of Object.entries(extra)) form.append(k, v)
      const saved = await apiFetch(`${API_URL}/api/admin/walkthroughs/${walkthroughId}/media`, { method: 'POST', body: form })
      onChange(prev => [...prev, saved])
    } catch (err) {
      toastError(`Could not save that: ${err.message}`)
    }
    setUploading(false)
  }

  /**
   * Send a stored recording, and only forget it once the server answers.
   *
   * The order matters and is the whole point: read from IndexedDB, upload,
   * check the response, then delete. The previous version deleted nothing
   * because it had never saved anything.
   */
  const uploadStored = async (rec) => {
    setBusyId(rec.id)
    try {
      const blob = await getRecordingBlob(rec.id)
      if (!blob) throw new Error('The audio for that recording is no longer on this device.')
      const ext = extensionFor(rec.mimeType)
      const form = new FormData()
      form.append('file', new File([blob], `voice-note.${ext}`, { type: rec.mimeType }))
      if (rec.durationSecs) form.append('duration_secs', String(rec.durationSecs))
      // Back to the meeting it was recorded against, which is not necessarily
      // the one on screen. Filing a walkthrough's audio under whichever couple
      // happened to be open is its own kind of lost.
      const target = rec.walkthroughId || walkthroughId
      const saved = await apiFetch(`${API_URL}/api/admin/walkthroughs/${target}/media`, { method: 'POST', body: form })
      if (!saved?.id) throw new Error('The server did not confirm it saved.')
      if (target === walkthroughId) onChange(prev => [...prev, saved])
      await discardRecording(rec.id)
    } catch (err) {
      // Kept, not dropped. This is the branch that used to lose a meeting.
      await noteUploadError(rec.id, err.message)
      toastError(`That recording is still on this device but did not upload: ${err.message}`)
    }
    setBusyId(null)
    await refreshPending()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Let the browser pick its own container. Chrome gives webm, Safari mp4,
      // and forcing one of them is how this breaks on half the phones.
      const rec = new MediaRecorder(stream)
      const id = await beginRecording({ walkthroughId, mimeType: rec.mimeType })
      recordingIdRef.current = id

      rec.ondataavailable = async e => {
        if (!e.data?.size) return
        try {
          await appendChunk(id, e.data)
        } catch (err) {
          // Losing the ability to save mid-meeting is worth interrupting for.
          // Carrying on silently is how ninety minutes turns into nothing.
          toastError(`Cannot save audio on this device: ${err.message}. Stop and check storage space.`)
        }
      }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        releaseScreen()
        const secs = Math.round((Date.now() - startedAt.current) / 1000)
        await finishRecording(id, { durationSecs: secs })
        await refreshPending()
        setUploading(true)
        await uploadStored({ id, walkthroughId, mimeType: rec.mimeType, durationSecs: secs })
        setUploading(false)
        recordingIdRef.current = null
      }

      startedAt.current = Date.now()
      // Five-second slices. Without a timeslice the entire meeting sits in one
      // in-memory blob until Stop, so anything that interrupts the page loses
      // all of it. With one, the audio is on disk within five seconds and stays
      // there.
      rec.start(5000)
      recorderRef.current = rec
      setRecording(true)
      setElapsed(0)
      holdScreenAwake()
      await refreshPending()
    } catch (err) {
      toastError(`Could not start recording: ${err.message}. Check the browser has microphone permission.`)
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    releaseScreen()
  }

  /**
   * Leaving the screen must not lose the meeting.
   *
   * This is the likeliest way the two meetings on 16 August went: recorded on a
   * laptop, and at some point during it somebody clicked to another walkthrough
   * or another couple. MediaStrip unmounts, the recorder reference goes with
   * it, `onstop` never runs, and the entire in-memory blob is collected. No
   * error, no toast, nothing in the console. The button just was not there any
   * more.
   *
   * Now the recorder is stopped properly on the way out, which flushes the last
   * chunk and marks the recording pending, and the banner above will offer it
   * back on any walkthrough screen.
   */
  useEffect(() => {
    return () => {
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        try { rec.requestData() } catch { /* best effort */ }
        try { rec.stop() } catch { /* best effort */ }
      }
      recorderRef.current = null
      try { wakeLockRef.current?.release() } catch { /* fine */ }
    }
  }, [])

  // A visible clock, because a recording with no elapsed time gives no way to
  // tell "still going" from "died twenty minutes ago".
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [recording])

  // Closing the tab mid-meeting is recoverable now, since the chunks are on
  // disk, but it is still worth one question.
  useEffect(() => {
    if (!recording) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [recording])

  // The screen wake lock is dropped by the browser whenever the tab is hidden,
  // and is not restored on its own. Re-take it on the way back.
  useEffect(() => {
    if (!recording) return
    const onVisible = () => { if (document.visibilityState === 'visible') holdScreenAwake() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [recording])

  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const remove = async (m) => {
    const snapshot = media
    onChange(prev => prev.filter(x => x.id !== m.id))
    try { await apiFetch(`${API_URL}/api/admin/walkthrough-media/${m.id}`, { method: 'DELETE' }) }
    catch (err) { onChange(snapshot); toastError(`Could not delete that: ${err.message}`) }
  }

  const canRecord = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
  const photos = media.filter(m => m.kind === 'photo')
  const audio = media.filter(m => m.kind === 'audio')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
          onChange={async e => {
            const files = Array.from(e.target.files || [])
            for (const f of files) await uploadFile(f)
            e.target.value = ''
          }}
        />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
          className="text-xs px-3 py-1.5 rounded-lg border border-cream-300 text-sage-600 hover:bg-cream-50 transition disabled:opacity-50">
          {uploading ? 'Saving…' : '+ Photo'}
        </button>

        {canRecord ? (
          <button type="button" disabled={uploading}
            onClick={recording ? stopRecording : startRecording}
            className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${
              recording ? 'bg-red-500 border-red-500 text-white' : 'border-cream-300 text-sage-600 hover:bg-cream-50'
            }`}>
            {recording ? `■ Stop recording  ${mmss(elapsed)}` : '● Record a voice note'}
          </button>
        ) : (
          <span className="text-xs text-sage-400">Recording not supported on this browser</span>
        )}

        {recording && (
          <span className="text-xs text-sage-500">
            Saving to this device as it records. Keep this tab open.
          </span>
        )}
      </div>

      {/*
        Recordings held on this device that the server has not confirmed.
        Anything here is audio that exists and is not filed, which is exactly
        the state that used to be invisible.
      */}
      {pending.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-amber-900">
            {pending.length === 1 ? 'A recording on this device has not been saved to the portal yet' :
              `${pending.length} recordings on this device have not been saved to the portal yet`}
          </p>
          {pending.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
              <span className="font-medium">
                {new Date(r.startedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              <span className="text-amber-700">
                {r.durationSecs ? mmss(r.durationSecs) : `${Math.round(r.bytes / 1024 / 1024 * 10) / 10} MB`}
                {r.status === 'recording' && ' · interrupted mid-recording'}
                {r.walkthroughId && r.walkthroughId !== walkthroughId && ' · recorded against another meeting'}
              </span>
              {r.lastError && <span className="text-red-700 basis-full">Last attempt: {r.lastError}</span>}
              <span className="grow" />
              <button
                type="button" disabled={busyId === r.id}
                onClick={() => uploadStored(r)}
                className="px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition disabled:opacity-50"
              >
                {busyId === r.id ? 'Uploading…' : 'Upload it now'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await downloadRecording(r.id, `meeting-${r.startedAt.slice(0, 16).replace(/[:T]/g, '-')}.${extensionFor(r.mimeType)}`)
                  if (!ok) toastError('The audio for that recording is no longer on this device.')
                }}
                className="px-2.5 py-1 rounded-lg border border-amber-400 text-amber-900 hover:bg-amber-100 transition"
              >
                Download a copy
              </button>
              <button
                type="button"
                onClick={async () => {
                  // Deliberately worded as a deletion, and deliberately not
                  // offered until an upload has been tried at least once.
                  if (!window.confirm('Delete this recording from this device? The audio cannot be got back.')) return
                  await discardRecording(r.id)
                  await refreshPending()
                }}
                className="px-2.5 py-1 rounded-lg text-amber-700 hover:text-red-700 transition"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {audio.length > 0 && (
        <div className="space-y-2">
          {audio.map(m => (
            <div key={m.id} className="flex items-center gap-3">
              <audio controls src={m.url} className="h-8 flex-1 min-w-0" />
              <span className="text-xs text-sage-400 shrink-0">
                {m.duration_secs ? `${Math.floor(m.duration_secs / 60)}:${String(m.duration_secs % 60).padStart(2, '0')}` : ''}
              </span>
              <button type="button" onClick={() => remove(m)} className="text-xs text-sage-400 hover:text-red-500 shrink-0">Delete</button>
            </div>
          ))}
          {audio.map(m => m.transcript ? (
            <div key={`t-${m.id}`} className="border border-cream-200 rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="text-xs font-medium text-sage-600">What was said</p>
                {/* Dropped into the notes rather than filed directly: the
                    organiser already turns notes into reviewable items, and
                    a transcript should go through the same gate as anything
                    typed by hand. */}
                <button
                  type="button"
                  onClick={() => onUseTranscript(m.transcript)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-sage-300 text-sage-600 hover:bg-sage-50 transition shrink-0"
                >
                  Add to notes
                </button>
              </div>
              <p className="text-xs text-sage-600 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">{m.transcript}</p>
            </div>
          ) : null)}
          <p className="text-xs text-sage-400">
            Transcribing takes about a minute per ten minutes of audio. Refresh if it hasn&apos;t appeared.
          </p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map(m => (
            <div key={m.id} className="relative group">
              <a href={m.url} target="_blank" rel="noreferrer">
                <img src={m.url} alt={m.caption || 'Walkthrough photo'} className="w-20 h-20 object-cover rounded-lg border border-cream-200" />
              </a>
              <button type="button" onClick={() => remove(m)}
                className="absolute -top-1.5 -right-1.5 bg-white border border-cream-300 rounded-full w-5 h-5 text-xs text-sage-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, onChange, busy }) {
  const [open, setOpen] = useState(false)
  const applied = item.status === 'applied'
  const failed = item.status === 'failed'
  const skipped = item.status === 'skipped'
  const accepted = item.status === 'accepted'

  return (
    <div className={`border rounded-xl px-4 py-3 ${
      failed ? 'border-red-200 bg-red-50'
      : applied ? 'border-sage-200 bg-sage-50/50'
      : skipped ? 'border-cream-200 bg-cream-50/60 opacity-60'
      : accepted ? 'border-sage-300 bg-white' : 'border-cream-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm ${skipped ? 'line-through text-sage-400' : 'text-sage-800'}`}>{item.summary}</p>
          <p className="text-xs text-sage-400 mt-1">
            {item.section ? (SECTION_LABELS[item.section] || item.section) : 'Planning note'}
            {item.confidence != null && <span className="ml-2">{item.confidence}% sure</span>}
            {applied && <span className="ml-2 text-sage-600">filed to {item.applied_table}</span>}
            {failed && <span className="ml-2 text-red-600">failed: {item.apply_error}</span>}
          </p>
        </div>
        {!applied && (
          <div className="flex gap-1 shrink-0">
            <button
              type="button" disabled={busy}
              onClick={() => onChange(item, { status: accepted ? 'proposed' : 'accepted' })}
              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                accepted ? 'bg-sage-600 text-white border-sage-600' : 'border-sage-300 text-sage-600 hover:bg-sage-50'
              }`}
            >
              {accepted ? 'Accepted' : 'Accept'}
            </button>
            <button
              type="button" disabled={busy}
              onClick={() => onChange(item, { status: skipped ? 'proposed' : 'skipped' })}
              className="text-xs px-2.5 py-1 rounded-lg border border-cream-300 text-sage-500 hover:bg-cream-50 transition"
            >
              {skipped ? 'Restore' : 'Skip'}
            </button>
          </div>
        )}
      </div>

      <button type="button" onClick={() => setOpen(o => !o)} className="text-xs text-sage-400 underline mt-2">
        {open ? 'Hide' : 'Show'} what was said
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {/* The quote is the point: it lets you check the parser against the
              room rather than trusting the tidy sentence above. */}
          <p className="text-xs text-sage-600 italic border-l-2 border-cream-300 pl-3 whitespace-pre-wrap">
            {item.source_text}
          </p>
          {Object.keys(item.proposed || {}).length > 0 && (
            <div className="text-xs text-sage-500">
              {Object.entries(item.proposed).map(([k, v]) => (
                <div key={k}><span className="text-sage-400">{k}:</span> {String(v)}</div>
              ))}
            </div>
          )}
          {!applied && (
            <select
              value={item.section || ''}
              disabled={busy}
              onChange={e => onChange(item, { section: e.target.value || null })}
              className="text-xs border border-cream-300 rounded-lg px-2 py-1"
            >
              <option value="">File as a planning note</option>
              {Object.entries(SECTION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Takes either a wedding or an enquiry. A tour is recorded, transcribed and
 * organised by exactly this component: building a second one would have meant
 * two recorders drifting apart, and the one used less often would be the one
 * that quietly stopped working.
 *
 * The difference is only at the end. A tour has no wedding to file an allergy
 * or a decor item into, so its organised items wait on the enquiry and come
 * across if the couple books.
 */
export default function WalkthroughNotes({ weddingId, enquiryId }) {
  const { error: toastError, success: toastSuccess } = useToast()
  const [list, setList] = useState([])
  const [active, setActive] = useState(null)
  const [items, setItems] = useState([])
  const [notes, setNotes] = useState('')
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const loadedFor = useRef(null)

  const owner = weddingId || enquiryId
  const isEnquiry = !weddingId && !!enquiryId

  const load = async () => {
    setLoading(true)
    try {
      const path = isEnquiry
        ? `${API_URL}/api/admin/enquiries/${enquiryId}/walkthroughs`
        : `${API_URL}/api/admin/walkthroughs/${weddingId}`
      const data = await apiFetch(path)
      setList(data || [])
      if (data?.length) await open(data[0])
    } catch (err) {
      toastError(`Could not load notes: ${err.message}`)
    }
    setLoading(false)
  }

  const open = async (w) => {
    setActive(w)
    setNotes(w.raw_notes || '')
    loadedFor.current = w.id
    try { setItems(await apiFetch(`${API_URL}/api/admin/walkthroughs/${w.id}/items`) || []) }
    catch { setItems([]) }
    try { setMedia(await apiFetch(`${API_URL}/api/admin/walkthroughs/${w.id}/media`) || []) }
    catch { setMedia([]) }
  }

  // Declared after load/open so the reference is not read before either exists.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (owner) load() }, [owner])

  // Transcription finishes after the upload has already responded, so poll
  // while anything is still waiting. Stops as soon as every recording has
  // text, and gives up after five minutes rather than polling for ever on a
  // recording that failed.
  useEffect(() => {
    if (!active) return
    const pending = media.some(m => m.kind === 'audio' && !m.transcript)
    if (!pending) return
    let stop = false
    const startedAt = Date.now()
    const tick = async () => {
      if (stop || Date.now() - startedAt > 5 * 60 * 1000) return
      try {
        const fresh = await apiFetch(`${API_URL}/api/admin/walkthroughs/${active.id}/media`)
        if (!stop && Array.isArray(fresh)) setMedia(fresh)
      } catch { /* a failed poll is not worth telling anyone about */ }
      if (!stop) timer = setTimeout(tick, 8000)
    }
    let timer = setTimeout(tick, 8000)
    return () => { stop = true; clearTimeout(timer) }
  }, [active, media])

  const { schedule: scheduleSave, flush: flushSave, state: saveState } = useAutosave(
    async (payload) => { await apiFetch(`${API_URL}/api/admin/walkthroughs/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload.body) }) },
    { delay: 1200, errorMessage: 'Could not save your notes', toastError }
  )

  // Autosaves as she types. This is the one thing that must never fail
  // quietly: everything else can be redone, a lost walkthrough cannot.
  useEffect(() => {
    if (!active || loadedFor.current !== active.id) return
    if (notes === (active.raw_notes || '')) return
    scheduleSave({ id: active.id, body: { raw_notes: notes } })
  }, [notes, active, scheduleSave])

  // Say what kind of meeting it is up front. This used to always create a final
  // walkthrough and leave you to change it afterwards, which is fine until you
  // are sitting down with a couple and recording starts before you notice.
  const create = async (kind = 'final_walkthrough') => {
    setBusy('create')
    try {
      const w = await apiFetch(`${API_URL}/api/admin/walkthroughs`, {
        method: 'POST',
        body: JSON.stringify(isEnquiry ? { enquiryId, kind: kind === 'final_walkthrough' ? 'tour' : kind } : { weddingId, kind }),
      })
      setList(prev => [w, ...prev])
      await open(w)
    } catch (err) { toastError(`Could not start a meeting record: ${err.message}`) }
    setBusy('')
  }

  const organise = async () => {
    if (!active) return
    setBusy('organise')
    try {
      await flushSave()
      const res = await apiFetch(`${API_URL}/api/admin/walkthroughs/${active.id}/organise`, { method: 'POST' })
      setItems(res.items || [])
      toastSuccess(`Sorted into ${res.parsed} item${res.parsed === 1 ? '' : 's'}. Nothing filed yet.`)
    } catch (err) { toastError(`Could not organise these notes: ${err.message}`) }
    setBusy('')
  }

  const changeItem = async (item, patch) => {
    const snapshot = items
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i))
    try { await apiFetch(`${API_URL}/api/admin/walkthrough-items/${item.id}`, { method: 'PUT', body: JSON.stringify(patch) }) }
    catch (err) { setItems(snapshot); toastError(`Could not update that item: ${err.message}`) }
  }

  const acceptAll = async () => {
    const pending = items.filter(i => i.status === 'proposed')
    for (const i of pending) await changeItem(i, { status: 'accepted' })
  }

  const apply = async () => {
    if (!active) return
    setBusy('apply')
    try {
      const res = await apiFetch(`${API_URL}/api/admin/walkthroughs/${active.id}/apply`, { method: 'POST' })
      setItems(await apiFetch(`${API_URL}/api/admin/walkthroughs/${active.id}/items`) || [])
      toastSuccess(`Filed ${res.applied} item${res.applied === 1 ? '' : 's'}${res.failed ? `, ${res.failed} failed` : ''}.`)
    } catch (err) { toastError(`Could not file these: ${err.message}`) }
    setBusy('')
  }

  const share = async () => {
    if (!active) return
    setBusy('share')
    try {
      const updated = await apiFetch(`${API_URL}/api/admin/walkthroughs/${active.id}`, {
        method: 'PUT',
        body: JSON.stringify({ shared_summary: active.shared_summary || '', shared: !active.shared_at }),
      })
      setActive(updated)
      setList(prev => prev.map(w => w.id === updated.id ? updated : w))
    } catch (err) { toastError(`Could not change sharing: ${err.message}`) }
    setBusy('')
  }

  if (loading) return <div className="text-sage-400 text-sm text-center py-10">Loading walkthroughs…</div>

  const pending = items.filter(i => i.status === 'proposed')
  const accepted = items.filter(i => i.status === 'accepted')
  const done = items.filter(i => i.status === 'applied')

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-sage-700">Meetings &amp; walkthroughs</h2>
          <p className="text-sage-500 text-sm mt-0.5">
            Record it or type as you go. Sage sorts it afterwards, and nothing is filed until you say so.
          </p>
        </div>
        <div className="shrink-0 flex gap-2">
          <button onClick={() => create('planning_meeting')} disabled={busy === 'create'}
            className="text-sm px-4 py-2 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition disabled:opacity-50">
            + Planning meeting
          </button>
          <button onClick={() => create('final_walkthrough')} disabled={busy === 'create'}
            className="text-sm px-4 py-2 rounded-lg border border-sage-300 text-sage-700 hover:bg-cream-50 transition disabled:opacity-50">
            + Walkthrough
          </button>
        </div>
      </div>

      {list.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {list.map(w => (
            <button key={w.id} onClick={() => open(w)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                active?.id === w.id ? 'bg-sage-100 border-sage-300 text-sage-700' : 'border-cream-300 text-sage-500 hover:bg-cream-50'
              }`}>
              {kindLabel(w.kind)} · {w.occurred_on}
            </button>
          ))}
        </div>
      )}

      {!active ? (
        <div className="border border-dashed border-cream-300 rounded-xl py-12 text-center">
          <p className="text-sage-400 text-sm">No walkthroughs yet. Hit New before you set off.</p>
        </div>
      ) : (
        <>
          <div className="border border-cream-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={active.kind}
                onChange={e => { const kind = e.target.value; setActive(a => ({ ...a, kind })); scheduleSave({ id: active.id, body: { kind } }) }}
                className="text-sm border border-cream-300 rounded-lg px-2 py-1.5"
              >
                {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <input
                type="date" value={active.occurred_on || ''}
                onChange={e => { const occurred_on = e.target.value; setActive(a => ({ ...a, occurred_on })); scheduleSave({ id: active.id, body: { occurred_on } }) }}
                className="text-sm border border-cream-300 rounded-lg px-2 py-1.5"
              />
              <input
                type="text" placeholder="Who was there…" defaultValue={active.attendees || ''}
                onChange={e => scheduleSave({ id: active.id, body: { attendees: e.target.value } })}
                className="text-sm border border-cream-300 rounded-lg px-3 py-1.5 flex-1 min-w-[160px]"
              />
              <SaveIndicator state={saveState} />
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={12}
              placeholder={'Everything, in whatever order it comes.\n\narbor moving 6ft left\nceremony 4:30 not 4\nuncle Bill coeliac, needs separate prep\nchase the florist about delivery\n3 high chairs not 2'}
              className="w-full border border-cream-300 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-sage-300 resize-y"
            />
            <p className="text-xs text-sage-400">
              Saved as you type. This stays private to the venue whatever you file from it.
            </p>

            <MediaStrip
              walkthroughId={active.id}
              media={media}
              onChange={setMedia}
              toastError={toastError}
              onUseTranscript={(t) => setNotes(prev => (prev ? `${prev.trimEnd()}\n\n` : '') + t)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={organise} disabled={busy === 'organise' || !notes.trim()}
              className="text-sm px-4 py-2 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition disabled:opacity-50">
              {busy === 'organise' ? 'Reading…' : items.length ? 'Organise again' : 'Organise this'}
            </button>
            {pending.length > 0 && (
              <button onClick={acceptAll} className="text-sm px-4 py-2 rounded-lg border border-sage-300 text-sage-600 hover:bg-sage-50 transition">
                Accept all {pending.length}
              </button>
            )}
            {accepted.length > 0 && (
              <button onClick={apply} disabled={busy === 'apply'}
                className="text-sm px-4 py-2 rounded-lg bg-sage-700 text-white hover:bg-sage-800 transition disabled:opacity-50">
                {busy === 'apply' ? 'Filing…' : `File ${accepted.length} into the portal`}
              </button>
            )}
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              {done.length > 0 && (
                <p className="text-xs text-sage-500">{done.length} already filed. Re-organising leaves those alone.</p>
              )}
              {items.map(i => (
                <ItemRow key={i.id} item={i} onChange={changeItem} busy={!!busy} />
              ))}
            </div>
          )}

          {/* What the couple gets to see. Written by you, not by the parser. */}
          <div className="border border-cream-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-sage-700">Summary for the couple</p>
              <button onClick={share} disabled={busy === 'share'}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  active.shared_at ? 'bg-sage-600 text-white border-sage-600' : 'border-sage-300 text-sage-600 hover:bg-sage-50'
                }`}>
                {active.shared_at ? 'Shared with them' : 'Not shared'}
              </button>
            </div>
            <textarea
              rows={4}
              defaultValue={active.shared_summary || ''}
              onChange={e => { const v = e.target.value; setActive(a => ({ ...a, shared_summary: v })); scheduleSave({ id: active.id, body: { shared_summary: v } }) }}
              placeholder="What you agreed, in the words you would say to them."
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm resize-y"
            />
            <p className="text-xs text-sage-400">
              Only this box is ever visible to the couple. Your notes above are not.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
