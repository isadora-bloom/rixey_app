import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { toast } from './components/ui/Toast'
import { ApiError } from './utils/api'
import { reportError } from './utils/reportError'

// Safety net: if any apiFetch promise rejects without a try/catch, surface it as a toast
// instead of failing silently. Belt-and-suspenders for the silent-save bug class.
window.addEventListener('unhandledrejection', (event) => {
  const err = event.reason
  if (err instanceof ApiError) {
    toast.error(err.message || 'Something went wrong saving — please try again.')
    event.preventDefault()
    return
  }
  // Anything else that got this far is a real fault nobody handled. An
  // ApiError is deliberately not reported: a server that is down would have
  // every browser reporting it, repeatedly, to the server that is down.
  reportError(err)
})

// ErrorBoundary only sees errors thrown during render. One thrown from an
// event handler, a timer or a callback goes straight past it, and used to go
// nowhere at all.
window.addEventListener('error', (event) => {
  reportError(event.error || event.message)
})

// Belt-and-braces alongside the listener above: assigning window.onerror
// catches the same runtime errors through the older global-handler API, in
// case anything ever runs before the listener is attached. reportError
// dedupes by message + first stack line internally, so a storm of the same
// fault (a render loop, say) still reaches the venue once, not once per
// handler per occurrence.
window.onerror = function (message, source, lineno, colno, error) {
  reportError(error || message)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
