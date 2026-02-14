import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || '${API_URL}'

export default function ZoomCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('Processing...')

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      setStatus('Authorization denied. Redirecting...')
      setTimeout(() => navigate('/admin'), 2000)
      return
    }

    if (code) {
      fetch(`${API_URL}/api/zoom/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setStatus('Zoom connected successfully! Redirecting...')
          } else {
            setStatus('Failed to connect: ' + (data.error || 'Unknown error'))
          }
          setTimeout(() => navigate('/admin'), 2000)
        })
        .catch(() => {
          setStatus('Connection error. Redirecting...')
          setTimeout(() => navigate('/admin'), 2000)
        })
    } else {
      setStatus('No authorization code. Redirecting...')
      setTimeout(() => navigate('/admin'), 2000)
    }
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-8 text-center">
        <div className="w-12 h-12 border-4 border-sage-200 border-t-sage-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sage-700">{status}</p>
      </div>
    </div>
  )
}
