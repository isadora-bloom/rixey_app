import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { toast } from './components/ui/Toast'
import { ApiError } from './utils/api'

// Safety net: if any apiFetch promise rejects without a try/catch, surface it as a toast
// instead of failing silently. Belt-and-suspenders for the silent-save bug class.
window.addEventListener('unhandledrejection', (event) => {
  const err = event.reason
  if (err instanceof ApiError) {
    toast.error(err.message || 'Something went wrong saving — please try again.')
    event.preventDefault()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
