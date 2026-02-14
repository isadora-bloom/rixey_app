import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    // Check if we have an access token in the URL (from email link)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    if (!hashParams.get('access_token')) {
      setError('Invalid or expired reset link. Please request a new one.')
    }
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Password updated successfully!')
      setTimeout(() => navigate('/'), 2000)
    }

    setLoading(false)
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 transition bg-cream-50"

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-sage-700 mb-2">Rixey Manor</h1>
          <p className="text-sage-500 text-lg">Reset Your Password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-cream-200">
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-sage-600 mb-1">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-sage-600 mb-1">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-sage-50 text-sage-700 px-4 py-3 rounded-lg text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sage-600 text-white py-3 rounded-lg font-medium hover:bg-sage-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sage-500 hover:text-sage-700 text-sm transition"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
