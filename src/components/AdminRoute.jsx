import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()

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

  // User exists but profile not loaded yet - keep waiting
  if (user && profile === null) {
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
