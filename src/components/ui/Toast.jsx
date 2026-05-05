import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)

let externalDispatch = null

function dispatchToast(message, opts) {
  if (externalDispatch) externalDispatch(message, opts)
}

export function toast(message, opts) { dispatchToast(message, opts) }
toast.success = (m, o) => dispatchToast(m, { ...o, variant: 'success' })
toast.error = (m, o) => dispatchToast(m, { ...o, variant: 'error' })
toast.info = (m, o) => dispatchToast(m, { ...o, variant: 'info' })

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idCounter = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const push = useCallback((message, opts = {}) => {
    const id = ++idCounter.current
    const variant = opts.variant || 'info'
    const duration = opts.duration ?? (variant === 'error' ? 7000 : 3000)
    setToasts(t => [...t, { id, message: String(message ?? ''), variant }])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  useEffect(() => {
    externalDispatch = push
    return () => { if (externalDispatch === push) externalDispatch = null }
  }, [push])

  const value = {
    toast: push,
    success: (m, o) => push(m, { ...o, variant: 'success' }),
    error: (m, o) => push(m, { ...o, variant: 'error' }),
    info: (m, o) => push(m, { ...o, variant: 'info' }),
    dismiss,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <ToastViewport toasts={toasts} dismiss={dismiss} />,
        document.body
      )}
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, dismiss }) {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map(t => {
        const border =
          t.variant === 'error' ? 'border-rose-500' :
          t.variant === 'success' ? 'border-sage-500' :
          'border-stone-400'
        return (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm bg-white border-l-4 ${border} flex items-start gap-3 animate-in slide-in-from-right`}
          >
            <span className="flex-1 text-stone-700 whitespace-pre-wrap break-words">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-stone-400 hover:text-stone-600 leading-none text-lg"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
