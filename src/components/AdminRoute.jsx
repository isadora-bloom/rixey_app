import { useState, useEffect } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (user && profile === null && !loading) {
      const timer = setTimeout(() => setTimedOut(true), 5000)
      return () => clearTimeout(timer)
    }
    setTimedOut(false)
  }, [user, profile, loading])

  // Wait for auth to finish loading
  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-sage-600">Loading...</div>
      </div>
    )
  }

  // Not logged in - redirect to admin login
  if (!user) {
    return <Navigate to="/staff" replace />
  }

  // User exists but profile not loaded yet - keep waiting (with timeout)
  if (user && profile === null) {
    if (timedOut) {
      return (
        <div className="min-h-screen bg-cream-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <h2 className="text-lg font-serif text-sage-800 mb-2">Profile not found</h2>
            <p className="text-sage-600 text-sm mb-6">
              Could not load your admin profile. Your account may not have admin access, or there may be a connection issue.
            </p>
            <Link
              to="/staff"
              className="inline-block px-4 py-2 bg-sage-600 text-white rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors"
            >
              Return to login
            </Link>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-sage-600">Loading profile...</div>
      </div>
    )
  }

  // Logged in but not admin - redirect to client dashboard
  if (!profile?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  // Admin verified
  return children
}
