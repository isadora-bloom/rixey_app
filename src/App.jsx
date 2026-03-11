import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Login from './pages/Login'
import AdminLogin from './pages/AdminLogin'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Vendors from './pages/Vendors'
import Accommodations from './pages/Accommodations'
import Admin from './pages/Admin'
import GmailCallback from './pages/GmailCallback'
import ZoomCallback from './pages/ZoomCallback'
import Preview from './pages/Preview'
import PrintView from './pages/PrintView'
import VendorPortal from './pages/VendorPortal'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — no auth */}
          <Route path="/preview" element={<Preview />} />
          <Route path="/vendor/:token" element={<VendorPortal />} />

          {/* Client login */}
          <Route path="/" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Staff/Admin login */}
          <Route path="/staff" element={<AdminLogin />} />

          {/* Client routes */}
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

          {/* Admin routes - protected by AdminRoute */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/gmail-callback"
            element={
              <AdminRoute>
                <GmailCallback />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/zoom-callback"
            element={
              <AdminRoute>
                <ZoomCallback />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/print/:weddingId"
            element={
              <AdminRoute>
                <PrintView />
              </AdminRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
