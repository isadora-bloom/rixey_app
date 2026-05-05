import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Debounced autosave hook.
 *
 * Usage:
 *   const { schedule, flush, state } = useAutosave(
 *     async (payload) => { await apiFetch('/api/foo', { method: 'POST', body: JSON.stringify(payload) }) },
 *     { delay: 1200, errorMessage: 'Could not save timeline' }
 *   )
 *   // call schedule(currentState) on every change; <SaveIndicator state={state} />
 *
 * Behavior:
 *   - Debounces by `delay` ms after the last `schedule(payload)` call.
 *   - `flush()` saves immediately with the latest pending payload.
 *   - Auto-flushes on window blur and on unmount so nothing in-flight is lost.
 *   - Out-of-order responses can't override newer state (token-checked).
 *   - On error, surfaces a toast with `errorMessage` and the server message;
 *     state returns to 'idle' so the indicator doesn't lie about success.
 */
export function useAutosave(saveFn, { delay = 1200, errorMessage = 'Could not save', toastError } = {}) {
  const [state, setState] = useState('idle')
  const pendingRef = useRef(null)
  const hasPendingRef = useRef(false)
  const timerRef = useRef(null)
  const tokenRef = useRef(0)
  const saveFnRef = useRef(saveFn)
  const toastErrorRef = useRef(toastError)
  saveFnRef.current = saveFn
  toastErrorRef.current = toastError

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!hasPendingRef.current) return
    const payload = pendingRef.current
    pendingRef.current = null
    hasPendingRef.current = false
    const myToken = ++tokenRef.current
    setState('saving')
    try {
      await saveFnRef.current(payload)
      if (myToken === tokenRef.current) {
        setState('saved')
      }
    } catch (err) {
      if (myToken === tokenRef.current) {
        setState('idle')
      }
      const msg = err?.message ? `${errorMessage}: ${err.message}` : errorMessage
      if (toastErrorRef.current) toastErrorRef.current(msg)
    }
  }, [errorMessage])

  const schedule = useCallback((payload) => {
    pendingRef.current = payload
    hasPendingRef.current = true
    setState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { flush() }, delay)
  }, [delay, flush])

  useEffect(() => {
    const onBlur = () => { if (hasPendingRef.current) flush() }
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      if (hasPendingRef.current) flush()
    }
  }, [flush])

  return { schedule, flush, state }
}
