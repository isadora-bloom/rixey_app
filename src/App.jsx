import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
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
import Preview from './pages/Preview'
import VendorPortal from './pages/VendorPortal'
import WeddingWebsite from './pages/WeddingWebsite'
import NotFound from './pages/NotFound'

// A tab left open across a deploy asks for a chunk that no longer exists on
// the server once the old build is gone, and the browser reports that as
// "Failed to fetch dynamically imported module" (Firefox and Safari word it
// differently, but mean the same thing). That used to land straight on the
// error boundary, which reads like the app broke when really it just needs
// the new index.html. Reload once — sessionStorage stops a genuinely broken
// chunk from reloading forever — and only fall through to the error boundary
// if it still fails after that.
const STALE_CHUNK_RELOAD_KEY = 'rp-stale-chunk-reload'
const STALE_CHUNK_PATTERN = /fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i

function lazyWithReload(factory) {
  return lazy(() =>
    factory()
      .then(mod => {
        // A later deploy during the same tab session deserves its own retry.
        sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY)
        return mod
      })
      .catch(err => {
        const isStaleChunk = STALE_CHUNK_PATTERN.test(String(err?.message || ''))
        if (isStaleChunk && !sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, '1')
          window.location.reload()
          // The reload is already underway; never settle so nothing renders
          // an error in the moment before the page goes away.
          return new Promise(() => {})
        }
        throw err
      })
  )
}

// Lazy-load admin routes to keep couples' bundle smaller
const Admin = lazyWithReload(() => import('./pages/Admin'))
const GmailCallback = lazyWithReload(() => import('./pages/GmailCallback'))
const ZoomCallback = lazyWithReload(() => import('./pages/ZoomCallback'))
const PrintView = lazyWithReload(() => import('./pages/PrintView'))

// Loading fallback for lazy routes
function AdminLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <svg className="w-8 h-8 animate-spin text-slate-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-slate-600">Loading...</p>
      </div>
    </div>
  )
}

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
                    <Suspense fallback={<AdminLoadingFallback />}>
                      <Admin />
                    </Suspense>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/gmail-callback"
                element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoadingFallback />}>
                      <GmailCallback />
                    </Suspense>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/zoom-callback"
                element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoadingFallback />}>
                      <ZoomCallback />
                    </Suspense>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/print/:weddingId"
                element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoadingFallback />}>
                      <PrintView />
                    </Suspense>
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
