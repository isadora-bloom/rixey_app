import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Vendors from './pages/Vendors'
import Accommodations from './pages/Accommodations'
import Admin from './pages/Admin'
import GmailCallback from './pages/GmailCallback'
import ZoomCallback from './pages/ZoomCallback'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendors"
            element={
              <ProtectedRoute>
                <Vendors />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accommodations"
            element={
              <ProtectedRoute>
                <Accommodations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/gmail-callback"
            element={
              <ProtectedRoute>
                <GmailCallback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/zoom-callback"
            element={
              <ProtectedRoute>
                <ZoomCallback />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
