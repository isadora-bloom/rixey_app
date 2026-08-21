import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { API_URL } from '../config/api'
import { apiFetch } from '../utils/api'
import { toast } from '../components/ui/Toast'
import {
  recordingStoreAvailable, beginRecording, appendChunk, finishRecording,
  noteUploadError, listPending, getRecordingBlob, discardRecording,
  downloadRecording, extensionFor,
} from '../utils/recordingStore'

/**
 * One recorder for the whole app, living above the router.
 *
 * It used to live inside the walkthrough panel, which meant the recording was
 * only as long-lived as that screen. Clicking to another couple unmounted the
 * component, took the MediaRecorder reference with it, and lost the meeting
 * without a word. That is the likeliest way the two on 16 August went.
 *
 * Up here nothing unmounts it, so recording carries on while you move around
 * the portal: open the couple's timeline, check a vendor, look at the guest
 * list. The bar at the top of the screen is the proof it is still going.
 *
 * Audio still lands in IndexedDB every five seconds and is still only deleted
 * once the server has returned a row. Being harder to interrupt is not the same
 * as being safe, and the recovery path is the part that actually saves a
 * meeting.
 */

const RecorderContext = createContext(null)

export function useRecorder() {
  const ctx = useContext(RecorderContext)
  if (!ctx) throw new Error('useRecorder must be used inside RecorderProvider')
  return ctx
}

const CHUNK_MS = 5000

export function RecorderProvider({ children }) {
  // { id, walkthroughId, label, mimeType } while recording, else null.
  const [active, setActive] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [pending, setPending] = useState([])
  const [busyId, setBusyId] = useState(null)
  // Bumped whenever a recording is filed, so an open panel can refetch without
  // the provider needing to know anything about panels.
  const [lastSaved, setLastSaved] = useState(null)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const wakeLockRef = useRef(null)
  const startedAtRef = useRef(0)

  const refreshPending = useCallback(async () => {
    if (!recordingStoreAvailable()) return
    try { setPending(await listPending()) } catch { /* never block recording on this */ }
  }, [])

  useEffect(() => { refreshPending() }, [refreshPending])

  /**
   * Keep the machine awake for the length of the meeting.
   *
   * A laptop that dims and sleeps mid-meeting suspends the tab, and the first
   * anyone knows is silence. The lock is dropped by the browser every time the
   * tab is hidden and is not restored on its own, so it is re-taken on the way
   * back. Not supported everywhere, and a missing lock is not a reason to
   * refuse to record.
   */
  const holdScreenAwake = useCallback(async () => {
    try { wakeLockRef.current = await navigator.wakeLock?.request('screen') } catch { /* fine */ }
  }, [])

  const releaseScreen = useCallback(() => {
    try { wakeLockRef.current?.release() } catch { /* fine */ }
    wakeLockRef.current = null
  }, [])

  const uploadStored = useCallback(async (rec) => {
    setBusyId(rec.id)
    let ok = false
    let blobSize = 0
    try {
      const blob = await getRecordingBlob(rec.id)
      if (!blob) throw new Error('The audio for that recording is no longer on this device.')
      blobSize = blob.size
      const form = new FormData()
      form.append('file', new File([blob], `voice-note.${extensionFor(rec.mimeType)}`, { type: rec.mimeType }))
      if (rec.durationSecs) form.append('duration_secs', String(rec.durationSecs))
      // Back to the meeting it was recorded against, never whichever one is on
      // screen. Filing a walkthrough's audio under the wrong couple is its own
      // kind of lost.
      const saved = await apiFetch(
        `${API_URL}/api/admin/walkthroughs/${rec.walkthroughId}/media`,
        { method: 'POST', body: form }
      )
      if (!saved?.id) throw new Error('The server did not confirm it saved.')
      await discardRecording(rec.id)
      setLastSaved({ walkthroughId: rec.walkthroughId, media: saved, at: Date.now() })
      toast.success('Recording saved. Transcribing now.')
      ok = true
    } catch (err) {
      // "The object exceeded the maximum allowed size" is storage's wording and
      // it tells you nothing you can act on: not how big, not how big is
      // allowed, not whether the audio still exists. Say all three.
      const tooBig = /exceeded the maximum allowed size/i.test(err.message || '')
      const sizeMb = blobSize ? (blobSize / 1024 / 1024).toFixed(0) : null
      const message = tooBig
        ? `it is ${sizeMb ? `${sizeMb}MB, over the ` : 'over the '}50MB limit for a single upload. The audio is still here, and recordings made from now on are far smaller.`
        : err.message
      await noteUploadError(rec.id, message)
      toast.error(`That recording is safe on this device but did not upload: ${message}`)
    }
    setBusyId(null)
    await refreshPending()
    return ok
  }, [refreshPending])

  const start = useCallback(async ({ walkthroughId, label }) => {
    if (recorderRef.current) {
      toast.error('Something is already recording. Stop that first.')
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      // Let the browser pick its own container. Chrome gives webm, Safari mp4,
      // and forcing one of them is how this breaks on half the machines.
      //
      // The bitrate is ours to set, though, and leaving it to the browser cost
      // a 108-minute planning meeting on 20 August. Chrome's default came out
      // at 188 kbps — 81 MB an hour — against a 50 MB ceiling on storage, so
      // anything past about thirty-seven minutes could not be saved at all. The
      // phone defaulted to 130 kbps and died at around fifty-four.
      //
      // 32 kbps Opus is speech, which is all this ever records and all Deepgram
      // needs; music would be a different question and this is never music. It
      // is 14 MB an hour, so the ceiling moves out past three hours, and every
      // upload from a phone on venue wifi gets six times quicker as well.
      const rec = new MediaRecorder(stream, { audioBitsPerSecond: 32000 })
      const id = await beginRecording({ walkthroughId, mimeType: rec.mimeType, label })

      rec.ondataavailable = async e => {
        if (!e.data?.size) return
        try {
          await appendChunk(id, e.data)
        } catch (err) {
          // Losing the ability to save mid-meeting is worth interrupting for.
          // Carrying on quietly is how ninety minutes turns into nothing.
          toast.error(`Cannot save audio on this device: ${err.message}. Stop and check disk space.`)
        }
      }

      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        releaseScreen()
        const secs = Math.round((Date.now() - startedAtRef.current) / 1000)
        await finishRecording(id, { durationSecs: secs })
        setActive(null)
        await refreshPending()
        await uploadStored({ id, walkthroughId, mimeType: rec.mimeType, durationSecs: secs })
      }

      startedAtRef.current = Date.now()
      // Five-second slices. Without a timeslice the whole meeting sits in one
      // in-memory blob until Stop, so anything that interrupts the page loses
      // all of it. With one, the audio is on disk within five seconds.
      rec.start(CHUNK_MS)
      recorderRef.current = rec
      setActive({ id, walkthroughId, label: label || null, mimeType: rec.mimeType })
      setElapsed(0)
      holdScreenAwake()
      await refreshPending()
      return true
    } catch (err) {
      toast.error(`Could not start recording: ${err.message}. Check the browser has microphone permission.`)
      return false
    }
  }, [holdScreenAwake, releaseScreen, refreshPending, uploadStored])

  const stop = useCallback(() => {
    const rec = recorderRef.current
    recorderRef.current = null
    if (!rec) return
    // Flush whatever is buffered before stopping, so the last few seconds of a
    // meeting are not the bit that goes missing.
    try { rec.requestData() } catch { /* best effort */ }
    try { rec.stop() } catch { /* best effort */ }
  }, [])

  const download = useCallback(async (rec) => {
    const name = `meeting-${String(rec.startedAt).slice(0, 16).replace(/[:T]/g, '-')}.${extensionFor(rec.mimeType)}`
    const ok = await downloadRecording(rec.id, name)
    if (!ok) toast.error('The audio for that recording is no longer on this device.')
  }, [])

  const discard = useCallback(async (rec) => {
    await discardRecording(rec.id)
    await refreshPending()
  }, [refreshPending])

  // The clock. A recording with no elapsed time gives no way to tell "still
  // going" from "died twenty minutes ago".
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [active])

  useEffect(() => {
    if (!active) return
    const onVisible = () => { if (document.visibilityState === 'visible') holdScreenAwake() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [active, holdScreenAwake])

  // Closing the tab mid-meeting is survivable now, since the chunks are on
  // disk, but it is still worth one question.
  useEffect(() => {
    if (!active) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])

  const value = {
    active, elapsed, pending, busyId, lastSaved,
    start, stop, uploadStored, download, discard, refreshPending,
    available: recordingStoreAvailable()
      && typeof window !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia
      && typeof MediaRecorder !== 'undefined',
  }

  return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>
}
