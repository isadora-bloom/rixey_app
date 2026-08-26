import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { RecorderProvider } from './context/RecorderContext'
import RecordingBar from './components/RecordingBar'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Login from './pages/Login'
import AdminLogin from './pages/AdminLogin'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Accommodations from './pages/Accommodations'
import Admin from './pages/Admin'
import GmailCallback from './pages/GmailCallback'
import ZoomCallback from './pages/ZoomCallback'
import Preview from './pages/Preview'
import PrintView from './pages/PrintView'
import VendorPortal from './pages/VendorPortal'
import WeddingWebsite from './pages/WeddingWebsite'
import NotFound from './pages/NotFound'

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            {/*
              The recorder sits outside Routes on purpose. Inside, changing
              screen unmounts it and the meeting stops without saying so.
            */}
            <RecorderProvider>
            <RecordingBar />
            <Routes>
              {/* Public routes — no auth */}
              <Route path="/preview" element={<Preview />} />
              <Route path="/vendor/:token" element={<VendorPortal />} />
              <Route path="/w/:slug" element={<WeddingWebsite />} />

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
              {/* The vendor directory used to be its own page, showing the
                  same table without the photos or bios. It is a dashboard
                  section now; this keeps old links and bookmarks working. */}
              <Route path="/vendors" element={<Navigate to="/dashboard?section=preferred-vendors" replace />} />
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

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </RecorderProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
